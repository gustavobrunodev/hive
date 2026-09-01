import type { Draft } from './segmenter'

/**
 * Live transcription of the phrase **still being spoken** (VP-R2.9).
 *
 * The complaint this answers, in the user's own words: *"não deveria o usuário
 * ter que terminar tudo para só depois transcrever"*. Nothing was broken — the
 * pipeline was simply built around a boundary. A segment is handed over when
 * silence closes it or when it hits the 9 s ceiling, so a speaker in full flow
 * saw their first words nine seconds after saying them, plus the pass itself.
 * The partial stream helped, but it can only start once a segment exists.
 *
 * So the open phrase is transcribed too, over and over, while it grows. Each
 * pass is a *guess about audio that is not finished*, which is why it never
 * becomes the transcript: the segment's own pass, over the complete phrase with
 * its tail pad, still writes the text that stays. What this produces is the
 * provisional run under the caret — replaced by the next pass, and finally by
 * the real one.
 *
 * **Pacing is the whole design.** There is one engine, one thread and one
 * pipeline slot; a live pass that delays a real segment has made things worse,
 * not better. Three rules keep it honest, and they are the reason this is a
 * tested module rather than a `setInterval`:
 *
 *   1. **One at a time, and only when the engine is free.** The caller gates on
 *      the queue being idle; this gates on its own pass being done. Together
 *      they mean a live pass only ever uses time nothing else wants.
 *   2. **Only when there is meaningfully more to hear.** Re-running on 200 ms
 *      of new audio costs a full pipeline slot — Whisper pads every window to
 *      30 s, so a pass costs the same whatever it is given — and returns almost
 *      the same sentence.
 *   3. **It gives up rather than fighting.** A failure means the engine is in
 *      trouble (an exhausted heap is the one that actually happens); a preview
 *      is the last thing that should be spending what is left of it.
 */

/** How the passes are paced. Every field is overridable for tests. */
export interface LivePassConfig {
  /**
   * Speech needed before the first pass of a phrase.
   *
   * Below this there is not enough audio to transcribe into anything but
   * noise — Whisper on a fragment of a word reliably invents a different word,
   * and a preview that starts wrong is worse than one that starts late.
   */
  minSpeechMs: number
  /**
   * New speech needed before re-running.
   *
   * The floor under how often the preview can change, and deliberately close to
   * how long a pass takes on the small models: aiming faster than the engine
   * only queues work behind work.
   */
  growthMs: number
  /**
   * Consecutive failures after which live passes stop for the rest of the take.
   *
   * One is bad luck. Two is the engine, and the take still has real segments to
   * transcribe with whatever it has left.
   */
  failureBudget: number
}

export const DEFAULT_LIVE_PASS_CONFIG: LivePassConfig = {
  minSpeechMs: 900,
  growthMs: 1200,
  failureBudget: 2
}

export interface LivePassDeps {
  /**
   * Transcribes provisional audio. The same engine the queue uses — `onPartial`
   * included, because a pass is itself several seconds long and the tokens it
   * streams are the fastest text the feature can produce.
   */
  transcribe: (pcm: Float32Array, onPartial: (text: string) => void) => Promise<string>
  /** Reports the provisional text: partials during a pass, the result after it. */
  onText: (text: string) => void
  config?: LivePassConfig
}

export interface LivePass {
  /**
   * Offers the phrase as it stands. Runs a pass if the pacing rules allow one;
   * `null` (nothing being spoken) ends the current phrase's text.
   */
  offer: (draft: Draft | null) => void
  /** True while a pass is in flight — the caller's "is the engine busy" half. */
  busy: () => boolean
  /**
   * Drops everything and re-arms the failure budget: a new take, or a discard.
   * In-flight results are ignored rather than awaited.
   */
  reset: () => void
}

export function createLivePass(deps: LivePassDeps): LivePass {
  const config = deps.config ?? DEFAULT_LIVE_PASS_CONFIG
  let running = false
  /** Speech length at the start of the last pass, for rule 2. */
  let lastMs = 0
  /** The phrase the last pass belonged to, so a new one starts fresh. */
  let lastIndex = -1
  let failures = 0
  /** Bumped by `reset()`; a pass that resolves across one is discarded. */
  let generation = 0

  const shouldRun = (draft: Draft): boolean => {
    if (running || failures >= config.failureBudget) return false
    if (draft.ms < config.minSpeechMs) return false
    // A new phrase has no predecessor to be "more than": the minimum above is
    // the whole rule for its first pass, and the growth rule takes over from
    // the second. Reading growth against the *previous* phrase's length would
    // hold a new one silent for as long as the last one ran.
    if (draft.index !== lastIndex) return true
    return draft.ms - lastMs >= config.growthMs
  }

  return {
    offer: (draft) => {
      if (draft === null) {
        // The phrase ended. Its text is the queue's business now — leaving the
        // guess on screen would have the field showing a provisional sentence
        // that nothing is going to revise.
        lastIndex = -1
        lastMs = 0
        if (!running) deps.onText('')
        return
      }
      if (!shouldRun(draft)) return

      running = true
      lastMs = draft.ms
      lastIndex = draft.index
      const take = generation

      deps
        .transcribe(draft.pcm, (text) => {
          if (generation === take) deps.onText(text)
        })
        .then((text) => {
          if (generation !== take) return
          failures = 0
          deps.onText(text)
        })
        .catch(() => {
          if (generation !== take) return
          failures += 1
          // Deliberately silent. A preview that failed has nothing to say to
          // the user — the segment covering the same words is still coming, and
          // it is the one whose failure is worth reporting (VP-R4.4).
        })
        .finally(() => {
          if (generation === take) running = false
        })
    },
    busy: () => running,
    reset: () => {
      generation += 1
      running = false
      lastMs = 0
      lastIndex = -1
      failures = 0
    }
  }
}
