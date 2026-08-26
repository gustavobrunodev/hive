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
 * A fully-stubbed `window.hive.whisper` namespace for tests that mount UI
 * reading `window.hive` but do not drive transcription.
 *
 * The default is the **fresh-install** state (M26): an empty catalog, nothing
 * downloaded, and therefore `preference.id === null`. That is deliberately the
 * harsher default — it is what a new user actually has, and every surface that
 * listens has to render it correctly.
 */
export function createHiveWhisperMock(): HiveWhisperMock {
  const emptyPreference = {
    id: null,
    auto: true,
    recommendation: UNKNOWN_HARDWARE,
    installed: []
  }
  return {
    listModels: vi.fn().mockResolvedValue([]),
    modelStatus: vi.fn().mockResolvedValue({ downloaded: false, variant: null }),
    deleteModel: vi.fn().mockResolvedValue(undefined),
    recommend: vi.fn().mockResolvedValue(UNKNOWN_HARDWARE),
    preference: vi.fn().mockResolvedValue(emptyPreference),
    setPreferredModel: vi.fn().mockResolvedValue(emptyPreference),
    // Downloads live in main and are read, not owned, by the renderer — the
    // stubs mirror that: a snapshot to read and subscriptions that hand back a
    // no-op unsubscribe.
    downloads: vi.fn().mockResolvedValue([]),
    startDownload: vi.fn().mockResolvedValue(undefined),
    cancelDownload: vi.fn().mockResolvedValue(undefined),
    dismissDownload: vi.fn().mockResolvedValue(undefined),
    onDownloads: vi.fn().mockReturnValue(() => {}),
    onDownloadSettled: vi.fn().mockReturnValue(() => {})
  }
}

/**
 * One catalog row. Exported because several surfaces need realistic rows, and
 * hand-rolling them per test is how a field added to `WhisperModelInfo` ends up
 * missing in half the suite.
 */
export function whisperModelFixture(
  overrides: Partial<Awaited<ReturnType<Window['hive']['whisper']['listModels']>>[number]> = {}
): Awaited<ReturnType<Window['hive']['whisper']['listModels']>>[number] {
  return {
    id: 'base',
    repo: 'Xenova/whisper-base',
    params: '74 M',
    sizeMB: { fp32: 278, q8: 73 },
    maxFileMB: { fp32: 199, q8: 51 },
    approxVramGB: 1,
    relativeSpeed: '~7x',
    multilingual: true,
    downloaded: true,
    downloadedVariant: 'fp32',
    ...overrides
  }
}

/** One download record, in flight by default. */
export function whisperDownloadFixture(
  overrides: Partial<Awaited<ReturnType<Window['hive']['whisper']['downloads']>>[number]> = {}
): Awaited<ReturnType<Window['hive']['whisper']['downloads']>>[number] {
  return {
    id: 'medium',
    variant: 'fp32',
    status: 'downloading',
    loaded: 512 * 1024 * 1024,
    total: 3_057 * 1024 * 1024,
    file: 'onnx/encoder_model.onnx',
    bytesPerSecond: 3 * 1024 * 1024,
    failure: null,
    startedAt: 0,
    updatedAt: 0,
    ...overrides
  }
}
