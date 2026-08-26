import type { ModelInfo } from './modelFacts'

type Variant = 'fp32' | 'q8'

/**
 * The largest `ArrayBuffer` this renderer can allocate, in MB.
 *
 * **Measured, not assumed** (2026-08-23, this app's own renderer): 2040 MiB
 * allocates, 2047 MiB throws `RangeError: Array buffer allocation failed` —
 * V8's 2 GiB per-buffer ceiling. Transformers.js reads each weight file into
 * exactly one such buffer before handing it to onnxruntime, so a single file
 * at or above this figure cannot be loaded on any backend, on any machine,
 * however much RAM it has.
 *
 * That sentence — "Array buffer allocation failed" — is verbatim what a user
 * saw after downloading a model the library then offered them anyway.
 */
export const MAX_WEIGHT_FILE_MB = 2048

/**
 * How much of a machine's RAM one model load may claim.
 *
 * The peak is not the download size: onnxruntime holds every session in its
 * WASM heap (the full total) *while* the JS side still holds the buffer of the
 * file it is reading (the largest one). `medium` at fp32 is 2916 + 1744 MB of
 * live memory at its worst moment. Half the machine is the most an app can ask
 * for and still leave room for the operating system, the browser process and
 * the rest of Hive.
 */
const RAM_SHARE = 0.5

/** What this machine can do with a model, and why. */
export type ModelFit =
  /** It loads and runs here. */
  | { kind: 'ok' }
  /**
   * Impossible on this backend, at any amount of RAM: one of its weight files
   * is at or past the `ArrayBuffer` ceiling.
   */
  | { kind: 'tooLarge'; fileMB: number }
  /** It would need more memory at once than this machine has to spare. */
  | { kind: 'tooHeavy'; needMB: number; ramGB: number }

/**
 * Can this machine actually run `model`?
 *
 * The question exists because the catalog was answering a different one. Every
 * row offered a download button, including two models whose fp32 weights this
 * renderer provably cannot read — a 3.0 GB and a 5.8 GB download that end in a
 * `RangeError` after the better part of an hour. A library that lets you spend
 * an hour on something that cannot work is not a library, it is a trap.
 *
 * `ramGB` comes from the hardware probe main already runs; `0` (unknown) skips
 * the memory test rather than guessing, because refusing a model on a figure
 * we could not read is worse than letting a capable machine try.
 *
 * Pure, so both thresholds are asserted from numbers instead of from a machine.
 */
export function modelFit(model: ModelInfo, variant: Variant, ramGB: number): ModelFit {
  // A row without measurements is never refused. The catalog in main always
  // carries them, but this screen is the only way to get a voice model at all,
  // and a missing number is not a reason to take that away — the same rule the
  // `ramGB === 0` branch below follows.
  const fileMB = model.maxFileMB?.[variant] ?? 0
  const totalMB = model.sizeMB?.[variant] ?? 0
  if (fileMB === 0 || totalMB === 0) return { kind: 'ok' }
  if (fileMB >= MAX_WEIGHT_FILE_MB) return { kind: 'tooLarge', fileMB }

  const needMB = totalMB + fileMB
  if (ramGB > 0 && needMB > ramGB * 1024 * RAM_SHARE) {
    return { kind: 'tooHeavy', needMB, ramGB }
  }
  return { kind: 'ok' }
}

/** Is `model` offerable at all on this machine? */
export function fits(model: ModelInfo, variant: Variant, ramGB: number): boolean {
  return modelFit(model, variant, ramGB).kind === 'ok'
}

/**
 * Does `message` look like the renderer running out of room for the weights?
 *
 * Matched on the engine's own words because there is nothing else to match on:
 * the allocation fails deep inside V8 with a `RangeError` that carries no code,
 * and the alternative is showing the user the English string. Two spellings,
 * because the WASM heap and the JS heap word the same failure differently.
 */
export function isMemoryFailure(message: string): boolean {
  return /array buffer allocation failed|out of memory|memory access out of bounds/i.test(message)
}
