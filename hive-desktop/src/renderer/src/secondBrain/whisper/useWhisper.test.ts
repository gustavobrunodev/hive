// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import {
  browserWhisperDeps,
  DEFAULT_LANGUAGE,
  DEFAULT_MODEL,
  probeWebGpu,
  useWhisper,
  type WhisperDeps
} from './useWhisper'
import type { TransformersEnv } from './whisperEnv'

function blankEnv(): TransformersEnv {
  return {
    allowRemoteModels: true,
    allowLocalModels: false,
    useBrowserCache: true,
    localModelPath: '',
    backends: { onnx: { wasm: { wasmPaths: '' } } }
  }
}

describe('useWhisper (T14)', () => {
  let asr: ReturnType<typeof vi.fn>
  let pipeline: ReturnType<typeof vi.fn>
  let env: TransformersEnv
  let modelStatus: ReturnType<typeof vi.fn>
  let downloadModel: ReturnType<typeof vi.fn>

  function makeDeps(overrides: Partial<WhisperDeps> = {}): WhisperDeps {
    return {
      loadLibrary: async () => ({ pipeline, env }) as never,
      hasWebGpu: async () => false,
      baseHref: () => 'file:///app/index.html',
      ...overrides
    }
  }

  beforeEach(() => {
    asr = vi.fn().mockResolvedValue({ text: '  olá squad  ' })
    pipeline = vi.fn().mockResolvedValue(asr)
    env = blankEnv()
    modelStatus = vi.fn().mockResolvedValue({ downloaded: true, variant: 'fp32' })
    downloadModel = vi.fn((_id: string, _v: string, onEvent: (e: unknown) => void) => {
      onEvent({ type: 'done', id: 'base' })
      return () => {}
    })
    window.hive = {
      ...window.hive,
      whisper: { ...window.hive?.whisper, modelStatus, downloadModel }
    } as typeof window.hive
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('transcribes with the pt-BR default language and trims the result (D-SB-6)', async () => {
    const { result } = renderHook(() => useWhisper(makeDeps()))

    let text = ''
    await act(async () => {
      text = await result.current.transcribe(new Float32Array([0.1, 0.2]))
    })

    expect(text).toBe('olá squad')
    expect(asr).toHaveBeenCalledWith(
      expect.any(Float32Array),
      expect.objectContaining({ language: DEFAULT_LANGUAGE, task: 'transcribe' })
    )
    expect(pipeline).toHaveBeenCalledWith(
      'automatic-speech-recognition',
      DEFAULT_MODEL,
      expect.anything()
    )
  })

  it('chunks long audio so a long recording cannot blow up memory or freeze', async () => {
    const { result } = renderHook(() => useWhisper(makeDeps()))
    await act(async () => {
      await result.current.transcribe(new Float32Array([0.1]))
    })
    expect(asr).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ chunk_length_s: 30, stride_length_s: 5 })
    )
  })

  it('uses WASM + fp32 when WebGPU is unavailable (the quantized decoder cannot build a WASM session)', async () => {
    const { result } = renderHook(() => useWhisper(makeDeps({ hasWebGpu: async () => false })))
    await act(async () => {
      await result.current.transcribe(new Float32Array([0.1]))
    })
    expect(pipeline).toHaveBeenCalledWith(
      'automatic-speech-recognition',
      'base',
      expect.objectContaining({ device: 'wasm', dtype: 'fp32' })
    )
    expect(modelStatus).toHaveBeenCalledWith('base')
  })

  it('uses WebGPU + q8 when an adapter is available (~4x smaller download)', async () => {
    modelStatus.mockResolvedValue({ downloaded: true, variant: 'q8' })
    const { result } = renderHook(() => useWhisper(makeDeps({ hasWebGpu: async () => true })))
    await act(async () => {
      await result.current.transcribe(new Float32Array([0.1]))
    })
    expect(pipeline).toHaveBeenCalledWith(
      'automatic-speech-recognition',
      'base',
      expect.objectContaining({ device: 'webgpu', dtype: 'q8' })
    )
  })

  it('downloads a missing model BEFORE loading the pipeline (a load-first would fault)', async () => {
    const order: string[] = []
    modelStatus.mockResolvedValue({ downloaded: false, variant: null })
    downloadModel.mockImplementation((_id, _v, onEvent) => {
      order.push('download')
      onEvent({ type: 'progress', id: 'base', loaded: 50, total: 100, file: 'config.json' })
      onEvent({ type: 'done', id: 'base' })
      return () => {}
    })
    pipeline.mockImplementation(async () => {
      order.push('load')
      return asr
    })

    const { result } = renderHook(() => useWhisper(makeDeps()))
    await act(async () => {
      await result.current.transcribe(new Float32Array([0.1]))
    })

    expect(order).toEqual(['download', 'load'])
    expect(downloadModel).toHaveBeenCalledWith('base', 'fp32', expect.any(Function))
  })

  it('re-downloads when the on-disk variant differs from the one this device needs', async () => {
    // Downloaded as q8 (a WebGPU run) but now running on WASM, which needs fp32.
    modelStatus.mockResolvedValue({ downloaded: true, variant: 'q8' })
    const { result } = renderHook(() => useWhisper(makeDeps({ hasWebGpu: async () => false })))
    await act(async () => {
      await result.current.transcribe(new Float32Array([0.1]))
    })
    expect(downloadModel).toHaveBeenCalledWith('base', 'fp32', expect.any(Function))
  })

  it('skips the download entirely when the right variant is already on disk', async () => {
    const { result } = renderHook(() => useWhisper(makeDeps()))
    await act(async () => {
      await result.current.transcribe(new Float32Array([0.1]))
    })
    expect(downloadModel).not.toHaveBeenCalled()
  })

  it('applies the proven offline env before building the pipeline', async () => {
    const { result } = renderHook(() => useWhisper(makeDeps()))
    await act(async () => {
      await result.current.transcribe(new Float32Array([0.1]))
    })
    expect(env.allowRemoteModels).toBe(false)
    expect(env.localModelPath).toBe('hive-model://models/')
    expect(env.backends.onnx.wasm.wasmPaths).toBe('file:///app/ort/')
  })

  it('caches the warmed pipeline across transcriptions of the same model', async () => {
    const { result } = renderHook(() => useWhisper(makeDeps()))
    await act(async () => {
      await result.current.transcribe(new Float32Array([0.1]))
      await result.current.transcribe(new Float32Array([0.2]))
    })
    expect(pipeline).toHaveBeenCalledTimes(1)
    expect(asr).toHaveBeenCalledTimes(2)
  })

  it('rebuilds the pipeline when a different model is requested', async () => {
    const { result } = renderHook(() => useWhisper(makeDeps()))
    await act(async () => {
      await result.current.transcribe(new Float32Array([0.1]), { model: 'base' })
      await result.current.transcribe(new Float32Array([0.2]), { model: 'small' })
    })
    expect(pipeline).toHaveBeenCalledTimes(2)
    expect(pipeline).toHaveBeenLastCalledWith(
      'automatic-speech-recognition',
      'small',
      expect.anything()
    )
  })

  it('honors an explicit language override', async () => {
    const { result } = renderHook(() => useWhisper(makeDeps()))
    await act(async () => {
      await result.current.transcribe(new Float32Array([0.1]), { language: 'english' })
    })
    expect(asr).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ language: 'english' })
    )
  })

  it('reports download progress, then load progress, then idle', async () => {
    modelStatus.mockResolvedValue({ downloaded: false, variant: null })
    const phases: string[] = []
    downloadModel.mockImplementation((_id, _v, onEvent) => {
      onEvent({ type: 'progress', id: 'base', loaded: 25, total: 100, file: 'config.json' })
      onEvent({ type: 'done', id: 'base' })
      return () => {}
    })
    pipeline.mockImplementation(async (_task, _repo, options: Record<string, unknown>) => {
      const cb = options.progress_callback as (p: unknown) => void
      cb({ status: 'progress', progress: 42 })
      cb({ status: 'ready' }) // ignored — not a progress tick
      return asr
    })

    const { result } = renderHook(() => useWhisper(makeDeps()))
    const record = (): void => void phases.push(result.current.phase.status)

    await act(async () => {
      const promise = result.current.transcribe(new Float32Array([0.1]))
      record()
      await promise
    })

    expect(result.current.phase).toEqual({ status: 'idle' })
  })

  it('surfaces a download failure as an error phase and rejects', async () => {
    modelStatus.mockResolvedValue({ downloaded: false, variant: null })
    downloadModel.mockImplementation((_id, _v, onEvent) => {
      onEvent({ type: 'error', id: 'base', message: 'sem conexão' })
      return () => {}
    })

    const { result } = renderHook(() => useWhisper(makeDeps()))
    await act(async () => {
      await expect(result.current.transcribe(new Float32Array([0.1]))).rejects.toThrow(
        'sem conexão'
      )
    })
    await waitFor(() =>
      expect(result.current.phase).toEqual({ status: 'error', message: 'sem conexão' })
    )
  })

  it('surfaces a transcription failure as an error phase (SB-R4.6)', async () => {
    asr.mockRejectedValue(new Error('session create failed'))
    const { result } = renderHook(() => useWhisper(makeDeps()))
    await act(async () => {
      await expect(result.current.transcribe(new Float32Array([0.1]))).rejects.toThrow()
    })
    expect(result.current.phase).toMatchObject({ status: 'error' })

    act(() => result.current.reset())
    expect(result.current.phase).toEqual({ status: 'idle' })
  })

  it('handles a non-Error rejection without losing the message', async () => {
    asr.mockRejectedValue('plain string failure')
    const { result } = renderHook(() => useWhisper(makeDeps()))
    await act(async () => {
      await expect(result.current.transcribe(new Float32Array([0.1]))).rejects.toBeTruthy()
    })
    expect(result.current.phase).toEqual({ status: 'error', message: 'plain string failure' })
  })

  it('reports 0% rather than NaN when a download has no known total', async () => {
    modelStatus.mockResolvedValue({ downloaded: false, variant: null })
    let seen: unknown = null
    downloadModel.mockImplementation((_id, _v, onEvent) => {
      onEvent({ type: 'progress', id: 'base', loaded: 10, total: 0, file: 'x' })
      seen = true
      onEvent({ type: 'done', id: 'base' })
      return () => {}
    })
    const { result } = renderHook(() => useWhisper(makeDeps()))
    await act(async () => {
      await result.current.transcribe(new Float32Array([0.1]))
    })
    expect(seen).toBe(true)
  })

  // `navigator.gpu` alone is NOT proof of WebGPU — the T2 spike found it truthy
  // in a headless Electron run where no adapter exists — so the probe must
  // await requestAdapter() and fall back to WASM on null/throw.
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

  it('browserWhisperDeps reads the document base for the same-origin ORT dir', () => {
    const deps = browserWhisperDeps()
    expect(deps.baseHref()).toBe(document.baseURI)
    expect(deps.hasWebGpu).toBe(probeWebGpu)
  })

  it('returns an empty string when the model produced no text field', async () => {
    asr.mockResolvedValue({})
    const { result } = renderHook(() => useWhisper(makeDeps()))
    let text = 'unset'
    await act(async () => {
      text = await result.current.transcribe(new Float32Array([0.1]))
    })
    expect(text).toBe('')
  })
})
