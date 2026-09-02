import { vi, type Mock } from 'vitest'

/** Each ASR bridge method as a vitest `Mock`, so tests can override per method. */
export type HiveAsrMock = Record<keyof Window['hive']['asr'], Mock>

type Readiness = Awaited<ReturnType<Window['hive']['asr']['readiness']>>
type Download = Awaited<ReturnType<Window['hive']['asr']['downloads']>>[number]

/** The catalog entry, as main reports it. */
export const ASR_MODEL_FIXTURE: Readiness['model'] = {
  id: 'parakeet-tdt-0.6b-v3-int8',
  repo: 'csukuangfj/sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8',
  params: '600 M',
  sizeMB: 671,
  languages: 25,
  downloaded: false
}

/** What the probe reads on a machine we know nothing about. */
const UNKNOWN_RUNTIME: Readiness['runtime'] = {
  threads: 2,
  facts: { gpu: false, ramGB: 0, cores: 0 }
}

/** Readiness, uninstalled by default — see below. */
export function asrReadinessFixture(overrides: Partial<Readiness> = {}): Readiness {
  return {
    installed: false,
    model: ASR_MODEL_FIXTURE,
    runtime: UNKNOWN_RUNTIME,
    ...overrides
  }
}

/**
 * A fully-stubbed `window.hive.asr` namespace for tests that mount UI reading
 * `window.hive` but do not drive transcription.
 *
 * The default is the **fresh-install** state: nothing downloaded, so
 * `installed` is false. That is deliberately the harsher default — it is what a
 * new user actually has, and every surface that listens has to render it
 * correctly.
 */
export function createHiveAsrMock(): HiveAsrMock {
  return {
    readiness: vi.fn().mockResolvedValue(asrReadinessFixture()),
    deleteModel: vi.fn().mockResolvedValue(asrReadinessFixture()),
    warm: vi.fn().mockResolvedValue(undefined),
    transcribe: vi.fn().mockResolvedValue(''),
    evict: vi.fn().mockResolvedValue(undefined),
    onPhase: vi.fn().mockReturnValue(() => {}),
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

/** One download record, in flight by default. */
export function asrDownloadFixture(overrides: Partial<Download> = {}): Download {
  return {
    id: 'parakeet-tdt-0.6b-v3-int8',
    status: 'downloading',
    loaded: 256 * 1024 * 1024,
    total: 671 * 1024 * 1024,
    file: 'encoder.int8.onnx',
    bytesPerSecond: 3 * 1024 * 1024,
    failure: null,
    startedAt: 0,
    updatedAt: 0,
    ...overrides
  }
}
