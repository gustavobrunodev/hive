import { describe, expect, it } from 'vitest'
import { hasRealGpu, recommendWhisperModel } from './whisperHardware'

const GB = 2 ** 30

function machine(ramGB: number, gpu?: unknown): Parameters<typeof recommendWhisperModel>[0] {
  return {
    totalMemory: () => ramGB * GB,
    gpuInfo: async () => gpu ?? null
  }
}

const discreteGpu = { gpuDevice: [{ vendorId: 4318, deviceId: 8710, deviceString: 'NVIDIA' }] }

describe('whisperHardware', () => {
  describe('hasRealGpu', () => {
    it('accepts a device with a real vendor/device id', () => {
      expect(hasRealGpu(discreteGpu)).toBe(true)
      expect(hasRealGpu({ gpuDevice: [{ deviceId: 42 }] })).toBe(true)
    })

    it('rejects software renderers, which are not a GPU for our purposes', () => {
      expect(
        hasRealGpu({ gpuDevice: [{ vendorId: 1, deviceId: 1, deviceString: 'SwiftShader' }] })
      ).toBe(false)
      expect(hasRealGpu({ gpuDevice: [{ vendorId: 1, deviceString: 'llvmpipe (LLVM 15)' }] })).toBe(
        false
      )
    })

    it('rejects anything malformed rather than guessing', () => {
      expect(hasRealGpu(null)).toBe(false)
      expect(hasRealGpu(undefined)).toBe(false)
      expect(hasRealGpu('nvidia')).toBe(false)
      expect(hasRealGpu({})).toBe(false)
      expect(hasRealGpu({ gpuDevice: [] })).toBe(false)
      expect(hasRealGpu({ gpuDevice: [null] })).toBe(false)
      expect(hasRealGpu({ gpuDevice: [{ vendorId: 0, deviceId: 0 }] })).toBe(false)
    })
  })

  describe('recommendWhisperModel', () => {
    it('recommends tiny on a low-memory machine', async () => {
      const result = await recommendWhisperModel(machine(4))
      expect(result).toMatchObject({ recommendedId: 'tiny', reason: 'lowMemory', ramGB: 4 })
    })

    it('recommends base without a real GPU, however much RAM there is', async () => {
      expect(await recommendWhisperModel(machine(32))).toMatchObject({
        recommendedId: 'base',
        reason: 'noGpu',
        gpu: false
      })
    })

    it('recommends small on a GPU machine with plenty of RAM', async () => {
      const result = await recommendWhisperModel(machine(32, discreteGpu))
      expect(result).toMatchObject({ recommendedId: 'small', reason: 'discreteGpu', gpu: true })
    })

    it('stays on base for a GPU machine with middling RAM', async () => {
      expect(await recommendWhisperModel(machine(8, discreteGpu))).toMatchObject({
        recommendedId: 'base',
        reason: 'balanced',
        gpu: true
      })
    })

    it('falls back to base and says so when RAM cannot be read (SB-R7.3)', async () => {
      expect(await recommendWhisperModel({ totalMemory: () => 0 })).toMatchObject({
        recommendedId: 'base',
        reason: 'unknown'
      })
    })

    it('never throws — a failing probe degrades to the fallback', async () => {
      const thrownMemory = await recommendWhisperModel({
        totalMemory: () => {
          throw new Error('sysinfo unavailable')
        }
      })
      expect(thrownMemory).toMatchObject({ recommendedId: 'base', reason: 'unknown' })

      const thrownGpu = await recommendWhisperModel({
        totalMemory: () => 32 * GB,
        gpuInfo: async () => {
          throw new Error('gpu probe failed')
        }
      })
      // A failed GPU probe means "no GPU", not "crash".
      expect(thrownGpu).toMatchObject({ recommendedId: 'base', reason: 'noGpu', gpu: false })
    })

    it('treats an absent gpuInfo probe as no GPU', async () => {
      expect(await recommendWhisperModel({ totalMemory: () => 32 * GB })).toMatchObject({
        recommendedId: 'base',
        reason: 'noGpu'
      })
    })

    it('reports RAM to one decimal so the UI can state what it measured', async () => {
      const result = await recommendWhisperModel({ totalMemory: () => 15.7 * GB })
      expect(result.ramGB).toBeCloseTo(15.7, 1)
    })

    it('reads real system memory when no probe is injected', async () => {
      const result = await recommendWhisperModel()
      expect(result.ramGB).toBeGreaterThan(0)
      expect(result.recommendedId).toBeTruthy()
    })
  })
})
