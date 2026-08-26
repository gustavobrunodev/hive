import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync
} from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  createWhisperModelStore,
  DEFAULT_WHISPER_MODEL,
  toDownloadFailure,
  WHISPER_CATALOG,
  WhisperDownloadCancelled,
  WhisperDownloadError,
  type WhisperModelStore
} from './whisperModelStore'
import type { WhisperDownloadEvent, WhisperVariant } from './whisperTypes'

interface RegistryOptions {
  root?: Array<{ path: string; size: number }>
  onnx?: Array<{ path: string; size: number }>
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

/** A tiny fake of the HF tree API + file CDN, with no network involved. */
function fakeRegistry(options: RegistryOptions): ReturnType<typeof vi.fn> {
  const root = options.root ?? [
    { path: 'config.json', size: 10 },
    { path: 'tokenizer.json', size: 20 },
    { path: 'quant_config.json', size: 5 },
    { path: 'README.md', size: 99 }
  ]
  const onnx = options.onnx ?? [
    { path: 'onnx/encoder_model.onnx', size: 100 },
    { path: 'onnx/decoder_model_merged.onnx', size: 200 },
    { path: 'onnx/encoder_model_quantized.onnx', size: 30 },
    { path: 'onnx/decoder_model_merged_quantized.onnx', size: 40 }
  ]
  const failures = new Map<string, number>()

  return vi.fn(async (url: string, init?: RequestInit) => {
    if (url.includes('/tree/main/onnx')) {
      if (options.treeStatus) return { ok: false, status: options.treeStatus } as Response
      return {
        ok: true,
        status: 200,
        json: async () => onnx.map((f) => ({ type: 'file', ...f }))
      } as unknown as Response
    }
    if (url.includes('/tree/main')) {
      if (options.treeStatus) return { ok: false, status: options.treeStatus } as Response
      return {
        ok: true,
        status: 200,
        json: async () => root.map((f) => ({ type: 'file', ...f }))
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
  run: (onEvent: (e: WhisperDownloadEvent) => void) => Promise<void>
): Promise<WhisperDownloadEvent[]> {
  const events: WhisperDownloadEvent[] = []
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

describe('whisperModelStore', () => {
  let root: string
  /** No waiting in tests: retries must be asserted, not slept through. */
  const noWait = (): Promise<void> => Promise.resolve()

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'hive-whisper-store-'))
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
    vi.restoreAllMocks()
  })

  describe('catalog', () => {
    it('defaults to base (D-SB-4) and lists every model exactly once', () => {
      expect(DEFAULT_WHISPER_MODEL).toBe('base')
      const ids = WHISPER_CATALOG.map((m) => m.id)
      expect(new Set(ids).size).toBe(ids.length)
      expect(ids).toContain('base')
      expect(ids).toContain('large-v3-turbo')
    })

    it('marks the .en models as English-only and the rest as multilingual', () => {
      for (const model of WHISPER_CATALOG) {
        expect(model.multilingual).toBe(!model.id.endsWith('.en'))
      }
    })

    it('carries a measured size for both variants, with q8 smaller than fp32', () => {
      for (const model of WHISPER_CATALOG) {
        expect(model.sizeMB.fp32).toBeGreaterThan(0)
        expect(model.sizeMB.q8).toBeGreaterThan(0)
        expect(model.sizeMB.q8).toBeLessThan(model.sizeMB.fp32)
      }
    })
  })

  describe('status/list', () => {
    it('reports nothing downloaded on a fresh store — the app ships no weights', () => {
      const store = createWhisperModelStore(root)
      expect(store.status('base')).toEqual({ downloaded: false, variant: null })
      expect(store.list().every((m) => !m.downloaded)).toBe(true)
    })

    it('serves exactly one root: the user profile', () => {
      expect(createWhisperModelStore(root).searchRoots()).toEqual([root])
    })

    it('rejects an unknown model id rather than inventing a repo', async () => {
      const store = createWhisperModelStore(root, { fetchFn: fakeRegistry({}) as never })
      const error = await failure(() => store.download('nope' as never, 'fp32', () => {}))
      expect(error).toBeInstanceOf(WhisperDownloadError)
      expect((error as WhisperDownloadError).kind).toBe('unsupported')
    })
  })

  describe('download', () => {
    let store: WhisperModelStore
    let fetchFn: ReturnType<typeof vi.fn>

    beforeEach(() => {
      fetchFn = fakeRegistry({})
      store = createWhisperModelStore(root, { fetchFn: fetchFn as never, wait: noWait })
    })

    it('downloads the fp32 pair + config files, emits byte progress, then done', async () => {
      const events = await collect((on) => store.download('base', 'fp32', on))

      expect(events.at(-1)).toEqual({ type: 'done', id: 'base' })
      const progress = events.filter((e) => e.type === 'progress')
      expect(progress.length).toBeGreaterThan(0)
      // Totals are the sum of the wanted files' sizes (10+20 config + 100+200 onnx).
      expect(progress[0]).toMatchObject({ total: 330 })
      expect(progress.at(-1)).toMatchObject({ loaded: 330, total: 330 })

      const dir = join(root, 'base')
      expect(existsSync(join(dir, 'config.json'))).toBe(true)
      expect(existsSync(join(dir, 'tokenizer.json'))).toBe(true)
      expect(existsSync(join(dir, 'onnx', 'encoder_model.onnx'))).toBe(true)
      expect(existsSync(join(dir, 'onnx', 'decoder_model_merged.onnx'))).toBe(true)
      // The quantized siblings are NOT fetched for an fp32 download.
      expect(existsSync(join(dir, 'onnx', 'encoder_model_quantized.onnx'))).toBe(false)
      // README/quant_config are skipped (not needed by Transformers.js).
      expect(existsSync(join(dir, 'README.md'))).toBe(false)
      expect(existsSync(join(dir, 'quant_config.json'))).toBe(false)
      // The resume manifest never survives into the finalized model.
      expect(existsSync(join(dir, '.hive-partial.json'))).toBe(false)
    })

    it('asks the tree API for a full page — the default 50 hides medium‘s weights', async () => {
      await collect((on) => store.download('base', 'fp32', on))
      const treeCalls = fetchFn.mock.calls
        .map(([url]) => String(url))
        .filter((url) => url.includes('/tree/main'))
      expect(treeCalls.length).toBeGreaterThan(0)
      for (const url of treeCalls) expect(url).toContain('limit=1000')
    })

    it('downloads only the quantized weights for a q8 download', async () => {
      await collect((on) => store.download('base', 'q8', on))
      const onnxDir = join(root, 'base', 'onnx')
      expect(readdirSync(onnxDir).sort()).toEqual([
        'decoder_model_merged_quantized.onnx',
        'encoder_model_quantized.onnx'
      ])
    })

    it('follows the .onnx_data sidecar of the external-data format', async () => {
      // large-v3-turbo ships a 0-byte encoder stub + a huge `.onnx_data` file;
      // fetching only the `.onnx` would produce an unusable model.
      const external = fakeRegistry({
        onnx: [
          { path: 'onnx/encoder_model.onnx', size: 0 },
          { path: 'onnx/encoder_model.onnx_data', size: 2400 },
          { path: 'onnx/decoder_model_merged.onnx', size: 600 }
        ]
      })
      const s = createWhisperModelStore(root, { fetchFn: external as never, wait: noWait })
      await collect((on) => s.download('large-v3-turbo', 'fp32', on))

      const onnxDir = join(root, 'large-v3-turbo', 'onnx')
      expect(existsSync(join(onnxDir, 'encoder_model.onnx_data'))).toBe(true)
      expect(existsSync(join(onnxDir, 'decoder_model_merged.onnx'))).toBe(true)
    })

    it('records the variant so status() reports what is actually on disk', async () => {
      await collect((on) => store.download('base', 'q8', on))
      expect(store.status('base')).toEqual({ downloaded: true, variant: 'q8' })
      const info = store.list().find((m) => m.id === 'base')
      expect(info).toMatchObject({ downloaded: true, downloadedVariant: 'q8' })
    })

    it('finalizes atomically — an interrupted download is never "downloaded"', async () => {
      const failing = fakeRegistry({ failFile: 'onnx/decoder_model_merged.onnx', failWith: 404 })
      const s = createWhisperModelStore(root, { fetchFn: failing as never, wait: noWait })

      await failure(() => s.download('base', 'fp32', () => {}))

      expect(s.status('base')).toEqual({ downloaded: false, variant: null })
      expect(existsSync(join(root, 'base'))).toBe(false)
    })

    it('a failed re-download leaves the previously-complete model intact', async () => {
      await collect((on) => store.download('base', 'fp32', on))
      expect(store.status('base').downloaded).toBe(true)

      const failing = fakeRegistry({ failFile: 'config.json', failWith: 404 })
      const s = createWhisperModelStore(root, { fetchFn: failing as never, wait: noWait })
      await failure(() => s.download('base', 'fp32', () => {}))

      // The old model is still there and still usable.
      expect(s.status('base')).toEqual({ downloaded: true, variant: 'fp32' })
      expect(existsSync(join(root, 'base', 'onnx', 'encoder_model.onnx'))).toBe(true)
    })

    it('types an unavailable model index as a server failure', async () => {
      const offline = fakeRegistry({ treeStatus: 503 })
      const s = createWhisperModelStore(root, { fetchFn: offline as never, wait: noWait })
      const error = await failure(() => s.download('base', 'fp32', () => {}))
      expect(toDownloadFailure(error)).toMatchObject({ kind: 'server' })
    })

    it('errors clearly when the repo publishes no weights for the requested variant', async () => {
      const noQ8 = fakeRegistry({
        onnx: [{ path: 'onnx/encoder_model.onnx', size: 10 }]
      })
      const s = createWhisperModelStore(root, { fetchFn: noQ8 as never, wait: noWait })
      const error = await failure(() => s.download('base', 'q8' as WhisperVariant, () => {}))
      expect(toDownloadFailure(error)).toMatchObject({
        kind: 'unsupported',
        detail: expect.stringContaining('no q8 weights')
      })
    })

    it('re-downloading replaces the previous copy', async () => {
      await collect((on) => store.download('base', 'fp32', on))
      await collect((on) => store.download('base', 'q8', on))
      expect(store.status('base')).toEqual({ downloaded: true, variant: 'q8' })
      expect(existsSync(join(root, 'base', 'onnx', 'encoder_model.onnx'))).toBe(false)
    })
  })

  /**
   * The behaviour the previous store did not have, and the reason a 2.8 GB
   * `medium` download reported "falhou" on a connection that only blinked.
   */
  describe('resume + retry', () => {
    it('keeps partial bytes after a failure and continues from them', async () => {
      // Sizes match the bodies exactly, as they do against the real registry:
      // that is what lets the resumed pass recognise a file as already complete
      // instead of re-fetching it.
      const shape = {
        root: [{ path: 'config.json', size: 2 }],
        onnx: [
          { path: 'onnx/encoder_model.onnx', size: 100 },
          { path: 'onnx/decoder_model_merged.onnx', size: 200 }
        ],
        bodies: {
          'config.json': 'ok',
          'onnx/encoder_model.onnx': 'E'.repeat(100),
          'onnx/decoder_model_merged.onnx': 'D'.repeat(200)
        }
      }
      const failing = fakeRegistry({
        ...shape,
        failFile: 'onnx/decoder_model_merged.onnx',
        failWith: 404
      })
      const s = createWhisperModelStore(root, { fetchFn: failing as never, wait: noWait })
      await failure(() => s.download('base', 'fp32', () => {}))

      // The encoder that *did* arrive is still on disk, ready to be resumed.
      const temp = join(root, '.tmp-base')
      expect(existsSync(join(temp, 'onnx', 'encoder_model.onnx'))).toBe(true)
      expect(s.partialBytes('base')).toBeGreaterThan(0)

      const healthy = fakeRegistry(shape)
      const s2 = createWhisperModelStore(root, { fetchFn: healthy as never, wait: noWait })
      await collect((on) => s2.download('base', 'fp32', on))
      expect(s2.status('base').downloaded).toBe(true)

      // The already-complete encoder was never re-fetched.
      const fetched = healthy.mock.calls
        .map(([url]) => String(url))
        .filter((url) => url.includes('/resolve/main/onnx/encoder_model.onnx'))
      expect(fetched).toHaveLength(0)
    })

    it('sends a Range header for a half-written file and appends the rest', async () => {
      const body = 'ABCDEFGHIJ'
      const temp = join(root, '.tmp-base')
      mkdirSync(join(temp, 'onnx'), { recursive: true })
      writeFileSync(
        join(temp, '.hive-partial.json'),
        JSON.stringify({ repo: 'Xenova/whisper-base', variant: 'fp32', files: [] })
      )
      writeFileSync(join(temp, 'onnx', 'encoder_model.onnx'), body.slice(0, 4))

      const registry = fakeRegistry({
        onnx: [{ path: 'onnx/encoder_model.onnx', size: body.length }],
        root: [{ path: 'config.json', size: 2 }],
        bodies: { 'onnx/encoder_model.onnx': body, 'config.json': 'ok' }
      })
      const s = createWhisperModelStore(root, { fetchFn: registry as never, wait: noWait })
      await collect((on) => s.download('base', 'fp32', on))

      expect(readFileSync(join(root, 'base', 'onnx', 'encoder_model.onnx'), 'utf-8')).toBe(body)
      const ranged = registry.mock.calls.find(
        ([url]) => String(url).includes('encoder_model.onnx') && String(url).includes('/resolve/')
      )
      expect((ranged?.[1] as RequestInit | undefined)?.headers).toMatchObject({
        Range: 'bytes=4-'
      })
    })

    it('restarts the file when the server answers 200 to a Range request', async () => {
      const body = 'ABCDEFGHIJ'
      const temp = join(root, '.tmp-base')
      mkdirSync(join(temp, 'onnx'), { recursive: true })
      writeFileSync(
        join(temp, '.hive-partial.json'),
        JSON.stringify({ repo: 'Xenova/whisper-base', variant: 'fp32', files: [] })
      )
      writeFileSync(join(temp, 'onnx', 'encoder_model.onnx'), body.slice(0, 4))

      const registry = fakeRegistry({
        ignoreRange: true,
        onnx: [{ path: 'onnx/encoder_model.onnx', size: body.length }],
        root: [{ path: 'config.json', size: 2 }],
        bodies: { 'onnx/encoder_model.onnx': body, 'config.json': 'ok' }
      })
      const s = createWhisperModelStore(root, { fetchFn: registry as never, wait: noWait })
      await collect((on) => s.download('base', 'fp32', on))

      // Appending the whole body to the 4 bytes already there would corrupt it.
      expect(readFileSync(join(root, 'base', 'onnx', 'encoder_model.onnx'), 'utf-8')).toBe(body)
    })

    it('drops a partial left by a different precision instead of resuming into it', async () => {
      const temp = join(root, '.tmp-base')
      mkdirSync(join(temp, 'onnx'), { recursive: true })
      writeFileSync(
        join(temp, '.hive-partial.json'),
        JSON.stringify({ repo: 'Xenova/whisper-base', variant: 'q8', files: [] })
      )
      writeFileSync(join(temp, 'onnx', 'encoder_model_quantized.onnx'), 'stale')

      const s = createWhisperModelStore(root, { fetchFn: fakeRegistry({}) as never, wait: noWait })
      await collect((on) => s.download('base', 'fp32', on))
      expect(existsSync(join(root, 'base', 'onnx', 'encoder_model_quantized.onnx'))).toBe(false)
    })

    it('retries a transport failure instead of surfacing a blip as "falhou"', async () => {
      const flaky = fakeRegistry({
        failFile: 'onnx/encoder_model.onnx',
        failWith: 'network',
        failTimes: 2
      })
      const s = createWhisperModelStore(root, { fetchFn: flaky as never, wait: noWait })
      await collect((on) => s.download('base', 'fp32', on))
      expect(s.status('base').downloaded).toBe(true)
    })

    it('does not retry a 404 — that answer will not change', async () => {
      const gone = fakeRegistry({ failFile: 'onnx/encoder_model.onnx', failWith: 404 })
      const s = createWhisperModelStore(root, { fetchFn: gone as never, wait: noWait })
      const error = await failure(() => s.download('base', 'fp32', () => {}))
      expect(toDownloadFailure(error)).toMatchObject({ kind: 'notFound' })

      const attempts = gone.mock.calls
        .map(([url]) => String(url))
        .filter((url) => url.includes('/resolve/main/onnx/encoder_model.onnx'))
      expect(attempts).toHaveLength(1)
    })

    it('gives up after the attempt budget rather than retrying forever', async () => {
      const broken = fakeRegistry({ failFile: 'onnx/encoder_model.onnx', failWith: 500 })
      const s = createWhisperModelStore(root, { fetchFn: broken as never, wait: noWait })
      await failure(() => s.download('base', 'fp32', () => {}))
      const attempts = broken.mock.calls
        .map(([url]) => String(url))
        .filter((url) => url.includes('/resolve/main/onnx/encoder_model.onnx'))
      expect(attempts).toHaveLength(4)
    })

    it('reports the bytes a previous attempt left behind', () => {
      const temp = join(root, '.tmp-base')
      mkdirSync(join(temp, 'onnx'), { recursive: true })
      writeFileSync(
        join(temp, '.hive-partial.json'),
        JSON.stringify({
          repo: 'Xenova/whisper-base',
          variant: 'fp32',
          files: ['onnx/encoder_model.onnx']
        })
      )
      writeFileSync(join(temp, 'onnx', 'encoder_model.onnx'), '12345')
      const s = createWhisperModelStore(root)
      expect(s.partialBytes('base')).toBe(5)
      s.discardPartial('base')
      expect(s.partialBytes('base')).toBe(0)
    })

    it('reads no partial bytes when there is no manifest to trust', () => {
      expect(createWhisperModelStore(root).partialBytes('base')).toBe(0)
    })
  })

  describe('cancellation', () => {
    it('rejects with WhisperDownloadCancelled once the signal aborts', async () => {
      const controller = new AbortController()
      controller.abort()
      const s = createWhisperModelStore(root, { fetchFn: fakeRegistry({}) as never, wait: noWait })
      const error = await failure(() =>
        s.download('base', 'fp32', () => {}, { signal: controller.signal })
      )
      expect(error).toBeInstanceOf(WhisperDownloadCancelled)
    })
  })

  /**
   * The store's defensive edges. Each of these is a real shape the outside
   * world hands back — a corrupt manifest, a 401 behind a proxy, a tree entry
   * that is a directory — and every one of them used to be an unmeasured
   * branch between a user's download and a stack trace.
   */
  describe('defensive edges', () => {
    it('types a non-Error rejection without losing what it said', () => {
      expect(toDownloadFailure('plain string failure')).toEqual({
        kind: 'unknown',
        detail: 'plain string failure'
      })
    })

    it('reads a cancellation as a cancellation, never as a failure to retry', () => {
      expect(toDownloadFailure(new WhisperDownloadCancelled())).toMatchObject({ kind: 'unknown' })
    })

    it('treats an auth failure like a missing file — retrying will not fix it', async () => {
      const denied = fakeRegistry({ failFile: 'onnx/encoder_model.onnx', failWith: 401 })
      const s = createWhisperModelStore(root, { fetchFn: denied as never, wait: noWait })
      const error = await failure(() => s.download('base', 'fp32', () => {}))
      expect(toDownloadFailure(error)).toMatchObject({ kind: 'notFound' })
    })

    it('retries a rate limit, which is a "later", not a "no"', async () => {
      const throttled = fakeRegistry({
        failFile: 'onnx/encoder_model.onnx',
        failWith: 429,
        failTimes: 1
      })
      const s = createWhisperModelStore(root, { fetchFn: throttled as never, wait: noWait })
      await collect((on) => s.download('base', 'fp32', on))
      expect(s.status('base').downloaded).toBe(true)
    })

    it('ignores directories in the tree listing', async () => {
      const withDir = vi.fn(async (url: string) => {
        if (url.includes('/tree/main/onnx')) {
          return {
            ok: true,
            status: 200,
            json: async () => [
              { type: 'directory', path: 'onnx/nested', size: 0 },
              { type: 'file', path: 'onnx/encoder_model.onnx', size: 5 },
              { type: 'file', path: 'onnx/decoder_model_merged.onnx', size: 5 }
            ]
          } as unknown as Response
        }
        if (url.includes('/tree/main')) {
          return {
            ok: true,
            status: 200,
            json: async () => [{ type: 'file', path: 'config.json', size: 2 }]
          } as unknown as Response
        }
        return {
          ok: true,
          status: 200,
          body: new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode('xxxxx'))
              controller.close()
            }
          })
        } as unknown as Response
      })
      const s = createWhisperModelStore(root, { fetchFn: withDir as never, wait: noWait })
      await collect((on) => s.download('base', 'fp32', on))
      expect(existsSync(join(root, 'base', 'onnx', 'nested'))).toBe(false)
    })

    it('refuses a body-less 200 rather than finalizing an empty file', async () => {
      const empty = vi.fn(async (url: string) => {
        if (url.includes('/tree/main/onnx')) {
          return {
            ok: true,
            status: 200,
            json: async () => [
              { type: 'file', path: 'onnx/encoder_model.onnx', size: 5 },
              { type: 'file', path: 'onnx/decoder_model_merged.onnx', size: 5 }
            ]
          } as unknown as Response
        }
        if (url.includes('/tree/main')) {
          return { ok: true, status: 200, json: async () => [] } as unknown as Response
        }
        return { ok: true, status: 200, body: null } as unknown as Response
      })
      const s = createWhisperModelStore(root, { fetchFn: empty as never, wait: noWait })
      const error = await failure(() => s.download('base', 'fp32', () => {}))
      expect(toDownloadFailure(error)).toMatchObject({ kind: 'server' })
    })

    for (const [label, body] of [
      ['unparseable', '{not json'],
      ['missing its repo', JSON.stringify({ variant: 'fp32' })],
      ['carrying an unknown precision', JSON.stringify({ repo: 'x', variant: 'int4' })],
      [
        'with a files field that is not a list',
        JSON.stringify({ repo: 'x', variant: 'fp32', files: 7 })
      ]
    ] as const) {
      it(`reads a partial manifest ${label} as no partial at all`, () => {
        const temp = join(root, '.tmp-base')
        mkdirSync(temp, { recursive: true })
        writeFileSync(join(temp, '.hive-partial.json'), body)
        expect(createWhisperModelStore(root).partialBytes('base')).toBe(0)
      })
    }

    it('counts nothing for a manifest naming a file that is not there', () => {
      const temp = join(root, '.tmp-base')
      mkdirSync(temp, { recursive: true })
      writeFileSync(
        join(temp, '.hive-partial.json'),
        JSON.stringify({ repo: 'x', variant: 'fp32', files: ['onnx/gone.onnx', 7] })
      )
      expect(createWhisperModelStore(root).partialBytes('base')).toBe(0)
    })

    it('reads a tree entry with no declared size as zero rather than NaN', async () => {
      const sizeless = vi.fn(async (url: string) => {
        if (url.includes('/tree/main/onnx')) {
          return {
            ok: true,
            status: 200,
            json: async () => [
              { type: 'file', path: 'onnx/encoder_model.onnx' },
              { type: 'file', path: 'onnx/decoder_model_merged.onnx' }
            ]
          } as unknown as Response
        }
        if (url.includes('/tree/main')) {
          return { ok: true, status: 200, json: async () => [] } as unknown as Response
        }
        return {
          ok: true,
          status: 200,
          body: new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode('abc'))
              controller.close()
            }
          })
        } as unknown as Response
      })
      const s = createWhisperModelStore(root, { fetchFn: sizeless as never, wait: noWait })
      const events = await collect((on) => s.download('base', 'fp32', on))
      const progress = events.filter((e) => e.type === 'progress')
      for (const event of progress) {
        expect(Number.isFinite(event.loaded)).toBe(true)
        expect(Number.isFinite(event.total)).toBe(true)
      }
      expect(s.status('base').downloaded).toBe(true)
    })

    it('backs off between attempts, with a growing delay', async () => {
      const waits: number[] = []
      const broken = fakeRegistry({ failFile: 'onnx/encoder_model.onnx', failWith: 500 })
      const s = createWhisperModelStore(root, {
        fetchFn: broken as never,
        wait: async (ms) => void waits.push(ms)
      })
      await failure(() => s.download('base', 'fp32', () => {}))

      // Three waits for four attempts, each at least as long as the last: a
      // flat retry loop hammers a server that is already struggling.
      expect(waits).toHaveLength(3)
      expect(waits[0]).toBeGreaterThan(0)
      expect(waits[2]).toBeGreaterThanOrEqual(waits[1])
      expect(waits[1]).toBeGreaterThanOrEqual(waits[0])
    })
  })

  describe('disk space', () => {
    it('refuses before downloading when the volume cannot hold the model', async () => {
      const s = createWhisperModelStore(root, {
        fetchFn: fakeRegistry({}) as never,
        freeSpace: () => 1_000,
        wait: noWait
      })
      const error = await failure(() => s.download('base', 'fp32', () => {}))
      expect(toDownloadFailure(error)).toMatchObject({ kind: 'disk' })
    })

    it('proceeds when free space cannot be read — a probe is not a gate', async () => {
      const s = createWhisperModelStore(root, {
        fetchFn: fakeRegistry({}) as never,
        freeSpace: () => null,
        wait: noWait
      })
      await collect((on) => s.download('base', 'fp32', on))
      expect(s.status('base').downloaded).toBe(true)
    })
  })

  describe('status robustness', () => {
    it('treats a corrupt completion marker as not-downloaded', () => {
      const dir = join(root, 'base')
      mkdirSync(dir, { recursive: true })
      writeFileSync(join(dir, '.hive-complete.json'), '{not json')
      expect(createWhisperModelStore(root).status('base')).toEqual({
        downloaded: false,
        variant: null
      })
    })

    it('reports downloaded with a null variant when the marker omits it', () => {
      const dir = join(root, 'base')
      mkdirSync(dir, { recursive: true })
      writeFileSync(join(dir, '.hive-complete.json'), JSON.stringify({ repo: 'x' }))
      expect(createWhisperModelStore(root).status('base')).toEqual({
        downloaded: true,
        variant: null
      })
    })
  })

  describe('remove', () => {
    it('deletes the model directory and any partial, and is a no-op when absent', async () => {
      const store = createWhisperModelStore(root, {
        fetchFn: fakeRegistry({}) as never,
        wait: noWait
      })
      await collect((on) => store.download('base', 'fp32', on))
      expect(store.status('base').downloaded).toBe(true)
      expect(statSync(join(root, 'base')).isDirectory()).toBe(true)

      store.remove('base')
      expect(store.status('base').downloaded).toBe(false)
      expect(existsSync(join(root, 'base'))).toBe(false)
      expect(existsSync(join(root, '.tmp-base'))).toBe(false)

      expect(() => store.remove('base')).not.toThrow()
    })
  })
})
