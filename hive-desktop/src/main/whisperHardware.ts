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

/** The rung the ladder falls back to whenever a probe tells us nothing. */
const FALLBACK: WhisperModelId = 'base'

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
 * 2. **It degrades toward the model that works everywhere.** A probe that
 *    throws, or that reads back nothing, lands on `base` rather than guessing
 *    upward — the failure mode of guessing too high is a transcription that
 *    takes minutes, which reads as a broken app rather than a slow one.
 *
 * The ladder tracks how these weights actually behave, not just the published
 * table. Without a GPU the pipeline runs fp32 on **single-threaded** WASM
 * (`SharedArrayBuffer` is unavailable on a `file://` origin, so `numThreads`
 * is forced to 1 — M12.3), and there `small` is minutes per take. So `small`
 * is reserved for a machine that has both a real GPU and the memory to hold
 * it, and core count is what separates a CPU-only machine that can still carry
 * `base` from one that should stay on `tiny`:
 *
 *   < 8 GB RAM                        → `tiny`   (the only comfortable fit)
 *   no GPU, < 8 cores                 → `tiny`   (fp32 on 1 WASM thread)
 *   no GPU, >= 8 cores                → `base`
 *   GPU + >= 16 GB RAM + >= 8 cores   → `small`  (accuracy worth the time)
 *   GPU, otherwise                    → `base`
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
  if (ramGB < 8) return pick('tiny', 'lowMemory')
  if (!gpu) return cores < 8 ? pick('tiny', 'cpuOnly') : pick('base', 'noGpu')
  if (ramGB >= 16 && cores >= 8) return pick('small', 'discreteGpu')
  return pick('base', 'balanced')
}

/**
 * Is `id` a model this probe is allowed to choose on its own? Exported so the
 * resolver in `index.ts` can refuse a stale config entry (a model the user
 * downloaded and later deleted) without re-deriving the bundled list.
 */
export function isAutoSelectable(id: WhisperModelId): boolean {
  return BUNDLED_WHISPER_MODELS.includes(id)
}
