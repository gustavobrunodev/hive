/**
 * Pure, runtime-free ASR types shared across main/preload/renderer (the
 * `whisperTypes.ts` / `secondBrainTypes.ts` convention — the preload `.d.ts`
 * must not drag `fs`/`fetch` runtime into the web TypeScript program).
 */

/**
 * The one model the app transcribes with (M29).
 *
 * A single id where there used to be a ten-model union, and the collapse is the
 * feature rather than a simplification made in passing. The old catalog existed
 * because Whisper forced a trade nobody could make well: `tiny` was fast and
 * wrong, `medium` was right and did not fit, and the app spent a hardware
 * probe, a recommendation ladder, a fit calculator and a whole settings surface
 * helping people guess. Parakeet TDT v3 is 600 M parameters in 670 MB — more
 * accurate than the `medium` nobody could run, smaller than the `small`
 * everyone did — so the question the catalog answered no longer has two sides.
 */
export const PARAKEET_MODEL_ID = 'parakeet-tdt-0.6b-v3-int8'
export type AsrModelId = typeof PARAKEET_MODEL_ID

/** The catalog entry + its local availability. */
export interface AsrModelInfo {
  id: AsrModelId
  /** Hugging Face repo holding the sherpa-onnx export. */
  repo: string
  /** Parameter count, as the model card states it. */
  params: string
  /** Measured download size (MB) — real HF file sizes, not estimates. */
  sizeMB: number
  /** How many languages the model was trained on. */
  languages: number
  /** Is it fully downloaded locally? */
  downloaded: boolean
}

/** Byte progress for an in-flight model download. */
export interface AsrDownloadProgress {
  id: AsrModelId
  /** Bytes fetched so far across all files, resumed bytes included. */
  loaded: number
  /** Total bytes to fetch (sum of the tree API's sizes). */
  total: number
  /** The file currently downloading, for an honest caption. */
  file: string
}

/**
 * Why a download stopped, as a key the renderer turns into a sentence.
 *
 * Carried over from the Whisper store unchanged, because the taxonomy was never
 * about Whisper: a full disk and a dropped Wi-Fi are different things to tell
 * someone, whatever the bytes were for. `detail` is the raw text, kept for the
 * disclosure rather than the headline.
 */
export type AsrDownloadErrorKind =
  'offline' | 'server' | 'notFound' | 'disk' | 'unsupported' | 'unknown'

export interface AsrDownloadFailure {
  kind: AsrDownloadErrorKind
  /** The underlying error text — English, technical, never the headline. */
  detail: string
}

/** Where one model download is, as the manager in main keeps it. */
export type AsrDownloadStatus = 'downloading' | 'done' | 'error' | 'cancelled'

/**
 * One download, owned by **main** and outliving every window that watches it.
 *
 * The record exists because a download is not a component's state: it is a
 * multi-hundred-megabyte, multi-minute job whose owner used to be a React hook
 * inside a sheet. Closing the sheet unsubscribed and a download that was 80 %
 * done became invisible with no way back to it. Anything that survives the
 * surface that started it belongs in main, with the renderer as a subscriber.
 */
export interface AsrDownload {
  id: AsrModelId
  status: AsrDownloadStatus
  /** Bytes fetched so far, resumed bytes included. `0` until the index lands. */
  loaded: number
  /** Total bytes to fetch. `0` until the index lands. */
  total: number
  /** The file currently downloading. Empty while the index is being read. */
  file: string
  /**
   * Smoothed transfer rate in bytes/second, `0` until two samples exist.
   *
   * Measured rather than assumed: the honest answer to "how long is left" needs
   * this machine's actual throughput, not a constant.
   */
  bytesPerSecond: number
  /** Set only when `status` is `error`. */
  failure: AsrDownloadFailure | null
  startedAt: number
  updatedAt: number
}

/**
 * What the hardware probe read, reported so the UI can say what it measured.
 *
 * These three figures survive the death of the recommendation ladder. They stop
 * being an argument for a model — there is only one — and become the argument
 * for a **thread count**, plus the honest answer to "did this app actually look
 * at my machine?" on the voice panel.
 */
export interface MachineFacts {
  gpu: boolean
  ramGB: number
  /** Logical CPU cores. */
  cores: number
}

/** How the engine will be run on this machine. */
export interface AsrRuntimeProfile {
  /** ONNX Runtime intra-op threads. */
  threads: number
  facts: MachineFacts
}

/**
 * Whether the app can transcribe right now, and why not when it cannot.
 *
 * Replaces `WhisperPreference`. The old type answered "which of ten models, and
 * who chose it"; with one model the only live question is whether its bytes are
 * on disk, so this is a boolean with its reasons attached rather than an id
 * plus a recommendation plus an `auto` flag.
 */
export interface AsrReadiness {
  /** True once every model file is on disk. */
  installed: boolean
  /** The model, for the size and the label the download surface shows. */
  model: AsrModelInfo
  /** What the probe read, for the machine facts on the voice panel. */
  runtime: AsrRuntimeProfile
}

/** Terminal event of a model download. */
export type AsrDownloadEvent =
  | ({ type: 'progress' } & AsrDownloadProgress)
  | { type: 'done'; id: AsrModelId }
  | { type: 'error'; id: AsrModelId; message: string; failure: AsrDownloadFailure }
