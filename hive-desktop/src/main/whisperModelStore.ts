import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statfsSync,
  statSync,
  truncateSync,
  writeFileSync
} from 'fs'
import { dirname, join } from 'path'
import { Readable, Transform } from 'stream'
import { pipeline } from 'stream/promises'
import type {
  WhisperDownloadErrorKind,
  WhisperDownloadEvent,
  WhisperDownloadFailure,
  WhisperModelId,
  WhisperModelInfo,
  WhisperVariant
} from './whisperTypes'

export type { WhisperModelId, WhisperModelInfo, WhisperVariant } from './whisperTypes'

/**
 * The model catalog. Repos were verified live against the Hugging Face API and
 * every `sizeMB`/`maxFileMB` is the **measured** sum (and maximum) of that
 * variant's real ONNX file sizes — not an estimate; totals taken 2026-07-26,
 * per-file maxima 2026-08-23. `params`/`approxVramGB`/`relativeSpeed` come
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
    maxFileMB: { fp32: 113, q8: 29 },
    approxVramGB: 1,
    relativeSpeed: '~10x',
    multilingual: true
  },
  {
    id: 'tiny.en',
    repo: 'Xenova/whisper-tiny.en',
    params: '39 M',
    sizeMB: { fp32: 144, q8: 39 },
    maxFileMB: { fp32: 113, q8: 29 },
    approxVramGB: 1,
    relativeSpeed: '~10x',
    multilingual: false
  },
  {
    id: 'base',
    repo: 'Xenova/whisper-base',
    params: '74 M',
    sizeMB: { fp32: 278, q8: 73 },
    maxFileMB: { fp32: 199, q8: 51 },
    approxVramGB: 1,
    relativeSpeed: '~7x',
    multilingual: true
  },
  {
    id: 'base.en',
    repo: 'Xenova/whisper-base.en',
    params: '74 M',
    sizeMB: { fp32: 278, q8: 73 },
    maxFileMB: { fp32: 199, q8: 51 },
    approxVramGB: 1,
    relativeSpeed: '~7x',
    multilingual: false
  },
  {
    id: 'small',
    repo: 'Xenova/whisper-small',
    params: '244 M',
    sizeMB: { fp32: 923, q8: 238 },
    maxFileMB: { fp32: 587, q8: 150 },
    approxVramGB: 2,
    relativeSpeed: '~4x',
    multilingual: true
  },
  {
    id: 'small.en',
    repo: 'Xenova/whisper-small.en',
    params: '244 M',
    sizeMB: { fp32: 923, q8: 238 },
    maxFileMB: { fp32: 587, q8: 150 },
    approxVramGB: 2,
    relativeSpeed: '~4x',
    multilingual: false
  },
  {
    id: 'medium',
    repo: 'Xenova/whisper-medium',
    params: '769 M',
    sizeMB: { fp32: 2916, q8: 740 },
    maxFileMB: { fp32: 1744, q8: 441 },
    approxVramGB: 5,
    relativeSpeed: '~2x',
    multilingual: true
  },
  {
    id: 'medium.en',
    repo: 'Xenova/whisper-medium.en',
    params: '769 M',
    sizeMB: { fp32: 4861, q8: 740 },
    maxFileMB: { fp32: 1945, q8: 441 },
    approxVramGB: 5,
    relativeSpeed: '~2x',
    multilingual: false
  },
  {
    id: 'large-v3',
    repo: 'onnx-community/whisper-large-v3-ONNX',
    params: '1.55 B',
    sizeMB: { fp32: 5891, q8: 1738 },
    maxFileMB: { fp32: 3458, q8: 1123 },
    approxVramGB: 10,
    relativeSpeed: '1x',
    multilingual: true
  },
  {
    id: 'large-v3-turbo',
    repo: 'onnx-community/whisper-large-v3-turbo',
    params: '809 M',
    sizeMB: { fp32: 3086, q8: 1035 },
    maxFileMB: { fp32: 2430, q8: 615 },
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

/** Name of the resume manifest inside a partial download's temp directory. */
const PARTIAL_MARKER = '.hive-partial.json'

/** How many times one file is re-attempted before the download gives up. */
const MAX_FILE_ATTEMPTS = 4

/** Backoff between attempts, in ms — short enough to survive a blip, bounded. */
const RETRY_BACKOFF_MS = [1_000, 4_000, 10_000]

