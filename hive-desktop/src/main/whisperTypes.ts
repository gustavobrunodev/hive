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

/** Best-effort hardware recommendation (P2, SB-R7). */
export interface HardwareRecommendation {
  recommendedId: WhisperModelId
  reason: string
  gpu: boolean
  ramGB: number
}
