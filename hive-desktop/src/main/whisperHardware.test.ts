import { describe, expect, it } from 'vitest'
import { hasRealGpu, pickAutoModel, recommendWhisperModel } from './whisperHardware'

/**
 * The rungs the probe is allowed to land on. It used to be
 * `BUNDLED_WHISPER_MODELS` — the models that shipped inside the installer —
 * and the property it guarded (an automatic pick never implies a download) is
 * now enforced somewhere else entirely: the probe advises, and `pickAutoModel`
 * only ever answers with something already on disk.
 */
const PROBE_RUNGS = ['tiny', 'base', 'small'] as const

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

    it('prefers small whenever there is a GPU and the memory to hold it', async () => {
      // The default the product asks for (2026-08-20): the most accurate
      // bundled model, wherever it will actually run.
      expect(await recommendWhisperModel(machine(32, discreteGpu, 12))).toMatchObject({
        recommendedId: 'small',
        reason: 'discreteGpu',
        gpu: true
      })
    })

    it('commits to small on a GPU machine with exactly the floor of RAM', async () => {
      // 8 GB is the floor, not a value above it: an off-by-one here silently
      // demotes every machine sitting on the boundary.
      expect(await recommendWhisperModel(machine(8, discreteGpu, 4))).toMatchObject({
        recommendedId: 'small',
        reason: 'discreteGpu'
      })
    })

    it('does not need cores once there is a GPU — the GPU is the gate', async () => {
      expect(await recommendWhisperModel(machine(32, discreteGpu, 2))).toMatchObject({
        recommendedId: 'small',
        reason: 'discreteGpu'
      })
    })

    it('drops to tiny — not base — on a strong CPU-only machine', async () => {
      // fp32 on a single WASM thread (M12.3): `small` is minutes per take
      // here, so the ladder's second rung is `tiny`, the fastest model.
      expect(await recommendWhisperModel(machine(32, null, 8))).toMatchObject({
        recommendedId: 'tiny',
        reason: 'noGpu',
        gpu: false
      })
    })

    it('drops to tiny on a CPU-only machine with few cores, and says which', async () => {
      expect(await recommendWhisperModel(machine(16, null, 4))).toMatchObject({
        recommendedId: 'tiny',
        reason: 'cpuOnly',
        gpu: false,
        cores: 4
      })
    })

    it('drops to tiny on a GPU machine that has no room for small', async () => {
      // A GPU is not enough on its own — `small`'s weights still have to fit.
      expect(await recommendWhisperModel(machine(6, discreteGpu, 16))).toMatchObject({
        recommendedId: 'tiny',
        reason: 'lowMemory',
        gpu: true
      })
    })

    it('degrades to tiny when the core probe throws', async () => {
      const result = await recommendWhisperModel({
        totalMemory: () => 32 * GB,
        coreCount: () => {
          throw new Error('cpuinfo unavailable')
        }
      })
      expect(result).toMatchObject({ recommendedId: 'tiny', reason: 'cpuOnly', cores: 0 })
    })

    it('falls back to base — the rung that runs anywhere — when RAM cannot be read', async () => {
      // SB-R7.3. `base`, not `tiny`: picking the smallest model would assert
      // "this machine is weak", which is precisely what was not measured.
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
      ).toMatchObject({ recommendedId: 'tiny', reason: 'noGpu' })
    })

    /**
     * The property that makes this safe to *act* on rather than merely display
     * (SB-R7.4): an automatic pick must never imply a download. Asserted over
     * the whole matrix rather than the handful of cases above, because a future
     * rung added to the ladder is exactly what would break it quietly.
     */
    it('only ever recommends a light rung of the ladder', async () => {
      for (const ramGB of [0, 2, 4, 7.9, 8, 15.9, 16, 64]) {
        for (const gpu of [null, discreteGpu]) {
          for (const cores of [0, 1, 4, 7, 8, 32]) {
            const { recommendedId } = await recommendWhisperModel(machine(ramGB, gpu, cores))
            expect(PROBE_RUNGS).toContain(recommendedId)
          }
        }
      }
    })

    it('reports RAM to one decimal so the UI can state what it measured', async () => {
      const result = await recommendWhisperModel({ totalMemory: () => 15.7 * GB })
      expect(result.ramGB).toBeCloseTo(15.7, 1)
    })

    it('reads real system memory and cores when no probe is injected', async () => {
      const result = await recommendWhisperModel()
      expect(result.ramGB).toBeGreaterThan(0)
      expect(result.cores).toBeGreaterThan(0)
      expect(PROBE_RUNGS).toContain(result.recommendedId)
    })
  })

  /**
   * What "Automático" actually resolves to now that nothing ships inside the
   * app: advice on one side, an inventory on the other, and a rule that never
   * points transcription at files that are not there.
   */
  describe('pickAutoModel', () => {
    it('answers null when nothing is installed — the fresh-install state', () => {
      expect(pickAutoModel('small', [])).toBeNull()
    })

    it('takes the advised model when it is on disk', () => {
      expect(pickAutoModel('small', ['tiny', 'small', 'medium'])).toBe('small')
    })

    it('never rounds up: the heaviest installed model at or below the advice wins', () => {
      expect(pickAutoModel('small', ['tiny', 'base', 'medium'])).toBe('base')
    })

    it('falls to the lightest installed model when everything is heavier than advised', () => {
      expect(pickAutoModel('tiny', ['medium', 'large-v3'])).toBe('medium')
    })

    it('treats an .en build as the same rung as its multilingual sibling', () => {
      expect(pickAutoModel('base', ['tiny.en', 'base.en'])).toBe('base.en')
    })

    it('never picks English-only for a pt-BR squad while a multilingual model exists', () => {
      expect(pickAutoModel('small', ['small.en', 'tiny'])).toBe('tiny')
    })

    it('answers something for an id outside the ladder rather than nothing', () => {
      expect(pickAutoModel('base', ['mystery' as never])).toBe('mystery')
    })
  })
})
