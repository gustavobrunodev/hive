/**
 * Audio decode + resample for the Whisper pipeline (SB-R4.1, design §4.2).
 *
 * Whisper wants exactly **16 kHz mono Float32 PCM**. The browser's WebAudio
 * gives us both halves for free — `decodeAudioData` handles every container
 * Chromium can read (wav/mp3/m4a/ogg/webm/flac), and `OfflineAudioContext`
 * resamples — so there is no ffmpeg and no native codec anywhere in this
 * feature (D-SB-1). The same path serves an uploaded file and the recorder's
 * Blob, which is what lets both modes share one transcript field.
 */

/** Sample rate the Whisper feature extractor expects. */
export const WHISPER_SAMPLE_RATE = 16000

/** Why a decode failed, so the UI can say something true (SB-R4.6). */
export type AudioErrorKind = 'empty' | 'unsupported' | 'silent'

export class AudioDecodeError extends Error {
  constructor(
    public readonly kind: AudioErrorKind,
    message: string
  ) {
    super(message)
    this.name = 'AudioDecodeError'
  }
}

/**
 * The slice of WebAudio this module needs, injected so the decode/resample
 * logic is unit-testable without a real browser audio stack.
 */
export interface AudioDeps {
  decode: (data: ArrayBuffer) => Promise<AudioBuffer>
  /** Builds an OfflineAudioContext-like renderer for the target rate. */
  resample: (buffer: AudioBuffer, targetRate: number) => Promise<AudioBuffer>
}

/** Real WebAudio implementation of `AudioDeps`. */
export function browserAudioDeps(): AudioDeps {
  return {
    decode: async (data) => {
      const context = new AudioContext()
      try {
        return await context.decodeAudioData(data)
      } finally {
        void context.close()
      }
    },
    resample: async (buffer, targetRate) => {
      const frames = Math.max(1, Math.ceil((buffer.duration || 0) * targetRate))
      const offline = new OfflineAudioContext(1, frames, targetRate)
      const source = offline.createBufferSource()
      source.buffer = buffer
      source.connect(offline.destination)
      source.start()
      return offline.startRendering()
    }
  }
}

/** Averages an AudioBuffer's channels into one Float32 track (mono downmix). */
export function downmixToMono(buffer: AudioBuffer): Float32Array {
  const channels = buffer.numberOfChannels
  if (channels === 1) return buffer.getChannelData(0)

  const length = buffer.length
  const mono = new Float32Array(length)
  for (let channel = 0; channel < channels; channel++) {
    const data = buffer.getChannelData(channel)
    for (let i = 0; i < length; i++) mono[i] += data[i]
  }
  for (let i = 0; i < length; i++) mono[i] /= channels
  return mono
}

/**
 * Decodes `file` (an upload or the recorder's Blob) into 16 kHz mono Float32
 * PCM. Throws a typed `AudioDecodeError` on empty input, on audio Chromium
 * can't decode, and on a track that carries no signal at all — the last one
 * matters because a silent take would otherwise reach Whisper and come back as
 * an empty transcript with no explanation (SB-R4.6).
 */
export async function decodeToWhisperPcm(
  file: Blob,
  deps: AudioDeps = browserAudioDeps()
): Promise<Float32Array> {
  if (file.size === 0) {
    throw new AudioDecodeError('empty', 'audio: the file is empty')
  }

  const data = await file.arrayBuffer()

  let buffer: AudioBuffer
  try {
    buffer = await deps.decode(data)
  } catch (cause) {
    throw new AudioDecodeError('unsupported', `audio: could not decode (${String(cause)})`)
  }

  // Resample only when needed — a 16 kHz source skips a whole render pass.
  const atTargetRate =
    buffer.sampleRate === WHISPER_SAMPLE_RATE
      ? buffer
      : await deps.resample(buffer, WHISPER_SAMPLE_RATE)

  const pcm = downmixToMono(atTargetRate)

  if (pcm.length === 0) {
    throw new AudioDecodeError('empty', 'audio: decoded to zero samples')
  }
  if (!pcm.some((sample) => sample !== 0)) {
    throw new AudioDecodeError('silent', 'audio: the recording carries no sound')
  }

  return pcm
}
