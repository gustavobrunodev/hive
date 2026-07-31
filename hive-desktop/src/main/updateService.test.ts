import { createHash } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { RegistryClient } from './npmRegistry'
import type { Downloader } from './updateDownload'
import type { WindowsApplyDeps } from './updateApply'
import {
  createUpdateService,
  type UpdateEvent,
  type UpdateServiceDeps,
  createRegistryClient,
  createDownloader
} from './updateService'

const PACKAGE_NAME = '@user/hive-desktop'
const REPO = 'user/hive'
const ASSET_NAME = 'hive-desktop-0.2.0-setup.exe'
const INSTALLER_URL =
  'https://github.com/user/hive/releases/download/v0.2.0/hive-desktop-0.2.0-setup.exe'
const MANIFEST_URL = 'https://github.com/user/hive/releases/download/v0.2.0/hive-update.json'

function sha512Base64(buffer: Buffer): string {
  return createHash('sha512').update(buffer).digest('base64')
}

/** A `/latest` JSON body shaped like the real npm registry response (design.md §2A). */
function latestBody(
  version: string,
  platformAsset: string | null,
  notes: string | null = null,
  repo: string = REPO
): unknown {
  return {
    version,
    hiveRelease: platformAsset
      ? { notes, repo, platforms: { [`${process.platform}-${process.arch}`]: platformAsset } }
      : { notes, repo, platforms: {} }
  }
}

/** A GitHub release-by-tag JSON body — the installer + manifest assets (design.md §2A). */
function githubReleaseBody(installerBytes: number): unknown {
  return {
    assets: [
      { name: ASSET_NAME, browser_download_url: INSTALLER_URL, size: installerBytes },
      { name: 'hive-update.json', browser_download_url: MANIFEST_URL, size: 200 }
    ]
  }
}

/** The `hive-update.json` manifest content for a given installer buffer. */
function manifestBody(installer: Buffer, overrides: Record<string, unknown> = {}): unknown {
  return {
    version: '0.2.0',
    platform: 'win32',
    arch: 'x64',
    installer: ASSET_NAME,
    bytes: installer.length,
    sha512: sha512Base64(installer),
    ...overrides
  }
}

interface FakeRegistryOptions {
  latest?: unknown
  latestRejects?: Error
  release?: unknown
  releaseRejects?: Error
  manifest?: unknown
}

/**
 * A `RegistryClient` fake that dispatches on URL shape: a `/latest` npm
 * lookup, a `/repos/…/releases/tags/…` GitHub release lookup, or (anything
 * else) the manifest asset's own `browser_download_url` fetch — mirroring
 * how `updateService.ts` reuses one client for both origins.
 */
function createFakeRegistryClient(opts: FakeRegistryOptions): RegistryClient & { calls: string[] } {
  const calls: string[] = []
  return {
    calls,
    async fetchJson(url: string): Promise<unknown> {
      calls.push(url)
      if (url.endsWith('/latest')) {
        if (opts.latestRejects) throw opts.latestRejects
        return opts.latest
      }
      if (url.includes('/repos/')) {
        if (opts.releaseRejects) throw opts.releaseRejects
        return opts.release
      }
      return opts.manifest
    }
  }
}

/** A `Downloader` whose single download always resolves to `buffer`, as one chunk. */
function fakeDownloader(buffer: Buffer, total: number | null = buffer.length): Downloader {
  return {
    download: async () => ({ total, stream: Readable.from([buffer]) })
  }
}

function fakeApplyDeps(): WindowsApplyDeps & { spawnCalls: unknown[][]; quitCalls: number } {
  const spawnCalls: unknown[][] = []
  let quitCalls = 0
  return {
    spawnCalls,
    get quitCalls() {
      return quitCalls
    },
    spawn: (command, args, options) => {
      spawnCalls.push([command, args, options])
      return { unref: () => {} }
    },
    quit: () => {
      quitCalls += 1
    }
  }
}

