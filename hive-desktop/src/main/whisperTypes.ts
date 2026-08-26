/**
 * Pure, runtime-free Whisper types shared across main/preload/renderer (the
 * `secondBrainTypes.ts` / `reviewTypes.ts` convention — the preload `.d.ts`
 * must not drag `fs`/`fetch` runtime into the web TypeScript program).
 */

/** Catalog model ids (design §8). */
export type WhisperModelId =
  | 'tiny'
  | 'tiny.en'
  | 'base'
  | 'base.en'
  | 'small'
  | 'small.en'
  | 'medium'
  | 'medium.en'
  | 'large-v3'
  | 'large-v3-turbo'

/**
 * Which precision of the ONNX weights to fetch/run.
 *
 * `fp32` is the guaranteed path: the T2 spike proved the uint8-`quantized`
 * decoder fails to create a session on onnxruntime-web's WASM backend
 * ("MatMulNBits … Missing required scale"), so CPU/WASM must use fp32. `q8` is
 * offered for WebGPU, where the quantized kernels are supported and the
 * download is ~4× smaller (user decision, 2026-07-26).
 */
export type WhisperVariant = 'fp32' | 'q8'

/** One catalog entry + its local availability. */
export interface WhisperModelInfo {
  id: WhisperModelId
  /** Hugging Face repo holding the ONNX export. */
  repo: string
  /** Parameter count, as the Whisper model card states it. */
  params: string
  /** Measured download size (MB) per variant — real HF file sizes, not estimates. */
  sizeMB: Record<WhisperVariant, number>
  /**
   * The **largest single weight file** (MB) per variant, measured the same way.
   *
   * Carried separately from the total because it is the figure that decides
   * whether a model can be loaded at all. Transformers.js reads each weight
   * file into one `ArrayBuffer`, and V8 refuses any allocation of 2 GiB or
   * more — measured in this app's own renderer on 2026-08-23: 2040 MiB
   * allocates, 2047 MiB throws `RangeError: Array buffer allocation failed`,
   * which is verbatim the failure a user reported from a real take. A total
   * cannot express that: `large-v3-turbo` is 3.0 GB across two files, and it
   * is the 2.4 GB one that makes it impossible on this backend.
   */
  maxFileMB: Record<WhisperVariant, number>
  /** Rough GPU memory the model wants, from the published Whisper table. */
  approxVramGB: number
  /** Relative speed vs `large` (e.g. '~10x'), from the published Whisper table. */
  relativeSpeed: string
  /** False for the English-only `.en` variants. */
  multilingual: boolean
  /** Is it fully downloaded locally? */
  downloaded: boolean
  /** Which variant is on disk, when downloaded. */
  downloadedVariant: WhisperVariant | null
}

/** Byte progress for an in-flight model download. */
export interface WhisperDownloadProgress {
  id: WhisperModelId
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
 * The old surface reported every failure as the same four words ("O download
 * falhou.") with the engine's English message thrown away, which left a user
 * whose disk was full and a user whose Wi-Fi dropped reading the identical,
 * unactionable line. The kind is what makes the copy specific; `detail` is the
 * raw text, kept for the disclosure rather than the headline.
 */
export type WhisperDownloadErrorKind =
  'offline' | 'server' | 'notFound' | 'disk' | 'unsupported' | 'unknown'

export interface WhisperDownloadFailure {
  kind: WhisperDownloadErrorKind
  /** The underlying error text — English, technical, never the headline. */
  detail: string
}

/** Terminal event of a model download. */
export type WhisperDownloadEvent =
  | ({ type: 'progress' } & WhisperDownloadProgress)
  | { type: 'done'; id: WhisperModelId }
  | { type: 'error'; id: WhisperModelId; message: string; failure: WhisperDownloadFailure }

/** Where one model download is, as the manager in main keeps it. */
export type WhisperDownloadStatus = 'downloading' | 'done' | 'error' | 'cancelled'

/**
 * One download, owned by **main** and outliving every window that watches it.
 *
 * The record exists because a download is not a component's state: it is a
 * multi-gigabyte, multi-minute job whose owner used to be a React hook inside a
 * sheet. Closing the sheet unsubscribed, the preload's teardown sent
 * `whisper:download:stop`, and a download that was 80 % done became invisible
 * with no way back to it. Anything that survives the surface that started it
 * belongs in main, with the renderer as a subscriber to a snapshot.
 */
export interface WhisperDownload {
  id: WhisperModelId
  variant: WhisperVariant
  status: WhisperDownloadStatus
  /** Bytes fetched so far, resumed bytes included. `0` until the index lands. */
  loaded: number
  /** Total bytes to fetch. `0` until the index lands. */
  total: number
  /** The file currently downloading. Empty while the index is being read. */
  file: string
  /**
   * Smoothed transfer rate in bytes/second, `0` until two samples exist.
   *
   * Measured rather than assumed: a 2.8 GB model is the first thing in this app
   * whose wait is long enough that "how long is left" is a real question, and
   * the honest answer needs this machine's actual throughput, not a constant.
   */
  bytesPerSecond: number
  /** Set only when `status` is `error`. */
  failure: WhisperDownloadFailure | null
  startedAt: number
  updatedAt: number
}

/**
 * Why a model was recommended — a key the renderer maps to pt-BR copy.
 *
 * `lowMemory`/`cpuOnly`/`noGpu` all land on `tiny` and `discreteGpu` lands on
 * `small`; the reason is kept distinct from the model because the *sentence*
 * the UI shows is the part that differs, and "not enough memory" and "no GPU"
 * are different things to tell someone who wants a better transcription.
 */
export type RecommendationReason = 'lowMemory' | 'cpuOnly' | 'noGpu' | 'discreteGpu' | 'unknown'

/** Best-effort hardware recommendation (P2, SB-R7). */
export interface HardwareRecommendation {
  recommendedId: WhisperModelId
  reason: RecommendationReason
  gpu: boolean
  ramGB: number
  /** Logical CPU cores — reported so the UI can say what it measured. */
  cores: number
}

/**
 * Which model transcription actually uses, and how that was decided (SB-R7.4).
 *
 * The recommendation on its own was advisory: it was rendered as a badge in the
 * manager and nothing ever acted on it, so every machine transcribed with the
 * same hardcoded default. This is the resolved answer instead — `auto` says
 * whether the app chose it or the user did, and `recommendation` is carried
 * alongside so the UI can explain the automatic pick *and* show what would be
 * chosen if the user handed the decision back.
 */
export interface WhisperPreference {
  /**
   * The model to transcribe with, or `null` when nothing is installed yet.
   *
   * `null` became reachable when the app stopped shipping weights inside the
   * installer: until the user downloads a model there is no honest answer to
   * "what will transcribe this", and inventing one is how the old surface
   * ended up offering a microphone that could only fail. Every caller that
   * listens now has to handle it, which is the point.
   */
  id: WhisperModelId | null
  /** True when `id` came from the hardware probe rather than from the user. */
  auto: boolean
  /** The probe's own answer, regardless of whether it is in force. */
  recommendation: HardwareRecommendation
  /** Every model on disk right now, in catalog order. */
  installed: WhisperModelId[]
}
