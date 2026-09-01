import { useCallback, useEffect, useState } from 'react'
import {
  whisperClient,
  type TranscribeOptions,
  type WhisperClient,
  type WhisperPhase
} from './whisperClient'
import type { WhisperModelId } from './whisperIds'

export type { WhisperModelId, WhisperVariant } from './whisperIds'
export type { WhisperPhase, TranscribeOptions } from './whisperClient'
export {
  chooseVariant,
  probeWebGpu,
  DEFAULT_LANGUAGE,
  DEFAULT_MODEL,
  whisperClient
} from './whisperClient'

/**
 * React's view of the app's one transcription engine (SB-R4.1/4.2/4.4).
 *
 * There is almost nothing left in this file, and that is the change: the
 * ordering rules, the device pick, the download-before-load and the warm
 * pipeline all moved into `whisperClient.ts`, which is a module singleton in
 * front of a worker. What used to happen here — a `useRef` holding a pipeline,
 * one per surface that dictates — is what made every surface pay the session
 * build again, and what let a pre-warm and a first phrase start two builds at
 * once.
 *
 * The hook's remaining job is genuinely a hook's job: subscribe to the engine's
 * phase so a component re-renders when it changes.
 */

export interface WhisperEngine {
  phase: WhisperPhase
  /**
   * Transcribes 16 kHz mono Float32 PCM, downloading and warming the model
   * first if needed. Resolves to the transcript text; `onPartial` reports it as
   * it decodes.
   */
  transcribe: (pcm: Float32Array, options?: TranscribeOptions) => Promise<string>
  /** Builds the pipeline ahead of time, so the first phrase is not the one that waits. */
  warm: (model?: WhisperModelId) => Promise<void>
  reset: () => void
}

export function useWhisper(client: WhisperClient = whisperClient()): WhisperEngine {
  const [phase, setPhase] = useState<WhisperPhase>(client.phase())

  // The engine outlives every component that watches it, so this is a
  // subscription to an external system — exactly where React wants a
  // `setState`, and why the phase is not derived during render.
  //
  // The initial read goes through a named callback rather than a bare
  // `setPhase(...)` in the effect body (the repo's `load()`/`sync()` pattern):
  // a setState called synchronously at the top of an effect cascades a render,
  // which `react-hooks/set-state-in-effect` rejects outright.
  useEffect(() => {
    const sync = (): void => setPhase(client.phase())
    sync()
    return client.subscribe(setPhase)
  }, [client])

  return {
    phase,
    transcribe: useCallback(
      (pcm: Float32Array, options?: TranscribeOptions) => client.transcribe(pcm, options),
      [client]
    ),
    warm: useCallback((model?: WhisperModelId) => client.warm(model), [client]),
    reset: useCallback(() => client.reset(), [client])
  }
}
