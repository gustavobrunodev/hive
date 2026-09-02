import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync
} from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  ASR_MODEL,
  ASR_MODEL_FILES,
  AsrDownloadCancelled,
  AsrDownloadError,
  createAsrModelStore,
  toDownloadFailure,
  type AsrModelStore
} from './asrModelStore'
import type { AsrDownloadEvent } from './asrTypes'

/**
 * The download engine's rules, asserted against a fake registry.
 *
 * Inherited wholesale from `whisperModelStore.test.ts` and kept nearly intact,
 * because what it covers is not Whisper: resume from a half-written file, a
 * `200` answer to a `Range` request, a retry budget, an atomic finalize, a
 * disk-space refusal. Those were learned against a 2.8 GB transfer and they
 * still guard a 670 MB one. What is gone are the tests about *choosing* — the
 * catalog, the fp32/q8 precision, the per-file ceiling — because with one model
 * there is nothing left to choose.
 */

interface RegistryOptions {
  files?: Array<{ path: string; size: number }>
  bodies?: Record<string, string>
  /** File whose GET fails, and how (status, or `'network'` for a rejected fetch). */
  failFile?: string
  failWith?: number | 'network'
  /** How many times `failFile` fails before succeeding. `Infinity` by default. */
  failTimes?: number
  treeStatus?: number
  /** Serve `200` (whole body) even when a `Range` header is sent. */
  ignoreRange?: boolean
}

const DEFAULT_FILES = [
  { path: 'encoder.int8.onnx', size: 100 },
  { path: 'decoder.int8.onnx', size: 20 },
  { path: 'joiner.int8.onnx', size: 10 },
  { path: 'tokens.txt', size: 5 },
  // The repo also publishes sample audio; the store must not fetch it.
  { path: 'test_wavs/en.wav', size: 900 },
  { path: 'README.md', size: 99 }
]

/** A tiny fake of the HF tree API + file CDN, with no network involved. */
function fakeRegistry(options: RegistryOptions): ReturnType<typeof vi.fn> {
  const files = options.files ?? DEFAULT_FILES
  const failures = new Map<string, number>()

  return vi.fn(async (url: string, init?: RequestInit) => {
    if (url.includes('/tree/main')) {
      if (options.treeStatus) return { ok: false, status: options.treeStatus } as Response
      return {
        ok: true,
        status: 200,
        json: async () => files.map((f) => ({ type: 'file', ...f }))
      } as unknown as Response
    }

    const relative = url.split('/resolve/main/')[1]
    if (options.failFile === relative) {
      const seen = failures.get(relative) ?? 0
      if (seen < (options.failTimes ?? Number.POSITIVE_INFINITY)) {
        failures.set(relative, seen + 1)
        if (options.failWith === 'network') throw new TypeError('fetch failed')
        return { ok: false, status: options.failWith ?? 500, body: null } as unknown as Response
      }
    }

    const content = options.bodies?.[relative] ?? `bytes:${relative}`
    const rangeHeader = (init?.headers as Record<string, string> | undefined)?.Range
    const from =
      rangeHeader !== undefined && !options.ignoreRange
        ? Number(/bytes=(\d+)-/.exec(rangeHeader)?.[1] ?? 0)
        : 0
    return {
      ok: true,
      status: rangeHeader !== undefined && !options.ignoreRange ? 206 : 200,
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(content.slice(from)))
          controller.close()
        }
      })
    } as unknown as Response
  })
}

async function collect(
  run: (onEvent: (e: AsrDownloadEvent) => void) => Promise<void>
): Promise<AsrDownloadEvent[]> {
  const events: AsrDownloadEvent[] = []
  await run((e) => events.push(e))
  return events
}

/** Runs a download that is expected to reject, returning the thrown value. */
async function failure(run: () => Promise<void>): Promise<unknown> {
  try {
    await run()
  } catch (error) {
    return error
  }
  throw new Error('expected the download to reject')
}

