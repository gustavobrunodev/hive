// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createAsrClient, type AsrBridge, type AsrPhase } from './asrClient'
import { enginePhaseView, engineErrorCopy } from './enginePhase'
import { createHiveAsrMock } from '../testSupport/hiveAsrMock'

/**
 * The renderer's handle on the engine. There is little to assert because there
 * is little left in the file — which is the point: its predecessor probed for
 * WebGPU, chose a precision, checked the disk, started downloads and replaced
 * its own worker to get memory back. Inference in a native process leaves a
 * subscription and two calls.
 */

describe('asrClient', () => {
  let bridge: ReturnType<typeof createHiveAsrMock>
  let publish: (phase: AsrPhase) => void

  beforeEach(() => {
    bridge = createHiveAsrMock()
    bridge.onPhase.mockImplementation((listener: (phase: AsrPhase) => void) => {
      publish = listener
      return () => {}
    })
  })

  afterEach(() => vi.restoreAllMocks())

  const client = (): ReturnType<typeof createAsrClient> =>
    createAsrClient(() => bridge as unknown as AsrBridge)

  it('starts idle and follows main’s broadcast', () => {
    const c = client()
    expect(c.phase()).toEqual({ status: 'idle' })
    publish({ status: 'loading' })
    expect(c.phase()).toEqual({ status: 'loading' })
  })

  it('notifies subscribers, and stops once they unsubscribe', () => {
    const c = client()
    const seen: AsrPhase[] = []
    const off = c.subscribe((phase) => seen.push(phase))
    publish({ status: 'transcribing' })
    off()
    publish({ status: 'ready' })
    expect(seen).toEqual([{ status: 'transcribing' }])
  })

  /**
   * The failure mode that disappeared rather than being guarded against: the
   * old client *transferred* the PCM to its worker, detaching the buffer that
   * `transcriptionQueue` retains for retries — so the first failure of a take
   * turned "Tentar de novo" into a second error, permanently. IPC clones.
   */
  it('leaves the caller’s audio intact', async () => {
    const pcm = new Float32Array([0.1, 0.2, 0.3])
    bridge.transcribe.mockResolvedValue('olá')
    await expect(client().transcribe(pcm)).resolves.toBe('olá')
    expect(bridge.transcribe).toHaveBeenCalledWith(pcm)
    expect(pcm.length).toBe(3)
  })

  it('warms through the bridge', async () => {
    await client().warm()
    expect(bridge.warm).toHaveBeenCalledTimes(1)
  })

  it('clears an error the user has seen, and leaves any other phase alone', () => {
    const c = client()
    publish({ status: 'error', message: 'boom' })
    c.reset()
    expect(c.phase()).toEqual({ status: 'idle' })

    publish({ status: 'transcribing' })
    c.reset()
    expect(c.phase()).toEqual({ status: 'transcribing' })
  })

  /**
   * Reading the bridge per call rather than capturing it: the client is a
   * module singleton that outlives any particular `window.hive`.
   */
  it('follows a bridge that is replaced under it', async () => {
    let current = bridge
    const c = createAsrClient(() => current as unknown as AsrBridge)
    const replacement = createHiveAsrMock()
    replacement.transcribe.mockResolvedValue('depois')
    current = replacement
    await expect(c.transcribe(new Float32Array(4))).resolves.toBe('depois')
  })
})

describe('enginePhaseView', () => {
  it('describes the session build as unmeasurable, because it is', () => {
    const view = enginePhaseView({ status: 'loading' })
    // Building the ONNX session emits no progress at all — measured at ~1.8 s,
    // which is why it is worth naming rather than hiding.
    expect(view).toMatchObject({ kind: 'loading', pct: null })
    expect(view?.hint).toBeTruthy()
  })

  it('describes a decode in flight', () => {
    expect(enginePhaseView({ status: 'transcribing' })).toMatchObject({
      kind: 'transcribing',
      pct: null
    })
  })

  it.each([['idle'], ['ready']] as const)('says nothing at all when %s', (status) => {
    expect(enginePhaseView({ status })).toBeNull()
  })

  it('says nothing for an error — the failure copy owns that', () => {
    expect(enginePhaseView({ status: 'error', message: 'boom' })).toBeNull()
  })
})

describe('engineErrorCopy', () => {
  it('turns a missing model into the download it is really about', () => {
    expect(engineErrorCopy('model files missing: /m/encoder.int8.onnx')).toContain(
      'Baixe-o de novo'
    )
    expect(engineErrorCopy('no model installed')).toContain('Baixe-o de novo')
  })

  it('leaves a failure it has no better words for exactly as it came', () => {
    expect(engineErrorCopy('failed to create session')).toBe('failed to create session')
  })

  it('answers an empty message with something rather than nothing', () => {
    expect(engineErrorCopy('   ')).toBeTruthy()
  })

  it('names a broken install for what it is, in the words the addon uses', () => {
    // Verbatim from a packaged Windows build on 2026-09-02 — the installer had
    // been produced on Linux, so it carried no Windows binary. The user read
    // this sentence, in English, with relative paths in it, and it told them to
    // retry something that could never work.
    const raw =
      "Error invoking remote method 'asr:transcribe': AsrError: Could not find sherpa-onnx-node. " +
      'Tried ../build/Release/sherpa-onnx.node ./node_modules/sherpa-onnx-win-x64/sherpa-onnx.node'
    const copy = engineErrorCopy(raw)
    expect(copy).toContain('Reinstale')
    expect(copy).not.toContain('sherpa')
    expect(copy).not.toContain('remote method')
  })

  it('covers the other way the addon fails to load', () => {
    expect(engineErrorCopy("Cannot find module 'sherpa-onnx-node'")).toContain('Reinstale')
    expect(engineErrorCopy('sherpa-onnx-node loaded no native binary from /x')).toContain(
      'Reinstale'
    )
  })

  it('strips the IPC wrapper from a failure it otherwise has no words for', () => {
    // The channel that carried a failure is never the failure. Whatever falls
    // through to the raw branch should read as the engine talking, not as
    // Electron talking about the engine.
    expect(engineErrorCopy("Error invoking remote method 'asr:transcribe': failed to run")).toBe(
      'failed to run'
    )
  })
})
