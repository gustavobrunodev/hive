// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { createElement, createRef } from 'react'
import { useAsrDictation } from './useAsrDictation'
import type { ComposerDictationOptions } from './useComposerDictation'

/**
 * The bundle every dictating field calls (`dictation/useAsrDictation.ts`).
 *
 * It used to exist to prevent one specific drift: the model that transcribes
 * had to be the user's, not the engine's built-in default — the bug M25 found
 * in the chat composer after a milestone of nobody noticing, invisible from the
 * outside because dictation still worked, just with the wrong model.
 *
 * M29 removes the parameter that could drift. What this bundle still owes every
 * field is the rest of the wiring: the gate, the pre-warm on intent, and the
 * E2E seam taking precedence over a real engine.
 */

const transcribe = vi.fn(async () => 'texto')
const warm = vi.fn(async () => {})
const phase = { status: 'idle' } as const

vi.mock('../asr/useAsr', () => ({ useAsr: () => ({ phase, transcribe, warm }) }))

let gateActive: boolean | undefined
let gateReady = true
vi.mock('../voice/useVoiceGate', () => ({
  useVoiceGate: (active?: boolean) => {
    gateActive = active
    return {
      ready: gateReady,
      blocked: !gateReady,
      guard: vi.fn(),
      open: false,
      setOpen: vi.fn()
    }
  }
}))

// Armed only under the E2E harness; here it stays out of the way unless a test
// asks for it (the seam is a real branch of this hook, and the only one that
// decides whether a take reaches the real engine at all).
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
    useAsrDictation({
      value: 'pergunta',
      setValue: vi.fn(),
      textareaRef: createRef<HTMLTextAreaElement>(),
      active
    })
    return createElement('div')
  }
  render(createElement(Field))
}

describe('useAsrDictation', () => {
  beforeEach(() => {
    transcribe.mockClear()
    warm.mockClear()
    composerPrewarm.mockClear()
    composerOptions = null
    gateActive = undefined
    gateReady = true
    seamEngine = null
  })
  afterEach(() => cleanup())

  it('hands the engine straight through, with nothing added to get wrong', async () => {
    mount()

    await composerOptions?.engine.transcribe(new Float32Array(4))
    // No model id, no language: one model that detects its own language leaves
    // the bundle nothing to thread, and so nothing to thread incorrectly.
    expect(transcribe).toHaveBeenCalledWith(expect.any(Float32Array))
  })

  it('warms the same engine the field will transcribe with', async () => {
    mount()
    await composerOptions?.engine.warm()
    expect(warm).toHaveBeenCalled()
  })

  it('pre-warms the moment the surface opens, which is the intent (D-VP-6)', () => {
    mount()
    expect(composerPrewarm).toHaveBeenCalled()
  })

  /**
   * A real pass would add a 670 MB download and a session build to every E2E
   * run. When the harness is armed its stand-in **is** the engine — if the real
   * one leaked through here, the E2E would be downloading weights.
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
    gateReady = false
    mount()
    expect(composerPrewarm).not.toHaveBeenCalled()
  })

  it('passes the engine phase through, so the transport can show the wait', () => {
    mount()
    expect(composerOptions?.engine.phase).toBe(phase)
  })

  it('keeps a closed surface off the readiness subscription', () => {
    mount(false)
    expect(gateActive).toBe(false)
  })

  it('defaults to active, for a field that is always on screen', () => {
    mount()
    expect(gateActive).toBe(true)
  })
})
