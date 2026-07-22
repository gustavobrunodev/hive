import { createHash } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import { mkdir, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import * as tar from 'tar'

import type { PayloadInfo } from './npmRegistry'

/**
 * The injectable HTTP layer this module needs (the `DialogLike` / `McpProbe` /
 * `RegistryClient` DI precedent): fetch a URL and hand back its body as a
 * Node `Readable` plus a declared content length, if known. This is the only
 * network-shaped dependency — everything else (hashing, extraction, the
 * `hive-update.json` descriptor lookup) runs against the real filesystem and
 * the real `tar` package, so tests only ever fake this one seam (no real
 * network) while exercising real fs/tar behavior end-to-end (ND-R7.3).
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

/** The `hive-update.json` descriptor published inside the platform package (design.md §4). */
export interface UpdateDescriptor {
  version: string
  platform: string
  arch: string
  /** Installer file name, relative to the extracted package root. */
  installer: string
  bytes: number
}

export interface DownloadedUpdate {
  installerPath: string
  descriptor: UpdateDescriptor
}

/**
 * A verified download whose sha512 does not match the registry's
 * `dist.integrity` (ND-R3.3). Distinct from every other failure mode so a
 * caller can tell "this needs a fresh download" apart from "the network is
 * down" — it must never be silently retried.
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

const TARBALL_FILE_NAME = 'payload.tgz'
const DESCRIPTOR_FILE_NAME = 'hive-update.json'

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

/** Reads and validates the `hive-update.json` descriptor extracted alongside the installer. */
async function readDescriptor(stagingDir: string): Promise<UpdateDescriptor> {
  const raw = await readFile(join(stagingDir, DESCRIPTOR_FILE_NAME), 'utf-8')
  const parsed = JSON.parse(raw) as Partial<Record<keyof UpdateDescriptor, unknown>>

  if (
    typeof parsed.version !== 'string' ||
    typeof parsed.platform !== 'string' ||
    typeof parsed.arch !== 'string' ||
    typeof parsed.installer !== 'string' ||
    typeof parsed.bytes !== 'number'
  ) {
    throw new Error(`${DESCRIPTOR_FILE_NAME} is missing required fields.`)
  }

  return {
    version: parsed.version,
    platform: parsed.platform,
    arch: parsed.arch,
    installer: parsed.installer,
    bytes: parsed.bytes
  }
}

/**
 * Downloads the platform payload into `stagingDir`, verifies it against
 * `payload.integrity` (ND-R3.3), extracts it, and locates the installer via
 * its `hive-update.json` descriptor (ND-R4.1). `stagingDir` is a plain path
 * argument (never `app.getPath(...)` called internally) so this module has
 * no Electron dependency — the caller (T6) resolves the real
 * `userData/updates/<version>/` directory.
 *
 * On an integrity mismatch, the downloaded tarball is deleted and
 * `IntegrityMismatchError` is thrown — never retried automatically. On
 * cancellation (`options.signal`), the partial download is deleted and
 * `DownloadCancelledError` is thrown. Any other failure (network, malformed
 * descriptor) propagates as-is.
 */
export async function downloadAndExtractUpdate(
  downloader: Downloader,
  payload: PayloadInfo,
  stagingDir: string,
  options: DownloadOptions = {}
): Promise<DownloadedUpdate> {
  if (options.signal?.aborted) {
    throw new DownloadCancelledError()
  }

  await mkdir(stagingDir, { recursive: true })
  const tarballPath = join(stagingDir, TARBALL_FILE_NAME)

  const source = await downloader.download(payload.tarballUrl)
  const digest = await streamToFile(
    source,
    tarballPath,
    payload.bytes,
    options.onProgress,
    options.signal
  )

  const expectedDigest = payload.integrity.replace(/^sha512-/, '')
  if (digest !== expectedDigest) {
    await rm(tarballPath, { force: true })
    throw new IntegrityMismatchError()
  }

  // npm tarballs are rooted at a single `package/` directory (design.md §2) —
  // `strip: 1` drops it so the descriptor and installer land directly in
  // `stagingDir`.
  await tar.x({ file: tarballPath, cwd: stagingDir, strip: 1 })
  // The raw .tgz has done its job once extracted; no reason to keep ~90 MB
  // of compressed payload sitting next to the installer it unpacked.
  await rm(tarballPath, { force: true })

  const descriptor = await readDescriptor(stagingDir)
  return { installerPath: join(stagingDir, descriptor.installer), descriptor }
}
