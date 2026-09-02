/**
 * What counts as audio, and what the picker accepts.
 *
 * Its own module (not `AudioStage.tsx`'s) because a `.tsx` exporting a
 * non-component trips `react-refresh/only-export-components` — the
 * `audioJobCopy.ts` / `modelCopy.ts` precedent.
 */

/** Extensions the WebAudio decoder handles; anything else is rejected up front. */
export const AUDIO_ACCEPT = 'audio/*,.wav,.mp3,.m4a,.ogg,.webm,.flac'

/** Whether a dropped item is plausibly audio — by MIME first, extension second. */
export function isAudioFile(file: File): boolean {
  if (file.type.startsWith('audio/')) return true
  return /\.(wav|mp3|m4a|ogg|webm|flac|aac|opus)$/i.test(file.name)
}

/**
 * A stable identity for a staged file. Name plus size, because the same file
 * dropped twice is a slip rather than a request to spend the minutes twice, and
 * `File` objects from two separate drops are never `===` even for one file.
 */
export function stagedKey(file: File): string {
  return `${file.name}:${file.size}`
}
