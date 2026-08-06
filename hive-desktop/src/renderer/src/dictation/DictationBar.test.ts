// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { DictationBar, type DictationBarProps } from './DictationBar'
import { strings } from '../i18n'
import type { DictationPhase } from './phase'

/**
 * Every state in design.md §3, rendered. The transport is presentational, so
 * this is where its contract lives: the right copy, the right affordances, and
 * the roles that let a take be followed without sight (VP-R4.5).
 */

function show(overrides: Partial<DictationBarProps> = {}): {
  onFinish: ReturnType<typeof vi.fn>
  onDiscard: ReturnType<typeof vi.fn>
  onRetry: ReturnType<typeof vi.fn>
  onRequestMic: ReturnType<typeof vi.fn>
} {
  const handlers = {
    onFinish: vi.fn(),
    onDiscard: vi.fn(),
    onRetry: vi.fn(),
    onRequestMic: vi.fn()
  }
  render(
    createElement(DictationBar, {
      phase: { status: 'listening', seconds: 7, silentMs: 0, pending: 0 },
      levels: [0.2, 0.8],
      failure: null,
      ...handlers,
      ...overrides
    })
  )
  return handlers
}

const listening = (
  overrides: Partial<Extract<DictationPhase, { status: 'listening' }>> = {}
): DictationPhase => ({ status: 'listening', seconds: 7, silentMs: 0, pending: 0, ...overrides })

afterEach(cleanup)

