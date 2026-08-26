import { useMemo } from 'react'
import type { RefObject } from 'react'
import { DEFAULT_LANGUAGE, useWhisper } from '../secondBrain/whisper/useWhisper'
import { useVoiceGate, type VoiceGate } from '../voice/useVoiceGate'
import { e2eDictationEngine } from './e2eDictationSeam'
import { usePrewarm } from './usePrewarm'
import { useComposerDictation, type ComposerDictation } from './useComposerDictation'
import type { DictationEngine } from './useDictation'

/**
 * Everything a field needs to gain dictation, in one call: the embedded Whisper
 * engine, the installed-model gate, and the composer wiring.
 *
 * The three lines this bundles were being written out by hand at every
 * recording surface, and they had already drifted once on exactly the axis that
 * matters most — the chat composer dictated with `useWhisper`'s built-in
 * default for a whole milestone while the ingestion sheet read the user's real
 * preference (M25). A surface that spells this out itself can drift again; one
 * that calls this cannot.
 *
 * It stays inside `dictation/` and imports no field's own module, so it holds
 * VP-R5.1: adding it to the next textarea is a wiring job, not a refactor.
 */

export interface WhisperDictationOptions {
  /** The field's current value. */
  value: string
  /** The field's setter. */
  setValue: (value: string) => void
  textareaRef: RefObject<HTMLTextAreaElement | null>
  /**
   * False while the surface is closed. A dialog's hooks run whether or not it
   * is on screen, and the model preference is an IPC subscription — a closed
   * surface has no business holding one.
   */
  active?: boolean
}

export interface WhisperDictation {
  dictation: ComposerDictation
  /** The gate every microphone affordance routes through (M26). */
  voiceGate: VoiceGate
}

export function useWhisperDictation({
  value,
  setValue,
  textareaRef,
  active = true
}: WhisperDictationOptions): WhisperDictation {
  const { phase, transcribe, warm } = useWhisper()
  const voiceGate = useVoiceGate(active)
  const model = voiceGate.model

  const engine = useMemo<DictationEngine>(
    () =>
      // A real Whisper pass would add a model download and seconds of warm-up
      // to every E2E run; the seam returns null in every other context.
      e2eDictationEngine() ?? {
        phase,
        transcribe: (pcm, options) =>
          transcribe(pcm, {
            ...options,
            // `?? undefined` rather than a default id: a take cannot start
            // without a model (the gate sees to that), so this only covers the
            // IPC round trip, where the engine's own default is the honest
            // answer and inventing one here would hide the gap.
            model: model ?? undefined,
            language: DEFAULT_LANGUAGE
          }),
        warm: () => warm(model ?? undefined)
      },
    [phase, transcribe, warm, model]
  )

  const dictation = useComposerDictation({ value, setValue, textareaRef, engine })

  // The surface being open **is** the intent (see `usePrewarm`). A model has to
  // exist first: with none installed, warming would start a download nobody
  // asked for.
  usePrewarm(active && model !== null, dictation.prewarm)

  return { dictation, voiceGate }
}