/** Headroom demanded on top of the download itself, so the disk never fills flat. */
const DISK_SLACK_BYTES = 256 * 1024 * 1024

/** Progress is published at most this often — a 3 GB file emits chunks constantly. */
const PROGRESS_INTERVAL_MS = 250

/** What `status()` answers: is it usable, and in which precision. */
export interface WhisperModelStatus {
  downloaded: boolean
  variant: WhisperVariant | null
}

/**
 * A download that stopped, with the reason typed.
 *
 * `kind` exists so the renderer can say something useful. "The download
 * failed", the only sentence the previous surface could produce, is the same
 * words for a full disk, a dropped connection and a model the repo never
 * published — three problems with three different next steps.
 */
export class WhisperDownloadError extends Error {
  kind: WhisperDownloadErrorKind

  constructor(kind: WhisperDownloadErrorKind, message: string) {
    super(message)
    this.name = 'WhisperDownloadError'
    this.kind = kind
  }
}

/** Raised when the caller aborts. Never a failure — the user asked for it. */
export class WhisperDownloadCancelled extends Error {
  constructor() {
    super('whisper: download cancelled')
    this.name = 'WhisperDownloadCancelled'
  }
}

/** Turns any thrown value into the typed failure the record carries over IPC. */
export function toDownloadFailure(error: unknown): WhisperDownloadFailure {
  const detail = error instanceof Error ? error.message : String(error)
  if (error instanceof WhisperDownloadError) return { kind: error.kind, detail }
  return { kind: 'unknown', detail }
}

export interface DownloadOptions {
  /** Aborts the transfer. A cancelled download rejects with `WhisperDownloadCancelled`. */
  signal?: AbortSignal
}

export interface WhisperModelStore {
  list(): WhisperModelInfo[]
  status(id: WhisperModelId): WhisperModelStatus
  /**
   * Fetches one model, **resumably**. Rejects on failure (or cancellation)
   * rather than swallowing it into an event, so the manager above owns the
   * record's lifecycle in one place.
   */
  download(
    id: WhisperModelId,
    variant: WhisperVariant,
    onEvent: (event: WhisperDownloadEvent) => void,
    options?: DownloadOptions
  ): Promise<void>
  remove(id: WhisperModelId): void
  /** Drops a partial download's bytes — what "cancel" means on disk. */
  discardPartial(id: WhisperModelId): void
  /** How many bytes of `id` are already on disk from an interrupted attempt. */
  partialBytes(id: WhisperModelId): number
  /** Every directory a model's files may be read from. */
  searchRoots(): string[]
}

