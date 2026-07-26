import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync
} from 'fs'
import { dirname, join } from 'path'
import { Readable } from 'stream'
import { pipeline } from 'stream/promises'
import type {
  WhisperDownloadEvent,
  WhisperModelId,
  WhisperModelInfo,
  WhisperVariant
} from './whisperTypes'

export type { WhisperModelId, WhisperModelInfo, WhisperVariant } from './whisperTypes'

/**
 * The model catalog. Repos were verified live against the Hugging Face API and
 * every `sizeMB` is the **measured** sum of that variant's real ONNX file sizes
 * (2026-07-26) — not an estimate. `params`/`approxVramGB`/`relativeSpeed` come
 * from the published Whisper table, which is what the model-manager UI shows.
 */
export const WHISPER_CATALOG: ReadonlyArray<
  Omit<WhisperModelInfo, 'downloaded' | 'downloadedVariant'>
> = [
  {
    id: 'tiny',
    repo: 'Xenova/whisper-tiny',
    params: '39 M',
    sizeMB: { fp32: 144, q8: 39 },
    approxVramGB: 1,
    relativeSpeed: '~10x',
    multilingual: true
  },
  {
    id: 'tiny.en',
    repo: 'Xenova/whisper-tiny.en',
    params: '39 M',
    sizeMB: { fp32: 144, q8: 39 },
    approxVramGB: 1,
    relativeSpeed: '~10x',
    multilingual: false
  },
  {
    id: 'base',
    repo: 'Xenova/whisper-base',
    params: '74 M',
    sizeMB: { fp32: 278, q8: 73 },
    approxVramGB: 1,
    relativeSpeed: '~7x',
    multilingual: true
  },
  {
    id: 'base.en',
    repo: 'Xenova/whisper-base.en',
    params: '74 M',
    sizeMB: { fp32: 278, q8: 73 },
    approxVramGB: 1,
    relativeSpeed: '~7x',
    multilingual: false
  },
  {
    id: 'small',
    repo: 'Xenova/whisper-small',
    params: '244 M',
    sizeMB: { fp32: 923, q8: 238 },
    approxVramGB: 2,
    relativeSpeed: '~4x',
    multilingual: true
  },
  {
    id: 'small.en',
    repo: 'Xenova/whisper-small.en',
    params: '244 M',
    sizeMB: { fp32: 923, q8: 238 },
    approxVramGB: 2,
    relativeSpeed: '~4x',
    multilingual: false
  },
  {
    id: 'medium',
    repo: 'Xenova/whisper-medium',
    params: '769 M',
    sizeMB: { fp32: 2916, q8: 740 },
    approxVramGB: 5,
    relativeSpeed: '~2x',
    multilingual: true
  },
  {
    id: 'medium.en',
    repo: 'Xenova/whisper-medium.en',
    params: '769 M',
    sizeMB: { fp32: 4861, q8: 740 },
    approxVramGB: 5,
    relativeSpeed: '~2x',
    multilingual: false
  },
  {
    id: 'large-v3',
    repo: 'onnx-community/whisper-large-v3-ONNX',
    params: '1.55 B',
    sizeMB: { fp32: 5891, q8: 1738 },
    approxVramGB: 10,
    relativeSpeed: '1x',
    multilingual: true
  },
  {
    id: 'large-v3-turbo',
    repo: 'onnx-community/whisper-large-v3-turbo',
    params: '809 M',
    sizeMB: { fp32: 3086, q8: 1035 },
    approxVramGB: 6,
    relativeSpeed: '~8x',
    multilingual: true
  }
]

/** The default model (D-SB-4): small, multilingual, good enough to start. */
export const DEFAULT_WHISPER_MODEL: WhisperModelId = 'base'

/** Marker written after the atomic finalize; its presence means "complete". */
const COMPLETE_MARKER = '.hive-complete.json'

/** One entry of the HF tree API response we care about. */
interface TreeEntry {
  type: string
  path: string
  size?: number
}

export interface WhisperModelStore {
  list(): WhisperModelInfo[]
  status(id: WhisperModelId): { downloaded: boolean; variant: WhisperVariant | null }
  download(
    id: WhisperModelId,
    variant: WhisperVariant,
    onEvent: (event: WhisperDownloadEvent) => void
  ): Promise<void>
  remove(id: WhisperModelId): void
}

export interface WhisperStoreDeps {
  /** Injected so tests drive a fake registry without touching the network. */
  fetchFn?: typeof fetch
}

/** Root-level files every Transformers.js Whisper repo needs (those that exist). */
function isWantedRootFile(path: string): boolean {
  return /^[^/]+\.(json|txt)$/.test(path) && !/^quant(ize)?_config\.json$/.test(path)
}

/**
 * Which `onnx/` files belong to `variant` — including any `.onnx_data` sidecar.
 *
 * The sidecar is not a detail to skip: large repos (e.g.
 * `onnx-community/whisper-large-v3-turbo`) ship the external-data format, where
 * `encoder_model.onnx` is a **0-byte stub** and the real 2.4 GB of weights live
 * in `encoder_model.onnx_data`. Downloading only the `.onnx` would "succeed"
 * and then fail at session-create time. This is exactly why the file list comes
 * from the tree API rather than a hard-coded array (design OQ4).
 */
