// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { VoiceDownloadNotices } from './VoiceDownloadNotices'
import { whisperDownloadFixture } from '../testSupport/hiveWhisperMock'

describe('VoiceDownloadNotices', () => {
  let settledListeners: Array<(download: unknown) => void>

  function renderNotices(): {
    onUseModel: ReturnType<typeof vi.fn>
    onRetry: ReturnType<typeof vi.fn>
    onOpenSettings: ReturnType<typeof vi.fn>
  } {
    const props = { onUseModel: vi.fn(), onRetry: vi.fn(), onOpenSettings: vi.fn() }
    render(createElement(VoiceDownloadNotices, props))
    return props
  }

  /** Pushes one ending from "main" through the settled channel. */
  function settle(over: Record<string, unknown>): void {
    act(() => settledListeners[0](whisperDownloadFixture(over)))
  }

  beforeEach(() => {
    settledListeners = []
    window.hive = {
      ...window.hive,
      whisper: {
        ...window.hive?.whisper,
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

  it('announces a completion and offers the model it just fetched', () => {
    const { onUseModel } = renderNotices()
    settle({ id: 'medium', status: 'done' })

    expect(screen.getByRole('status').textContent).toContain('medium está pronto')
    fireEvent.click(screen.getByRole('button', { name: 'Usar medium' }))
    expect(onUseModel).toHaveBeenCalledWith('medium')
  })

  /**
   * The failure is the one ending that still needs a decision from the user,
   * so it is the one that waits for them. Success needs none, and a card that
   * lingers after good news is clutter.
   */
  it('retires a success by itself, and keeps a failure until dismissed', () => {
    vi.useFakeTimers()
    renderNotices()

    settle({ id: 'medium', status: 'done' })
    act(() => void vi.advanceTimersByTime(10_000))
    expect(document.body.textContent).toBe('')

    settle({ id: 'medium', status: 'error', failure: { kind: 'offline', detail: 'x' } })
    act(() => void vi.advanceTimersByTime(60_000))
    expect(screen.getByRole('alert')).toBeTruthy()
  })

  it('names the cause of a failure, and resumes from what already arrived', () => {
    const { onRetry } = renderNotices()
    settle({
      id: 'medium',
      status: 'error',
      loaded: 512 * 1024 * 1024,
      failure: { kind: 'disk', detail: 'ENOSPC' }
    })

    expect(screen.getByRole('alert').textContent).toContain('espaço em disco')
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
    expect(onRetry).toHaveBeenCalledWith(expect.objectContaining({ id: 'medium' }))
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

  it('replaces the previous notice for the same model rather than stacking', () => {
    renderNotices()
    settle({ id: 'medium', status: 'error', failure: { kind: 'offline', detail: 'x' } })
    settle({ id: 'medium', status: 'done' })
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