describe('asrModelStore', () => {
  let root: string
  /** No waiting in tests: retries must be asserted, not slept through. */
  const noWait = (): Promise<void> => Promise.resolve()

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'hive-asr-store-'))
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
    vi.restoreAllMocks()
  })

  const store = (options: RegistryOptions = {}): AsrModelStore =>
    createAsrModelStore(root, {
      fetchFn: fakeRegistry(options) as unknown as typeof fetch,
      wait: noWait
    })

  describe('catalog', () => {
    it('names the sherpa export, not the fused one', () => {
      // `istupakov`'s export of the same weights fuses decoder and joiner for
      // `onnx-asr`; sherpa's transducer loader needs them split, and loading
      // the wrong one fails only at session-create time.
      expect(ASR_MODEL.repo).toBe('csukuangfj/sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8')
      expect(ASR_MODEL_FILES).toEqual([
        'encoder.int8.onnx',
        'decoder.int8.onnx',
        'joiner.int8.onnx',
        'tokens.txt'
      ])
    })

    it('carries the measured download size', () => {
      expect(ASR_MODEL.sizeMB).toBe(671)
      expect(ASR_MODEL.languages).toBe(25)
    })
  })

  describe('installed/info', () => {
    it('reports nothing downloaded on a fresh store — the app ships no weights', () => {
      const s = store()
      expect(s.installed()).toBe(false)
      expect(s.info().downloaded).toBe(false)
      expect(s.paths()).toBeNull()
    })
  })

  describe('download', () => {
    it('fetches the four model files, emits byte progress, then done', async () => {
      const s = store()
      const events = await collect((onEvent) => s.download(onEvent))

      const done = events.filter((e) => e.type === 'done')
      expect(done).toHaveLength(1)
      const progress = events.filter((e) => e.type === 'progress')
      expect(progress.length).toBeGreaterThan(0)
      // 100 + 20 + 10 + 5 — the samples and the README are not in the total.
      expect(progress[0]).toMatchObject({ total: 135 })

      for (const file of ASR_MODEL_FILES) {
        expect(existsSync(join(root, ASR_MODEL.id, file))).toBe(true)
      }
      expect(s.installed()).toBe(true)
    })

    it('never downloads the repo’s sample audio', async () => {
      const fetchFn = fakeRegistry({})
      const s = createAsrModelStore(root, {
        fetchFn: fetchFn as unknown as typeof fetch,
        wait: noWait
      })
      await s.download(() => {})
      const fetched = fetchFn.mock.calls.map((call) => String(call[0]))
      expect(fetched.some((url) => url.includes('test_wavs'))).toBe(false)
      expect(existsSync(join(root, ASR_MODEL.id, 'test_wavs'))).toBe(false)
    })

    it('asks the tree API for a full page — the default 50 hides the weights', async () => {
      const fetchFn = fakeRegistry({})
      const s = createAsrModelStore(root, {
        fetchFn: fetchFn as unknown as typeof fetch,
        wait: noWait
      })
      await s.download(() => {})
      expect(String(fetchFn.mock.calls[0][0])).toContain('limit=1000')
    })

    it('answers paths only once every file is really there', async () => {
      const s = store()
      await s.download(() => {})
      const paths = s.paths()
      expect(paths?.encoder).toBe(join(root, ASR_MODEL.id, 'encoder.int8.onnx'))

      // A user who deleted one file by hand must not be told it is ready: the
      // marker says the rename happened, the files are what the engine opens.
      rmSync(join(root, ASR_MODEL.id, 'joiner.int8.onnx'))
      expect(s.installed()).toBe(false)
      expect(s.paths()).toBeNull()
    })

    it('finalizes atomically — an interrupted download is never "downloaded"', async () => {
      const s = store({ failFile: 'tokens.txt' })
      await failure(() => s.download(() => {}))
      expect(s.installed()).toBe(false)
      expect(existsSync(join(root, ASR_MODEL.id))).toBe(false)
      // The bytes survive for the resume, under the temp name.
      expect(existsSync(join(root, `.tmp-${ASR_MODEL.id}`))).toBe(true)
    })

    it('a failed re-download leaves the previously-complete model intact', async () => {
      const good = store()
      await good.download(() => {})

      const bad = store({ failFile: 'encoder.int8.onnx' })
      await failure(() => bad.download(() => {}))
      // Losing a working model to a failed refresh is the worst outcome here.
      expect(good.installed()).toBe(true)
    })

    it('types an unavailable model index as a server failure', async () => {
      const s = store({ treeStatus: 503 })
      const error = await failure(() => s.download(() => {}))
      expect(error).toBeInstanceOf(AsrDownloadError)
      expect((error as AsrDownloadError).kind).toBe('server')
    })

    it('names what the repo is missing rather than failing vaguely', async () => {
      const s = store({ files: [{ path: 'tokens.txt', size: 5 }] })
      const error = await failure(() => s.download(() => {}))
      expect((error as AsrDownloadError).kind).toBe('unsupported')
      expect((error as Error).message).toContain('encoder.int8.onnx')
    })

    it('re-downloading replaces the previous copy', async () => {
      const s = store({ bodies: { 'tokens.txt': 'first' } })
      await s.download(() => {})
      const second = store({ bodies: { 'tokens.txt': 'second' } })
      await second.download(() => {})
      expect(readFileSync(join(root, ASR_MODEL.id, 'tokens.txt'), 'utf-8')).toBe('second')
    })
  })

  describe('resume + retry', () => {
    it('keeps partial bytes after a failure and continues from them', async () => {
      const s = store({ failFile: 'joiner.int8.onnx' })
      await failure(() => s.download(() => {}))
      const temp = join(root, `.tmp-${ASR_MODEL.id}`)
      expect(existsSync(join(temp, 'encoder.int8.onnx'))).toBe(true)

      const resumed = store()
      await resumed.download(() => {})
      expect(resumed.installed()).toBe(true)
    })

    it('sends a Range header for a half-written file and appends the rest', async () => {
      const temp = join(root, `.tmp-${ASR_MODEL.id}`)
      mkdirSync(temp, { recursive: true })
      writeFileSync(
        join(temp, '.partial.json'),
        JSON.stringify({ repo: ASR_MODEL.repo, files: [...ASR_MODEL_FILES] })
      )
      writeFileSync(join(temp, 'tokens.txt'), 'abc')

      const fetchFn = fakeRegistry({ bodies: { 'tokens.txt': 'abcdefghij' } })
      const s = createAsrModelStore(root, {
        fetchFn: fetchFn as unknown as typeof fetch,
        wait: noWait
      })
      await s.download(() => {})

      const ranged = fetchFn.mock.calls.find(
        (call) => String(call[0]).includes('tokens.txt') && call[1]?.headers
      )
      expect((ranged?.[1]?.headers as Record<string, string>).Range).toBe('bytes=3-')
      // Appended, not restarted: the three bytes already there are still good.
      expect(readFileSync(join(root, ASR_MODEL.id, 'tokens.txt'), 'utf-8')).toBe('abcdefghij')
    })

    it('restarts the file when the server answers 200 to a Range request', async () => {
      const temp = join(root, `.tmp-${ASR_MODEL.id}`)
      mkdirSync(temp, { recursive: true })
      writeFileSync(
        join(temp, '.partial.json'),
        JSON.stringify({ repo: ASR_MODEL.repo, files: [...ASR_MODEL_FILES] })
      )
      writeFileSync(join(temp, 'tokens.txt'), 'abc')

      const s = store({ bodies: { 'tokens.txt': 'abcdefghij' }, ignoreRange: true })
      await s.download(() => {})
      // Appending a whole body onto existing bytes produces a corrupt file that
      // only fails later, at session-create time.
      expect(readFileSync(join(root, ASR_MODEL.id, 'tokens.txt'), 'utf-8')).toBe('abcdefghij')
    })

    it('drops a partial left by a different repo instead of resuming into it', async () => {
      const temp = join(root, `.tmp-${ASR_MODEL.id}`)
      mkdirSync(temp, { recursive: true })
      writeFileSync(
        join(temp, '.partial.json'),
        JSON.stringify({ repo: 'someone/else', files: ['tokens.txt'] })
      )
      writeFileSync(join(temp, 'tokens.txt'), 'stale bytes from another repo')

      const s = store({ bodies: { 'tokens.txt': 'fresh' } })
      await s.download(() => {})
      expect(readFileSync(join(root, ASR_MODEL.id, 'tokens.txt'), 'utf-8')).toBe('fresh')
    })

    it('retries a transport failure instead of surfacing a blip as "falhou"', async () => {
      const s = store({ failFile: 'encoder.int8.onnx', failWith: 'network', failTimes: 2 })
      await s.download(() => {})
      expect(s.installed()).toBe(true)
    })

    it('does not retry a 404 — that answer will not change', async () => {
      const fetchFn = fakeRegistry({ failFile: 'encoder.int8.onnx', failWith: 404 })
      const s = createAsrModelStore(root, {
        fetchFn: fetchFn as unknown as typeof fetch,
        wait: noWait
      })
      const error = await failure(() => s.download(() => {}))
      expect((error as AsrDownloadError).kind).toBe('notFound')
      const attempts = fetchFn.mock.calls.filter((c) => String(c[0]).includes('encoder.int8.onnx'))
      expect(attempts).toHaveLength(1)
    })

    it('gives up after the attempt budget rather than retrying forever', async () => {
      const fetchFn = fakeRegistry({ failFile: 'encoder.int8.onnx', failWith: 500 })
      const s = createAsrModelStore(root, {
        fetchFn: fetchFn as unknown as typeof fetch,
        wait: noWait
      })
      await failure(() => s.download(() => {}))
      const attempts = fetchFn.mock.calls.filter((c) => String(c[0]).includes('encoder.int8.onnx'))
      expect(attempts).toHaveLength(4)
    })

    it('backs off between attempts, with a growing delay', async () => {
      const waits: number[] = []
      const s = createAsrModelStore(root, {
        fetchFn: fakeRegistry({
          failFile: 'encoder.int8.onnx',
          failWith: 500
        }) as unknown as typeof fetch,
        wait: async (ms) => {
          waits.push(ms)
        }
      })
      await failure(() => s.download(() => {}))
      expect(waits).toEqual([500, 2000, 5000])
    })

    it('reports the bytes a previous attempt left behind', async () => {
      const temp = join(root, `.tmp-${ASR_MODEL.id}`)
      mkdirSync(temp, { recursive: true })
      writeFileSync(
        join(temp, '.partial.json'),
        JSON.stringify({ repo: ASR_MODEL.repo, files: ['tokens.txt', 'joiner.int8.onnx'] })
      )
      writeFileSync(join(temp, 'tokens.txt'), '12345')
      expect(store().partialBytes()).toBe(5)
    })

    it('reads no partial bytes when there is no manifest to trust', () => {
      expect(store().partialBytes()).toBe(0)
    })

    it.each([
      ['that is not JSON', 'not json at all'],
      ['with no repo', JSON.stringify({ files: ['a'] })],
      ['that is null', 'null']
    ])('reads a partial manifest %s as no partial at all', (_label, content) => {
      const temp = join(root, `.tmp-${ASR_MODEL.id}`)
      mkdirSync(temp, { recursive: true })
      writeFileSync(join(temp, '.partial.json'), content)
      expect(store().partialBytes()).toBe(0)
    })

    it('counts nothing for a manifest naming a file that is not there', () => {
      const temp = join(root, `.tmp-${ASR_MODEL.id}`)
      mkdirSync(temp, { recursive: true })
      writeFileSync(
        join(temp, '.partial.json'),
        JSON.stringify({ repo: ASR_MODEL.repo, files: ['ghost.onnx'] })
      )
      expect(store().partialBytes()).toBe(0)
    })
  })

  describe('cancellation', () => {
    it('rejects with AsrDownloadCancelled once the signal aborts', async () => {
      const controller = new AbortController()
      const s = createAsrModelStore(root, {
        fetchFn: (async (url: string) => {
          if (String(url).includes('/tree/main')) {
            return {
              ok: true,
              status: 200,
              json: async () => DEFAULT_FILES.map((f) => ({ type: 'file', ...f }))
            } as unknown as Response
          }
          controller.abort()
          throw new DOMException('aborted', 'AbortError')
        }) as unknown as typeof fetch,
        wait: noWait
      })
      const error = await failure(() => s.download(() => {}, { signal: controller.signal }))
      // A cancellation is the user's own request, never a failure to retry.
      expect(error).toBeInstanceOf(AsrDownloadCancelled)
    })
  })

  describe('defensive edges', () => {
    it('types a non-Error rejection without losing what it said', () => {
      expect(toDownloadFailure('just a string')).toEqual({
        kind: 'unknown',
        detail: 'just a string'
      })
    })

    it('carries a typed error’s own kind through', () => {
      expect(toDownloadFailure(new AsrDownloadError('disk', 'full'))).toEqual({
        kind: 'disk',
        detail: 'full'
      })
    })

    it('treats an auth failure like a missing file — retrying will not fix it', async () => {
      const s = store({ failFile: 'encoder.int8.onnx', failWith: 401 })
      const error = await failure(() => s.download(() => {}))
      expect((error as AsrDownloadError).kind).toBe('notFound')
    })

    it('retries a rate limit, which is a "later", not a "no"', async () => {
      const s = store({ failFile: 'encoder.int8.onnx', failWith: 429, failTimes: 1 })
      await s.download(() => {})
      expect(s.installed()).toBe(true)
    })

    it('ignores directories in the tree listing', async () => {
      const fetchFn = vi.fn(async (url: string) => {
        if (String(url).includes('/tree/main')) {
          return {
            ok: true,
            status: 200,
            json: async () => [
              { type: 'directory', path: 'test_wavs', size: 0 },
              ...DEFAULT_FILES.filter((f) =>
                (ASR_MODEL_FILES as readonly string[]).includes(f.path)
              ).map((f) => ({ type: 'file', ...f }))
            ]
          } as unknown as Response
        }
        return {
          ok: true,
          status: 200,
          body: new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode('x'))
              controller.close()
            }
          })
        } as unknown as Response
      })
      const s = createAsrModelStore(root, {
        fetchFn: fetchFn as unknown as typeof fetch,
        wait: noWait
      })
      await s.download(() => {})
      expect(s.installed()).toBe(true)
    })

    it('refuses a body-less 200 rather than finalizing an empty file', async () => {
      const s = createAsrModelStore(root, {
        fetchFn: (async (url: string) => {
          if (String(url).includes('/tree/main')) {
            return {
              ok: true,
              status: 200,
              json: async () => DEFAULT_FILES.map((f) => ({ type: 'file', ...f }))
            } as unknown as Response
          }
          return { ok: true, status: 200, body: null } as unknown as Response
        }) as unknown as typeof fetch,
        wait: noWait
      })
      const error = await failure(() => s.download(() => {}))
      expect((error as AsrDownloadError).kind).toBe('server')
    })

    it('reads a tree entry with no declared size as zero rather than NaN', async () => {
      const s = createAsrModelStore(root, {
        fetchFn: (async (url: string) => {
          if (String(url).includes('/tree/main')) {
            return {
              ok: true,
              status: 200,
              json: async () => ASR_MODEL_FILES.map((path) => ({ type: 'file', path }))
            } as unknown as Response
          }
          return {
            ok: true,
            status: 200,
            body: new ReadableStream({
              start(controller) {
                controller.enqueue(new TextEncoder().encode('xy'))
                controller.close()
              }
            })
          } as unknown as Response
        }) as unknown as typeof fetch,
        wait: noWait
      })
      const events = await collect((onEvent) => s.download(onEvent))
      const progress = events.filter((e) => e.type === 'progress')
      expect(progress.every((e) => Number.isFinite(e.type === 'progress' ? e.total : 0))).toBe(true)
      expect(s.installed()).toBe(true)
    })
  })

  describe('disk space', () => {
    it('refuses before downloading when the volume cannot hold the model', async () => {
      const s = createAsrModelStore(root, {
        fetchFn: fakeRegistry({}) as unknown as typeof fetch,
        freeSpace: () => 1,
        wait: noWait
      })
      const error = await failure(() => s.download(() => {}))
      // ENOSPC half a gigabyte in leaves a failure, a full disk, and no
      // explanation of the connection between the two.
      expect((error as AsrDownloadError).kind).toBe('disk')
    })

    it('proceeds when free space cannot be read — a probe is not a gate', async () => {
      const s = createAsrModelStore(root, {
        fetchFn: fakeRegistry({}) as unknown as typeof fetch,
        freeSpace: () => null,
        wait: noWait
      })
      await s.download(() => {})
      expect(s.installed()).toBe(true)
    })
  })

  describe('installed robustness', () => {
    it('treats a missing completion marker as not-downloaded', async () => {
      const s = store()
      await s.download(() => {})
      rmSync(join(root, ASR_MODEL.id, '.complete.json'))
      // The marker is written last and only inside the temp dir, so its absence
      // means the rename never happened for these bytes.
      expect(s.installed()).toBe(false)
    })
  })

  describe('remove', () => {
    it('deletes the model directory and any partial, and is a no-op when absent', async () => {
      const s = store()
      await s.download(() => {})
      expect(statSync(join(root, ASR_MODEL.id)).isDirectory()).toBe(true)
      s.remove()
      expect(existsSync(join(root, ASR_MODEL.id))).toBe(false)
      expect(s.installed()).toBe(false)
      expect(() => s.remove()).not.toThrow()
    })
  })
})
