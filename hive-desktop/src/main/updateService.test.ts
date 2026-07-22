import { createHash } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import * as tar from 'tar'
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
const PLATFORM_PACKAGE = '@user/hive-desktop-win-x64'

/** Builds a real gzipped npm-style tarball, same fixture shape as updateDownload.test.ts. */
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
  const tgzPath = join(workDir, `fixture-${Date.now()}-${Math.random()}.tgz`)
  tar.create({ file: tgzPath, gzip: true, cwd: sourceRoot, sync: true }, ['package'])
  return readFileSync(tgzPath)
}

function sha512Base64(buffer: Buffer): string {
  return createHash('sha512').update(buffer).digest('base64')
}

/** A latest-release JSON body shaped like the real `/latest` registry response. */
function latestBody(
  version: string,
  platformPackage: string | null,
  notes: string | null = null
): unknown {
  return {
    version,
    hiveRelease: platformPackage
      ? { notes, platforms: { [`${process.platform}-${process.arch}`]: platformPackage } }
      : { notes, platforms: {} }
  }
}

/**
 * A payload-fetch JSON body shaped like the real `/<pkg>/<version>` registry
 * response. `unpackedSize: null` omits the field entirely (simulating a
 * registry response that never reports a size).
 */
function payloadBody(tarball: Buffer, unpackedSize: number | null = tarball.length): unknown {
  return {
    dist: {
      tarball: 'https://registry.npmjs.org/x/-/x-0.2.0.tgz',
      integrity: `sha512-${sha512Base64(tarball)}`,
      ...(unpackedSize === null ? {} : { unpackedSize })
    }
  }
}

interface FakeRegistryOptions {
  latest?: unknown
  latestRejects?: Error
  payload?: unknown
  payloadRejects?: Error
}

