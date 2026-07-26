import { totalmem } from 'os'
import type { HardwareRecommendation, RecommendationReason, WhisperModelId } from './whisperTypes'

/**
 * Best-effort hardware probe, injected so the heuristic is testable against
 * fixed machines rather than whatever CPU the test runner happens to have.
 */
export interface HardwareDeps {
  /** Total system RAM in bytes. */
  totalMemory?: () => number
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
 * Advisory model recommendation (SB-R7.1/7.3). Deliberately conservative: the
 * user always overrides it, and anything inconclusive falls back to `base`, the
 * default that is known to work everywhere. It never throws — a failing probe
 * degrades to the fallback rather than blocking the model picker.
 *
 * The ladder loosely tracks the published Whisper table:
 *   < 8 GB RAM            → `tiny`   (the only comfortable fit)
 *   no real GPU           → `base`   (CPU/WASM: bigger models get painfully slow)
 *   GPU + ≥ 16 GB RAM     → `small`  (accuracy worth the extra time)
 *   GPU + ≥ 8 GB RAM      → `base`
 */
export async function recommendWhisperModel(
  deps: HardwareDeps = {}
): Promise<HardwareRecommendation> {
  const readMemory = deps.totalMemory ?? totalmem
  let ramGB = 0
  try {
    ramGB = Math.round((readMemory() / 2 ** 30) * 10) / 10
  } catch {
    ramGB = 0
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
  ): HardwareRecommendation => ({ recommendedId, reason, gpu, ramGB })

  // A probe that told us nothing: say so honestly and fall back to base.
  if (ramGB <= 0) return pick('base', 'unknown')
  if (ramGB < 8) return pick('tiny', 'lowMemory')
  if (!gpu) return pick('base', 'noGpu')
  if (ramGB >= 16) return pick('small', 'discreteGpu')
  return pick('base', 'balanced')
}
