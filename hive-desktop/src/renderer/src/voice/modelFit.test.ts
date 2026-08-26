import { describe, expect, it } from 'vitest'
import { fits, isMemoryFailure, modelFit, MAX_WEIGHT_FILE_MB } from './modelFit'
import { whisperModelFixture } from '../testSupport/hiveWhisperMock'

/**
 * The numbers below are the real catalog's, and the thresholds they meet are
 * measured rather than chosen — see `modelFit.ts`. This suite exists because
 * the library used to offer every model on every machine, including two whose
 * fp32 weights this renderer provably cannot read: a 3.0 GB and a 5.8 GB
 * download that end in `RangeError: Array buffer allocation failed`.
 */
describe('modelFit', () => {
  const model = (over: Record<string, unknown>): ReturnType<typeof whisperModelFixture> =>
    whisperModelFixture({ downloaded: false, downloadedVariant: null, ...over })

  const tiny = model({
    id: 'tiny',
    sizeMB: { fp32: 144, q8: 39 },
    maxFileMB: { fp32: 113, q8: 29 }
  })
  const small = model({
    id: 'small',
    sizeMB: { fp32: 923, q8: 238 },
    maxFileMB: { fp32: 587, q8: 150 }
  })
  const medium = model({
    id: 'medium',
    sizeMB: { fp32: 2916, q8: 740 },
    maxFileMB: { fp32: 1744, q8: 441 }
  })
  const turbo = model({
    id: 'large-v3-turbo',
    sizeMB: { fp32: 3086, q8: 1035 },
    maxFileMB: { fp32: 2430, q8: 615 }
  })

  it('refuses a model with a weight file at or past the ArrayBuffer ceiling', () => {
    // `large-v3-turbo`'s fp32 encoder is a single 2430 MB `.onnx_data` file.
    expect(modelFit(turbo, 'fp32', 64)).toEqual({ kind: 'tooLarge', fileMB: 2430 })
    // Not a memory problem: 64 GB of RAM does not move this one.
    expect(fits(turbo, 'fp32', 64)).toBe(false)
  })

  it('accepts the same model in the precision a GPU machine would fetch', () => {
    expect(modelFit(turbo, 'q8', 16)).toEqual({ kind: 'ok' })
  })

  it('refuses a model whose peak does not fit in this machine, and allows it in one that does', () => {
    // fp32 `medium` peaks at 2916 (every session in the WASM heap) + 1744 (the
    // file being read) = 4660 MB.
    expect(modelFit(medium, 'fp32', 8)).toEqual({ kind: 'tooHeavy', needMB: 4660, ramGB: 8 })
    expect(modelFit(medium, 'fp32', 32)).toEqual({ kind: 'ok' })
  })

  it('lets the small end of the ladder through on a modest machine', () => {
    expect(fits(tiny, 'fp32', 4)).toBe(true)
    expect(fits(small, 'fp32', 4)).toBe(true)
  })

  /**
   * A machine whose RAM could not be read must not be told what it cannot do:
   * refusing on a figure we never measured is worse than letting it try.
   */
  it('skips the memory test when the probe could not read the machine', () => {
    expect(modelFit(medium, 'fp32', 0)).toEqual({ kind: 'ok' })
    // The hard ceiling still applies — it is not about this machine at all.
    expect(modelFit(turbo, 'fp32', 0).kind).toBe('tooLarge')
  })

  /**
   * This screen is the only way to get a voice model at all. A row whose
   * measurements are missing must still be offerable — refusing on a number we
   * do not have would take the whole feature away over a catalog gap.
   */
  it('never refuses a row it has no measurements for', () => {
    const unmeasured = whisperModelFixture({
      downloaded: false,
      downloadedVariant: null
    }) as unknown as Record<string, unknown>
    delete unmeasured.maxFileMB
    expect(modelFit(unmeasured as never, 'fp32', 8)).toEqual({ kind: 'ok' })
  })

  it('draws the hard ceiling exactly where V8 does', () => {
    const at = model({ maxFileMB: { fp32: MAX_WEIGHT_FILE_MB, q8: 1 } })
    const under = model({ maxFileMB: { fp32: MAX_WEIGHT_FILE_MB - 1, q8: 1 } })
    expect(modelFit(at, 'fp32', 64).kind).toBe('tooLarge')
    expect(modelFit(under, 'fp32', 64).kind).toBe('ok')
  })
})

describe('isMemoryFailure', () => {
  it('recognizes the engine sentence a user actually saw', () => {
    expect(isMemoryFailure('Array buffer allocation failed')).toBe(true)
    expect(isMemoryFailure('RangeError: array buffer allocation failed')).toBe(true)
    expect(isMemoryFailure('memory access out of bounds')).toBe(true)
  })

  it('leaves unrelated failures alone', () => {
    expect(isMemoryFailure('Missing required scale for node')).toBe(false)
    expect(isMemoryFailure('')).toBe(false)
  })
})
