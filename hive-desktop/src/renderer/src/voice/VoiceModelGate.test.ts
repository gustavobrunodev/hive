// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { VoiceModelGate } from './VoiceModelGate'
import {
  createHiveWhisperMock,
  whisperDownloadFixture,
  whisperModelFixture
} from '../testSupport/hiveWhisperMock'

const HARDWARE = {
  recommendedId: 'base' as const,
  reason: 'noGpu' as const,
  gpu: false,
  ramGB: 16,
  cores: 8
}

const CATALOG = [
  whisperModelFixture({
    id: 'tiny',
    params: '39 M',
    relativeSpeed: '~10x',
    sizeMB: { fp32: 144, q8: 39 },
    downloaded: false,
    downloadedVariant: null
  }),
  whisperModelFixture({
    id: 'base',
    downloaded: false,
    downloadedVariant: null
  }),
  whisperModelFixture({
    id: 'small',
    params: '244 M',
    relativeSpeed: '~4x',
    sizeMB: { fp32: 923, q8: 238 },
    downloaded: false,
    downloadedVariant: null
  }),
  whisperModelFixture({
    id: 'medium.en',
    params: '769 M',
    relativeSpeed: '~2x',
    sizeMB: { fp32: 2916, q8: 740 },
    multilingual: false,
    downloaded: false,
    downloadedVariant: null
  })
]

