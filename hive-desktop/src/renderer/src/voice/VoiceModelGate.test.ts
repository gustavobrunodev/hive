// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { VoiceModelGate } from './VoiceModelGate'
import {
  asrDownloadFixture,
  asrReadinessFixture,
  createHiveAsrMock
} from '../testSupport/hiveAsrMock'

/**
 * The gate, with the choosing taken out.
 *
 * Most of what this file used to assert was about a chooser: that it offered
 * the three lightest multilingual models, preselected the one the probe
 * recommended, explained why, let the reader override it, and refused to render
 * an empty picker. None of it survives M29, and none of it is a loss — the
 * questions were forced by Whisper's trade between speed and accuracy, and one
 * model that is both leaves nothing to ask.
 *
 * What survives is everything about the gate being a **way in**: that the
 * download starts here, keeps running when this closes, reports its own
 * failure, and hands the take back.
 */

describe('VoiceModelGate', () => {
  let pushDownloads: (list: unknown[]) => void
  let settle: (download: unknown) => void

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
    settle = () => {}
    window.hive = {
      ...window.hive,
      asr: {
        ...createHiveAsrMock(),
        onDownloads: vi.fn((listener: (list: unknown[]) => void) => {
          pushDownloads = (list) => act(() => listener(list))
          return () => {}
        }),
        onDownloadSettled: vi.fn((listener: (download: unknown) => void) => {
          settle = (download) => act(() => listener(download))
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

  it('states nothing until main has answered', () => {
    vi.mocked(window.hive.asr.readiness).mockReturnValue(new Promise(() => {}))
    renderGate()
    // A size that appears and then changes under the reader is worse than one
    // that arrives.
    expect(screen.queryByText(/Baixar e gravar/)).toBeNull()
    expect(screen.getByText('Avaliando este computador…')).toBeTruthy()
  })

  it('names the cost before asking for it', async () => {
    renderGate()
    // 671 MB, through the pt-BR formatter's 1 GB switch.
    expect(await screen.findByText('Baixar e gravar · 671 MB')).toBeTruthy()
  })

  it('starts the download in main', async () => {
    renderGate()
    fireEvent.click(await screen.findByText('Baixar e gravar · 671 MB'))
    expect(window.hive.asr.startDownload).toHaveBeenCalledTimes(1)
  })

  it('replaces the offer with real progress once bytes are moving', async () => {
    renderGate()
    await screen.findByText('Baixar e gravar · 671 MB')
    pushDownloads([asrDownloadFixture()])
    expect(screen.queryByText('Baixar e gravar · 671 MB')).toBeNull()
    expect(screen.getByRole('progressbar')).toBeTruthy()
    // The promise that makes closing safe, stated while it matters.
    expect(screen.getByText(/o download continua em segundo plano/)).toBeTruthy()
  })

  it('cancels by id rather than by closing anything', async () => {
    renderGate()
    await screen.findByText('Baixar e gravar · 671 MB')
    pushDownloads([asrDownloadFixture()])
    fireEvent.click(screen.getByText('Cancelar'))
    expect(window.hive.asr.cancelDownload).toHaveBeenCalledWith('parakeet-tdt-0.6b-v3-int8')
  })

  it('names a failure and retries it in place', async () => {
    renderGate()
    await screen.findByText('Baixar e gravar · 671 MB')
    pushDownloads([
      asrDownloadFixture({
        status: 'error',
        loaded: 256 * 1024 * 1024,
        failure: { kind: 'offline', detail: 'fetch failed' }
      })
    ])
    // The cause, not "o download falhou" — and the bytes already on disk, which
    // are what make "Continuar" honest.
    expect(screen.getByText('A conexão caiu no meio do download.')).toBeTruthy()
    fireEvent.click(screen.getByText('Continuar'))
    expect(window.hive.asr.startDownload).toHaveBeenCalledTimes(1)
  })

  it('dismisses a failure without retrying it', async () => {
    renderGate()
    await screen.findByText('Baixar e gravar · 671 MB')
    pushDownloads([
      asrDownloadFixture({ status: 'error', failure: { kind: 'disk', detail: 'no space' } })
    ])
    fireEvent.click(screen.getByLabelText('Dispensar o aviso de falha do download'))
    expect(window.hive.asr.dismissDownload).toHaveBeenCalledWith('parakeet-tdt-0.6b-v3-int8')
    expect(window.hive.asr.startDownload).not.toHaveBeenCalled()
  })

  it('offers a way through to the settings', async () => {
    const { onOpenSettings } = renderGate()
    fireEvent.click(await screen.findByText('Ver detalhes'))
    expect(onOpenSettings).toHaveBeenCalledTimes(1)
  })

  it('re-reads readiness when a download completes', async () => {
    renderGate()
    await screen.findByText('Baixar e gravar · 671 MB')
    expect(window.hive.asr.readiness).toHaveBeenCalledTimes(1)

    settle({ id: 'parakeet-tdt-0.6b-v3-int8', status: 'done' })
    // Main answers readiness on request, so the request has to be made — this
    // is what lets `useVoiceGate` close the dialog and run the take.
    await waitFor(() => expect(window.hive.asr.readiness).toHaveBeenCalledTimes(2))
  })

  it('ignores an ending that is not a completion', async () => {
    renderGate()
    await screen.findByText('Baixar e gravar · 671 MB')
    settle({ id: 'parakeet-tdt-0.6b-v3-int8', status: 'cancelled' })
    await act(async () => {})
    expect(window.hive.asr.readiness).toHaveBeenCalledTimes(1)
  })

  it('shows the installed state without a download button', async () => {
    vi.mocked(window.hive.asr.readiness).mockResolvedValue(asrReadinessFixture({ installed: true }))
    renderGate()
    // The gate is only opened when the model is missing, but readiness can land
    // *after* it opens — the offer must not stay on screen once it is stale.
    await screen.findByText(/Ver detalhes/)
    expect(screen.queryByRole('progressbar')).toBeNull()
  })
})
