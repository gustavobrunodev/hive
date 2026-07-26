// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AudioFileTab } from './AudioFileTab'
import { phaseCaption } from './phaseCaption'
import { AudioDecodeError } from './audio'
import type { WhisperPhase } from './useWhisper'

const decodeToWhisperPcm = vi.hoisted(() => vi.fn())
vi.mock('./audio', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./audio')>()),
  decodeToWhisperPcm
}))

function renderTab(
  overrides: {
    phase?: WhisperPhase
    transcribe?: ReturnType<typeof vi.fn>
    onTranscript?: ReturnType<typeof vi.fn>
    onError?: ReturnType<typeof vi.fn>
    onStart?: ReturnType<typeof vi.fn>
  } = {}
): {
  transcribe: ReturnType<typeof vi.fn>
  onTranscript: ReturnType<typeof vi.fn>
  onError: ReturnType<typeof vi.fn>
  onStart: ReturnType<typeof vi.fn>
  input: HTMLInputElement
} {
  const transcribe = overrides.transcribe ?? vi.fn().mockResolvedValue('transcrito')
  const onTranscript = overrides.onTranscript ?? vi.fn()
  const onError = overrides.onError ?? vi.fn()
  const onStart = overrides.onStart ?? vi.fn()
  render(
    createElement(AudioFileTab, {
      phase: overrides.phase ?? { status: 'idle' },
      transcribe,
      onTranscript,
      onError,
      onStart
    })
  )
  return {
    transcribe,
    onTranscript,
    onError,
    onStart,
    input: screen.getByLabelText('Escolher arquivo de áudio') as HTMLInputElement
  }
}

function pick(input: HTMLInputElement, file = new File(['x'], 'meeting.wav')): void {
  Object.defineProperty(input, 'files', { value: [file], configurable: true })
  fireEvent.change(input)
}

describe('AudioFileTab (T15)', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('decodes then transcribes the picked file, filling the shared field (SB-R4.3/4.5)', async () => {
    const pcm = new Float32Array([0.1, 0.2])
    decodeToWhisperPcm.mockResolvedValue(pcm)
    const { input, transcribe, onTranscript, onStart } = renderTab()

    pick(input)

    await waitFor(() => expect(onTranscript).toHaveBeenCalledWith('transcrito'))
    expect(onStart).toHaveBeenCalled()
    expect(transcribe).toHaveBeenCalledWith(pcm)
  })

  it('ignores a cancelled picker (no file chosen)', async () => {
    const { input, onStart } = renderTab()
    Object.defineProperty(input, 'files', { value: [], configurable: true })
    fireEvent.change(input)
    expect(onStart).not.toHaveBeenCalled()
  })

  it('reports each decode failure with copy that says what actually went wrong (SB-R4.6)', async () => {
    const cases: Array<[ConstructorParameters<typeof AudioDecodeError>[0], string]> = [
      ['empty', 'O arquivo de áudio está vazio.'],
      ['silent', 'Não há som nesse áudio.'],
      ['unsupported', 'Não foi possível ler esse áudio. Tente wav, mp3, m4a, ogg ou webm.']
    ]
    for (const [kind, message] of cases) {
      cleanup()
      vi.clearAllMocks()
      decodeToWhisperPcm.mockRejectedValue(new AudioDecodeError(kind, 'boom'))
      const { input, onError } = renderTab()
      pick(input)
      await waitFor(() => expect(onError).toHaveBeenCalledWith(message))
    }
  })

  it('reports a transcription failure distinctly from a decode failure', async () => {
    decodeToWhisperPcm.mockResolvedValue(new Float32Array([0.1]))
    const { input, onError } = renderTab({
      transcribe: vi.fn().mockRejectedValue(new Error('session failed'))
    })
    pick(input)
    await waitFor(() =>
      expect(onError).toHaveBeenCalledWith('Não foi possível transcrever o áudio.')
    )
  })

  it('disables the picker while the engine is busy, and re-enables when idle', () => {
    const { input } = renderTab({ phase: { status: 'transcribing' } })
    expect((screen.getByText('Escolher arquivo de áudio') as HTMLButtonElement).disabled).toBe(true)
    expect(input).toBeTruthy()

    cleanup()
    renderTab({ phase: { status: 'error', message: 'x' } })
    // An error is a resting state — the user must be able to retry.
    expect((screen.getByText('Escolher arquivo de áudio') as HTMLButtonElement).disabled).toBe(
      false
    )
  })

  it('clicking the styled button opens the hidden file input', () => {
    const { input } = renderTab()
    const click = vi.spyOn(input, 'click')
    fireEvent.click(screen.getByText('Escolher arquivo de áudio'))
    expect(click).toHaveBeenCalled()
  })

  describe('phaseCaption', () => {
    it('narrates download, load and transcribe, and says nothing when idle', () => {
      expect(phaseCaption({ status: 'downloading', pct: 40, file: 'x' })).toBe(
        'Baixando o modelo… 40%'
      )
      expect(phaseCaption({ status: 'loading', pct: 70 })).toBe('Preparando o modelo… 70%')
      expect(phaseCaption({ status: 'transcribing' })).toBe('Transcrevendo…')
      expect(phaseCaption({ status: 'idle' })).toBeNull()
      expect(phaseCaption({ status: 'error', message: 'x' })).toBeNull()
    })

    it('renders the live caption as a status region', () => {
      renderTab({ phase: { status: 'downloading', pct: 12, file: 'config.json' } })
      expect(screen.getByRole('status').textContent).toBe('Baixando o modelo… 12%')
    })
  })
})