describe('createUpdateService', () => {
  let workDir: string
  let stagingRoot: string

  beforeEach(() => {
    workDir = mkdtempSync(join(tmpdir(), 'hive-update-service-'))
    stagingRoot = join(workDir, 'updates')
  })

  afterEach(() => {
    rmSync(workDir, { recursive: true, force: true })
  })

  function baseDeps(overrides: Partial<UpdateServiceDeps> = {}): UpdateServiceDeps {
    return {
      registryClient: createFakeRegistryClient({}),
      downloader: fakeDownloader(Buffer.from('unused')),
      applyDeps: fakeApplyDeps(),
      packageName: PACKAGE_NAME,
      currentVersion: '0.1.0',
      platform: 'win32',
      stagingRoot,
      supported: true,
      ...overrides
    }
  }

  it('unsupported (dev/unpacked): every method is a no-op, nothing is ever emitted', async () => {
    const service = createUpdateService(baseDeps({ supported: false }))
    const seen: UpdateEvent[] = []
    service.onEvent((e) => seen.push(e))

    service.check(true)
    service.download()
    service.install()
    service.cancel()
    await flush()

    expect(seen).toEqual([])
    expect(service.getCanApply()).toBe(true) // canApply reflects the resolved strategy regardless of `supported`
    expect(service.getLastCheckedAt()).toBeNull()
  })

  it('canApply reflects the resolved per-platform strategy: true on win32, false elsewhere', () => {
    const win = createUpdateService(baseDeps({ platform: 'win32' }))
    const mac = createUpdateService(baseDeps({ platform: 'darwin' }))
    const linux = createUpdateService(baseDeps({ platform: 'linux' }))
    expect(win.getCanApply()).toBe(true)
    expect(mac.getCanApply()).toBe(false)
    expect(linux.getCanApply()).toBe(false)
  })

  describe('check()', () => {
    it('silent (explicit:false) check with nothing newer emits nothing, but updates lastCheckedAt', async () => {
      const registryClient = createFakeRegistryClient({ latest: latestBody('0.1.0', null) })
      const service = createUpdateService(baseDeps({ registryClient }))
      const seen: UpdateEvent[] = []
      service.onEvent((e) => seen.push(e))

      expect(service.getLastCheckedAt()).toBeNull()
      service.check(false)
      await flush()

      expect(seen).toEqual([])
      expect(service.getLastCheckedAt()).not.toBeNull()
    })

    it('explicit check with nothing newer emits checking then not-available', async () => {
      const registryClient = createFakeRegistryClient({ latest: latestBody('0.1.0', null) })
      const service = createUpdateService(baseDeps({ registryClient }))
      const seen: UpdateEvent[] = []
      service.onEvent((e) => seen.push(e))

      service.check(true)
      await flush()

      expect(seen).toEqual([{ type: 'checking' }, { type: 'not-available' }])
    })

    it('explicit check when a newer version exists but has no platform payload emits not-available', async () => {
      const registryClient = createFakeRegistryClient({ latest: latestBody('0.2.0', null) })
      const service = createUpdateService(baseDeps({ registryClient }))
      const seen: UpdateEvent[] = []
      service.onEvent((e) => seen.push(e))

      service.check(true)
      await flush()

      expect(seen).toEqual([{ type: 'checking' }, { type: 'not-available' }])
    })

    it('a genuinely older/equal registry version never re-offers a downgrade (semver, not string compare)', async () => {
      const registryClient = createFakeRegistryClient({
        latest: latestBody('0.1.0', ASSET_NAME)
      })
      const service = createUpdateService(baseDeps({ registryClient, currentVersion: '0.1.0' }))
      const seen: UpdateEvent[] = []
      service.onEvent((e) => seen.push(e))

      service.check(true)
      await flush()

      expect(seen).toEqual([{ type: 'checking' }, { type: 'not-available' }])
    })

    it('newer + platform payload: emits available with bytes/notes from the follow-up GitHub fetch (both explicit and silent)', async () => {
      const installer = Buffer.from('fake-installer-bytes')
      const registryClient = createFakeRegistryClient({
        latest: latestBody('0.2.0', ASSET_NAME, '### Novidades'),
        release: githubReleaseBody(installer.length),
        manifest: manifestBody(installer)
      })
      const service = createUpdateService(baseDeps({ registryClient }))
      const seen: UpdateEvent[] = []
      service.onEvent((e) => seen.push(e))

      service.check(false)
      await flush()

      expect(seen).toEqual([
        {
          type: 'available',
          version: '0.2.0',
          bytes: installer.length,
          notes: '### Novidades'
        }
      ])
    })

    it('registry offline/DNS/5xx/timeout at the /latest step degrades to not-available, silent when not explicit', async () => {
      const registryClient = createFakeRegistryClient({
        latestRejects: new Error('should never reach here')
      })
      // fetchLatestRelease itself swallows this — simulate the real contract
      // by asserting the service behaves the same as "nothing newer" rather
      // than by bypassing fetchLatestRelease's own guarantee.
      const service = createUpdateService(baseDeps({ registryClient }))
      const seen: UpdateEvent[] = []
      service.onEvent((e) => seen.push(e))

      service.check(false)
      await flush()
      expect(seen).toEqual([])
      expect(service.getLastCheckedAt()).not.toBeNull()

      service.check(true)
      await flush()
      expect(seen).toEqual([{ type: 'checking' }, { type: 'not-available' }])
    })

    it('a failure at the GitHub payload follow-up step is a genuine, freshly-observed error: explicit emits error{kind:network}, silent emits nothing', async () => {
      const registryClient = createFakeRegistryClient({
        latest: latestBody('0.2.0', ASSET_NAME),
        releaseRejects: new Error('registry hiccup')
      })
      const service = createUpdateService(baseDeps({ registryClient }))
      const seen: UpdateEvent[] = []
      service.onEvent((e) => seen.push(e))

      service.check(false)
      await flush()
      expect(seen).toEqual([])
      expect(service.getLastCheckedAt()).not.toBeNull()

      service.check(true)
      await flush()
      expect(seen).toEqual([
        { type: 'checking' },
        { type: 'error', message: 'registry hiccup', kind: 'network' }
      ])
    })

    it('lastCheckedAt updates on every check attempt, success or failure, explicit or silent', async () => {
      const registryClient = createFakeRegistryClient({ latest: latestBody('0.1.0', null) })
      const service = createUpdateService(baseDeps({ registryClient }))
      expect(service.getLastCheckedAt()).toBeNull()

      service.check(false)
      await flush()
      const first = service.getLastCheckedAt()
      expect(first).not.toBeNull()

      await new Promise((r) => setTimeout(r, 2))
      service.check(true)
      await flush()
      expect(service.getLastCheckedAt()).toBeGreaterThanOrEqual(first as number)
    })
  })

  describe('download()', () => {
    it('does nothing when no version is pending (defensive — the UI must not expose this control otherwise)', async () => {
      const service = createUpdateService(baseDeps())
      const seen: UpdateEvent[] = []
      service.onEvent((e) => seen.push(e))
      service.download()
      await flush()
      expect(seen).toEqual([])
    })
  })

  it('full happy path event ordering: checking -> available -> progress(es) -> verifying -> downloaded -> applying', async () => {
    const installer = Buffer.from('fake-installer-bytes')
    const registryClient = createFakeRegistryClient({
      latest: latestBody('0.2.0', ASSET_NAME, 'notes'),
      release: githubReleaseBody(installer.length),
      manifest: manifestBody(installer)
    })
    const applyDeps = fakeApplyDeps()
    const service = createUpdateService(
      baseDeps({ registryClient, downloader: fakeDownloader(installer), applyDeps })
    )
    const seen: UpdateEvent[] = []
    service.onEvent((e) => seen.push(e))

    service.check(true)
    await flush()
    service.download()
    await flush()
    service.install()
    await flush()

    expect(seen[0]).toEqual({ type: 'checking' })
    expect(seen[1]).toEqual({
      type: 'available',
      version: '0.2.0',
      bytes: installer.length,
      notes: 'notes'
    })
    const progressEvents = seen.filter((e) => e.type === 'progress')
    expect(progressEvents.length).toBeGreaterThan(0)
    for (const p of progressEvents) {
      if (p.type === 'progress') {
        expect(p.total).toBe(installer.length)
        expect(p.transferred).toBeGreaterThanOrEqual(0)
        expect(p.transferred).toBeLessThanOrEqual(p.total)
      }
    }
    const verifyingIndex = seen.findIndex((e) => e.type === 'verifying')
    const downloadedIndex = seen.findIndex((e) => e.type === 'downloaded')
    const applyingIndex = seen.findIndex((e) => e.type === 'applying')
    expect(verifyingIndex).toBeGreaterThan(-1)
    expect(downloadedIndex).toBeGreaterThan(verifyingIndex)
    expect(seen[downloadedIndex]).toEqual({
      type: 'downloaded',
      version: '0.2.0',
      installerPath: join(stagingRoot, '0.2.0', ASSET_NAME)
    })
    expect(applyingIndex).toBeGreaterThan(downloadedIndex)
    expect(seen[applyingIndex + 1]).toBeUndefined() // apply succeeds silently (spawn+quit), no further event

    expect(applyDeps.spawnCalls).toEqual([
      [join(stagingRoot, '0.2.0', ASSET_NAME), [], { detached: true, stdio: 'ignore' }]
    ])
    expect(applyDeps.quitCalls).toBe(1)
  })

  /**
   * P0-012 (test-design-qa.md, risk R-10 — OPS, score 6): "applying a
   * downloaded update swaps the payload and the app comes up on the new
   * version", against a fake registry.
   *
   * The happy path above proves the event ORDER and that the right *path* is
   * handed to the platform strategy. What it cannot see is whether the bytes
   * at that path are the ones the registry advertised — a swap that stages the
   * wrong payload, or reuses a stale one, produces exactly the same event
   * sequence and the same path. The native apply itself stays manual (no
   * Windows hardware, ND T18); everything up to handing the installer over is
   * automatable, and that is what these two pin.
   */
  it('stages the exact advertised payload — bytes on disk match the manifest sha512', async () => {
    const installer = Buffer.from('the real 0.2.0 installer payload')
    const registryClient = createFakeRegistryClient({
      latest: latestBody('0.2.0', ASSET_NAME, 'notes'),
      release: githubReleaseBody(installer.length),
      manifest: manifestBody(installer)
    })
    const applyDeps = fakeApplyDeps()
    const service = createUpdateService(
      baseDeps({ registryClient, downloader: fakeDownloader(installer), applyDeps })
    )

    service.check(true)
    await flush()
    service.download()
    await flush()
    service.install()
    await flush()

    const staged = join(stagingRoot, '0.2.0', ASSET_NAME)
    // The installer handed to the platform strategy is the file on disk…
    expect(applyDeps.spawnCalls[0][0]).toBe(staged)
    // …and its bytes are the advertised payload, not a truncated or stale one.
    const onDisk = readFileSync(staged)
    expect(onDisk.equals(installer)).toBe(true)
    expect(sha512Base64(onDisk)).toBe(sha512Base64(installer))
    expect(applyDeps.quitCalls).toBe(1)
  })

  it('a second, newer release stages its own payload rather than re-applying the first', async () => {
    // The upgrade-twice bug: a service that keys staging on "already
    // downloaded" rather than on the version happily re-applies the previous
    // installer, and the user stays on the old build while every event says
    // the update succeeded.
    const first = Buffer.from('installer for 0.2.0')
    const second = Buffer.from('a DIFFERENT installer, for 0.3.0')

    const firstRun = createUpdateService(
      baseDeps({
        registryClient: createFakeRegistryClient({
          latest: latestBody('0.2.0', ASSET_NAME),
          release: githubReleaseBody(first.length),
          manifest: manifestBody(first)
        }),
        downloader: fakeDownloader(first)
      })
    )
    firstRun.check(true)
    await flush()
    firstRun.download()
    await flush()
    expect(readFileSync(join(stagingRoot, '0.2.0', ASSET_NAME)).equals(first)).toBe(true)

    // A later session, now running 0.2.0, finds 0.3.0 — same staging root.
    const applyDeps = fakeApplyDeps()
    const secondRun = createUpdateService(
      baseDeps({
        currentVersion: '0.2.0',
        applyDeps,
        registryClient: createFakeRegistryClient({
          latest: latestBody('0.3.0', ASSET_NAME),
          release: githubReleaseBody(second.length),
          manifest: manifestBody(second, { version: '0.3.0', bytes: second.length })
        }),
        downloader: fakeDownloader(second)
      })
    )
    secondRun.check(true)
    await flush()
    secondRun.download()
    await flush()
    secondRun.install()
    await flush()

    const staged = join(stagingRoot, '0.3.0', ASSET_NAME)
    expect(applyDeps.spawnCalls[0][0]).toBe(staged)
    expect(readFileSync(staged).equals(second)).toBe(true)
    // The 0.2.0 payload is not what got applied.
    expect(readFileSync(staged).equals(first)).toBe(false)
  })

  it('falls back to emitting verifying right before downloaded when total is never known', async () => {
    const installer = Buffer.from('fake-installer-bytes')
    const registryClient = createFakeRegistryClient({
      latest: latestBody('0.2.0', ASSET_NAME),
      // Installer asset reports no usable size either — neither the
      // downloader's content-length nor this fallback exist.
      release: githubReleaseBody(0),
      manifest: manifestBody(installer)
    })
    const service = createUpdateService(
      baseDeps({ registryClient, downloader: fakeDownloader(installer, null) })
    )
    const seen: UpdateEvent[] = []
    service.onEvent((e) => seen.push(e))

    service.check(true)
    await flush()
    service.download()
    await flush()

    const verifyingIndex = seen.findIndex((e) => e.type === 'verifying')
    const downloadedIndex = seen.findIndex((e) => e.type === 'downloaded')
    expect(verifyingIndex).toBe(downloadedIndex - 1)
    const progressEvents = seen.filter((e) => e.type === 'progress')
    expect(progressEvents.every((e) => e.type === 'progress' && e.total === 0)).toBe(true)
  })

  it('integrity mismatch: distinct error kind, never auto-retried, no download re-attempted on its own', async () => {
    const installer = Buffer.from('fake-installer-bytes')
    const registryClient = createFakeRegistryClient({
      latest: latestBody('0.2.0', ASSET_NAME),
      release: githubReleaseBody(installer.length),
      // Deliberately wrong digest — the manifest's sha512 will never match
      // the real installer bytes the download step fetches.
      manifest: manifestBody(installer, {
        sha512: sha512Base64(Buffer.from('not the real content'))
      })
    })
    const service = createUpdateService(
      baseDeps({ registryClient, downloader: fakeDownloader(installer) })
    )
    const seen: UpdateEvent[] = []
    service.onEvent((e) => seen.push(e))

    service.check(true)
    await flush()
    seen.length = 0
    service.download()
    await flush()

    // The stream genuinely completes (progress/verifying fire honestly)
    // before the hash comparison — done only at the very end — discovers the
    // mismatch; the important assertions are the *last* event's shape and
    // that no `downloaded` ever fires and nothing auto-retries.
    expect(seen[seen.length - 1]).toEqual({
      type: 'error',
      message: expect.any(String),
      kind: 'integrity'
    })
    expect(seen.some((e) => e.type === 'downloaded')).toBe(false)
    expect(seen.filter((e) => e.type === 'error')).toHaveLength(1)
  })

  it('a non-integrity download failure emits error{kind: network}', async () => {
    const installer = Buffer.from('irrelevant')
    const registryClient = createFakeRegistryClient({
      latest: latestBody('0.2.0', ASSET_NAME),
      release: githubReleaseBody(installer.length),
      manifest: manifestBody(installer)
    })
    const failingDownloader: Downloader = {
      download: async () => {
        throw new Error('ECONNRESET')
      }
    }
    const service = createUpdateService(baseDeps({ registryClient, downloader: failingDownloader }))
    const seen: UpdateEvent[] = []
    service.onEvent((e) => seen.push(e))

    service.check(true)
    await flush()
    seen.length = 0
    service.download()
    await flush()

    expect(seen).toEqual([{ type: 'error', message: 'ECONNRESET', kind: 'network' }])
  })

  it('cancel(): no error event at all, and the staging dir holds no partial artifact afterward', async () => {
    const installer = Buffer.from('x'.repeat(200_000))
    const registryClient = createFakeRegistryClient({
      latest: latestBody('0.2.0', ASSET_NAME),
      release: githubReleaseBody(installer.length),
      manifest: manifestBody(installer)
    })
    const service = createUpdateService(
      baseDeps({ registryClient, downloader: fakeDownloader(installer) })
    )
    const seen: UpdateEvent[] = []
    service.onEvent((e) => {
      seen.push(e)
      if (e.type === 'progress' && e.transferred > 0) service.cancel()
    })

    service.check(true)
    await flush()
    seen.length = 0
    service.download()
    // More generous than the default flush: this path does real disk I/O
    // (writing part of a 200 KB fixture, then tearing streams down and
    // removing the partial file on abort) on top of the async cancellation
    // itself settling.
    await flush(400)

    expect(seen.some((e) => e.type === 'error')).toBe(false)
    expect(seen.some((e) => e.type === 'downloaded')).toBe(false)
    const versionDir = join(stagingRoot, '0.2.0')
    if (existsSync(versionDir)) {
      expect(readdirSync(versionDir)).toEqual([])
    }
  })

  it('cancel() with nothing downloading is a no-op', () => {
    const service = createUpdateService(baseDeps())
    expect(() => service.cancel()).not.toThrow()
  })

  describe('install()', () => {
    it('never fires without an explicit install() call — check()/download() alone never emit applying', async () => {
      const installer = Buffer.from('fake-installer-bytes')
      const registryClient = createFakeRegistryClient({
        latest: latestBody('0.2.0', ASSET_NAME),
        release: githubReleaseBody(installer.length),
        manifest: manifestBody(installer)
      })
      const applyDeps = fakeApplyDeps()
      const service = createUpdateService(
        baseDeps({ registryClient, downloader: fakeDownloader(installer), applyDeps })
      )
      const seen: UpdateEvent[] = []
      service.onEvent((e) => seen.push(e))

      service.check(true)
      await flush()
      service.download()
      await flush()

      expect(seen.some((e) => e.type === 'applying')).toBe(false)
      expect(applyDeps.spawnCalls).toEqual([])
      expect(applyDeps.quitCalls).toBe(0)
    })

    it('defends against being called with nothing downloaded: emits error{kind: apply} rather than throwing', async () => {
      const service = createUpdateService(baseDeps())
      const seen: UpdateEvent[] = []
      service.onEvent((e) => seen.push(e))

      service.install()
      await flush()

      expect(seen).toEqual([{ type: 'error', message: expect.any(String), kind: 'apply' }])
    })

    it('canApply:false (non-Windows): install() defends with error{kind: apply} even after a real download', async () => {
      const installer = Buffer.from('fake-installer-bytes')
      const registryClient = createFakeRegistryClient({
        latest: latestBody('0.2.0', ASSET_NAME),
        release: githubReleaseBody(installer.length),
        manifest: manifestBody(installer)
      })
      const service = createUpdateService(
        baseDeps({ registryClient, downloader: fakeDownloader(installer), platform: 'darwin' })
      )
      const seen: UpdateEvent[] = []
      service.onEvent((e) => seen.push(e))

      service.check(true)
      await flush()
      service.download()
      await flush()
      seen.length = 0
      service.install()
      await flush()

      expect(seen).toEqual([{ type: 'error', message: expect.any(String), kind: 'apply' }])
    })

    it('an apply failure emits error{kind: apply} and never deletes the installer', async () => {
      const installer = Buffer.from('fake-installer-bytes')
      const registryClient = createFakeRegistryClient({
        latest: latestBody('0.2.0', ASSET_NAME),
        release: githubReleaseBody(installer.length),
        manifest: manifestBody(installer)
      })
      const applyDeps: WindowsApplyDeps = {
        spawn: () => {
          throw new Error('spawn EACCES')
        },
        quit: () => {}
      }
      const service = createUpdateService(
        baseDeps({ registryClient, downloader: fakeDownloader(installer), applyDeps })
      )
      const seen: UpdateEvent[] = []
      service.onEvent((e) => seen.push(e))

      service.check(true)
      await flush()
      service.download()
      await flush()
      const installerPath = service.getInstallerPath()
      expect(installerPath).not.toBeNull()
      seen.length = 0
      service.install()
      await flush()

      expect(seen[0]).toEqual({ type: 'applying' })
      expect(seen[1]).toEqual({ type: 'error', message: 'spawn EACCES', kind: 'apply' })
      expect(existsSync(installerPath as string)).toBe(true)
    })
  })

  it('getInstallerPath reflects the last successful download and stays null until then', async () => {
    const installer = Buffer.from('fake-installer-bytes')
    const registryClient = createFakeRegistryClient({
      latest: latestBody('0.2.0', ASSET_NAME),
      release: githubReleaseBody(installer.length),
      manifest: manifestBody(installer)
    })
    const service = createUpdateService(
      baseDeps({ registryClient, downloader: fakeDownloader(installer) })
    )
    expect(service.getInstallerPath()).toBeNull()

    service.check(true)
    await flush()
    service.download()
    await flush()

    expect(service.getInstallerPath()).toBe(join(stagingRoot, '0.2.0', ASSET_NAME))
  })

  it('stale staging cleanup: a leftover directory from a previous version is removed once a new one is pending', async () => {
    mkdirSync(join(stagingRoot, '0.1.5-stale'), { recursive: true })
    writeFileSync(join(stagingRoot, '0.1.5-stale', 'leftover.tmp'), 'x')

    const installer = Buffer.from('fake-installer-bytes')
    const registryClient = createFakeRegistryClient({
      latest: latestBody('0.2.0', ASSET_NAME),
      release: githubReleaseBody(installer.length),
      manifest: manifestBody(installer)
    })
    const service = createUpdateService(
      baseDeps({ registryClient, downloader: fakeDownloader(installer) })
    )

    service.check(true)
    await flush()

    expect(existsSync(join(stagingRoot, '0.1.5-stale'))).toBe(false)
  })

  it('onEvent unsubscribe stops delivery', async () => {
    const registryClient = createFakeRegistryClient({ latest: latestBody('0.1.0', null) })
    const service = createUpdateService(baseDeps({ registryClient }))
    const seen: UpdateEvent[] = []
    const unsubscribe = service.onEvent((e) => seen.push(e))
    unsubscribe()

    service.check(true)
    await flush()

    expect(seen).toEqual([])
  })
})

