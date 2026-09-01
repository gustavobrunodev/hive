// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { createElement, createRef } from 'react'
import { useWhisperDictation } from './useWhisperDictation'
import type { ComposerDictationOptions } from './useComposerDictation'

/**
 * The bundle every dictating field calls (`dictation/useWhisperDictation.ts`).
 *
 * The one thing worth asserting here is the drift this hook exists to prevent:
 * the model that actually transcribes must be the gate's — the user's — and not
 * the engine's built-in default. That is the exact bug M25 found in the chat
 * composer after a milestone of nobody noticing, and it is invisible from the
 * outside: dictation still works, just with the wrong model.
 */

const transcribe = vi.fn(async () => 'texto')
const warm = vi.fn(async () => {})
const phase = { status: 'idle' } as const

vi.mock('../secondBrain/whisper/useWhisper', () => ({
  DEFAULT_LANGUAGE: 'portuguese',
  useWhisper: () => ({ phase, transcribe, warm })
}))

let gateActive: boolean | undefined
let gateModel: string | null = 'small'
vi.mock('../voice/useVoiceGate', () => ({
  useVoiceGate: (active?: boolean) => {
    gateActive = active
    return {
      model: gateModel,
      blocked: gateModel === null,
      guard: vi.fn(),
      open: false,
      setOpen: vi.fn()
    }
  }
}))

// Armed only under the E2E harness; here it stays out of the way unless a test
// asks for it (the seam is a real branch of this hook, and the only one that
// decides whether a take reaches Whisper at all).
let seamEngine: unknown = null
vi.mock('./e2eDictationSeam', () => ({ e2eDictationEngine: () => seamEngine }))

let composerOptions: ComposerDictationOptions | null = null
const composerPrewarm = vi.fn()
vi.mock('./useComposerDictation', () => ({
  useComposerDictation: (options: ComposerDictationOptions) => {
    composerOptions = options
    // `prewarm` is not optional in the double: `usePrewarm` calls it the moment
    // the surface mounts (D-VP-6), so a stub without it fails at render.
    return { phase: options.engine.phase, active: false, prewarm: composerPrewarm }
  }
}))

function mount(active?: boolean): void {
  function Field(): React.JSX.Element {
    useWhisperDictation({
      value: 'pergunta',
      setValue: vi.fn(),
      textareaRef: createRef<HTMLTextAreaElement>(),
      active
    })
    return createElement('div')
  }
  render(createElement(Field))
}

describe('useWhisperDictation', () => {
  beforeEach(() => {
    transcribe.mockClear()
    warm.mockClear()
    composerPrewarm.mockClear()
    composerOptions = null
    gateActive = undefined
    gateModel = 'small'
    seamEngine = null
  })
  afterEach(() => cleanup())

  it('transcribes with the model the user actually chose, in pt-BR', async () => {
    mount()

    await composerOptions?.engine.transcribe(new Float32Array(4))
    expect(transcribe).toHaveBeenCalledWith(expect.any(Float32Array), {
      model: 'small',
      language: 'portuguese'
    })
  })

  it('sends no model at all while none is installed, rather than inventing one', async () => {
    gateModel = null
    mount()

    await composerOptions?.engine.transcribe(new Float32Array(4))
    expect(transcribe).toHaveBeenCalledWith(expect.any(Float32Array), {
      model: undefined,
      language: 'portuguese'
    })
  })

  it('warms with the chosen model too — a build for the wrong one warms nothing', async () => {
    mount()
    await composerOptions?.engine.warm()
    expect(warm).toHaveBeenCalledWith('small')
  })

  it('pre-warms the moment the surface opens, which is the intent (D-VP-6)', () => {
    mount()
    expect(composerPrewarm).toHaveBeenCalled()
  })

  /**
   * A real Whisper pass would add a model download and seconds of warm-up to
   * every E2E run. When the harness is armed its stand-in **is** the engine —
   * if the real one leaked through here, the E2E would be downloading weights.
   */
  it('hands the E2E stand-in straight through when the harness is armed', async () => {
    const scripted = {
      phase,
      transcribe: vi.fn(async () => 'roteiro'),
      warm: vi.fn(async () => {})
    }
    seamEngine = scripted
    mount()

    await composerOptions?.engine.transcribe(new Float32Array(4))
    expect(scripted.transcribe).toHaveBeenCalled()
    expect(transcribe).not.toHaveBeenCalled()
  })

  /**
   * M26: the app ships no weights, so "no model" is what a fresh install has.
   * Warming there would mean starting a download nobody agreed to.
   */
  it('warms nothing while no model is installed', () => {
    gateModel = null
    mount()
    expect(composerPrewarm).not.toHaveBeenCalled()
  })

  it('passes the engine phase through, so the transport can show a download', () => {
    mount()
    expect(composerOptions?.engine.phase).toBe(phase)
  })

  it('keeps a closed surface off the model preference subscription', () => {
    mount(false)
    expect(gateActive).toBe(false)
  })

  it('defaults to active, for a field that is always on screen', () => {
    mount()
    expect(gateActive).toBe(true)
  })
})