describe('DictationBar', () => {
  it('renders nothing at all when dictation is idle', () => {
    const { container } = render(
      createElement(DictationBar, {
        phase: { status: 'idle' },
        levels: [],
        failure: null,
        onFinish: vi.fn(),
        onDiscard: vi.fn(),
        onRetry: vi.fn(),
        onRequestMic: vi.fn()
      })
    )
    expect(container.firstChild).toBeNull()
  })

  it('shows the clock, the meter, the status and both controls while listening', () => {
    show()
    expect(screen.getByRole('timer').textContent).toContain('00:07')
    expect(screen.getByRole('meter')).not.toBeNull()
    expect(screen.getByRole('status').textContent).toContain(strings.dictation.listening)
    expect(screen.getByRole('button', { name: strings.dictation.discard })).not.toBeNull()
    expect(screen.getByRole('button', { name: strings.dictation.finish })).not.toBeNull()
  })

  it('announces phase changes politely rather than interrupting', () => {
    show()
    expect(screen.getByRole('status').getAttribute('aria-live')).toBe('polite')
  })

  it('names the elapsed timer, so a screen reader does not read a bare number', () => {
    show()
    expect(screen.getByRole('timer').getAttribute('aria-label')).toBe(
      strings.dictation.elapsed('00:07')
    )
  })

  it('counts the queue instead of showing provisional words (D-VP-8)', () => {
    show({ phase: listening({ pending: 2 }) })
    expect(screen.getByRole('status').textContent).toContain('2 trechos na fila')
  })

  it('promises the audio is kept while the engine prepares (VP-R3.2)', () => {
    show({
      phase: {
        status: 'preparing',
        seconds: 3,
        silentMs: 0,
        pending: 1,
        engine: { status: 'downloading', pct: 41, file: 'encoder.onnx' }
      }
    })
    const status = screen.getByRole('status')
    expect(status.textContent).toContain('41%')
    expect(status.textContent).toContain(strings.dictation.preparingKeep)
    // Still capturing: the clock and the meter say the microphone is live.
    expect(screen.getByRole('timer').textContent).toContain('00:03')
    expect(screen.getByRole('meter')).not.toBeNull()
  })

  it('flattens the meter when it is hearing nothing (VP-R4.1)', () => {
    show({ phase: listening({ silentMs: 4000 }), levels: [0.9, 0.9] })
    expect(screen.getByRole('status').textContent).toContain(strings.dictation.silent)
    // The bars do not keep bouncing on stale data — the meter is the one thing
    // on screen that answers "is this hearing me?".
    expect(screen.getByRole('meter').getAttribute('data-signal')).toBe('none')
  })

  it('counts down before stopping on its own (VP-R4.2)', () => {
    show({ phase: listening({ silentMs: 6000 }) })
    expect(screen.getByRole('status').textContent).toContain('Encerrando em 2')
  })

  it('shows the drain and drops the transport controls when finalizing', () => {
    show({ phase: { status: 'finalizing', pending: 2 } })
    expect(screen.getByRole('status').textContent).toContain('Transcrevendo 2 trechos')
    expect(screen.queryByRole('timer')).toBeNull()
    expect(screen.queryByRole('meter')).toBeNull()
    expect(screen.queryByRole('button', { name: strings.dictation.finish })).toBeNull()
  })

  it('distinguishes a refused microphone from a missing one, and retries the DEVICE', () => {
    const denied = show({ phase: { status: 'error', kind: 'denied' } })
    expect(screen.getByRole('status').textContent).toContain(strings.dictation.denied)
    fireEvent.click(screen.getByRole('button', { name: strings.dictation.retry }))
    expect(denied.onRequestMic).toHaveBeenCalledTimes(1)
    expect(denied.onRetry).not.toHaveBeenCalled()

    cleanup()
    const unavailable = show({ phase: { status: 'error', kind: 'unavailable' } })
    expect(screen.getByRole('status').textContent).toContain(strings.dictation.unavailable)
    fireEvent.click(screen.getByRole('button', { name: strings.dictation.retry }))
    expect(unavailable.onRequestMic).toHaveBeenCalledTimes(1)
  })

  it('shows a mid-take segment failure without ending the take (VP-R4.4)', () => {
    const handlers = show({ phase: listening(), failure: 'sessão falhou' })
    // The clock and the meter are still there: capture did not stop.
    expect(screen.getByRole('timer')).not.toBeNull()
    expect(screen.getByRole('meter')).not.toBeNull()

    fireEvent.click(screen.getByRole('button', { name: strings.dictation.retry }))
    // The SEGMENT is retried, not the microphone.
    expect(handlers.onRetry).toHaveBeenCalledTimes(1)
    expect(handlers.onRequestMic).not.toHaveBeenCalled()
  })

  it('keeps the failure and its retry after the take is over', () => {
    const handlers = show({
      phase: { status: 'error', kind: 'engine', message: 'modelo sumiu' },
      failure: 'modelo sumiu'
    })
    const status = screen.getByRole('status')
    expect(status.textContent).toContain('modelo sumiu')
    // The promise that makes the retry worth offering.
    expect(status.textContent).toContain(strings.dictation.errorKeep)
    fireEvent.click(screen.getByRole('button', { name: strings.dictation.retry }))
    expect(handlers.onRetry).toHaveBeenCalledTimes(1)
  })

  it('wires Concluir and Descartar', () => {
    const handlers = show()
    fireEvent.click(screen.getByRole('button', { name: strings.dictation.finish }))
    expect(handlers.onFinish).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: strings.dictation.discard }))
    expect(handlers.onDiscard).toHaveBeenCalledTimes(1)
  })

  it('offers no retry when there is nothing to retry', () => {
    show()
    expect(screen.queryByRole('button', { name: strings.dictation.retry })).toBeNull()
  })

  // VP-R6.4: the send control stays the row's only accent-filled element, so
  // every control here is a ghost button.
  it('renders its controls as ghost buttons, never as a second filled call to action', () => {
    const { container } = render(
      createElement(DictationBar, {
        phase: listening(),
        levels: [],
        failure: null,
        onFinish: vi.fn(),
        onDiscard: vi.fn(),
        onRetry: vi.fn(),
        onRequestMic: vi.fn()
      })
    )
    const buttons = container.querySelectorAll('button')
    expect(buttons.length).toBeGreaterThan(0)
    for (const button of buttons) expect(button.classList.contains('wb-dictation-btn')).toBe(true)
  })

  it('exposes the phase as a data attribute, for the state-specific styling', () => {
    const { container } = render(
      createElement(DictationBar, {
        phase: listening({ silentMs: 4000 }),
        levels: [],
        failure: null,
        onFinish: vi.fn(),
        onDiscard: vi.fn(),
        onRetry: vi.fn(),
        onRequestMic: vi.fn()
      })
    )
    expect(container.querySelector('.wb-dictation')?.getAttribute('data-state')).toBe('silent')
  })
})
