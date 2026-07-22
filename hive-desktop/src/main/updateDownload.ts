import { createHash } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import { mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'

/**
 * The injectable HTTP layer this module needs (the `DialogLike` / `McpProbe` /
 * `RegistryClient` DI precedent): fetch a URL and hand back its body as a
 * Node `Readable` plus a declared content length, if known. This is the only
 * network-shaped dependency — everything else (hashing) runs against the
 * real filesystem, so tests only ever fake this one seam (no real network)
 * while exercising real fs behavior end-to-end (ND-R7.3).
 */
export interface Downloader {
  download(url: string): Promise<DownloadSource>
}

export interface DownloadSource {
  /** Declared content length in bytes, or `null` if the server/client didn't report one. */
  total: number | null
  stream: NodeJS.ReadableStream
}

export interface DownloadProgress {
  transferred: number
  total: number | null
}

export interface DownloadOptions {
  onProgress?: (progress: DownloadProgress) => void
  /** Aborting mid-download (ND-R3.4) stops the stream and deletes any partial artifact. */
  signal?: AbortSignal
}

/**
 * What this module needs to fetch and verify the installer (design.md §2A,
 * ND-C7/D21's payload-host pivot). Was `npmRegistry.ts`'s `PayloadInfo` with
 * a `tarballUrl` field before the pivot — renamed `downloadUrl` because the
 * payload is a raw installer now, not an npm tarball. Defined here (this
 * module's own consumer-side shape) rather than imported from
 * `npmRegistry.ts`, since that module no longer produces payloads at all
 * (`githubReleases.ts` does, via its structurally-identical
 * `GithubPayloadInfo` — TypeScript's structural typing means a caller can
 * hand either one to `downloadAndVerifyInstaller` with no conversion).
 */
export interface PayloadInfo {
  downloadUrl: string
  /** SRI string, e.g. `"sha512-…"`. */
  integrity: string
  bytes: number | null
}

/**
 * A verified download whose sha512 does not match the expected `integrity`
 * (ND-R3.3). Distinct from every other failure mode so a caller can tell
 * "this needs a fresh download" apart from "the network is down" — it must
 * never be silently retried.
 */
export class IntegrityMismatchError extends Error {
  constructor(message = 'Downloaded artifact failed integrity verification.') {
    super(message)
    this.name = 'IntegrityMismatchError'
  }
}

/** A download stopped by an explicit cancellation (ND-R3.4), not a failure. */
export class DownloadCancelledError extends Error {
  constructor(message = 'Download was cancelled.') {
    super(message)
    this.name = 'DownloadCancelledError'
  }
}

/**
 * Streams `source` to `destPath` while hashing with sha512, reporting
 * progress as chunks arrive. Uses `stream/promises`' `pipeline` with the
 * caller's `AbortSignal` so cancellation tears down the source stream and
 * the destination file handle together — no manual stream bookkeeping.
 * On any failure (including cancellation) the partial file is removed
 * before rejecting, so a caller never has to clean up on our behalf.
 */
async function streamToFile(
  source: DownloadSource,
  destPath: string,
  fallbackTotal: number | null,
  onProgress: ((progress: DownloadProgress) => void) | undefined,
  signal: AbortSignal | undefined
): Promise<string> {
  const hash = createHash('sha512')
  const total = source.total ?? fallbackTotal
  let transferred = 0

  const progressTap = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      hash.update(chunk)
      transferred += chunk.length
      onProgress?.({ transferred, total })
      callback(null, chunk)
    }
  })

  try {
    await pipeline(source.stream, progressTap, createWriteStream(destPath), { signal })
  } catch (err) {
    await rm(destPath, { force: true })
    if (signal?.aborted) {
      throw new DownloadCancelledError()
    }
    throw err
  }

  return hash.digest('base64')
}

/**
 * Downloads the installer directly into `stagingDir/installerFileName` and
 * verifies it against `payload.integrity` (ND-R3.3). `stagingDir` is a plain
 * path argument (never `app.getPath(...)` called internally) so this module
 * has no Electron dependency — the caller (`updateService.ts`) resolves the
 * real `userData/updates/<version>/` directory.
 *
 * ND-C7/D21 (design.md §2A) simplified this from `downloadAndExtractUpdate`:
 * the payload used to be an npm tarball that had to be extracted and then
 * read for its `hive-update.json` descriptor; it's a raw installer now, and
 * the descriptor is already known to the caller (`githubReleases.ts` parsed
 * it before this function is ever invoked) — so `installerFileName` (the
 * descriptor's `installer` field) comes in as a parameter instead, and there
 * is no extraction step or descriptor lookup left to do here at all. The
 * streaming-hash-while-downloading shape, `IntegrityMismatchError`/
 * `DownloadCancelledError`, and cancellation are unchanged in spirit.
 *
 * On an integrity mismatch, the downloaded installer is deleted and
 * `IntegrityMismatchError` is thrown — never retried automatically. On
 * cancellation (`options.signal`), the partial download is deleted and
 * `DownloadCancelledError` is thrown. Any other failure (network) propagates
 * as-is. Resolves to the installer's full path on success.
 */
export async function downloadAndVerifyInstaller(
  downloader: Downloader,
  payload: PayloadInfo,
  stagingDir: string,
  installerFileName: string,
  options: DownloadOptions = {}
): Promise<string> {
  if (options.signal?.aborted) {
    throw new DownloadCancelledError()
  }

  await mkdir(stagingDir, { recursive: true })
  const installerPath = join(stagingDir, installerFileName)

  const source = await downloader.download(payload.downloadUrl)
  const digest = await streamToFile(
    source,
    installerPath,
    payload.bytes,
    options.onProgress,
    options.signal
  )

  const expectedDigest = payload.integrity.replace(/^sha512-/, '')
  if (digest !== expectedDigest) {
    await rm(installerPath, { force: true })
    throw new IntegrityMismatchError()
  }

  return installerPath
}
