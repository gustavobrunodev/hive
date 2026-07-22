import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import * as tar from 'tar'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { PayloadInfo } from './npmRegistry'
import {
  DownloadCancelledError,
  type Downloader,
  type DownloadSource,
  IntegrityMismatchError,
  downloadAndExtractUpdate
} from './updateDownload'

/**
 * Builds a real gzipped npm-style tarball (rooted at `package/`, containing
 * a `hive-update.json` descriptor and a dummy installer file) using the same
 * `tar` package the module under test extracts with — an honest fixture
 * rather than a hand-rolled fake, per the module's "real fs/tar, fake
 * network only" testing approach.
 */
function buildFixtureTarball(workDir: string, installerContent = 'fake-installer-bytes'): Buffer {
  const sourceRoot = join(workDir, 'source')
  const packageDir = join(sourceRoot, 'package')
  mkdirSync(packageDir, { recursive: true })
  writeFileSync(
    join(packageDir, 'hive-update.json'),
    JSON.stringify({
      version: '0.2.0',
      platform: 'win32',
      arch: 'x64',
      installer: 'hive-desktop-0.2.0-setup.exe',
      bytes: installerContent.length
    })
  )
  writeFileSync(join(packageDir, 'hive-desktop-0.2.0-setup.exe'), installerContent)

  const tgzPath = join(workDir, 'fixture.tgz')
  tar.create({ file: tgzPath, gzip: true, cwd: sourceRoot, sync: true }, ['package'])
  return readFileSync(tgzPath)
}

function sha512Base64(buffer: Buffer): string {
  return createHash('sha512').update(buffer).digest('base64')
}

/** A `Downloader` whose single download always resolves to `buffer`, as one chunk. */
function fakeDownloader(buffer: Buffer, total: number | null = buffer.length): Downloader {
  return {
    download: async (): Promise<DownloadSource> => ({
      total,
      stream: Readable.from([buffer])
    })
  }
}

