import { describe, expect, it } from 'vitest'
import { hasRealGpu, isAutoSelectable, recommendWhisperModel } from './whisperHardware'
import { BUNDLED_WHISPER_MODELS } from './whisperBundled'

const GB = 2 ** 30

/**
 * A fixed machine. **Cores are injected too**, not left to `os.cpus()`: the
 * ladder branches on core count, and a test that read the runner's real CPU
 * would assert one thing on a laptop and another in CI.
 */
function machine(
  ramGB: number,
  gpu?: unknown,
  cores = 8
): Parameters<typeof recommendWhisperModel>[0] {
  return {
    totalMemory: () => ramGB * GB,
    coreCount: () => cores,
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

    it('recommends base without a real GPU when there are cores to carry it', async () => {
      expect(await recommendWhisperModel(machine(32, null, 8))).toMatchObject({
        recommendedId: 'base',
        reason: 'noGpu',
        gpu: false
      })
    })

    it('drops to tiny on a CPU-only machine with few cores', async () => {
      // fp32 on a single WASM thread: `base` here is minutes per take, which
      // reads as a broken app rather than a slow one (M12.3).
      expect(await recommendWhisperModel(machine(16, null, 4))).toMatchObject({
        recommendedId: 'tiny',
        reason: 'cpuOnly',
        gpu: false,
        cores: 4
      })
    })

    it('needs cores as well as a GPU before it commits to small', async () => {
      expect(await recommendWhisperModel(machine(32, discreteGpu, 4))).toMatchObject({
        recommendedId: 'base',
        reason: 'balanced'
      })
    })

    it('degrades to the fallback when the core probe throws', async () => {
      const result = await recommendWhisperModel({
        totalMemory: () => 32 * GB,
        coreCount: () => {
          throw new Error('cpuinfo unavailable')
        }
      })
      expect(result).toMatchObject({ recommendedId: 'tiny', reason: 'cpuOnly', cores: 0 })
    })

    it('recommends small on a GPU machine with plenty of RAM and cores', async () => {
      const result = await recommendWhisperModel(machine(32, discreteGpu, 12))
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
      expect(thrownGpu.gpu).toBe(false)
      expect(thrownGpu.recommendedId).not.toBe('small')
    })

    it('treats an absent gpuInfo probe as no GPU', async () => {
      expect(
        await recommendWhisperModel({ totalMemory: () => 32 * GB, coreCount: () => 8 })
      ).toMatchObject({ recommendedId: 'base', reason: 'noGpu' })
    })

    /**
     * The property that makes this safe to *act* on rather than merely display
     * (SB-R7.4): an automatic pick must never imply a download. Asserted over
     * the whole matrix rather than the handful of cases above, because a future
     * rung added to the ladder is exactly what would break it quietly.
     */
    it('only ever recommends a model that ships inside the app', async () => {
      for (const ramGB of [0, 2, 4, 7.9, 8, 15.9, 16, 64]) {
        for (const gpu of [null, discreteGpu]) {
          for (const cores of [0, 1, 4, 7, 8, 32]) {
            const { recommendedId } = await recommendWhisperModel(machine(ramGB, gpu, cores))
            expect(BUNDLED_WHISPER_MODELS).toContain(recommendedId)
            expect(isAutoSelectable(recommendedId)).toBe(true)
          }
        }
      }
    })

    it('does not consider a downloadable-only model auto-selectable', () => {
      expect(isAutoSelectable('medium')).toBe(false)
      expect(isAutoSelectable('large-v3-turbo')).toBe(false)
      expect(isAutoSelectable('base')).toBe(true)
    })

    it('reports RAM to one decimal so the UI can state what it measured', async () => {
      const result = await recommendWhisperModel({ totalMemory: () => 15.7 * GB })
      expect(result.ramGB).toBeCloseTo(15.7, 1)
    })

    it('reads real system memory and cores when no probe is injected', async () => {
      const result = await recommendWhisperModel()
      expect(result.ramGB).toBeGreaterThan(0)
      expect(result.cores).toBeGreaterThan(0)
      expect(BUNDLED_WHISPER_MODELS).toContain(result.recommendedId)
    })
  })
})
