// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { VoiceDownloadNotices } from './VoiceDownloadNotices'
import { asrDownloadFixture } from '../testSupport/hiveAsrMock'

describe('VoiceDownloadNotices', () => {
  let settledListeners: Array<(download: unknown) => void>

  function renderNotices(): {
    onRetry: ReturnType<typeof vi.fn>
    onOpenSettings: ReturnType<typeof vi.fn>
  } {
    const props = { onRetry: vi.fn(), onOpenSettings: vi.fn() }
    render(createElement(VoiceDownloadNotices, props))
    return props
  }

  /** Pushes one ending from "main" through the settled channel. */
  function settle(over: Record<string, unknown>): void {
    act(() => settledListeners[0](asrDownloadFixture(over)))
  }

  beforeEach(() => {
    settledListeners = []
    window.hive = {
      ...window.hive,
      asr: {
        ...window.hive?.asr,
        onDownloadSettled: vi.fn((listener: (download: unknown) => void) => {
          settledListeners.push(listener)
          return () => {}
        })
      }
    } as typeof window.hive
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('shows nothing at all while no download has ended', () => {
    renderNotices()
    expect(document.body.textContent).toBe('')
  })

  it('announces a completion, and asks nothing of the reader', () => {
    renderNotices()
    settle({ status: 'done' })

    expect(screen.getByRole('status').textContent).toContain('O modelo de voz está pronto')
    // The success card used to offer "Usar <modelo>", which pinned the finished
    // download as the one to transcribe with. With one model the news *is* the
    // whole message, so there is no action to press.
    expect(screen.queryAllByRole('button', { name: /^Usar/ })).toHaveLength(0)
  })

  /**
   * The failure is the one ending that still needs a decision from the user,
   * so it is the one that waits for them. Success needs none, and a card that
   * lingers after good news is clutter.
   */
  it('retires a success by itself, and keeps a failure until dismissed', () => {
    vi.useFakeTimers()
    renderNotices()

    settle({ status: 'done' })
    act(() => void vi.advanceTimersByTime(10_000))
    expect(document.body.textContent).toBe('')

    settle({
      status: 'error',
      failure: { kind: 'offline', detail: 'x' }
    })
    act(() => void vi.advanceTimersByTime(60_000))
    expect(screen.getByRole('alert')).toBeTruthy()
  })

  it('names the cause of a failure, and resumes from what already arrived', () => {
    const { onRetry } = renderNotices()
    settle({
      status: 'error',
      loaded: 512 * 1024 * 1024,
      failure: { kind: 'disk', detail: 'ENOSPC' }
    })

    expect(screen.getByRole('alert').textContent).toContain('espaço em disco')
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('offers no retry for a failure that will answer the same way next time', () => {
    renderNotices()
    settle({ status: 'error', failure: { kind: 'notFound', detail: 'HTTP 404' } })
    expect(screen.queryByRole('button', { name: /Continuar|Tentar de novo/ })).toBeNull()
    expect(screen.getByRole('button', { name: 'Abrir Voz e transcrição' })).toBeTruthy()
  })

  /** A cancel was the user's own doing, a second ago, by hand. */
  it('says nothing about a download the user cancelled themselves', () => {
    renderNotices()
    settle({ status: 'cancelled' })
    expect(document.body.textContent).toBe('')
  })

  it('replaces the previous notice rather than stacking', () => {
    renderNotices()
    settle({
      status: 'error',
      failure: { kind: 'offline', detail: 'x' }
    })
    settle({ status: 'done' })
    expect(screen.queryAllByRole('alert')).toHaveLength(0)
    expect(screen.getAllByRole('status')).toHaveLength(1)
  })

  it('dismisses on request', () => {
    renderNotices()
    settle({ status: 'error', failure: { kind: 'offline', detail: 'x' } })
    fireEvent.click(screen.getByLabelText('Dispensar este aviso'))
    expect(document.body.textContent).toBe('')
  })
})
