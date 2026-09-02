// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { DownloadFailure, DownloadProgress } from './DownloadProgress'
import { asrDownloadFixture } from '../testSupport/hiveAsrMock'
import type { AsrDownload } from './downloadCopy'

/**
 * The two halves of a transfer's story on screen: how far it has got, and why
 * it stopped. Both exist because the first version could say neither — one
 * progress event per file, and "O download falhou." for every cause.
 */

const MB = 1024 * 1024

function progress(over: Partial<AsrDownload> = {}): ReturnType<typeof vi.fn> {
  const onCancel = vi.fn()
  render(
    createElement(DownloadProgress, { download: asrDownloadFixture(over), onCancel })
  )
  return onCancel
}

afterEach(cleanup)

describe('DownloadProgress', () => {
  it('states the percentage, the sizes, the rate and the time left', () => {
    progress({ loaded: 256 * MB, total: 512 * MB, bytesPerSecond: 2 * MB })
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('50')
    expect(screen.getByText('256 MB de 512 MB')).toBeTruthy()
    expect(screen.getByText('2,0 MB/s')).toBeTruthy()
    // Coarse on purpose: second-by-second precision invites watching, and it is
    // wrong anyway — the number comes off a rate that moves.
    expect(screen.getByText(/min restantes/)).toBeTruthy()
  })

  it('goes indeterminate before the index lands, rather than claiming 0%', () => {
    progress({ loaded: 0, total: 0, bytesPerSecond: 0, file: '' })
    const bar = screen.getByRole('progressbar')
    expect(bar.getAttribute('data-indeterminate')).toBe('true')
    expect(bar.getAttribute('aria-valuenow')).toBeNull()
    // No rate and no ETA: two samples do not exist yet, and inventing them is
    // how a "tempo restante" flickers between 4 and 40 minutes.
    expect(screen.queryByText(/MB\/s/)).toBeNull()
    expect(screen.queryByText(/restante/)).toBeNull()
  })

  it('cancels by asking its host, never by unmounting', () => {
    const onCancel = progress()
    fireEvent.click(screen.getByLabelText('Cancelar o download do modelo de voz'))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})

describe('DownloadFailure', () => {
  function failure(over: Partial<AsrDownload> = {}): {
    onRetry: ReturnType<typeof vi.fn>
    onDismiss: ReturnType<typeof vi.fn>
  } {
    const handlers = { onRetry: vi.fn(), onDismiss: vi.fn() }
    render(
      createElement(DownloadFailure, {
        download: asrDownloadFixture({ status: 'error', ...over }),
        ...handlers
      })
    )
    return handlers
  }

  it.each([
    ['offline', 'A conexão caiu no meio do download.'],
    ['server', 'O servidor dos modelos não respondeu agora.'],
    ['disk', 'Não há espaço em disco suficiente para o modelo.'],
    ['notFound', 'O modelo não está mais publicado onde o Hive o procura.']
  ] as const)('names %s as its own cause, with its own next step', (kind, sentence) => {
    // "O download falhou" was the same four words for a full disk, a dropped
    // Wi-Fi and a repo that moved — three problems with three different fixes.
    failure({ failure: { kind, detail: 'raw' } })
    expect(screen.getByText(sentence)).toBeTruthy()
  })

  it('offers to continue from the bytes already on disk', () => {
    const { onRetry } = failure({ loaded: 256 * MB, failure: { kind: 'offline', detail: 'x' } })
    expect(screen.getByText(/256 MB já baixados/)).toBeTruthy()
    fireEvent.click(screen.getByText('Continuar'))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('says "tentar de novo" when nothing arrived to continue from', () => {
    failure({ loaded: 0, failure: { kind: 'server', detail: 'x' } })
    expect(screen.getByText('Tentar de novo')).toBeTruthy()
  })

  it('offers no retry for an answer that will not change', () => {
    failure({ failure: { kind: 'notFound', detail: 'HTTP 404' } })
    expect(screen.queryByText(/Continuar|Tentar de novo/)).toBeNull()
  })

  it('dismisses without retrying', () => {
    const { onDismiss, onRetry } = failure({ failure: { kind: 'disk', detail: 'ENOSPC' } })
    fireEvent.click(screen.getByLabelText('Dispensar o aviso de falha do download'))
    expect(onDismiss).toHaveBeenCalledTimes(1)
    expect(onRetry).not.toHaveBeenCalled()
  })
})