describe('VoiceModelGate', () => {
  let pushDownloads: (list: unknown[]) => void

  function renderGate(open = true): {
    onOpenChange: ReturnType<typeof vi.fn>
    onOpenSettings: ReturnType<typeof vi.fn>
  } {
    const props = { open, onOpenChange: vi.fn(), onOpenSettings: vi.fn() }
    render(createElement(VoiceModelGate, props))
    return props
  }

  beforeEach(() => {
    pushDownloads = () => {}
    window.hive = {
      ...window.hive,
      whisper: {
        ...createHiveWhisperMock(),
        listModels: vi.fn(async () => CATALOG),
        preference: vi.fn(async () => ({
          id: null,
          auto: true,
          installed: [],
          recommendation: HARDWARE
        })),
        onDownloads: vi.fn((listener: (list: unknown[]) => void) => {
          pushDownloads = (list) => act(() => listener(list))
          return () => {}
        })
      }
    } as typeof window.hive
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('renders nothing while it is closed', () => {
    renderGate(false)
    expect(document.body.textContent).toBe('')
  })

  it('states nothing until the catalog and the probe have both answered', () => {
    vi.mocked(window.hive.whisper.listModels).mockReturnValue(new Promise(() => {}))
    renderGate()
    expect(screen.getByText('Avaliando este computador…')).toBeTruthy()
    expect(screen.queryByRole('radio')).toBeNull()
  })

  /**
   * Three, not ten: the choice at this moment is "how long am I willing to wait
   * right now", and a reader with a microphone in hand is not shopping.
   */
  it('offers the three lightest multilingual models, and no English-only build', async () => {
    renderGate()
    const options = await screen.findAllByRole('radio')
    expect(options).toHaveLength(3)
    for (const id of ['tiny', 'base', 'small']) {
      expect(options.some((option) => option.textContent?.startsWith(id))).toBe(true)
    }
    expect(screen.queryByText('medium.en')).toBeNull()
  })

  it('preselects the model this machine should run, and says why', async () => {
    renderGate()
    const base = await screen.findByRole('radio', { name: /base/ })
    expect(base.getAttribute('aria-checked')).toBe('true')
    expect(screen.getByText('É o que o Hive recomenda para este computador.')).toBeTruthy()
  })

  it('lets the reader override the recommendation, and drops the note when they do', async () => {
    renderGate()
    fireEvent.click(await screen.findByRole('radio', { name: /small/ }))

    await waitFor(() =>
      expect(screen.getByRole('radio', { name: /small/ }).getAttribute('aria-checked')).toBe('true')
    )
    expect(screen.queryByText('É o que o Hive recomenda para este computador.')).toBeNull()
    expect(screen.getByRole('button', { name: /Baixar e gravar · 923 MB/ })).toBeTruthy()
  })

  it('starts the download in main, at the precision this device needs', async () => {
    renderGate()
    fireEvent.click(await screen.findByRole('button', { name: /Baixar e gravar/ }))
    // fp32: this jsdom has no WebGPU adapter to ask.
    expect(window.hive.whisper.startDownload).toHaveBeenCalledWith('base', 'fp32')
  })

  it('replaces the choice with real progress once bytes are moving', async () => {
    renderGate()
    await screen.findByRole('button', { name: /Baixar e gravar/ })
    pushDownloads([whisperDownloadFixture({ id: 'base' })])

    expect(screen.getByText('512 MB de 3,0 GB')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Baixar e gravar/ })).toBeNull()
    // …and it says the wait is safe to walk away from.
    expect(screen.getByText(/o download continua em segundo plano/)).toBeTruthy()
  })

  it('cancels by id rather than by closing anything', async () => {
    renderGate()
    await screen.findByRole('button', { name: /Baixar e gravar/ })
    pushDownloads([whisperDownloadFixture({ id: 'base' })])

    fireEvent.click(screen.getByLabelText('Cancelar o download de base'))
    expect(window.hive.whisper.cancelDownload).toHaveBeenCalledWith('base')
  })

  it('names a failure and retries it in place', async () => {
    renderGate()
    await screen.findByRole('button', { name: /Baixar e gravar/ })
    pushDownloads([
      whisperDownloadFixture({
        id: 'base',
        status: 'error',
        loaded: 0,
        failure: { kind: 'server', detail: 'HTTP 503' }
      })
    ])

    expect(screen.getByRole('alert').textContent).toContain('servidor dos modelos')
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(window.hive.whisper.startDownload).toHaveBeenCalledWith('base', 'fp32')
  })

  it('dismisses a failure without retrying it', async () => {
    renderGate()
    await screen.findByRole('button', { name: /Baixar e gravar/ })
    pushDownloads([
      whisperDownloadFixture({
        id: 'base',
        status: 'error',
        loaded: 0,
        failure: { kind: 'offline', detail: 'fetch failed' }
      })
    ])

    fireEvent.click(screen.getByLabelText('Dispensar o aviso de falha de base'))
    expect(window.hive.whisper.dismissDownload).toHaveBeenCalledWith('base')
    expect(window.hive.whisper.startDownload).not.toHaveBeenCalled()
  })

  it('offers a way out to the full library', async () => {
    const { onOpenSettings } = renderGate()
    fireEvent.click(await screen.findByRole('button', { name: 'Ver todos os modelos' }))
    expect(onOpenSettings).toHaveBeenCalled()
  })

  /**
   * A download that lands does not re-resolve the preference on its own — main
   * answers `whisper:preference` on request. Without this the gate would sit
   * open on a machine that now has a model.
   */
  it('re-reads the catalog and the preference when a download completes', async () => {
    // Typed off the bridge, not `unknown`: the mocked implementation has to be
    // assignable to the real signature.
    type Settled = Parameters<Window['hive']['whisper']['onDownloadSettled']>[0]
    let settle: Settled = () => {}
    vi.mocked(window.hive.whisper.onDownloadSettled).mockImplementation((listener) => {
      settle = listener
      return () => {}
    })
    renderGate()
    await screen.findByRole('button', { name: /Baixar e gravar/ })
    const before = vi.mocked(window.hive.whisper.preference).mock.calls.length

    await act(async () => settle(whisperDownloadFixture({ id: 'base', status: 'done' })))

    await waitFor(() =>
      expect(vi.mocked(window.hive.whisper.preference).mock.calls.length).toBeGreaterThan(before)
    )
    expect(window.hive.whisper.listModels).toHaveBeenCalledTimes(2)
  })

  it('says so, instead of offering an empty chooser, when the catalog has nothing', async () => {
    vi.mocked(window.hive.whisper.listModels).mockResolvedValue([])
    const { onOpenSettings } = renderGate()
    expect(await screen.findByText('Nenhum modelo pôde ser oferecido aqui.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Ver todos os modelos' }))
    expect(onOpenSettings).toHaveBeenCalled()
  })
})
