import { cpus, totalmem } from 'os'
import { BUNDLED_WHISPER_MODELS } from './whisperBundled'
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
 * 1. **It only ever answers with a model that ships in the app.** An automatic
 *    choice that implied a 900 MB download would be the app deciding to spend
 *    someone's evening; every rung below is one of `BUNDLED_WHISPER_MODELS`,
 *    asserted in the tests.
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
 * Is `id` a model this probe is allowed to choose on its own? Exported so the
 * resolver in `index.ts` can refuse a stale config entry (a model the user
 * downloaded and later deleted) without re-deriving the bundled list.
 */
export function isAutoSelectable(id: WhisperModelId): boolean {
  return BUNDLED_WHISPER_MODELS.includes(id)
}
