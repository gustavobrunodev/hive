import { describe, expect, it } from 'vitest'
import {
  FALLBACK_THREADS,
  MAX_THREADS,
  hasRealGpu,
  probeMachine,
  probeRuntime,
  threadsFor
} from './asrHardware'

describe('threadsFor', () => {
  it('always leaves one core for the rest of the app', () => {
    expect(threadsFor(2)).toBe(1)
    expect(threadsFor(4)).toBe(3)
  })

  it('caps at the ceiling however many cores exist', () => {
    // The cap is about what else is running — a coding agent compiling beside
    // it — not about what ONNX Runtime could use.
    expect(threadsFor(8)).toBe(MAX_THREADS)
    expect(threadsFor(64)).toBe(MAX_THREADS)
  })

  it('never returns zero on a single-core machine', () => {
    expect(threadsFor(1)).toBe(1)
  })

  it('falls back when the core count is unreadable', () => {
    expect(threadsFor(0)).toBe(FALLBACK_THREADS)
    expect(threadsFor(Number.NaN)).toBe(FALLBACK_THREADS)
    expect(threadsFor(-4)).toBe(FALLBACK_THREADS)
  })
})

describe('probeMachine', () => {
  it('reports the three readings the voice panel shows', async () => {
    const facts = await probeMachine({
      totalMemory: () => 16 * 2 ** 30,
      coreCount: () => 8,
      gpuInfo: async () => ({ gpuDevice: [{ vendorId: 4318, deviceId: 7953 }] })
    })
    expect(facts).toEqual({ gpu: true, ramGB: 16, cores: 8 })
  })

  it('survives every probe throwing', async () => {
    const facts = await probeMachine({
      totalMemory: () => {
        throw new Error('no')
      },
      coreCount: () => {
        throw new Error('no')
      },
      gpuInfo: async () => {
        throw new Error('no')
      }
    })
    // A probe must never block transcription, so an unreadable machine is a
    // reported zero rather than a rejection.
    expect(facts).toEqual({ gpu: false, ramGB: 0, cores: 0 })
  })
})

describe('hasRealGpu', () => {
  it('rejects software renderers', () => {
    expect(hasRealGpu({ gpuDevice: [{ vendorId: 1, deviceString: 'SwiftShader' }] })).toBe(false)
    expect(hasRealGpu({ gpuDevice: [{ vendorId: 1, deviceString: 'llvmpipe (LLVM 15)' }] })).toBe(
      false
    )
  })

  it('rejects anything that is not the shape it expects', () => {
    expect(hasRealGpu(null)).toBe(false)
    expect(hasRealGpu({})).toBe(false)
    expect(hasRealGpu({ gpuDevice: [] })).toBe(false)
  })
})

describe('probeRuntime', () => {
  it('turns the core count into the thread count', async () => {
    const profile = await probeRuntime({
      totalMemory: () => 8 * 2 ** 30,
      coreCount: () => 4,
      gpuInfo: async () => null
    })
    expect(profile).toEqual({ threads: 3, facts: { gpu: false, ramGB: 8, cores: 4 } })
  })
})
