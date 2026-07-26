// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { audioErrorMessage, useAudioIngest } from './useAudioIngest'
import { AudioDecodeError } from './audio'
import type { WhisperEngine } from './useWhisper'

const decodeToWhisperPcm = vi.hoisted(() => vi.fn())
vi.mock('./audio', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./audio')>()),
  decodeToWhisperPcm
}))

function engine(transcribe = vi.fn().mockResolvedValue('transcrito')): WhisperEngine {
  return { phase: { status: 'idle' }, transcribe, reset: vi.fn() }
}

function setup(whisper = engine()): {
  ingest: (blob: Blob) => Promise<void>
  onTranscript: ReturnType<typeof vi.fn>
  onError: ReturnType<typeof vi.fn>
  whisper: WhisperEngine
} {
  const onTranscript = vi.fn()
  const onError = vi.fn()
  const { result } = renderHook(() => useAudioIngest(whisper, 'base', onTranscript, onError))
  return { ingest: result.current, onTranscript, onError, whisper }
}

describe('useAudioIngest (T17)', () => {
  afterEach(() => vi.clearAllMocks())

  it('decodes then transcribes, handing the text to the shared field', async () => {
    const pcm = new Float32Array([0.1, 0.2])
    decodeToWhisperPcm.mockResolvedValue(pcm)
    const { ingest, onTranscript, onError, whisper } = setup()

    await ingest(new Blob(['audio']))

    expect(whisper.transcribe).toHaveBeenCalledWith(pcm, { model: 'base' })
    expect(onTranscript).toHaveBeenCalledWith('transcrito')
    // The prior error is cleared before a new attempt.
    expect(onError).toHaveBeenCalledWith(null)
  })

  it('is the SAME path for a recorded Blob as for an uploaded File', async () => {
    decodeToWhisperPcm.mockResolvedValue(new Float32Array([0.1]))
    const { ingest, onTranscript } = setup()

    await ingest(new Blob(['take'], { type: 'audio/webm' }))
    await ingest(new File(['upload'], 'a.wav'))

    expect(onTranscript).toHaveBeenCalledTimes(2)
    expect(decodeToWhisperPcm).toHaveBeenCalledTimes(2)
  })

  it('reports each decode failure with copy that says what went wrong (SB-R4.6)', async () => {
    const cases: Array<[ConstructorParameters<typeof AudioDecodeError>[0], string]> = [
      ['empty', 'O arquivo de áudio está vazio.'],
      ['silent', 'Não há som nesse áudio.'],
      ['unsupported', 'Não foi possível ler esse áudio. Tente wav, mp3, m4a, ogg ou webm.']
    ]
    for (const [kind, message] of cases) {
      vi.clearAllMocks()
      decodeToWhisperPcm.mockRejectedValue(new AudioDecodeError(kind, 'boom'))
      const { ingest, onError, onTranscript } = setup()
      await ingest(new Blob(['x']))
      expect(onError).toHaveBeenLastCalledWith(message)
      expect(onTranscript).not.toHaveBeenCalled()
    }
  })

  it('reports a transcription failure distinctly from a decode failure', async () => {
    decodeToWhisperPcm.mockResolvedValue(new Float32Array([0.1]))
    const { ingest, onError } = setup(engine(vi.fn().mockRejectedValue(new Error('session'))))

    await ingest(new Blob(['x']))
    expect(onError).toHaveBeenLastCalledWith('Não foi possível transcrever o áudio.')
  })

  describe('audioErrorMessage', () => {
    it('falls back to the generic transcription message for an unknown error', () => {
      expect(audioErrorMessage(new Error('???'))).toBe('Não foi possível transcrever o áudio.')
      expect(audioErrorMessage('a string')).toBe('Não foi possível transcrever o áudio.')
    })
  })
})
