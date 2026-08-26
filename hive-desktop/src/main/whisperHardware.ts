import { cpus, totalmem } from 'os'
import type { HardwareRecommendation, RecommendationReason, WhisperModelId } from './whisperTypes'

/**
 * Best-effort hardware probe, injected so the heuristic is testable against
 * fixed machines rather than whatever CPU the test runner happens to have.
 */
export interface HardwareDeps {
  /** Total system RAM in bytes. */
  totalMemory?: () => number
  /** Logical CPU cores. */
  coreCount?: () => number
  /**
   * Basic GPU info. Returns `null` when unavailable — never throws out to the
   * caller, since a recommendation must never block transcription (SB-R7.3).
   */
  gpuInfo?: () => Promise<unknown>
}

/**
 * Does the GPU info describe a real, non-software renderer?
 *
 * `app.getGPUInfo('basic')` returns a loose object whose shape differs by
 * platform, so this reads defensively: any `gpuDevice` entry with a non-zero
 * vendor/device id counts, and an obviously software renderer (SwiftShader,
 * llvmpipe) does not.
 */
export function hasRealGpu(info: unknown): boolean {
  if (!info || typeof info !== 'object') return false
  const devices = (info as { gpuDevice?: unknown }).gpuDevice
  if (!Array.isArray(devices) || devices.length === 0) return false

  return devices.some((device) => {
    if (!device || typeof device !== 'object') return false
    const entry = device as { vendorId?: number; deviceId?: number; deviceString?: string }
    const software = /swiftshader|llvmpipe|software/i.test(entry.deviceString ?? '')
    if (software) return false
    return Boolean(entry.vendorId) || Boolean(entry.deviceId)
  })
}

/**
 * The rung the ladder falls back to when a probe tells us nothing at all.
 *
 * Deliberately **not** the bottom of the ladder. `tiny` is the smaller model,
 * but picking it here would state a fact the probe never established ("this
 * machine is weak"); `base` is the rung that runs acceptably everywhere, which
 * is the right answer to "we could not measure".
 */
const FALLBACK: WhisperModelId = 'base'

/** Below this much RAM nothing above `tiny` is a comfortable fit. */
const SMALL_MIN_RAM_GB = 8

/**
 * Picks the transcription model for **this** machine (SB-R7.1/7.3/7.4).
 *
 * Two properties make this safe to act on automatically rather than merely
 * display, which is what it used to be:
 *
 * 1. **It is advice about hardware, never an instruction to spend bandwidth.**
 *    The answer names the model this machine should run; whether that model is
 *    on disk is a separate question, answered by `pickAutoModel` below. An
 *    automatic choice that silently started a 900 MB download would be the app
 *    deciding to spend someone's evening.
 * 2. **It degrades toward a model that works everywhere.** A probe that throws,
 *    or that reads back nothing, lands on `base` rather than guessing upward —
 *    the failure mode of guessing too high is a transcription that takes
 *    minutes, which reads as a broken app rather than a slow one.
 *
 * **The ladder is `small` → `tiny` → `base`, in that order of preference**
 * (product decision, 2026-08-20): prefer the most accurate model the machine
 * can actually carry, drop to the fastest one when it cannot, and use `base`
 * only when the hardware could not be read at all.
 *
 *   GPU + >= 8 GB RAM   → `small`  (the preferred default)
 *   GPU, < 8 GB RAM     → `tiny`   (no room to hold `small`)
 *   no GPU              → `tiny`   (fp32 on one WASM thread)
 *   RAM unreadable      → `base`   (measured nothing, claim nothing)
 *
 * **The GPU is the gate, and it is not negotiable.** Without one the pipeline
 * runs fp32 on **single-threaded** WASM (`SharedArrayBuffer` is unavailable on
 * a `file://` origin, so `numThreads` is forced to 1 — M12.3), and there
 * `small` is minutes per take. Preferring it anyway would not deliver "the
 * most accurate model"; it would deliver a dictation box that appears to hang.
 */
