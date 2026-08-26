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
const phase = { status: 'idle' } as const

vi.mock('../secondBrain/whisper/useWhisper', () => ({
  DEFAULT_LANGUAGE: 'portuguese',
  useWhisper: () => ({ phase, transcribe })
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

// Armed only under the E2E harness; here it must stay out of the way.
vi.mock('./e2eDictationSeam', () => ({ e2eDictationEngine: () => null }))

let composerOptions: ComposerDictationOptions | null = null
vi.mock('./useComposerDictation', () => ({
  useComposerDictation: (options: ComposerDictationOptions) => {
    composerOptions = options
    return { phase: options.engine.phase, active: false }
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
    composerOptions = null
    gateActive = undefined
    gateModel = 'small'
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
