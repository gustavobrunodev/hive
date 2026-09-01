import { joinTranscript, type JoinResult } from './transcriptJoin'

/**
 * Provisional text in the field, and how it gets replaced (VP-R2.9).
 *
 * Dictation used to write only finished segments, and the reason was sound: a
 * partial is a guess the next token can revise, and revising text under a caret
 * the user may already be editing is worse than making them wait. That reason
 * was right about *how* and wrong about *whether* — waiting meant the field
 * stayed empty while someone spoke a whole paragraph, which reads as broken.
 *
 * So provisional text does go in, as a **single tracked run** that every later
 * guess replaces in place. Two rules make that safe, and they are the substance
 * of this module:
 *
 *   - **The run is identified by its text, not only its offsets.** Offsets go
 *     stale the instant the user types, and a stale offset does not fail
 *     loudly — it silently eats the wrong characters. So a replacement only
 *     happens where the field still holds exactly what was written there.
 *   - **When it does not match, the provisional text is kept and let go of.**
 *     The alternative is deleting something the user may have typed themselves,
 *     which is the one outcome dictation must never produce.
 *
 * Pure, and separate from the sink, so both rules are asserted against plain
 * strings rather than through a textarea.
 */

/** Where the provisional text is, and what it says. */
export interface PreviewRun {
  /** `[start, end)` in the field's own offsets. */
  range: readonly [number, number]
  /** Exactly the characters written there — the identity check above. */
  text: string
}

/** The field, as `DictationTarget.read()` reports it. */
export interface FieldState {
  value: string
  selectionStart: number
  selectionEnd: number
}

/** A write to apply, plus the run it leaves behind (`null` = nothing provisional). */
export interface PreviewWrite {
  write: JoinResult
  run: PreviewRun | null
}

/**
 * Takes the provisional run back out of `field`, returning what to write into.
 *
 * The caret lands where the run was, so the replacement goes back in the same
 * place rather than wherever the caret has since wandered — during dictation
 * the caret moves because *this* code moves it, and reading it back would make
 * every pass chase its own tail.
 */
export function stripPreview(field: FieldState, run: PreviewRun | null): FieldState {
  if (run === null) return field
  const [start, end] = run.range
  if (start < 0 || end > field.value.length || field.value.slice(start, end) !== run.text) {
    // Someone edited over it. Their characters win; the run is forgotten and
    // whatever was provisional simply becomes text they now own.
    return field
  }
  return {
    value: field.value.slice(0, start) + field.value.slice(end),
    selectionStart: start,
    selectionEnd: start
  }
}

/**
 * Replaces the provisional run with `text`.
 *
 * `commit` is the difference between a guess and the transcript: a committed
 * write leaves no run behind, so the next guess opens a new one after it
 * instead of overwriting words that are now final.
 */
export function applyPreview(
  field: FieldState,
  run: PreviewRun | null,
  text: string,
  commit = false
): PreviewWrite {
  const base = stripPreview(field, run)
  const write = joinTranscript(base.value, base.selectionStart, base.selectionEnd, text)
  const [start, end] = write.range
  if (commit || start === end) return { write, run: null }
  return { write, run: { range: write.range, text: write.value.slice(start, end) } }
}

/**
 * The provisional text, assembled from the two things that produce it.
 *
 * `settled` is what the engine has decoded of the phrase that has already been
 * cut and is being transcribed for real; `open` is the live pass over the
 * phrase still being spoken. They cover different audio, in that order, so
 * showing both is not double-counting — it is the whole of what has been said
 * and not yet written.
 */
export function previewText(settled: string, open: string): string {
  return [settled.trim(), open.trim()].filter((part) => part !== '').join(' ')
}
