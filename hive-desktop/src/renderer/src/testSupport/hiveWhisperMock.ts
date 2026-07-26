import { vi, type Mock } from 'vitest'

/** Each whisper bridge method as a vitest `Mock`, so tests can override per method. */
export type HiveWhisperMock = Record<keyof Window['hive']['whisper'], Mock>

/**
 * A fully-stubbed `window.hive.whisper` namespace (second-brain M12) for tests
 * that mount UI reading `window.hive` but don't drive transcription: an empty
 * catalog, nothing downloaded, and a no-op download subscription. Tests that DO
 * drive Whisper override the methods they need.
 */
export function createHiveWhisperMock(): HiveWhisperMock {
  return {
    listModels: vi.fn().mockResolvedValue([]),
    modelStatus: vi.fn().mockResolvedValue({ downloaded: false, variant: null }),
    downloadModel: vi.fn().mockReturnValue(() => {}),
    deleteModel: vi.fn().mockResolvedValue(undefined),
    recommend: vi
      .fn()
      .mockResolvedValue({ recommendedId: 'base', reason: 'unknown', gpu: false, ramGB: 0 })
  }
}