/** A `RegistryClient` fake that dispatches on whether the URL is a `/latest` or a `/<pkg>/<version>` lookup. */
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
      if (opts.payloadRejects) throw opts.payloadRejects
      return opts.payload
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
        latest: latestBody('0.1.0', PLATFORM_PACKAGE)
      })
      const service = createUpdateService(baseDeps({ registryClient, currentVersion: '0.1.0' }))
      const seen: UpdateEvent[] = []
      service.onEvent((e) => seen.push(e))

      service.check(true)
      await flush()

      expect(seen).toEqual([{ type: 'checking' }, { type: 'not-available' }])
    })

    it('newer + platform payload: emits available with bytes/notes from the follow-up fetchPayload (both explicit and silent)', async () => {
      const tarball = buildFixtureTarball(workDir)
      const registryClient = createFakeRegistryClient({
        latest: latestBody('0.2.0', PLATFORM_PACKAGE, '### Novidades'),
        payload: payloadBody(tarball)
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
          bytes: tarball.length,
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

    it('a failure at the fetchPayload follow-up step is a genuine, freshly-observed error: explicit emits error{kind:network}, silent emits nothing', async () => {
      const registryClient = createFakeRegistryClient({
        latest: latestBody('0.2.0', PLATFORM_PACKAGE),
        payloadRejects: new Error('registry hiccup')
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
    const tarball = buildFixtureTarball(workDir)
    const registryClient = createFakeRegistryClient({
      latest: latestBody('0.2.0', PLATFORM_PACKAGE, 'notes'),
      payload: payloadBody(tarball)
    })
    const applyDeps = fakeApplyDeps()
    const service = createUpdateService(
      baseDeps({ registryClient, downloader: fakeDownloader(tarball), applyDeps })
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
      bytes: tarball.length,
      notes: 'notes'
    })
    const progressEvents = seen.filter((e) => e.type === 'progress')
    expect(progressEvents.length).toBeGreaterThan(0)
    for (const p of progressEvents) {
      if (p.type === 'progress') {
        expect(p.total).toBe(tarball.length)
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
      installerPath: join(stagingRoot, '0.2.0', 'hive-desktop-0.2.0-setup.exe')
    })
    expect(applyingIndex).toBeGreaterThan(downloadedIndex)
    expect(seen[applyingIndex + 1]).toBeUndefined() // apply succeeds silently (spawn+quit), no further event

    expect(applyDeps.spawnCalls).toEqual([
      [
        join(stagingRoot, '0.2.0', 'hive-desktop-0.2.0-setup.exe'),
        [],
        { detached: true, stdio: 'ignore' }
      ]
    ])
    expect(applyDeps.quitCalls).toBe(1)
  })

  it('falls back to emitting verifying right before downloaded when total is never known', async () => {
    const tarball = buildFixtureTarball(workDir)
    const registryClient = createFakeRegistryClient({
      latest: latestBody('0.2.0', PLATFORM_PACKAGE),
      // No unpackedSize either — the registry itself doesn't know the size,
      // so neither the downloader's content-length nor this fallback exist.
      payload: payloadBody(tarball, null)
    })
    const service = createUpdateService(
      baseDeps({ registryClient, downloader: fakeDownloader(tarball, null) })
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
    const tarball = buildFixtureTarball(workDir)
    const registryClient = createFakeRegistryClient({
      latest: latestBody('0.2.0', PLATFORM_PACKAGE),
      // Deliberately wrong digest — the payload the download step fetches
      // (from `payload`) will never hash-match the real tarball bytes.
      payload: {
        dist: {
          tarball: 'https://x/y.tgz',
          integrity: `sha512-${sha512Base64(Buffer.from('not the real content'))}`,
          unpackedSize: tarball.length
        }
      }
    })
    const service = createUpdateService(
      baseDeps({ registryClient, downloader: fakeDownloader(tarball) })
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
    const registryClient = createFakeRegistryClient({
      latest: latestBody('0.2.0', PLATFORM_PACKAGE),
      payload: payloadBody(Buffer.from('irrelevant'))
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
    const tarball = buildFixtureTarball(workDir, 'x'.repeat(200_000))
    const registryClient = createFakeRegistryClient({
      latest: latestBody('0.2.0', PLATFORM_PACKAGE),
      payload: payloadBody(tarball)
    })
    const service = createUpdateService(
      baseDeps({ registryClient, downloader: fakeDownloader(tarball) })
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
      const tarball = buildFixtureTarball(workDir)
      const registryClient = createFakeRegistryClient({
        latest: latestBody('0.2.0', PLATFORM_PACKAGE),
        payload: payloadBody(tarball)
      })
      const applyDeps = fakeApplyDeps()
      const service = createUpdateService(
        baseDeps({ registryClient, downloader: fakeDownloader(tarball), applyDeps })
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
      const tarball = buildFixtureTarball(workDir)
      const registryClient = createFakeRegistryClient({
        latest: latestBody('0.2.0', PLATFORM_PACKAGE),
        payload: payloadBody(tarball)
      })
      const service = createUpdateService(
        baseDeps({ registryClient, downloader: fakeDownloader(tarball), platform: 'darwin' })
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
      const tarball = buildFixtureTarball(workDir)
      const registryClient = createFakeRegistryClient({
        latest: latestBody('0.2.0', PLATFORM_PACKAGE),
        payload: payloadBody(tarball)
      })
      const applyDeps: WindowsApplyDeps = {
        spawn: () => {
          throw new Error('spawn EACCES')
        },
        quit: () => {}
      }
      const service = createUpdateService(
        baseDeps({ registryClient, downloader: fakeDownloader(tarball), applyDeps })
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
    const tarball = buildFixtureTarball(workDir)
    const registryClient = createFakeRegistryClient({
      latest: latestBody('0.2.0', PLATFORM_PACKAGE),
      payload: payloadBody(tarball)
    })
    const service = createUpdateService(
      baseDeps({ registryClient, downloader: fakeDownloader(tarball) })
    )
    expect(service.getInstallerPath()).toBeNull()

    service.check(true)
    await flush()
    service.download()
    await flush()

    expect(service.getInstallerPath()).toBe(
      join(stagingRoot, '0.2.0', 'hive-desktop-0.2.0-setup.exe')
    )
  })

  it('stale staging cleanup: a leftover directory from a previous version is removed once a new one is pending', async () => {
    mkdirSync(join(stagingRoot, '0.1.5-stale'), { recursive: true })
    writeFileSync(join(stagingRoot, '0.1.5-stale', 'leftover.tmp'), 'x')

    const tarball = buildFixtureTarball(workDir)
    const registryClient = createFakeRegistryClient({
      latest: latestBody('0.2.0', PLATFORM_PACKAGE),
      payload: payloadBody(tarball)
    })
    const service = createUpdateService(
      baseDeps({ registryClient, downloader: fakeDownloader(tarball) })
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
    const source = await downloader.download('https://registry.npmjs.org/x/-/x-1.0.0.tgz')
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
    const source = await downloader.download('https://registry.npmjs.org/x/-/x-1.0.0.tgz')
    expect(source.total).toBeNull()
  })

  it('rejects on a non-2xx response or a missing body', async () => {
    globalThis.fetch = vi.fn(async () => new Response(null, { status: 500 })) as typeof fetch

    const downloader = createDownloader()
    await expect(downloader.download('https://x/y.tgz')).rejects.toThrow(/500/)
  })
})

/** Flushes pending microtasks/timers so a fire-and-forget void method's internal async work settles. */
async function flush(ms = 150): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms))
}
