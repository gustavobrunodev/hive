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
import { PARAKEET_MODEL_ID } from './asrTypes'
import type {
  AsrDownloadErrorKind,
  AsrDownloadEvent,
  AsrDownloadFailure,
  AsrModelId,
  AsrModelInfo
} from './asrTypes'
import type { AsrModelPaths } from './asrWorkerProtocol'

export type { AsrModelId, AsrModelInfo } from './asrTypes'

/**
 * Main-owned store of the downloaded ASR model.
 *
 * Descended from `whisperModelStore.ts`, and deliberately so: the download
 * engine below — atomic finalize, resume, retry with backoff, byte-level
 * progress, disk-space refusal, a typed failure for every stop — was written
 * against a 2.8 GB transfer over a home connection, and none of what it learned
 * is about Whisper. What is gone is everything that served a *catalog*: the ten
 * entries, the fp32/q8 precision dance, the per-file ceiling that existed
 * because Transformers.js read each weight into one `ArrayBuffer` and V8
 * refuses 2 GiB. Native ONNX Runtime reads the weights itself, so that ceiling
 * is not a fact about this app any more.
 *
 * `fetchFn` is injected so the whole path — tree listing, byte streaming,
 * resume, retry, progress, atomic finalize — is unit-testable against a fake
 * registry with no network.
 */

/**
 * The catalog, which is one model (M29).
 *
 * Sizes are the **measured** file sizes from the Hugging Face API, read on
 * 2026-09-01: encoder 652.2 MB, decoder 11.8 MB, joiner 6.4 MB, tokens 0.1 MB.
 * The repo is sherpa-onnx's own export of NVIDIA's Parakeet TDT 0.6b v3 —
 * `csukuangfj` is the sherpa-onnx maintainer, and the split encoder/decoder/
 * joiner layout is what sherpa's transducer loader expects (the `istupakov`
 * export of the same weights fuses decoder and joiner for `onnx-asr`, and
 * cannot be loaded here).
 */
export const ASR_MODEL: Omit<AsrModelInfo, 'downloaded'> = {
  id: PARAKEET_MODEL_ID,
  repo: 'csukuangfj/sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8',
  params: '600 M',
  sizeMB: 671,
  languages: 25
}

/** The four files the recognizer needs. Everything else in the repo is samples. */
export const ASR_MODEL_FILES = [
  'encoder.int8.onnx',
  'decoder.int8.onnx',
  'joiner.int8.onnx',
  'tokens.txt'
] as const

/** Written last, inside the temp dir, so a finalized directory is always complete. */
const COMPLETE_MARKER = '.complete.json'

/** Records what a partial download is, so resume can tell it is the same one. */
const PARTIAL_MARKER = '.partial.json'

/** Attempts per file before a download is called failed. */
const MAX_FILE_ATTEMPTS = 4

/** Backoff between attempts, in ms. */
const RETRY_BACKOFF_MS = [500, 2000, 5000]

/** Headroom demanded on top of the download itself, so the disk never fills flat. */
const DISK_SLACK_BYTES = 256 * 1024 * 1024

/** Progress is published at most this often — a 652 MB file emits chunks constantly. */
const PROGRESS_INTERVAL_MS = 250

interface TreeEntry {
  type: string
  path: string
  size?: number
}

/**
 * A download that stopped, with the reason typed.
 *
 * `kind` exists so the renderer can say something useful. "The download
 * failed", the only sentence the first surface could produce, is the same words
 * for a full disk, a dropped connection and a model the repo never published —
 * three problems with three different next steps.
 */
export class AsrDownloadError extends Error {
  kind: AsrDownloadErrorKind

  constructor(kind: AsrDownloadErrorKind, message: string) {
    super(message)
    this.name = 'AsrDownloadError'
    this.kind = kind
  }
}

