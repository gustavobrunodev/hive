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
  /**
   * Does this model ship **inside the app**?
   *
   * Kept separate from `downloaded` rather than folded into it, because the two
   * answer different questions and the UI needs both: a bundled model is always
   * `downloaded`, but it can never be deleted, never has to be fetched, and is
   * the only kind the app is allowed to select on the user's behalf.
   */
  bundled: boolean
}

/** Byte progress for an in-flight model download. */
export interface WhisperDownloadProgress {
  id: WhisperModelId
  /** Bytes fetched so far across all files. */
  loaded: number
  /** Total bytes to fetch (sum of the tree API's sizes). */
  total: number
  /** The file currently downloading, for an honest caption. */
  file: string
}

/** Terminal event of a model download. */
export type WhisperDownloadEvent =
  | ({ type: 'progress' } & WhisperDownloadProgress)
  | { type: 'done'; id: WhisperModelId }
  | { type: 'error'; id: WhisperModelId; message: string }

/** Why a model was recommended — a key the renderer maps to pt-BR copy. */
export type RecommendationReason =
  'lowMemory' | 'cpuOnly' | 'noGpu' | 'discreteGpu' | 'balanced' | 'unknown'

/** Best-effort hardware recommendation (P2, SB-R7). */
export interface HardwareRecommendation {
  recommendedId: WhisperModelId
  reason: RecommendationReason
  gpu: boolean
  ramGB: number
  /** Logical CPU cores — the signal that decides `tiny` vs `base` without a GPU. */
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
  /** The model to transcribe with. Always one of the bundled ids when `auto`. */
  id: WhisperModelId
  /** True when `id` came from the hardware probe rather than from the user. */
  auto: boolean
  /** The probe's own answer, regardless of whether it is in force. */
  recommendation: HardwareRecommendation
}
