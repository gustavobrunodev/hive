import { join } from 'path'
import type { WhisperModelId, WhisperVariant } from './whisperTypes'

/**
 * The models that ship **inside the app** — no download, no network, ready on
 * first launch (D-SB-8).
 *
 * These are the first three rungs of the published Whisper ladder, which is
 * also the range where the accuracy/speed trade-off is a real choice rather
 * than a formality: `tiny` is the one that stays responsive on a thin laptop,
 * `small` is the one worth waiting for when the machine can carry it, and
 * `base` is the middle the app falls back to whenever the probe is
 * inconclusive. Everything above `small` stays in the catalog as an opt-in
 * download, because bundling `medium` would triple the installer for a model
 * most machines here cannot run at a usable speed anyway.
 */
export const BUNDLED_WHISPER_MODELS: readonly WhisperModelId[] = ['tiny', 'base', 'small']

/**
 * The precision the bundled weights are shipped in.
 *
 * **fp32, deliberately.** It is the only variant that builds an ONNX session on
 * onnxruntime-web's WASM backend — the quantized decoder fails there with
 * "MatMulNBits … Missing required scale" (T2 spike, STATE.md) — and a bundled
 * model exists precisely so that it works on the machine that has nothing else.
 * A WebGPU machine runs these same fp32 weights fine; it simply does not get
 * the ~4x smaller download it never had to make.
 */
export const BUNDLED_WHISPER_VARIANT: WhisperVariant = 'fp32'

/** Directory name, under the app's `resources/`, holding the bundled repos. */
export const BUNDLED_MODELS_DIRNAME = 'whisper-models'

/** Is `id` one of the models that ships with the app? */
export function isBundledModel(id: WhisperModelId): boolean {
  return BUNDLED_WHISPER_MODELS.includes(id)
}

/**
 * Where the bundled weights live, resolved **from the main bundle** rather than
 * from `process.resourcesPath` — the same rule (and the same release-blocking
 * trap) as `studioResourcesRoot`: `asarUnpack: resources/**` puts unpacked
 * entries at `<resourcesPath>/app.asar.unpacked/resources/…`, not at
 * `<resourcesPath>/resources/…`. A path relative to `out/main/` is correct in
 * dev *and* packaged, where Electron's fs shim redirects into
 * `app.asar.unpacked/` on its own.
 */
export function bundledModelsRoot(mainDir: string): string {
  return join(mainDir, '..', '..', 'resources', BUNDLED_MODELS_DIRNAME)
}
