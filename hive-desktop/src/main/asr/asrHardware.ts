import { cpus, totalmem } from 'os'
import type { AsrRuntimeProfile, MachineFacts } from './asrTypes'

/**
 * What this machine is, and how hard to drive it (M29).
 *
 * The descendant of `whisperHardware.ts`, and the inheritance is worth stating
 * because most of that file is deliberately **not** here. It ran a
 * recommendation ladder — `small` on a GPU with 8 GB, `tiny` without, `base`
 * when the probe read nothing — plus a resolver that mapped the advice onto
 * whatever was installed without ever rounding up. All of it existed to answer
 * "which of ten models", and with one model that question is gone.
 *
 * What survives is the probe itself, pointed at a different decision. The GPU
 * flag no longer gates a model (inference is native CPU now, so a missing GPU
 * costs nothing) and the core count no longer picks a rung — it picks the ONNX
 * Runtime thread count. The three readings stay reported because the voice
 * panel shows them, which is what makes "the app looked at your machine" a
 * statement rather than a shrug.
 */

export interface HardwareDeps {
  /** Total system RAM in bytes. */
  totalMemory?: () => number
  /** Logical CPU cores. */
  coreCount?: () => number
  /**
   * Basic GPU info. Returns `null` when unavailable — never throws out to the
   * caller, since a probe must never block transcription.
   */
  gpuInfo?: () => Promise<unknown>
}

/**
 * Does the GPU info describe a real, non-software renderer?
 *
 * Carried over unchanged. It no longer decides anything — it is a fact on the
 * voice panel — but reading it defensively still matters, because
 * `app.getGPUInfo('basic')` returns a loose object whose shape differs by
 * platform.
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

/** Threads when the probe could not read the machine at all. */
export const FALLBACK_THREADS = 2

/**
 * The ceiling on intra-op threads, regardless of how many cores exist.
 *
 * Not a guess about ONNX Runtime: a guess about **what else is running**. This
 * app's whole purpose is to sit beside a coding agent that is compiling,
 * testing and indexing, and dictation is a background courtesy inside it.
 * Measured in the spike on 2026-09-01, four threads already transcribe at
 * ~12.6× real time on eight cores — a phrase comes back in a tenth of the time
 * it took to say. Spending twelve threads to make that number larger would buy
 * nothing anyone can perceive and would take the cores from the work the user
 * actually came to do.
 */
export const MAX_THREADS = 4

/**
 * Threads for a machine with `cores` logical CPUs.
 *
 * One core is always left alone. On a two-core machine that is the difference
 * between a UI that keeps painting during a phrase and one that stutters every
 * time somebody speaks.
 */
export function threadsFor(cores: number): number {
  if (!Number.isFinite(cores) || cores <= 0) return FALLBACK_THREADS
  return Math.max(1, Math.min(MAX_THREADS, Math.round(cores) - 1))
}

/** Reads the machine. Never throws; an unreadable figure comes back as `0`/false. */
export async function probeMachine(deps: HardwareDeps = {}): Promise<MachineFacts> {
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

  return { gpu, ramGB, cores }
}

/** The probe plus the decision it now feeds. */
export async function probeRuntime(deps: HardwareDeps = {}): Promise<AsrRuntimeProfile> {
  const facts = await probeMachine(deps)
  return { threads: threadsFor(facts.cores), facts }
}