describe('createRegistryClient (real fetch-based implementation)', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('resolves parsed JSON on a 2xx response', async () => {
    globalThis.fetch = vi.fn(
      async () => new Response(JSON.stringify({ ok: true }), { status: 200 })
    ) as typeof fetch

    const client = createRegistryClient()
    await expect(client.fetchJson('https://registry.npmjs.org/x/latest')).resolves.toEqual({
      ok: true
    })
  })

  it('rejects on a non-2xx response', async () => {
    globalThis.fetch = vi.fn(async () => new Response('not found', { status: 404 })) as typeof fetch

    const client = createRegistryClient()
    await expect(client.fetchJson('https://registry.npmjs.org/x/latest')).rejects.toThrow(/404/)
  })

  it('sends a User-Agent header (GitHub Releases API requires one; npm ignores it)', async () => {
    let seenInit: RequestInit | undefined
    globalThis.fetch = vi.fn(async (_url, init?: RequestInit) => {
      seenInit = init
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    }) as typeof fetch

    const client = createRegistryClient()
    await client.fetchJson('https://api.github.com/repos/user/hive/releases/tags/v0.2.0')

    const headers = new Headers(seenInit?.headers)
    expect(headers.get('User-Agent')).toBe('hive-desktop-self-updater')
  })
})