/** Raised when the caller aborts. Never a failure — the user asked for it. */
export class AsrDownloadCancelled extends Error {
  constructor() {
    super('asr: download cancelled')
    this.name = 'AsrDownloadCancelled'
  }
}

/** Turns any thrown value into the typed failure the record carries over IPC. */
export function toDownloadFailure(error: unknown): AsrDownloadFailure {
  const detail = error instanceof Error ? error.message : String(error)
  if (error instanceof AsrDownloadError) return { kind: error.kind, detail }
  return { kind: 'unknown', detail }
}

export interface DownloadOptions {
  /** Aborts the transfer. A cancelled download rejects with `AsrDownloadCancelled`. */
  signal?: AbortSignal
}

export interface AsrModelStore {
  /** The catalog entry plus whether its bytes are on disk. */
  info(): AsrModelInfo
  installed(): boolean
  /**
   * Absolute paths to the four model files, or `null` when not installed.
   *
   * The engine reads these directly. There is no privileged scheme any more —
   * that existed because a sandboxed renderer had to be handed weights it could
   * not fetch itself, and the renderer no longer touches them at all.
   */
  paths(): AsrModelPaths | null
  /**
   * Fetches the model, **resumably**. Rejects on failure (or cancellation)
   * rather than swallowing it into an event, so the manager above owns the
   * record's lifecycle in one place.
   */
  download(onEvent: (event: AsrDownloadEvent) => void, options?: DownloadOptions): Promise<void>
  remove(): void
  /** Drops a partial download's bytes — what "cancel" means on disk. */
  discardPartial(): void
  /** How many bytes are already on disk from an interrupted attempt. */
  partialBytes(): number
}

