/**
 * Directory names under `userData`, as constants both main and the migration
 * can import without dragging anything else along.
 */

/** Where the ASR model is downloaded to. */
export const ASR_MODELS_DIRNAME = 'asr-models'

/**
 * The directory the Whisper models used to live in.
 *
 * Kept as a name because M29 does not delete it. What is on disk there is a
 * user's own download — often several gigabytes of it — and quietly removing
 * files someone waited twenty minutes for is not a migration, it is a
 * surprise. The voice panel offers to free the space instead, with the measured
 * figure on the button, and this constant is how it finds them.
 */
export const LEGACY_WHISPER_MODELS_DIRNAME = 'whisper-models'
