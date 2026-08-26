/**
 * The two model identifiers, derived from the bridge rather than imported from
 * `src/main` (AGENTS.md: the renderer's only contract with main is
 * `window.hive`, and `moduleBoundaries.test.ts` enforces it).
 *
 * They live in their own types-only module because the transcription **worker**
 * needs them too, and the worker must not import `useWhisper` — that would drag
 * React into a bundle whose whole purpose is to run somewhere React cannot.
 */
type WhisperBridge = Window['hive']['whisper']

export type WhisperModelId = Parameters<WhisperBridge['modelStatus']>[0]
export type WhisperVariant = Parameters<WhisperBridge['startDownload']>[1]
