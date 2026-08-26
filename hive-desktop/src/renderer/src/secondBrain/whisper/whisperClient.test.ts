// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  chooseVariant,
  createWhisperClient,
  probeWebGpu,
  type WhisperClient,
  type WhisperPhase
} from './whisperClient'
import type { WhisperWorkerRequest, WhisperWorkerResponse } from './whisperWorkerProtocol'

/**
 * The client's half of transcription: the things the worker cannot do because
 * it has no bridge (resolve the device, pick the precision, make sure the bytes
 * are on disk) and the things that only make sense on this side (one shared
 * engine for the whole app, a pre-warm that a real take joins instead of
 * racing, partial text accumulated into a running string).
 */

/** A stand-in worker the test drives, in place of a real thread. */
class FakeWorker {
  sent: WhisperWorkerRequest[] = []
  transfers: Transferable[][] = []
  onmessage: ((event: MessageEvent<WhisperWorkerResponse>) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null
  terminated = 0

  postMessage(request: WhisperWorkerRequest, transfer?: Transferable[]): void {
    this.sent.push(request)
    this.transfers.push(transfer ?? [])
  }
  terminate(): void {
    this.terminated += 1
  }
  /** Answers the request at `index` (default: the last one). */
  reply(message: WhisperWorkerResponse): void {
    this.onmessage?.({ data: message } as MessageEvent<WhisperWorkerResponse>)
  }
  lastId(): number {
    return this.sent[this.sent.length - 1].id
  }
}

describe('whisperClient', () => {
  let worker: FakeWorker
  let modelStatus: ReturnType<typeof vi.fn>
  let startDownload: ReturnType<typeof vi.fn>
  let autoFinish = true
  let downloadStream: {
    progress: (loaded: number, total: number, file: string) => void
    finish: () => void
    fail: (detail: string) => void
  }

  function client(hasWebGpu = false): WhisperClient {
    return createWhisperClient({
      spawn: () => worker as unknown as Worker,
      hasWebGpu: async () => hasWebGpu,
      baseHref: () => 'file:///app/index.html'
    })
  }

  /**
   * Waits for the client's Nth message to reach the worker, then answers it.
   *
   * The count matters: `prepare()` is asynchronous (device probe + model
   * status), so right after a call the worker has not been posted to yet and
   * "is there anything in the queue" would answer with the *previous* request's
   * id — a reply nobody is waiting on, and a test that hangs rather than fails.
   */
  async function settle(count = 1, text = 'olá squad'): Promise<void> {
    await vi.waitFor(() => expect(worker.sent.length).toBe(count))
    worker.reply({ type: 'done', id: worker.lastId(), text })
  }

  beforeEach(() => {
    worker = new FakeWorker()
    modelStatus = vi.fn().mockResolvedValue({ downloaded: true, variant: 'fp32' })

    const snapshotListeners: Array<(list: unknown[]) => void> = []
    const settledListeners: Array<(download: unknown) => void> = []
    autoFinish = true
    downloadStream = {
      progress: (loaded, total, file) => {
        for (const listener of snapshotListeners) {
          listener([{ id: 'base', status: 'downloading', loaded, total, file }])
        }
      },
      finish: () => {
        for (const listener of settledListeners) listener({ id: 'base', status: 'done' })
      },
      fail: (detail) => {
        for (const listener of settledListeners) {
          listener({ id: 'base', status: 'error', failure: { kind: 'offline', detail } })
        }
      }
    }
    startDownload = vi.fn(() => {
      if (autoFinish) downloadStream.finish()
      return Promise.resolve()
    })

    window.hive = {
      ...window.hive,
      whisper: {
        ...window.hive?.whisper,
        modelStatus,
        startDownload,
        onDownloads: (listener: (list: unknown[]) => void) => {
          snapshotListeners.push(listener)
          return () => snapshotListeners.splice(snapshotListeners.indexOf(listener), 1)
        },
        onDownloadSettled: (listener: (download: unknown) => void) => {
          settledListeners.push(listener)
          return () => settledListeners.splice(settledListeners.indexOf(listener), 1)
        }
      }
    } as typeof window.hive
  })

  afterEach(() => vi.restoreAllMocks())

  it('resolves device and precision before the worker sees anything', async () => {
    const engine = client(false)
    const running = engine.transcribe(new Float32Array([0.1]))
    await settle()
    await expect(running).resolves.toBe('olá squad')
    expect(worker.sent[0]).toMatchObject({
      type: 'transcribe',
      model: 'base',
      variant: 'fp32',
      device: 'wasm',
      language: 'portuguese',
      baseHref: 'file:///app/index.html'
    })
  })

  it('downloads a missing model BEFORE the worker is asked (a load-first would fault)', async () => {
    modelStatus.mockResolvedValue({ downloaded: false, variant: null })
    const engine = client()
    const running = engine.transcribe(new Float32Array([0.1]))
    await vi.waitFor(() => expect(startDownload).toHaveBeenCalledWith('base', 'fp32'))
    await settle()
    await running
    expect(worker.sent).toHaveLength(1)
  })

  it('re-downloads when the on-disk precision is one this device cannot load', async () => {
    // q8 on disk (a WebGPU run) but running on WASM, which needs fp32.
    modelStatus.mockResolvedValue({ downloaded: true, variant: 'q8' })
    const engine = client(false)
    const running = engine.transcribe(new Float32Array([0.1]))
    await vi.waitFor(() => expect(startDownload).toHaveBeenCalledWith('base', 'fp32'))
    await settle()
    await running
  })

  it('reports download progress, and 0% rather than NaN with no known total', async () => {
    modelStatus.mockResolvedValue({ downloaded: false, variant: null })
    autoFinish = false
    const engine = client()
    const phases: WhisperPhase[] = []
    engine.subscribe((phase) => phases.push(phase))
    const running = engine.transcribe(new Float32Array([0.1]))
    await vi.waitFor(() => expect(startDownload).toHaveBeenCalled())
    downloadStream.progress(10, 0, 'x')
    expect(phases).toContainEqual({ status: 'downloading', pct: 0, file: 'x' })
    downloadStream.finish()
    await settle()
    await running
  })

  it('surfaces a download failure as an error phase and rejects', async () => {
    modelStatus.mockResolvedValue({ downloaded: false, variant: null })
    startDownload.mockImplementation(() => {
      downloadStream.fail('sem conexão')
      return Promise.resolve()
    })
    const engine = client()
    await expect(engine.transcribe(new Float32Array([0.1]))).rejects.toThrow('sem conexão')
    expect(engine.phase()).toEqual({ status: 'error', message: 'sem conexão' })
    engine.reset()
    expect(engine.phase()).toEqual({ status: 'idle' })
  })

  /**
   * The defect this exists for: pre-warm on hover and then speak used to be two
   * independent builds fighting for one core, which made warming *slower* than
   * not warming.
   */
  it('a transcription joins a warm already in flight instead of racing it', async () => {
    const engine = client()
    const warming = engine.warm()
    await vi.waitFor(() => expect(worker.sent).toHaveLength(1))
    expect(worker.sent[0].type).toBe('warm')

    const running = engine.transcribe(new Float32Array([0.1]))
    // Nothing new reaches the worker until the warm settles.
    await Promise.resolve()
    expect(worker.sent).toHaveLength(1)

    worker.reply({ type: 'done', id: worker.sent[0].id, text: '' })
    await warming
    await settle(2)
    await running
    expect(worker.sent.map((request) => request.type)).toEqual(['warm', 'transcribe'])
  })

  it('warms once per model, however many surfaces ask', async () => {
    const engine = client()
    const first = engine.warm()
    const second = engine.warm()
    await vi.waitFor(() => expect(worker.sent).toHaveLength(1))
    worker.reply({ type: 'done', id: worker.sent[0].id, text: '' })
    await Promise.all([first, second])
    expect(worker.sent).toHaveLength(1)
  })

  it('a finished transcription counts as warm — a later pre-warm is free', async () => {
    const engine = client()
    const running = engine.transcribe(new Float32Array([0.1]))
    await settle()
    await running
    await engine.warm()
    expect(worker.sent).toHaveLength(1)
  })

  it('accumulates partial pieces into the running text', async () => {
    const engine = client()
    const seen: string[] = []
    const running = engine.transcribe(new Float32Array([0.1]), {
      onPartial: (text) => seen.push(text)
    })
    await vi.waitFor(() => expect(worker.sent).toHaveLength(1))
    const id = worker.lastId()
    worker.reply({ type: 'partial', id, text: 'Olá' })
    worker.reply({ type: 'partial', id, text: ' squad' })
    worker.reply({ type: 'done', id, text: 'Olá squad' })
    await running
    // The caller gets the sentence so far, not the fragment — a UI that had to
    // concatenate them itself would be a second place for that rule to live.
    expect(seen).toEqual(['Olá', 'Olá squad'])
  })

  it('hands the PCM over rather than copying it', async () => {
    const engine = client()
    const pcm = new Float32Array([0.1, 0.2])
    const running = engine.transcribe(pcm)
    await vi.waitFor(() => expect(worker.sent).toHaveLength(1))
    expect(worker.transfers[0]).toEqual([pcm.buffer])
    await settle()
    await running
  })

  it('spawns exactly one worker for the whole app', async () => {
    const spawn = vi.fn(() => worker as unknown as Worker)
    const engine = createWhisperClient({
      spawn,
      hasWebGpu: async () => false,
      baseHref: () => 'file:///app/index.html'
    })
    const first = engine.transcribe(new Float32Array([0.1]))
    await settle()
    await first
    const second = engine.transcribe(new Float32Array([0.2]))
    await settle(2)
    await second
    expect(spawn).toHaveBeenCalledTimes(1)
  })

  it('fails every waiting request when the worker itself dies', async () => {
    const engine = client()
    const running = engine.transcribe(new Float32Array([0.1]))
    await vi.waitFor(() => expect(worker.sent).toHaveLength(1))
    worker.onerror?.({ message: 'worker blew up' } as ErrorEvent)
    await expect(running).rejects.toThrow('worker blew up')
    expect(engine.phase()).toMatchObject({ status: 'error' })
  })

  it('relays the worker phases, and settles back to idle', async () => {
    const engine = client()
    const phases: WhisperPhase[] = []
    engine.subscribe((phase) => phases.push(phase))
    const running = engine.transcribe(new Float32Array([0.1]))
    await vi.waitFor(() => expect(worker.sent).toHaveLength(1))
    const id = worker.lastId()
    worker.reply({ type: 'phase', id, phase: { status: 'loading', pct: 40 } })
    worker.reply({ type: 'phase', id, phase: { status: 'transcribing' } })
    worker.reply({ type: 'done', id, text: 'ok' })
    worker.reply({ type: 'phase', id, phase: { status: 'idle' } })
    await running
    expect(phases).toContainEqual({ status: 'loading', pct: 40 })
    expect(engine.phase()).toEqual({ status: 'idle' })
  })

  describe('chooseVariant', () => {
    it('needs fp32 on WASM even when q8 is already on disk', () => {
      expect(chooseVariant(false, { downloaded: true, variant: 'q8' })).toBe('fp32')
    })
    it('reuses the fp32 copy on WebGPU rather than fetching q8 for nothing', () => {
      expect(chooseVariant(true, { downloaded: true, variant: 'fp32' })).toBe('fp32')
    })
    it('prefers the smaller q8 download when nothing is on disk and WebGPU is real', () => {
      expect(chooseVariant(true, { downloaded: false, variant: null })).toBe('q8')
    })
  })

  // `navigator.gpu` alone is NOT proof of WebGPU — the T2 spike found it truthy
  // in a headless Electron run where no adapter exists.
  describe('probeWebGpu', () => {
    afterEach(() => vi.unstubAllGlobals())

    it('is false when navigator.gpu is absent', async () => {
      vi.stubGlobal('navigator', {})
      expect(await probeWebGpu()).toBe(false)
    })

    it('is false when gpu exists but no adapter answers (the headless trap)', async () => {
      vi.stubGlobal('navigator', { gpu: { requestAdapter: async () => null } })
      expect(await probeWebGpu()).toBe(false)
    })

    it('is false when requestAdapter throws', async () => {
      vi.stubGlobal('navigator', {
        gpu: {
          requestAdapter: async () => {
            throw new Error('no adapter')
          }
        }
      })
      expect(await probeWebGpu()).toBe(false)
    })

    it('is true only when a real adapter answers', async () => {
      vi.stubGlobal('navigator', { gpu: { requestAdapter: async () => ({ name: 'adapter' }) } })
      expect(await probeWebGpu()).toBe(true)
    })
  })
})
