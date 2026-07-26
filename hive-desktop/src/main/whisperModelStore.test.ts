import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  createWhisperModelStore,
  DEFAULT_WHISPER_MODEL,
  WHISPER_CATALOG,
  type WhisperModelStore
} from './whisperModelStore'
import type { WhisperDownloadEvent, WhisperVariant } from './whisperTypes'

/** A tiny fake of the HF tree API + file CDN, with no network involved. */
function fakeRegistry(options: {
  root?: Array<{ path: string; size: number }>
  onnx?: Array<{ path: string; size: number }>
  bodies?: Record<string, string>
  failFile?: string
  treeStatus?: number
}): ReturnType<typeof vi.fn> {
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
  return vi.fn(async (url: string) => {
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
    if (options.failFile && relative === options.failFile) {
      return { ok: false, status: 500, body: null } as unknown as Response
    }
    const content = options.bodies?.[relative] ?? `bytes:${relative}`
    return {
      ok: true,
      status: 200,
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(content))
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

describe('whisperModelStore', () => {
  let root: string

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
    it('reports nothing downloaded on a fresh store', () => {
      const store = createWhisperModelStore(root)
      expect(store.status('base')).toEqual({ downloaded: false, variant: null })
      expect(store.list().every((m) => !m.downloaded)).toBe(true)
    })

    it('throws on an unknown model id rather than inventing a repo', async () => {
      const store = createWhisperModelStore(root, { fetchFn: fakeRegistry({}) as never })
      const events = await collect((on) => store.download('nope' as never, 'fp32', on))
      expect(events.at(-1)).toMatchObject({
        type: 'error',
        message: expect.stringContaining('unknown model')
      })
    })
  })

  describe('download', () => {
    let store: WhisperModelStore
    let fetchFn: ReturnType<typeof vi.fn>

    beforeEach(() => {
      fetchFn = fakeRegistry({})
      store = createWhisperModelStore(root, { fetchFn: fetchFn as never })
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
      const s = createWhisperModelStore(root, { fetchFn: external as never })
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
      const failing = fakeRegistry({ failFile: 'onnx/decoder_model_merged.onnx' })
      const s = createWhisperModelStore(root, { fetchFn: failing as never })

      const events = await collect((on) => s.download('base', 'fp32', on))

      expect(events.at(-1)).toMatchObject({ type: 'error' })
      expect(s.status('base')).toEqual({ downloaded: false, variant: null })
      // No partial model dir, and the temp dir is cleaned up.
      expect(existsSync(join(root, 'base'))).toBe(false)
      expect(existsSync(join(root, '.tmp-base'))).toBe(false)
    })

    it('a failed re-download leaves the previously-complete model intact', async () => {
      await collect((on) => store.download('base', 'fp32', on))
      expect(store.status('base').downloaded).toBe(true)

      const failing = fakeRegistry({ failFile: 'config.json' })
      const s = createWhisperModelStore(root, { fetchFn: failing as never })
      await collect((on) => s.download('base', 'fp32', on))

      // The old model is still there and still usable.
      expect(s.status('base')).toEqual({ downloaded: true, variant: 'fp32' })
      expect(existsSync(join(root, 'base', 'onnx', 'encoder_model.onnx'))).toBe(true)
    })

    it('surfaces an unavailable model index as an error event', async () => {
      const offline = fakeRegistry({ treeStatus: 503 })
      const s = createWhisperModelStore(root, { fetchFn: offline as never })
      const events = await collect((on) => s.download('base', 'fp32', on))
      expect(events.at(-1)).toMatchObject({
        type: 'error',
        message: expect.stringContaining('503')
      })
    })

    it('errors clearly when the repo publishes no weights for the requested variant', async () => {
      const noQ8 = fakeRegistry({
        onnx: [{ path: 'onnx/encoder_model.onnx', size: 10 }]
      })
      const s = createWhisperModelStore(root, { fetchFn: noQ8 as never })
      const events = await collect((on) => s.download('base', 'q8' as WhisperVariant, on))
      expect(events.at(-1)).toMatchObject({
        type: 'error',
        message: expect.stringContaining('no q8 weights')
      })
    })

    it('re-downloading replaces the previous copy', async () => {
      await collect((on) => store.download('base', 'fp32', on))
      await collect((on) => store.download('base', 'q8', on))
      expect(store.status('base')).toEqual({ downloaded: true, variant: 'q8' })
      expect(existsSync(join(root, 'base', 'onnx', 'encoder_model.onnx'))).toBe(false)
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
    it('deletes the model directory and is a no-op when absent', async () => {
      const store = createWhisperModelStore(root, { fetchFn: fakeRegistry({}) as never })
      await collect((on) => store.download('base', 'fp32', on))
      expect(store.status('base').downloaded).toBe(true)

      store.remove('base')
      expect(store.status('base').downloaded).toBe(false)
      expect(existsSync(join(root, 'base'))).toBe(false)

      expect(() => store.remove('base')).not.toThrow()
    })
  })

  it('writes the real file bytes it received', async () => {
    const store = createWhisperModelStore(root, {
      fetchFn: fakeRegistry({ bodies: { 'config.json': '{"model_type":"whisper"}' } }) as never
    })
    await collect((on) => store.download('base', 'fp32', on))
    expect(readFileSync(join(root, 'base', 'config.json'), 'utf-8')).toBe(
      '{"model_type":"whisper"}'
    )
  })
})
