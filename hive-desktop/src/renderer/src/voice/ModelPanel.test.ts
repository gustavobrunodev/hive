// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ModelPanel } from './ModelPanel'
import { asrDownloadFixture, asrReadinessFixture } from '../testSupport/hiveAsrMock'
import type { AsrDownloadsState } from './useAsrDownloads'
import type { AsrDownload } from './downloadCopy'

/**
 * The model, as one row. Four presentations and one action each — which is the
 * whole surface now that there is nothing to choose between.
 */

const MODEL_ID = 'parakeet-tdt-0.6b-v3-int8'

function downloads(over: Partial<AsrDownloadsState> = {}): AsrDownloadsState {
  return { byId: {}, busy: false, start: vi.fn(), cancel: vi.fn(), dismiss: vi.fn(), ...over }
}

function show(options: { installed?: boolean; download?: AsrDownload } = {}): {
  state: AsrDownloadsState
  onDelete: ReturnType<typeof vi.fn>
} {
  const state = downloads(
    options.download
      ? { byId: { [MODEL_ID]: options.download }, busy: options.download.status === 'downloading' }
      : {}
  )
  const onDelete = vi.fn()
  render(
    createElement(ModelPanel, {
      readiness: asrReadinessFixture({ installed: options.installed ?? false }),
      downloads: state,
      onDelete
    })
  )
  return { state, onDelete }
}

afterEach(cleanup)

describe('ModelPanel', () => {
  it('states what the download buys before asking for it', () => {
    show()
    expect(screen.getByText('600 M de parâmetros · 25 idiomas · 671 MB')).toBeTruthy()
    expect(screen.getByText('Baixar · 671 MB')).toBeTruthy()
    expect(screen.queryByText('Baixado')).toBeNull()
  })

  it('starts the download in main', () => {
    const { state } = show()
    fireEvent.click(screen.getByText('Baixar · 671 MB'))
    expect(state.start).toHaveBeenCalledTimes(1)
  })

  it('offers removal, not a second download, once the model is here', () => {
    show({ installed: true })
    expect(screen.getByText('Baixado')).toBeTruthy()
    expect(screen.getByText('Excluir do computador')).toBeTruthy()
    expect(screen.queryByText(/Baixar ·/)).toBeNull()
  })

  it('asks its host to confirm the delete rather than doing it', () => {
    const { onDelete } = show({ installed: true })
    fireEvent.click(screen.getByText('Excluir do computador'))
    // The undo is a 671 MB download, so the confirmation is the host's job and
    // this row never deletes on its own.
    expect(onDelete).toHaveBeenCalledTimes(1)
  })

  it('replaces the action with real progress while bytes are moving', () => {
    const { state } = show({ download: asrDownloadFixture() })
    expect(screen.queryByText(/Baixar ·/)).toBeNull()
    expect(screen.getByRole('progressbar')).toBeTruthy()

    fireEvent.click(screen.getByText('Cancelar'))
    expect(state.cancel).toHaveBeenCalledWith(MODEL_ID)
  })

  it('names a failure, and retries or dismisses it in place', () => {
    const { state } = show({
      download: asrDownloadFixture({
        status: 'error',
        loaded: 256 * 1024 * 1024,
        failure: { kind: 'offline', detail: 'fetch failed' }
      })
    })
    // The cause, not "o download falhou" — and the bytes already on disk, which
    // are what make "Continuar" honest.
    expect(screen.getByText('A conexão caiu no meio do download.')).toBeTruthy()

    fireEvent.click(screen.getByText('Continuar'))
    expect(state.start).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByLabelText('Dispensar o aviso de falha do download'))
    expect(state.dismiss).toHaveBeenCalledWith(MODEL_ID)
  })

  it('refuses a second start while one is already running', () => {
    render(
      createElement(ModelPanel, {
        readiness: asrReadinessFixture({ installed: false }),
        // Busy without a record of its own: a transfer this row is not showing
        // is still a transfer, and starting a second one into the same
        // directory is what the manager's idempotency exists to prevent.
        downloads: downloads({ busy: true }),
        onDelete: vi.fn()
      })
    )
    expect((screen.getByText('Baixar · 671 MB').closest('button') as HTMLButtonElement).disabled).toBe(
      true
    )
  })
})