export interface WhisperStoreDeps {
  /** Injected so tests drive a fake registry without touching the network. */
  fetchFn?: typeof fetch
  /** Free bytes on the volume holding `rootDir`. Injected for the disk-space test. */
  freeSpace?: (path: string) => number | null
  /** Sleep between retries, injected so the retry test does not wait 15 s. */
  wait?: (ms: number) => Promise<void>
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

/** Bytes of `file`, or 0 when it is not there. */
function sizeOnDisk(file: string): number {
  try {
    return statSync(file).size
  } catch {
    return 0
  }
}

/** Free bytes on the volume holding `path`, or `null` when it cannot be read. */
function defaultFreeSpace(path: string): number | null {
  try {
    const stats = statfsSync(path)
    return Number(stats.bavail) * Number(stats.bsize)
  } catch {
    return null
  }
}

/**
 * Is this worth another attempt?
 *
 * A dropped socket mid-way through 2.8 GB is the single most likely thing to go
 * wrong here and the single most pointless thing to surface as "failed" —
 * every byte already written is still on disk and still good. A 404, by
 * contrast, will be a 404 on the fourth try too.
 */
function isRetryable(error: unknown): boolean {
  if (error instanceof WhisperDownloadCancelled) return false
  if (error instanceof WhisperDownloadError)
    return error.kind === 'offline' || error.kind === 'server'
  return true
}

/** Maps an HTTP status to the failure kind whose copy actually helps. */
function httpFailureKind(status: number): WhisperDownloadErrorKind {
  if (status === 404 || status === 401 || status === 403) return 'notFound'
  return status >= 500 || status === 429 ? 'server' : 'unknown'
}

/**
 * Main-owned store of downloaded Whisper models (D-SB-4). Downloads are
 * **atomic and resumable**: every file lands in a sibling `.tmp-<id>` directory
 * that is only renamed into place once all bytes arrived, so an interrupted
 * download can never be mistaken for a complete model (the marker file is
 * written last, and only inside the finalized directory).
 *
 * Three properties the first version did not have, each of which was a real
 * failure on a 2.8 GB model:
 *
 * - **Resume.** The temp directory survives a failure, and the next attempt
 *   sends `Range: bytes=<what is already here>-` per file. Restarting a
 *   three-gigabyte download from zero because a laptop slept is not a retry,
 *   it is a punishment.
 * - **Retry.** Transport-level failures are re-attempted with backoff before
 *   the download is called failed, because the overwhelmingly common cause is
 *   a blip, not a broken repo.
 * - **Byte-level progress.** Progress used to be emitted once per *file*, and
 *   `medium` is two files — so a 25-minute download reported 0 %, then 42 %,
 *   then done. A bar that does not move is read as a hang, and the user
 *   reporting "it failed" may well have been reporting exactly that.
 *
 * `fetchFn` is injected so the whole path — tree listing, byte streaming,
 * resume, retry, progress, atomic finalize — is unit-testable against a fake
 * registry with no network.
 */
export function createWhisperModelStore(
  rootDir: string,
  deps: WhisperStoreDeps = {}
): WhisperModelStore {
  const fetchFn = deps.fetchFn ?? fetch
  const freeSpace = deps.freeSpace ?? defaultFreeSpace
  const wait =
    deps.wait ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)))

  const modelDir = (id: WhisperModelId): string => join(rootDir, id)
  const tempDir = (id: WhisperModelId): string => join(rootDir, `.tmp-${id}`)
  const entry = (id: WhisperModelId): (typeof WHISPER_CATALOG)[number] => {
    const found = WHISPER_CATALOG.find((m) => m.id === id)
    if (!found) throw new WhisperDownloadError('unsupported', `whisper: unknown model "${id}"`)
    return found
  }

  /** Reads a finalized directory's marker. `null` when absent or unreadable. */
  function readMarker(dir: string): WhisperVariant | null | undefined {
    const marker = join(dir, COMPLETE_MARKER)
    if (!existsSync(marker)) return undefined
    try {
      const parsed: unknown = JSON.parse(readFileSync(marker, 'utf-8'))
      const variant = (parsed as { variant?: string } | null)?.variant
      return variant === 'q8' || variant === 'fp32' ? variant : null
    } catch {
      // A corrupt marker means we cannot trust the directory — treat as absent.
      return undefined
    }
  }

  function status(id: WhisperModelId): WhisperModelStatus {
    const marked = readMarker(modelDir(id))
    if (marked !== undefined) return { downloaded: true, variant: marked }
    return { downloaded: false, variant: null }
  }

  function list(): WhisperModelInfo[] {
    return WHISPER_CATALOG.map((model) => {
      const state = status(model.id)
      return { ...model, downloaded: state.downloaded, downloadedVariant: state.variant }
    })
  }

  function searchRoots(): string[] {
    return [rootDir]
  }

  function discardPartial(id: WhisperModelId): void {
    rmSync(tempDir(id), { recursive: true, force: true })
  }

  function partialBytes(id: WhisperModelId): number {
    const dir = tempDir(id)
    const manifest = readPartial(dir)
    if (manifest === null) return 0
    return manifest.files.reduce((sum, file) => sum + sizeOnDisk(join(dir, file)), 0)
  }

  /** What a partial download records about itself, so resume can trust it. */
  interface PartialManifest {
    repo: string
    variant: WhisperVariant
    files: string[]
  }

  function readPartial(dir: string): PartialManifest | null {
    try {
      const parsed: unknown = JSON.parse(readFileSync(join(dir, PARTIAL_MARKER), 'utf-8'))
      const manifest = parsed as Partial<PartialManifest> | null
      if (!manifest || typeof manifest.repo !== 'string') return null
      if (manifest.variant !== 'fp32' && manifest.variant !== 'q8') return null
      return {
        repo: manifest.repo,
        variant: manifest.variant,
        files: Array.isArray(manifest.files)
          ? manifest.files.filter((f) => typeof f === 'string')
          : []
      }
    } catch {
      return null
    }
  }

  async function listRepoFiles(
    repo: string,
    variant: WhisperVariant,
    signal?: AbortSignal
  ): Promise<TreeEntry[]> {
    const wanted: TreeEntry[] = []
    for (const path of ['', '/onnx']) {
      // `?recursive=false&limit=1000` rather than the default page: the default
      // is 50 entries, and a repo publishing every quantization of every part
      // (whisper-medium ships 31 files under `onnx/` alone) can push the two
      // files we actually want off the first page — which would surface as
      // "no fp32 weights published for this model" for a model that has them.
      const url = `https://huggingface.co/api/models/${repo}/tree/main${path}?limit=1000`
      const response = await fetchOrThrow(url, {}, signal)
      if (!response.ok) {
        throw new WhisperDownloadError(
          httpFailureKind(response.status),
          `whisper: model index unavailable (HTTP ${response.status})`
        )
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
      throw new WhisperDownloadError(
        'unsupported',
        `whisper: no ${variant} weights published for this model`
      )
    }
    return wanted
  }

  /**
   * `fetch`, with transport failures typed as `offline`.
   *
   * `fetch` rejects with a bare `TypeError: fetch failed` for everything from
   * a DNS miss to a mid-stream reset, which is exactly the class that deserves
   * a retry and a "check your connection" sentence rather than a stack trace.
   */
  async function fetchOrThrow(
    url: string,
    init: RequestInit,
    signal?: AbortSignal
  ): Promise<Response> {
    // Read through a function, never as a narrowed expression: the flag flips
    // *during* the awaits below, and TypeScript's control-flow analysis would
    // otherwise decide the second check can never be true.
    const aborted = (): boolean => signal?.aborted === true
    if (aborted()) throw new WhisperDownloadCancelled()
    try {
      return await fetchFn(url, { ...init, signal })
    } catch (error) {
      if (aborted()) throw new WhisperDownloadCancelled()
      throw new WhisperDownloadError('offline', (error as Error).message)
    }
  }

  /**
   * Streams one file into the temp directory, continuing from whatever is
   * already there.
   *
   * A server that answers `200` to a `Range` request is telling us it ignored
   * the header and is sending the whole body — appending that to the bytes we
   * already had would produce a corrupt file that only fails hours later at
   * session-create time, so the local copy is truncated first.
   */
  async function fetchFile(
    repo: string,
    file: TreeEntry,
    target: string,
    signal: AbortSignal | undefined,
    onBytes: (bytesOnDisk: number) => void
  ): Promise<void> {
    let have = sizeOnDisk(target)
    const url = `https://huggingface.co/${repo}/resolve/main/${file.path}`
    const response = await fetchOrThrow(
      url,
      have > 0 ? { headers: { Range: `bytes=${have}-` } } : {},
      signal
    )

    if (!response.ok) {
      throw new WhisperDownloadError(
        httpFailureKind(response.status),
        `whisper: download failed for ${file.path} (HTTP ${response.status})`
      )
    }
    if (have > 0 && response.status !== 206) {
      truncateSync(target, 0)
      have = 0
    }
    if (!response.body) {
      throw new WhisperDownloadError('server', `whisper: empty response for ${file.path}`)
    }

    let written = have
    const counter = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        written += chunk.length
        onBytes(written)
        callback(null, chunk)
      }
    })

    mkdirSync(dirname(target), { recursive: true })
    try {
      await pipeline(
        Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]),
        counter,
        createWriteStream(target, { flags: have > 0 ? 'a' : 'w' }),
        { signal }
      )
    } catch (error) {
      if (signal?.aborted === true) throw new WhisperDownloadCancelled()
      const code = (error as NodeJS.ErrnoException).code
      if (code === 'ENOSPC') {
        throw new WhisperDownloadError('disk', `whisper: no space left while writing ${file.path}`)
      }
      throw new WhisperDownloadError('offline', (error as Error).message)
    }
  }

  /** One file, re-attempted with backoff — resume makes each retry cheap. */
  async function fetchFileWithRetry(
    repo: string,
    file: TreeEntry,
    target: string,
    signal: AbortSignal | undefined,
    onBytes: (bytesOnDisk: number) => void
  ): Promise<void> {
    for (let attempt = 0; ; attempt += 1) {
      try {
        await fetchFile(repo, file, target, signal, onBytes)
        return
      } catch (error) {
        const last = attempt >= MAX_FILE_ATTEMPTS - 1
        if (last || !isRetryable(error)) throw error
        await wait(RETRY_BACKOFF_MS[Math.min(attempt, RETRY_BACKOFF_MS.length - 1)])
        if (signal?.aborted === true) throw new WhisperDownloadCancelled()
      }
    }
  }

  /**
   * Refuses a download the volume cannot hold, **before** spending an hour
   * proving it. A `ENOSPC` two gigabytes in leaves the user with a failure, a
   * full disk and no explanation of the connection between the two.
   */
  function assertSpace(needed: number): void {
    const free = freeSpace(rootDir)
    if (free === null) return
    if (free >= needed + DISK_SLACK_BYTES) return
    throw new WhisperDownloadError(
      'disk',
      `whisper: needs ${needed} bytes, ${free} available on this volume`
    )
  }

  async function download(
    id: WhisperModelId,
    variant: WhisperVariant,
    onEvent: (event: WhisperDownloadEvent) => void,
    options: DownloadOptions = {}
  ): Promise<void> {
    const { signal } = options
    const finalDir = modelDir(id)
    const temp = tempDir(id)
    const { repo } = entry(id)

    const files = await listRepoFiles(repo, variant, signal)
    const total = files.reduce((sum, f) => sum + (f.size ?? 0), 0)

    // A partial left by a *different* precision (or a repo that moved) cannot
    // be resumed into: the bytes are not the bytes we now want.
    const partial = readPartial(temp)
    if (partial === null || partial.repo !== repo || partial.variant !== variant) {
      rmSync(temp, { recursive: true, force: true })
    }
    mkdirSync(temp, { recursive: true })
    writeFileSync(
      join(temp, PARTIAL_MARKER),
      JSON.stringify({ repo, variant, files: files.map((f) => f.path) })
    )

    const onDisk = new Map<string, number>(
      files.map((file) => [file.path, Math.min(sizeOnDisk(join(temp, file.path)), file.size ?? 0)])
    )
    const loadedBytes = (): number => [...onDisk.values()].reduce((sum, value) => sum + value, 0)

    assertSpace(Math.max(0, total - loadedBytes()))

    let lastPublished = 0
    const publish = (file: string, force = false): void => {
      const now = Date.now()
      if (!force && now - lastPublished < PROGRESS_INTERVAL_MS) return
      lastPublished = now
      onEvent({ type: 'progress', id, loaded: loadedBytes(), total, file })
    }
    publish(files[0]?.path ?? '', true)

    for (const file of files) {
      if (signal?.aborted === true) throw new WhisperDownloadCancelled()
      const target = join(temp, file.path)
      if (file.size !== undefined && file.size > 0 && sizeOnDisk(target) >= file.size) {
        onDisk.set(file.path, file.size)
        publish(file.path)
        continue
      }
      await fetchFileWithRetry(repo, file, target, signal, (bytes) => {
        onDisk.set(file.path, bytes)
        publish(file.path)
      })
      onDisk.set(file.path, file.size ?? sizeOnDisk(target))
      publish(file.path, true)
    }

    // Atomic finalize: the marker goes inside the temp dir, then one rename
    // publishes the whole model. A crash before this leaves only `.tmp-*`,
    // which `status()` never looks at — and which the next attempt resumes.
    writeFileSync(
      join(temp, COMPLETE_MARKER),
      JSON.stringify({ variant, repo, completedAt: new Date().toISOString() })
    )
    rmSync(join(temp, PARTIAL_MARKER), { force: true })
    rmSync(finalDir, { recursive: true, force: true })
    renameSync(temp, finalDir)
    onEvent({ type: 'done', id })
  }

  /**
   * Deletes the downloaded copy, and any partial bytes with it.
   *
   * Everything a model needs now lives in the user's own profile directory —
   * there is no read-only copy inside the installation to fall back to since
   * the app stopped shipping weights, so deleting means the model is gone
   * until it is fetched again, and `status()` says so on the very next call.
   */
  function remove(id: WhisperModelId): void {
    rmSync(modelDir(id), { recursive: true, force: true })
    discardPartial(id)
  }

  return { list, status, download, remove, discardPartial, partialBytes, searchRoots }
}