describe('createDownloader (real fetch-based implementation)', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('resolves a Node stream + total from content-length on a 2xx response', async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('hello'))
        controller.close()
      }
    })
    globalThis.fetch = vi.fn(
      async () => new Response(body, { status: 200, headers: { 'content-length': '5' } })
    ) as typeof fetch

    const downloader = createDownloader()
    const source = await downloader.download(
      'https://github.com/user/hive/releases/download/v1.0.0/x.exe'
    )
    expect(source.total).toBe(5)
    const chunks: Buffer[] = []
    for await (const chunk of source.stream as unknown as AsyncIterable<Buffer>) {
      chunks.push(Buffer.from(chunk))
    }
    expect(Buffer.concat(chunks).toString('utf-8')).toBe('hello')
  })

  it('total is null when content-length is absent', async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('hi'))
        controller.close()
      }
    })
    globalThis.fetch = vi.fn(async () => new Response(body, { status: 200 })) as typeof fetch

    const downloader = createDownloader()
    const source = await downloader.download(
      'https://github.com/user/hive/releases/download/v1.0.0/x.exe'
    )
    expect(source.total).toBeNull()
  })

  it('rejects on a non-2xx response or a missing body', async () => {
    globalThis.fetch = vi.fn(async () => new Response(null, { status: 500 })) as typeof fetch

    const downloader = createDownloader()
    await expect(downloader.download('https://x/y.exe')).rejects.toThrow(/500/)
  })
})

/** Flushes pending microtasks/timers so a fire-and-forget void method's internal async work settles. */
async function flush(ms = 150): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms))
}
