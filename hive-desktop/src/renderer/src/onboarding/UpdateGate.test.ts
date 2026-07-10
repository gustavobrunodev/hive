// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react'
import { UpdateGate } from './UpdateGate'
import type { BmadEvent } from '../../../main/bmadService'

/**
 * Task T10 — BmadService.update() + launch gate (design.md §5.2, R4.1–R4.3).
 *
 * Same mocking approach as GuidedInstall.test.ts: `@hive/design-system` gets
 * trivial DOM stand-ins, `window.hive` is mocked per test.
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
  Progress: () => createElement('div', { role: 'progressbar' })
}))

describe('UpdateGate (T10)', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  function mockUpdateBmad(): {
    emit: (event: BmadEvent) => void
    unsubscribe: ReturnType<typeof vi.fn>
  } {
    let capturedOnEvent: ((event: BmadEvent) => void) | undefined
    const unsubscribe = vi.fn()
    window.hive = {
      ...window.hive,
      updateBmad: vi.fn((_workspace: string, onEvent: (event: BmadEvent) => void) => {
        capturedOnEvent = onEvent
        return unsubscribe
      })
    }
    return {
      emit: (event: BmadEvent) => capturedOnEvent?.(event),
      unsubscribe
    }
  }

  it('starts updateBmad() for the given workspace and shows the running state', () => {
    mockUpdateBmad()

    render(createElement(UpdateGate, { workspace: '/ws', onComplete: () => {} }))

    expect(window.hive.updateBmad).toHaveBeenCalledWith('/ws', expect.any(Function))
    expect(screen.getByText('Atualizando o BMAD')).toBeTruthy()
    expect(screen.getByRole('progressbar')).toBeTruthy()
  })

  it('calls onComplete() as soon as the stream reports done (fast, no extra noise — R4.3)', async () => {
    const { emit } = mockUpdateBmad()
    const onComplete = vi.fn()

    render(createElement(UpdateGate, { workspace: '/ws', onComplete }))

    emit({ type: 'done', ok: true })

    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledTimes(1)
    })
  })

  it('shows an Alert with retry AND continue-anyway on error (R4.2)', async () => {
    const { emit } = mockUpdateBmad()
    const onComplete = vi.fn()

    render(createElement(UpdateGate, { workspace: '/ws', onComplete }))

    emit({ type: 'error', message: 'Falha na atualização' })

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy()
      expect(screen.getByText('Falha na atualização')).toBeTruthy()
    })

    expect(screen.getByText('Tentar novamente')).toBeTruthy()
    const continueButton = screen.getByText('Continuar mesmo assim')
    fireEvent.click(continueButton)

    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('retry restarts updateBmad() and clears the error state', async () => {
    const { emit } = mockUpdateBmad()

    render(createElement(UpdateGate, { workspace: '/ws', onComplete: () => {} }))

    emit({ type: 'error', message: 'Falha na atualização' })
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy()
    })

    expect(window.hive.updateBmad).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByText('Tentar novamente'))

    await waitFor(() => {
      expect(window.hive.updateBmad).toHaveBeenCalledTimes(2)
    })
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('unsubscribes from updateBmad() on unmount', () => {
    const { unsubscribe } = mockUpdateBmad()

    const { unmount } = render(
      createElement(UpdateGate, { workspace: '/ws', onComplete: () => {} })
    )
    unmount()

    expect(unsubscribe).toHaveBeenCalled()
  })
})