export async function recommendWhisperModel(
  deps: HardwareDeps = {}
): Promise<HardwareRecommendation> {
  const readMemory = deps.totalMemory ?? totalmem
  const readCores = deps.coreCount ?? ((): number => cpus().length)

  let ramGB = 0
  try {
    ramGB = Math.round((readMemory() / 2 ** 30) * 10) / 10
  } catch {
    ramGB = 0
  }

  let cores = 0
  try {
    cores = Math.max(0, Math.round(readCores()))
  } catch {
    cores = 0
  }

  let gpu = false
  try {
    gpu = deps.gpuInfo ? hasRealGpu(await deps.gpuInfo()) : false
  } catch {
    gpu = false
  }

  const pick = (
    recommendedId: WhisperModelId,
    reason: RecommendationReason
  ): HardwareRecommendation => ({ recommendedId, reason, gpu, ramGB, cores })

  // A probe that told us nothing: say so honestly and fall back.
  if (ramGB <= 0) return pick(FALLBACK, 'unknown')
  // Rung 1 — the model we want by default, wherever it will actually run.
  if (gpu && ramGB >= SMALL_MIN_RAM_GB) return pick('small', 'discreteGpu')
  // Rung 2 — `tiny`, for the two reasons a machine misses rung 1. The reason
  // is what the UI reads to explain the pick, so the two stay distinct even
  // though they land on the same model.
  if (ramGB < SMALL_MIN_RAM_GB) return pick('tiny', 'lowMemory')
  return cores < 8 ? pick('tiny', 'cpuOnly') : pick('tiny', 'noGpu')
}

/**
 * Each model's rung on the weight ladder — heavier means more accurate and
 * slower. The `.en` build of a model is the **same rung** as its multilingual
 * sibling: it is the same network, trained on one language, so ranking them as
 * neighbours (which a flat ordered list does) would make "one step lighter"
 * mean "same size, different language".
 */
const RUNG: Record<WhisperModelId, number> = {
  tiny: 0,
  'tiny.en': 0,
  base: 1,
  'base.en': 1,
  small: 2,
  'small.en': 2,
  medium: 3,
  'medium.en': 3,
  'large-v3-turbo': 4,
  'large-v3': 5
}

/** True for the English-only builds — the ones that cannot serve a pt-BR squad. */
const englishOnly = (id: WhisperModelId): boolean => id.endsWith('.en')

/**
 * Which installed model "Automático" resolves to, given what the probe advises.
 *
 * The rule has to exist because the app no longer ships weights: the probe can
 * recommend `small` on a machine that has only downloaded `tiny`, and a
 * resolver that trusted the recommendation outright would point transcription
 * at files that are not there.
 *
 * Two commitments, in order:
 *
 * 1. **Never round up.** Among what is installed, the answer is the heaviest
 *    model still no heavier than the advice. Rounding up is how "automatic"
 *    would hand a GPU-less laptop the 2.8 GB `medium` downloaded for a
 *    different machine, and then take minutes per phrase. Only when everything
 *    installed is heavier does it take the lightest of those — something beats
 *    a microphone that cannot run.
 * 2. **Never choose English-only on its own.** This squad works in pt-BR
 *    (D-SB-6), and an `.en` model does not refuse Portuguese — it transcribes
 *    it into confident nonsense, which is far worse than being slow. A user can
 *    still pin one deliberately; the app will not pick it for them unless it is
 *    the only thing on the machine.
 */
export function pickAutoModel(
  recommendedId: WhisperModelId,
  installed: readonly WhisperModelId[]
): WhisperModelId | null {
  if (installed.length === 0) return null

  const known = installed.filter((id) => id in RUNG)
  if (known.length === 0) return installed[0] ?? null

  const ceiling = RUNG[recommendedId]
  const best = (pool: WhisperModelId[]): WhisperModelId | null => {
    if (pool.length === 0) return null
    const ranked = [...pool].sort((a, b) => RUNG[a] - RUNG[b])
    const atOrBelow = ranked.filter((id) => RUNG[id] <= ceiling)
    return atOrBelow.length > 0 ? atOrBelow[atOrBelow.length - 1] : ranked[0]
  }

  return best(known.filter((id) => !englishOnly(id))) ?? best(known)
}