function isWantedOnnxFile(path: string, variant: WhisperVariant): boolean {
  const suffix = variant === 'q8' ? '_quantized' : ''
  return new RegExp(`^onnx/(encoder_model|decoder_model_merged)${suffix}\\.onnx(_data)?$`).test(
    path
  )
}

/**
 * Main-owned store of downloaded Whisper models (D-SB-4). Downloads are
 * **atomic**: every file lands in a sibling `.tmp-<id>` directory that is only
 * renamed into place once all bytes arrived, so an interrupted download can
 * never be mistaken for a complete model (the marker file is written last, and
 * only inside the finalized directory).
 *
 * `fetchFn` is injected so the whole download path — tree listing, byte
 * streaming, progress, atomic finalize, failure cleanup — is unit-testable
 * against a fake registry with no network.
 */
export function createWhisperModelStore(
  rootDir: string,
  deps: WhisperStoreDeps = {}
): WhisperModelStore {
  const fetchFn = deps.fetchFn ?? fetch

  const modelDir = (id: WhisperModelId): string => join(rootDir, id)
  const entry = (id: WhisperModelId): (typeof WHISPER_CATALOG)[number] => {
    const found = WHISPER_CATALOG.find((m) => m.id === id)
    if (!found) throw new Error(`whisper: unknown model "${id}"`)
    return found
  }

  function status(id: WhisperModelId): { downloaded: boolean; variant: WhisperVariant | null } {
    const marker = join(modelDir(id), COMPLETE_MARKER)
    if (!existsSync(marker)) return { downloaded: false, variant: null }
    try {
      const parsed: unknown = JSON.parse(readFileSync(marker, 'utf-8'))
      const variant = (parsed as { variant?: string } | null)?.variant
      return {
        downloaded: true,
        variant: variant === 'q8' || variant === 'fp32' ? variant : null
      }
    } catch {
      // A corrupt marker means we cannot trust the directory — treat as absent.
      return { downloaded: false, variant: null }
    }
  }

  function list(): WhisperModelInfo[] {
    return WHISPER_CATALOG.map((model) => {
      const state = status(model.id)
      return { ...model, downloaded: state.downloaded, downloadedVariant: state.variant }
    })
  }

  async function listRepoFiles(repo: string, variant: WhisperVariant): Promise<TreeEntry[]> {
    const wanted: TreeEntry[] = []
    for (const path of ['', '/onnx']) {
      const url = `https://huggingface.co/api/models/${repo}/tree/main${path}`
      const response = await fetchFn(url)
      if (!response.ok) {
        throw new Error(`whisper: model index unavailable (HTTP ${response.status})`)
      }
      const entries = (await response.json()) as TreeEntry[]
      for (const item of entries) {
        if (item.type !== 'file') continue
        if (path === '' ? isWantedRootFile(item.path) : isWantedOnnxFile(item.path, variant)) {
          wanted.push(item)
        }
      }
    }
    if (!wanted.some((f) => f.path.startsWith('onnx/'))) {
      throw new Error(`whisper: no ${variant} weights published for this model`)
    }
    return wanted
  }

  async function download(
    id: WhisperModelId,
    variant: WhisperVariant,
    onEvent: (event: WhisperDownloadEvent) => void
  ): Promise<void> {
    const finalDir = modelDir(id)
    const tempDir = join(rootDir, `.tmp-${id}`)

    try {
      // Inside the try on purpose: an unknown id must surface as an `error`
      // event like every other failure, never as a rejected promise the IPC
      // layer would see as an unhandled rejection.
      const { repo } = entry(id)
      const files = await listRepoFiles(repo, variant)
      const total = files.reduce((sum, f) => sum + (f.size ?? 0), 0)

      rmSync(tempDir, { recursive: true, force: true })
      mkdirSync(tempDir, { recursive: true })

      let loaded = 0
      for (const file of files) {
        const url = `https://huggingface.co/${repo}/resolve/main/${file.path}`
        const response = await fetchFn(url)
        if (!response.ok || !response.body) {
          throw new Error(`whisper: download failed for ${file.path} (HTTP ${response.status})`)
        }
        const target = join(tempDir, file.path)
        mkdirSync(dirname(target), { recursive: true })
        await pipeline(
          Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]),
          createWriteStream(target)
        )
        loaded += file.size ?? 0
        onEvent({ type: 'progress', id, loaded, total, file: file.path })
      }

      // Atomic finalize: the marker goes inside the temp dir, then one rename
      // publishes the whole model. A crash before this leaves only `.tmp-*`,
      // which `status()` never looks at.
      writeFileSync(
        join(tempDir, COMPLETE_MARKER),
        JSON.stringify({ variant, repo, completedAt: new Date().toISOString() })
      )
      rmSync(finalDir, { recursive: true, force: true })
      renameSync(tempDir, finalDir)
      onEvent({ type: 'done', id })
    } catch (error) {
      rmSync(tempDir, { recursive: true, force: true })
      onEvent({ type: 'error', id, message: (error as Error).message })
    }
  }

  function remove(id: WhisperModelId): void {
    rmSync(modelDir(id), { recursive: true, force: true })
  }

  return { list, status, download, remove }
}