describe('downloadAndExtractUpdate', () => {
  let workDir: string
  let stagingDir: string

  beforeEach(() => {
    workDir = mkdtempSync(join(tmpdir(), 'hive-update-download-'))
    stagingDir = join(workDir, 'staging')
  })

  afterEach(() => {
    rmSync(workDir, { recursive: true, force: true })
  })

  it('downloads, verifies, extracts, and locates the installer (happy path)', async () => {
    const tarball = buildFixtureTarball(workDir)
    const payload: PayloadInfo = {
      tarballUrl: 'https://registry.npmjs.org/@user/hive-desktop-win-x64/-/x-0.2.0.tgz',
      integrity: `sha512-${sha512Base64(tarball)}`,
      bytes: tarball.length
    }

    const result = await downloadAndExtractUpdate(fakeDownloader(tarball), payload, stagingDir)

    expect(result.descriptor).toEqual({
      version: '0.2.0',
      platform: 'win32',
      arch: 'x64',
      installer: 'hive-desktop-0.2.0-setup.exe',
      bytes: 'fake-installer-bytes'.length
    })
    expect(result.installerPath).toBe(join(stagingDir, 'hive-desktop-0.2.0-setup.exe'))
    expect(existsSync(result.installerPath)).toBe(true)
    expect(readFileSync(result.installerPath, 'utf-8')).toBe('fake-installer-bytes')
    // The raw .tgz is cleaned up once extracted — only the unpacked contents remain.
    expect(existsSync(join(stagingDir, 'payload.tgz'))).toBe(false)
  })

  it('reports real transferred/total progress as the stream is consumed', async () => {
    const tarball = buildFixtureTarball(workDir)
    const payload: PayloadInfo = {
      tarballUrl: 'https://x/y.tgz',
      integrity: `sha512-${sha512Base64(tarball)}`,
      bytes: tarball.length
    }

    const events: { transferred: number; total: number | null }[] = []
    await downloadAndExtractUpdate(fakeDownloader(tarball), payload, stagingDir, {
      onProgress: (p) => events.push(p)
    })

    expect(events.length).toBeGreaterThan(0)
    expect(events.every((e) => e.total === tarball.length)).toBe(true)
    expect(events[events.length - 1].transferred).toBe(tarball.length)
  })

  it('falls back to payload.bytes as the total when the downloader reports no content-length', async () => {
    const tarball = buildFixtureTarball(workDir)
    const payload: PayloadInfo = {
      tarballUrl: 'https://x/y.tgz',
      integrity: `sha512-${sha512Base64(tarball)}`,
      bytes: tarball.length
    }

    const events: { transferred: number; total: number | null }[] = []
    await downloadAndExtractUpdate(fakeDownloader(tarball, null), payload, stagingDir, {
      onProgress: (p) => events.push(p)
    })

    expect(events.every((e) => e.total === tarball.length)).toBe(true)
  })

  it('integrity mismatch: deletes the artifact and throws a distinct error, never extracting', async () => {
    const tarball = buildFixtureTarball(workDir)
    const payload: PayloadInfo = {
      tarballUrl: 'https://x/y.tgz',
      // Deliberately wrong digest.
      integrity: `sha512-${sha512Base64(Buffer.from('not the real content'))}`,
      bytes: tarball.length
    }

    await expect(
      downloadAndExtractUpdate(fakeDownloader(tarball), payload, stagingDir)
    ).rejects.toThrow(IntegrityMismatchError)
    expect(existsSync(join(stagingDir, 'payload.tgz'))).toBe(false)
    expect(existsSync(join(stagingDir, 'hive-update.json'))).toBe(false)
  })

  it('cancel mid-stream: leaves no partial file and rejects with a distinct cancellation error', async () => {
    const tarball = buildFixtureTarball(workDir, 'x'.repeat(200_000))
    const payload: PayloadInfo = {
      tarballUrl: 'https://x/y.tgz',
      integrity: `sha512-${sha512Base64(tarball)}`,
      bytes: tarball.length
    }
    const controller = new AbortController()

    const promise = downloadAndExtractUpdate(fakeDownloader(tarball), payload, stagingDir, {
      signal: controller.signal,
      // Abort as soon as the first chunk has actually been processed, so the
      // cancellation genuinely lands mid-stream rather than before anything starts.
      onProgress: (p) => {
        if (p.transferred > 0) controller.abort()
      }
    })

    await expect(promise).rejects.toBeInstanceOf(DownloadCancelledError)
    expect(existsSync(join(stagingDir, 'payload.tgz'))).toBe(false)
    expect(existsSync(join(stagingDir, 'hive-update.json'))).toBe(false)
  })

  it('an already-aborted signal cancels before any download starts', async () => {
    const controller = new AbortController()
    controller.abort()
    const payload: PayloadInfo = {
      tarballUrl: 'https://x/y.tgz',
      integrity: 'sha512-anything',
      bytes: null
    }
    let downloadCalled = false
    const downloader: Downloader = {
      download: async () => {
        downloadCalled = true
        return { total: null, stream: Readable.from([]) }
      }
    }

    await expect(
      downloadAndExtractUpdate(downloader, payload, stagingDir, { signal: controller.signal })
    ).rejects.toBeInstanceOf(DownloadCancelledError)
    expect(downloadCalled).toBe(false)
  })

  it('rejects with the original error when the download stream errors out (not integrity/cancel)', async () => {
    const payload: PayloadInfo = {
      tarballUrl: 'https://x/y.tgz',
      integrity: 'sha512-anything',
      bytes: null
    }
    const failingStream = new Readable({
      read() {
        this.destroy(new Error('ECONNRESET'))
      }
    })
    const downloader: Downloader = {
      download: async () => ({ total: null, stream: failingStream })
    }

    await expect(downloadAndExtractUpdate(downloader, payload, stagingDir)).rejects.toThrow(
      'ECONNRESET'
    )
    expect(existsSync(join(stagingDir, 'payload.tgz'))).toBe(false)
  })

  it('rejects when the extracted package has no usable hive-update.json descriptor', async () => {
    const sourceRoot = join(workDir, 'source-bad')
    const packageDir = join(sourceRoot, 'package')
    mkdirSync(packageDir, { recursive: true })
    writeFileSync(join(packageDir, 'hive-update.json'), JSON.stringify({ version: '0.2.0' }))
    const tgzPath = join(workDir, 'bad.tgz')
    tar.create({ file: tgzPath, gzip: true, cwd: sourceRoot, sync: true }, ['package'])
    const tarball = readFileSync(tgzPath)

    const payload: PayloadInfo = {
      tarballUrl: 'https://x/y.tgz',
      integrity: `sha512-${sha512Base64(tarball)}`,
      bytes: tarball.length
    }

    await expect(
      downloadAndExtractUpdate(fakeDownloader(tarball), payload, stagingDir)
    ).rejects.toThrow(/hive-update\.json/)
  })
})
