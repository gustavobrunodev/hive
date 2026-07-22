import { createHash } from 'node:crypto'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { PayloadInfo } from './updateDownload'
import {
  DownloadCancelledError,
  type Downloader,
  type DownloadSource,
  IntegrityMismatchError,
  downloadAndVerifyInstaller
} from './updateDownload'

const INSTALLER_FILE_NAME = 'hive-desktop-0.2.0-setup.exe'

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

describe('downloadAndVerifyInstaller', () => {
  let workDir: string
  let stagingDir: string

  beforeEach(() => {
    workDir = mkdtempSync(join(tmpdir(), 'hive-update-download-'))
    stagingDir = join(workDir, 'staging')
  })

  afterEach(() => {
    rmSync(workDir, { recursive: true, force: true })
  })

  it('downloads to stagingDir/installerFileName and verifies it (happy path)', async () => {
    const installer = Buffer.from('fake-installer-bytes')
    const payload: PayloadInfo = {
      downloadUrl: 'https://github.com/user/hive/releases/download/v0.2.0/x.exe',
      integrity: `sha512-${sha512Base64(installer)}`,
      bytes: installer.length
    }

    const installerPath = await downloadAndVerifyInstaller(
      fakeDownloader(installer),
      payload,
      stagingDir,
      INSTALLER_FILE_NAME
    )

    expect(installerPath).toBe(join(stagingDir, INSTALLER_FILE_NAME))
    expect(existsSync(installerPath)).toBe(true)
    expect(readFileSync(installerPath, 'utf-8')).toBe('fake-installer-bytes')
  })

  it('reports real transferred/total progress as the stream is consumed', async () => {
    const installer = Buffer.from('x'.repeat(50_000))
    const payload: PayloadInfo = {
      downloadUrl: 'https://x/y.exe',
      integrity: `sha512-${sha512Base64(installer)}`,
      bytes: installer.length
    }

    const events: { transferred: number; total: number | null }[] = []
    await downloadAndVerifyInstaller(
      fakeDownloader(installer),
      payload,
      stagingDir,
      INSTALLER_FILE_NAME,
      { onProgress: (p) => events.push(p) }
    )

    expect(events.length).toBeGreaterThan(0)
    expect(events.every((e) => e.total === installer.length)).toBe(true)
    expect(events[events.length - 1].transferred).toBe(installer.length)
  })

  it('falls back to payload.bytes as the total when the downloader reports no content-length', async () => {
    const installer = Buffer.from('fake-installer-bytes')
    const payload: PayloadInfo = {
      downloadUrl: 'https://x/y.exe',
      integrity: `sha512-${sha512Base64(installer)}`,
      bytes: installer.length
    }

    const events: { transferred: number; total: number | null }[] = []
    await downloadAndVerifyInstaller(
      fakeDownloader(installer, null),
      payload,
      stagingDir,
      INSTALLER_FILE_NAME,
      { onProgress: (p) => events.push(p) }
    )

    expect(events.every((e) => e.total === installer.length)).toBe(true)
  })

  it('integrity mismatch: deletes the artifact and throws a distinct error', async () => {
    const installer = Buffer.from('fake-installer-bytes')
    const payload: PayloadInfo = {
      downloadUrl: 'https://x/y.exe',
      // Deliberately wrong digest.
      integrity: `sha512-${sha512Base64(Buffer.from('not the real content'))}`,
      bytes: installer.length
    }

    await expect(
      downloadAndVerifyInstaller(
        fakeDownloader(installer),
        payload,
        stagingDir,
        INSTALLER_FILE_NAME
      )
    ).rejects.toThrow(IntegrityMismatchError)
    expect(existsSync(join(stagingDir, INSTALLER_FILE_NAME))).toBe(false)
  })

  it('cancel mid-stream: leaves no partial file and rejects with a distinct cancellation error', async () => {
    const installer = Buffer.from('x'.repeat(200_000))
    const payload: PayloadInfo = {
      downloadUrl: 'https://x/y.exe',
      integrity: `sha512-${sha512Base64(installer)}`,
      bytes: installer.length
    }
    const controller = new AbortController()

    const promise = downloadAndVerifyInstaller(
      fakeDownloader(installer),
      payload,
      stagingDir,
      INSTALLER_FILE_NAME,
      {
        signal: controller.signal,
        // Abort as soon as the first chunk has actually been processed, so the
        // cancellation genuinely lands mid-stream rather than before anything starts.
        onProgress: (p) => {
          if (p.transferred > 0) controller.abort()
        }
      }
    )

    await expect(promise).rejects.toBeInstanceOf(DownloadCancelledError)
    expect(existsSync(join(stagingDir, INSTALLER_FILE_NAME))).toBe(false)
  })

  it('an already-aborted signal cancels before any download starts', async () => {
    const controller = new AbortController()
    controller.abort()
    const payload: PayloadInfo = {
      downloadUrl: 'https://x/y.exe',
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
      downloadAndVerifyInstaller(downloader, payload, stagingDir, INSTALLER_FILE_NAME, {
        signal: controller.signal
      })
    ).rejects.toBeInstanceOf(DownloadCancelledError)
    expect(downloadCalled).toBe(false)
  })

  it('rejects with the original error when the download stream errors out (not integrity/cancel)', async () => {
    const payload: PayloadInfo = {
      downloadUrl: 'https://x/y.exe',
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

    await expect(
      downloadAndVerifyInstaller(downloader, payload, stagingDir, INSTALLER_FILE_NAME)
    ).rejects.toThrow('ECONNRESET')
    expect(existsSync(join(stagingDir, INSTALLER_FILE_NAME))).toBe(false)
  })
})