export interface AsrStoreDeps {
  /** Injected so tests drive a fake registry without touching the network. */
  fetchFn?: typeof fetch
  /** Free bytes on the volume holding `rootDir`. Injected for the disk-space test. */
  freeSpace?: (path: string) => number | null
  /** Sleep between retries, injected so the retry test does not wait 15 s. */
  wait?: (ms: number) => Promise<void>
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
 * A dropped socket mid-way through 652 MB is the single most likely thing to go
 * wrong here and the single most pointless thing to surface as "failed" — every
 * byte already written is still on disk and still good. A 404, by contrast,
 * will be a 404 on the fourth try too.
 */
function isRetryable(error: unknown): boolean {
  if (error instanceof AsrDownloadCancelled) return false
  if (error instanceof AsrDownloadError) return error.kind === 'offline' || error.kind === 'server'
  return true
}

/** Maps an HTTP status to the failure kind whose copy actually helps. */
function httpFailureKind(status: number): AsrDownloadErrorKind {
  if (status === 404 || status === 401 || status === 403) return 'notFound'
  return status >= 500 || status === 429 ? 'server' : 'unknown'
}

export function createAsrModelStore(rootDir: string, deps: AsrStoreDeps = {}): AsrModelStore {
  const fetchFn = deps.fetchFn ?? fetch
  const freeSpace = deps.freeSpace ?? defaultFreeSpace
  const wait =
    deps.wait ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)))

  const id: AsrModelId = ASR_MODEL.id
  const finalDir = join(rootDir, id)
  const temp = join(rootDir, `.tmp-${id}`)

  function installed(): boolean {
    if (!existsSync(join(finalDir, COMPLETE_MARKER))) return false
    // The marker only says the rename happened; the files are what the engine
    // opens, and a user who deleted one by hand must not be told it is ready.
    return ASR_MODEL_FILES.every((file) => existsSync(join(finalDir, file)))
  }

  function info(): AsrModelInfo {
    return { ...ASR_MODEL, downloaded: installed() }
  }

  function paths(): AsrModelPaths | null {
    if (!installed()) return null
    return {
      encoder: join(finalDir, 'encoder.int8.onnx'),
      decoder: join(finalDir, 'decoder.int8.onnx'),
      joiner: join(finalDir, 'joiner.int8.onnx'),
      tokens: join(finalDir, 'tokens.txt')
    }
  }

  function discardPartial(): void {
    rmSync(temp, { recursive: true, force: true })
  }

  function partialBytes(): number {
    const manifest = readPartial()
    if (manifest === null) return 0
    return manifest.files.reduce((sum, file) => sum + sizeOnDisk(join(temp, file)), 0)
  }

  /** What a partial download records about itself, so resume can trust it. */
  interface PartialManifest {
    repo: string
    files: string[]
  }

  function readPartial(): PartialManifest | null {
    try {
      const parsed: unknown = JSON.parse(readFileSync(join(temp, PARTIAL_MARKER), 'utf-8'))
      const manifest = parsed as Partial<PartialManifest> | null
      if (!manifest || typeof manifest.repo !== 'string') return null
      return {
        repo: manifest.repo,
        files: Array.isArray(manifest.files)
          ? manifest.files.filter((f) => typeof f === 'string')
          : []
      }
    } catch {
      return null
    }
  }

  async function listRepoFiles(signal?: AbortSignal): Promise<TreeEntry[]> {
    // `?limit=1000` rather than the default page of 50: the repo also publishes
    // sample wavs, and a listing that paged them ahead of the weights would
    // surface as "the repo publishes no weights" for a repo that does.
    const url = `https://huggingface.co/api/models/${ASR_MODEL.repo}/tree/main?limit=1000`
    const response = await fetchOrThrow(url, {}, signal)
    if (!response.ok) {
      throw new AsrDownloadError(
        httpFailureKind(response.status),
        `asr: model index unavailable (HTTP ${response.status})`
      )
    }
    const entries = (await response.json()) as TreeEntry[]
    const wanted = entries.filter(
      (item) => item.type === 'file' && (ASR_MODEL_FILES as readonly string[]).includes(item.path)
    )
    if (wanted.length !== ASR_MODEL_FILES.length) {
      const missing = ASR_MODEL_FILES.filter((f) => !wanted.some((w) => w.path === f))
      throw new AsrDownloadError('unsupported', `asr: repo is missing ${missing.join(', ')}`)
    }
    return wanted
  }

  /**
   * `fetch`, with transport failures typed as `offline`.
   *
   * `fetch` rejects with a bare `TypeError: fetch failed` for everything from a
   * DNS miss to a mid-stream reset, which is exactly the class that deserves a
   * retry and a "check your connection" sentence rather than a stack trace.
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
    if (aborted()) throw new AsrDownloadCancelled()
    try {
      return await fetchFn(url, { ...init, signal })
    } catch (error) {
      if (aborted()) throw new AsrDownloadCancelled()
      throw new AsrDownloadError('offline', (error as Error).message)
    }
  }

  /**
   * Streams one file into the temp directory, continuing from whatever is
   * already there.
   *
   * A server that answers `200` to a `Range` request is telling us it ignored
   * the header and is sending the whole body — appending that to the bytes we
   * already had would produce a corrupt file that only fails later at
   * session-create time, so the local copy is truncated first.
   */
  async function fetchFile(
    file: TreeEntry,
    target: string,
    signal: AbortSignal | undefined,
    onBytes: (bytesOnDisk: number) => void
  ): Promise<void> {
    let have = sizeOnDisk(target)
    const url = `https://huggingface.co/${ASR_MODEL.repo}/resolve/main/${file.path}`
    const response = await fetchOrThrow(
      url,
      have > 0 ? { headers: { Range: `bytes=${have}-` } } : {},
      signal
    )

    if (!response.ok) {
      throw new AsrDownloadError(
        httpFailureKind(response.status),
        `asr: download failed for ${file.path} (HTTP ${response.status})`
      )
    }
    if (have > 0 && response.status !== 206) {
      truncateSync(target, 0)
      have = 0
    }
    if (!response.body) {
      throw new AsrDownloadError('server', `asr: empty response for ${file.path}`)
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
      if (signal?.aborted === true) throw new AsrDownloadCancelled()
      const code = (error as NodeJS.ErrnoException).code
      if (code === 'ENOSPC') {
        throw new AsrDownloadError('disk', `asr: no space left while writing ${file.path}`)
      }
      throw new AsrDownloadError('offline', (error as Error).message)
    }
  }

  /** One file, re-attempted with backoff — resume makes each retry cheap. */
  async function fetchFileWithRetry(
    file: TreeEntry,
    target: string,
    signal: AbortSignal | undefined,
    onBytes: (bytesOnDisk: number) => void
  ): Promise<void> {
    for (let attempt = 0; ; attempt += 1) {
      try {
        await fetchFile(file, target, signal, onBytes)
        return
      } catch (error) {
        const last = attempt >= MAX_FILE_ATTEMPTS - 1
        if (last || !isRetryable(error)) throw error
        await wait(RETRY_BACKOFF_MS[Math.min(attempt, RETRY_BACKOFF_MS.length - 1)])
        if (signal?.aborted === true) throw new AsrDownloadCancelled()
      }
    }
  }

  /**
   * Refuses a download the volume cannot hold, **before** spending twenty
   * minutes proving it. A `ENOSPC` half a gigabyte in leaves the user with a
   * failure, a full disk and no explanation of the connection between the two.
   */
  function assertSpace(needed: number): void {
    const free = freeSpace(rootDir)
    if (free === null) return
    if (free >= needed + DISK_SLACK_BYTES) return
    throw new AsrDownloadError(
      'disk',
      `asr: needs ${needed} bytes, ${free} available on this volume`
    )
  }

  async function download(
    onEvent: (event: AsrDownloadEvent) => void,
    options: DownloadOptions = {}
  ): Promise<void> {
    const { signal } = options
    const files = await listRepoFiles(signal)
    const total = files.reduce((sum, f) => sum + (f.size ?? 0), 0)

    // A partial left by a repo that moved cannot be resumed into: the bytes are
    // not the bytes we now want.
    const partial = readPartial()
    if (partial === null || partial.repo !== ASR_MODEL.repo) {
      rmSync(temp, { recursive: true, force: true })
    }
    mkdirSync(temp, { recursive: true })
    writeFileSync(
      join(temp, PARTIAL_MARKER),
      JSON.stringify({ repo: ASR_MODEL.repo, files: files.map((f) => f.path) })
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
      if (signal?.aborted === true) throw new AsrDownloadCancelled()
      const target = join(temp, file.path)
      if (file.size !== undefined && file.size > 0 && sizeOnDisk(target) >= file.size) {
        onDisk.set(file.path, file.size)
        publish(file.path)
        continue
      }
      await fetchFileWithRetry(file, target, signal, (bytes) => {
        onDisk.set(file.path, bytes)
        publish(file.path)
      })
      onDisk.set(file.path, file.size ?? sizeOnDisk(target))
      publish(file.path, true)
    }

    // Atomic finalize: the marker goes inside the temp dir, then one rename
    // publishes the whole model. A crash before this leaves only `.tmp-*`,
    // which `installed()` never looks at — and which the next attempt resumes.
    writeFileSync(
      join(temp, COMPLETE_MARKER),
      JSON.stringify({ repo: ASR_MODEL.repo, completedAt: new Date().toISOString() })
    )
    rmSync(join(temp, PARTIAL_MARKER), { force: true })
    rmSync(finalDir, { recursive: true, force: true })
    renameSync(temp, finalDir)
    onEvent({ type: 'done', id })
  }

  /** Deletes the downloaded copy, and any partial bytes with it. */
  function remove(): void {
    rmSync(finalDir, { recursive: true, force: true })
    discardPartial()
  }

  return { info, installed, paths, download, remove, discardPartial, partialBytes }
}
