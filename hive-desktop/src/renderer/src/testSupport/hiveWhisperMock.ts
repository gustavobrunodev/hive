import { vi, type Mock } from 'vitest'

/** Each whisper bridge method as a vitest `Mock`, so tests can override per method. */
export type HiveWhisperMock = Record<keyof Window['hive']['whisper'], Mock>

/** The probe's answer on a machine we know nothing about. */
const UNKNOWN_HARDWARE = {
  recommendedId: 'base',
  reason: 'unknown',
  gpu: false,
  ramGB: 0,
  cores: 0
} as const

/**
 * A fully-stubbed `window.hive.whisper` namespace (second-brain M12) for tests
 * that mount UI reading `window.hive` but don't drive transcription: an empty
 * catalog, nothing downloaded, and a no-op download subscription. Tests that DO
 * drive Whisper override the methods they need.
 */
export function createHiveWhisperMock(): HiveWhisperMock {
  return {
    listModels: vi.fn().mockResolvedValue([]),
    modelStatus: vi.fn().mockResolvedValue({ downloaded: false, variant: null, bundled: false }),
    downloadModel: vi.fn().mockReturnValue(() => {}),
    deleteModel: vi.fn().mockResolvedValue(undefined),
    recommend: vi.fn().mockResolvedValue(UNKNOWN_HARDWARE),
    preference: vi
      .fn()
      .mockResolvedValue({ id: 'base', auto: true, recommendation: UNKNOWN_HARDWARE }),
    setPreferredModel: vi
      .fn()
      .mockResolvedValue({ id: 'base', auto: true, recommendation: UNKNOWN_HARDWARE })
  }
}

/**
 * One catalog row, with the bundled defaults. Exported because the picker and
 * the manager both need realistic rows, and hand-rolling them per test is how
 * a field added to `WhisperModelInfo` ends up missing in half the suite.
 */
export function whisperModelFixture(
  overrides: Partial<Awaited<ReturnType<Window['hive']['whisper']['listModels']>>[number]> = {}
): Awaited<ReturnType<Window['hive']['whisper']['listModels']>>[number] {
  return {
    id: 'base',
    repo: 'Xenova/whisper-base',
    params: '74 M',
    sizeMB: { fp32: 278, q8: 73 },
    approxVramGB: 1,
    relativeSpeed: '~7x',
    multilingual: true,
    downloaded: true,
    downloadedVariant: 'fp32',
    bundled: true,
    ...overrides
  }
}
