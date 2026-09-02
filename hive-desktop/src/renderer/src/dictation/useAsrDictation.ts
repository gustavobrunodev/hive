import { useMemo } from 'react'
import type { RefObject } from 'react'
import { useAsr } from '../asr/useAsr'
import { useVoiceGate, type VoiceGate } from '../voice/useVoiceGate'
import { e2eDictationEngine } from './e2eDictationSeam'
import { usePrewarm } from './usePrewarm'
import { useComposerDictation, type ComposerDictation } from './useComposerDictation'
import type { DictationEngine } from './useDictation'

/**
 * Everything a field needs to gain dictation, in one call: the transcription
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

export interface AsrDictationOptions {
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

export interface AsrDictation {
  dictation: ComposerDictation
  /** The gate every microphone affordance routes through (M26). */
  voiceGate: VoiceGate
}

export function useAsrDictation({
  value,
  setValue,
  textareaRef,
  active = true
}: AsrDictationOptions): AsrDictation {
  const { phase, transcribe, warm } = useAsr()
  const voiceGate = useVoiceGate(active)
  const ready = voiceGate.ready

  const engine = useMemo<DictationEngine>(
    () =>
      // A real pass would add a 670 MB model download and a session build to
      // every E2E run; the seam returns null in every other context.
      e2eDictationEngine() ?? { phase, transcribe, warm },
    [phase, transcribe, warm]
  )

  const dictation = useComposerDictation({ value, setValue, textareaRef, engine })

  // The surface being open **is** the intent (see `usePrewarm`). The model has
  // to exist first: with none installed, warming would only fail.
  usePrewarm(active && ready, dictation.prewarm)

  return { dictation, voiceGate }
}
