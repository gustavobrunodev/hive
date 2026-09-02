import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  AudioDecodeError,
  browserAudioDeps,
  decodeToAsrPcm,
  downmixToMono,
  ASR_SAMPLE_RATE,
  type AudioDeps
} from './audio'

/** A minimal AudioBuffer stand-in — jsdom ships no WebAudio. */
function fakeBuffer(channels: number[][], sampleRate: number): AudioBuffer {
  const length = channels[0]?.length ?? 0
  return {
    numberOfChannels: channels.length,
    length,
    sampleRate,
    duration: length / sampleRate,
    getChannelData: (i: number) => Float32Array.from(channels[i])
  } as unknown as AudioBuffer
}

function blobOfSize(size: number): Blob {
  return {
    size,
    arrayBuffer: async () => new ArrayBuffer(size)
  } as unknown as Blob
}

function deps(overrides: Partial<AudioDeps> = {}): AudioDeps {
  return {
    decode: async () => fakeBuffer([[0.5, -0.5, 0.25]], ASR_SAMPLE_RATE),
    resample: async (buffer) => buffer,
    ...overrides
  }
}

describe('whisper/audio', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  // jsdom ships no WebAudio, so the real `browserAudioDeps()` wiring is proven
  // against stubbed constructors: it must close the AudioContext it opens (a
  // leaked context keeps an audio thread alive) and render through an
  // OfflineAudioContext sized for the target rate.
  describe('browserAudioDeps', () => {
    it('decodes via AudioContext and always closes it, even when decoding throws', async () => {
      const close = vi.fn()
      const decodeAudioData = vi
        .fn()
        .mockResolvedValueOnce(fakeBuffer([[0.3]], 48000))
        .mockRejectedValueOnce(new Error('EncodingError'))
      vi.stubGlobal(
        'AudioContext',
        vi.fn(() => ({ decodeAudioData, close }))
      )

      const decoded = await browserAudioDeps().decode(new ArrayBuffer(8))
      expect(decoded.sampleRate).toBe(48000)
      expect(close).toHaveBeenCalledTimes(1)

      await expect(browserAudioDeps().decode(new ArrayBuffer(8))).rejects.toThrow('EncodingError')
      expect(close).toHaveBeenCalledTimes(2)
    })

    it('renders through an OfflineAudioContext sized for the target rate', async () => {
      const rendered = fakeBuffer([[0.1, 0.2]], ASR_SAMPLE_RATE)
      const start = vi.fn()
      const connect = vi.fn()
      const OfflineCtor = vi.fn(() => ({
        createBufferSource: () => ({ connect, start, buffer: null }),
        destination: {},
        startRendering: async () => rendered
      }))
      vi.stubGlobal('OfflineAudioContext', OfflineCtor)

      // 1 second of 48 kHz audio → 16000 frames at the target rate.
      const source = fakeBuffer([new Array(48000).fill(0.1)], 48000)
      const out = await browserAudioDeps().resample(source, ASR_SAMPLE_RATE)

      expect(OfflineCtor).toHaveBeenCalledWith(1, 16000, ASR_SAMPLE_RATE)
      expect(connect).toHaveBeenCalled()
      expect(start).toHaveBeenCalled()
      expect(out).toBe(rendered)
    })

    it('never asks for a zero-length render (guards a degenerate duration)', async () => {
      const OfflineCtor = vi.fn(() => ({
        createBufferSource: () => ({ connect: vi.fn(), start: vi.fn(), buffer: null }),
        destination: {},
        startRendering: async () => fakeBuffer([[0]], ASR_SAMPLE_RATE)
      }))
      vi.stubGlobal('OfflineAudioContext', OfflineCtor)

      await browserAudioDeps().resample(fakeBuffer([[]], 48000), ASR_SAMPLE_RATE)
      expect(OfflineCtor).toHaveBeenCalledWith(1, 1, ASR_SAMPLE_RATE)
    })
  })

  describe('downmixToMono', () => {
    it('returns the single channel untouched for mono input', () => {
      const mono = downmixToMono(fakeBuffer([[0.1, 0.2]], ASR_SAMPLE_RATE))
      expect(Array.from(mono)).toEqual([expect.closeTo(0.1, 5), expect.closeTo(0.2, 5)])
    })

    it('averages channels for stereo input', () => {
      const mono = downmixToMono(
        fakeBuffer(
          [
            [1, 0, -1],
            [0, 1, -1]
          ],
          ASR_SAMPLE_RATE
        )
      )
      expect(Array.from(mono)).toEqual([
        expect.closeTo(0.5, 5),
        expect.closeTo(0.5, 5),
        expect.closeTo(-1, 5)
      ])
    })
  })

  describe('decodeToAsrPcm', () => {
    it('produces mono Float32 PCM at the Whisper sample rate', async () => {
      const pcm = await decodeToAsrPcm(blobOfSize(64), deps())
      expect(pcm).toBeInstanceOf(Float32Array)
      expect(pcm.length).toBe(3)
    })

    it('resamples when the source rate differs, and skips the pass when it matches', async () => {
      const resample = vi.fn(async (_b: AudioBuffer, rate: number) =>
        fakeBuffer([[0.2, 0.2]], rate)
      )

      // 44.1 kHz source → one resample pass to 16 kHz.
      await decodeToAsrPcm(
        blobOfSize(64),
        deps({ decode: async () => fakeBuffer([[0.1, 0.2, 0.3]], 44100), resample })
      )
      expect(resample).toHaveBeenCalledWith(expect.anything(), ASR_SAMPLE_RATE)

      // Already 16 kHz → no resample at all.
      resample.mockClear()
      await decodeToAsrPcm(blobOfSize(64), deps({ resample }))
      expect(resample).not.toHaveBeenCalled()
    })

    it('downmixes a stereo source on the way through', async () => {
      const pcm = await decodeToAsrPcm(
        blobOfSize(64),
        deps({
          decode: async () =>
            fakeBuffer(
              [
                [1, 1],
                [0, 0]
              ],
              ASR_SAMPLE_RATE
            )
        })
      )
      expect(Array.from(pcm)).toEqual([expect.closeTo(0.5, 5), expect.closeTo(0.5, 5)])
    })

    it('rejects an empty file with a typed error', async () => {
      const error = await decodeToAsrPcm(blobOfSize(0), deps()).catch((e) => e)
      expect(error).toBeInstanceOf(AudioDecodeError)
      expect((error as AudioDecodeError).kind).toBe('empty')
    })

    it('rejects undecodable audio with a typed error (SB-R4.6)', async () => {
      const error = await decodeToAsrPcm(
        blobOfSize(64),
        deps({
          decode: async () => {
            throw new Error('EncodingError')
          }
        })
      ).catch((e) => e)
      expect(error).toBeInstanceOf(AudioDecodeError)
      expect((error as AudioDecodeError).kind).toBe('unsupported')
      expect((error as Error).message).toContain('EncodingError')
    })

    it('rejects a decode that yields zero samples', async () => {
      const error = await decodeToAsrPcm(
        blobOfSize(64),
        deps({ decode: async () => fakeBuffer([[]], ASR_SAMPLE_RATE) })
      ).catch((e) => e)
      expect((error as AudioDecodeError).kind).toBe('empty')
    })

    it('rejects an all-zero (silent) take instead of returning an empty transcript', async () => {
      const error = await decodeToAsrPcm(
        blobOfSize(64),
        deps({ decode: async () => fakeBuffer([[0, 0, 0, 0]], ASR_SAMPLE_RATE) })
      ).catch((e) => e)
      expect(error).toBeInstanceOf(AudioDecodeError)
      expect((error as AudioDecodeError).kind).toBe('silent')
    })
  })
})
