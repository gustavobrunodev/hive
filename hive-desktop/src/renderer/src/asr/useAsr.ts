import { useCallback, useEffect, useState } from 'react'
import { asrClient, type AsrClient, type AsrPhase, type TranscribeOptions } from './asrClient'

export type { AsrPhase, TranscribeOptions } from './asrClient'

/**
 * React's view of the app's one transcription engine.
 *
 * The hook's whole job is a hook's job: subscribe to the engine's phase so a
 * component re-renders when it changes. The engine outlives every component
 * that watches it, which is exactly what makes this a subscription to an
 * external system rather than state derived during render.
 */

export interface AsrEngine {
  phase: AsrPhase
  /** Transcribes 16 kHz mono Float32 PCM. Resolves to the transcript text. */
  transcribe: (pcm: Float32Array, options?: TranscribeOptions) => Promise<string>
  /** Builds the session ahead of time, so the first phrase is not the one that waits. */
  warm: () => Promise<void>
  reset: () => void
}

export function useAsr(client: AsrClient = asrClient()): AsrEngine {
  const [phase, setPhase] = useState<AsrPhase>(client.phase())

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
    warm: useCallback(() => client.warm(), [client]),
    reset: useCallback(() => client.reset(), [client])
  }
}
