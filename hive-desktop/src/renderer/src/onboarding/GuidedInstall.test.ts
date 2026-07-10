// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react'
import { GuidedInstall } from './GuidedInstall'
import type { BmadEvent } from '../../../main/bmadService'

/**
 * Task T9 — Guided install UI (design.md §5.1, R3.2–R3.4).
 *
 * Same mocking approach as App.test.ts/Explorer.test.ts: `@hive/design-system`
 * gets trivial DOM stand-ins (a real render would load a second React
 * instance from design-system's own node_modules), and `window.hive` is
 * mocked per test since there's no real main process here.
 */
vi.mock('@hive/design-system', () => ({
  Panel: ({ children, ...rest }: { children?: ReactNode }) => createElement('div', rest, children),
  Button: ({ children, ...rest }: { children?: ReactNode }) =>
    createElement('button', rest, children),
  Spinner: ({ label }: { label?: string }) => createElement('span', { role: 'status' }, label),
  Alert: ({ title, children, ...rest }: { title?: ReactNode; children?: ReactNode }) =>
    createElement(
      'div',
      { role: 'alert', ...rest },
      createElement('strong', null, title),
      children
    ),
  Progress: () => createElement('div', { role: 'progressbar' }),
  SteppedList: ({ children }: { children?: ReactNode }) => createElement('ol', null, children),
  SteppedListItem: ({ title }: { title?: ReactNode }) => createElement('li', null, title)
}))

describe('GuidedInstall (T9)', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  function mockInstallBmad(): {
    emit: (event: BmadEvent) => void
    unsubscribe: ReturnType<typeof vi.fn>
  } {
    let capturedOnEvent: ((event: BmadEvent) => void) | undefined
    const unsubscribe = vi.fn()
    window.hive = {
      ...window.hive,
      installBmad: vi.fn((_workspace: string, onEvent: (event: BmadEvent) => void) => {
        capturedOnEvent = onEvent
        return unsubscribe
      })
    }
    return {
      emit: (event: BmadEvent) => capturedOnEvent?.(event),
      unsubscribe
    }
  }

  it('starts installBmad() for the given workspace and shows the running state', () => {
    mockInstallBmad()

    render(createElement(GuidedInstall, { workspace: '/ws', onComplete: () => {} }))

    expect(window.hive.installBmad).toHaveBeenCalledWith('/ws', expect.any(Function))
    expect(screen.getByText('Preparando seu workspace')).toBeTruthy()
    expect(screen.getByRole('progressbar')).toBeTruthy()
  })

  it('renders each step event as a SteppedList item, in order', async () => {
    const { emit } = mockInstallBmad()

    render(createElement(GuidedInstall, { workspace: '/ws', onComplete: () => {} }))

    emit({ type: 'step', id: 'install-core', label: 'Instalando módulo core' })
    emit({ type: 'step', id: 'install-bmm', label: 'Instalando módulo bmm' })

    await waitFor(() => {
      expect(screen.getByText('Instalando módulo core')).toBeTruthy()
      expect(screen.getByText('Instalando módulo bmm')).toBeTruthy()
    })
  })

  it('calls onComplete() when the stream reports done', async () => {
    const { emit } = mockInstallBmad()
    const onComplete = vi.fn()

    render(createElement(GuidedInstall, { workspace: '/ws', onComplete }))

    emit({ type: 'done', ok: true })

    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledTimes(1)
    })
  })

  it('shows an Alert with retry on error, and restarts installBmad() when retried', async () => {
    const { emit } = mockInstallBmad()

    render(createElement(GuidedInstall, { workspace: '/ws', onComplete: () => {} }))

    emit({ type: 'error', message: 'Falha na instalação', detail: 'exit code 1' })

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy()
      expect(screen.getByText('Falha na instalação')).toBeTruthy()
    })

    expect(window.hive.installBmad).toHaveBeenCalledTimes(1)

    const retryButton = screen.getByText('Tentar novamente')
    fireEvent.click(retryButton)

    await waitFor(() => {
      expect(window.hive.installBmad).toHaveBeenCalledTimes(2)
    })
    // Retrying leaves the running state, not the stale error.
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('unsubscribes from installBmad() on unmount', () => {
    const { unsubscribe } = mockInstallBmad()

    const { unmount } = render(
      createElement(GuidedInstall, { workspace: '/ws', onComplete: () => {} })
    )
    unmount()

    expect(unsubscribe).toHaveBeenCalled()
  })
})
