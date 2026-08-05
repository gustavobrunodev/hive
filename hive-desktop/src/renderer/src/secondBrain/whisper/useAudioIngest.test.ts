// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { audioErrorMessage, useAudioIngest, type AudioIngestQueue } from './useAudioIngest'
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
  queue: () => AudioIngestQueue
  add: (items: Array<{ blob: Blob; name: string }>) => void
  onTranscript: ReturnType<typeof vi.fn>
  whisper: WhisperEngine
} {
  const onTranscript = vi.fn()
  const { result } = renderHook(() => useAudioIngest(whisper, 'base', onTranscript))
  return {
    queue: () => result.current,
    add: (items) => act(() => result.current.add(items)),
    onTranscript,
    whisper
  }
}

const item = (name = 'a.wav'): { blob: Blob; name: string } => ({
  blob: new Blob(['audio']),
  name
})

describe('useAudioIngest (T17)', () => {
  afterEach(() => vi.clearAllMocks())

  it('decodes then transcribes, handing the text to the shared field', async () => {
    const pcm = new Float32Array([0.1, 0.2])
    decodeToWhisperPcm.mockResolvedValue(pcm)
    const { add, onTranscript, whisper, queue } = setup()

    add([item('reuniao.wav')])

    await waitFor(() => expect(onTranscript).toHaveBeenCalledWith('transcrito', 'reuniao.wav'))
    expect(whisper.transcribe).toHaveBeenCalledWith(pcm, { model: 'base' })
    await waitFor(() => expect(queue().jobs[0].status).toBe('done'))
  })

  it('is the SAME path for a recorded Blob as for an uploaded File', async () => {
    decodeToWhisperPcm.mockResolvedValue(new Float32Array([0.1]))
    const { add, onTranscript } = setup()

    add([
      { blob: new Blob(['take'], { type: 'audio/webm' }), name: 'Gravação 10:00' },
      { blob: new File(['upload'], 'a.wav'), name: 'a.wav' }
    ])

    await waitFor(() => expect(onTranscript).toHaveBeenCalledTimes(2))
    expect(decodeToWhisperPcm).toHaveBeenCalledTimes(2)
  })

  it('runs the queue one at a time — the engine is a single warm pipeline', async () => {
    decodeToWhisperPcm.mockResolvedValue(new Float32Array([0.1]))
    let running = 0
    let peak = 0
    const transcribe = vi.fn(async () => {
      peak = Math.max(peak, ++running)
      await new Promise((resolve) => setTimeout(resolve, 5))
      running--
      return 'ok'
    })
    const { add, onTranscript } = setup(engine(transcribe))

    add([item('a.wav'), item('b.wav'), item('c.wav')])

    await waitFor(() => expect(onTranscript).toHaveBeenCalledTimes(3))
    expect(peak).toBe(1)
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
      const { add, queue, onTranscript } = setup()
      add([item()])
      await waitFor(() => expect(queue().jobs[0].status).toBe('error'))
      expect(queue().jobs[0].failure?.message).toBe(message)
      expect(onTranscript).not.toHaveBeenCalled()
    }
  })

  it('one unreadable file does not stop the rest of the batch', async () => {
    decodeToWhisperPcm
      .mockRejectedValueOnce(new AudioDecodeError('unsupported', 'boom'))
      .mockResolvedValue(new Float32Array([0.1]))
    const { add, queue, onTranscript } = setup()

    add([item('quebrado.wav'), item('bom.wav')])

    await waitFor(() => expect(onTranscript).toHaveBeenCalledWith('transcrito', 'bom.wav'))
    expect(queue().jobs.map((job) => job.status)).toEqual(['error', 'done'])
  })

  it('keeps the engine error as a detail, not as the headline', async () => {
    decodeToWhisperPcm.mockResolvedValue(new Float32Array([0.1]))
    const { add, queue } = setup(engine(vi.fn().mockRejectedValue(new Error('session failed'))))

    add([item()])

    await waitFor(() => expect(queue().jobs[0].status).toBe('error'))
    expect(queue().jobs[0].failure).toEqual({
      message: 'Não foi possível transcrever o áudio.',
      detail: 'session failed'
    })
  })

  it('drops settled rows on request, leaving working ones alone', async () => {
    decodeToWhisperPcm.mockResolvedValue(new Float32Array([0.1]))
    const { add, queue } = setup()
    add([item('a.wav')])
    await waitFor(() => expect(queue().jobs[0].status).toBe('done'))

    act(() => queue().clearFinished())
    expect(queue().jobs).toEqual([])
  })

  describe('audioErrorMessage', () => {
    it('falls back to the generic transcription message for an unknown error', () => {
      expect(audioErrorMessage(new Error('???')).message).toBe(
        'Não foi possível transcrever o áudio.'
      )
      expect(audioErrorMessage('a string').message).toBe('Não foi possível transcrever o áudio.')
    })

    it('carries the engine wording through as a detail, so a report is possible', () => {
      expect(audioErrorMessage(new Error('MatMulNBits')).detail).toBe('MatMulNBits')
    })

    it('adds no detail to a decode failure — the message already says everything', () => {
      expect(audioErrorMessage(new AudioDecodeError('silent', 'x')).detail).toBeUndefined()
    })
  })
})
