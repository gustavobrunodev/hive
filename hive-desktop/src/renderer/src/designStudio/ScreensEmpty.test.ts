// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ScreensEmpty, SpecLoadError } from './ScreensEmpty'

afterEach(() => {
  cleanup()
})

/**
 * design-studio T4.2 — DS-R1 AC-3/5 and design.md §3.10. The requirement is
 * not "show an empty state": it is that the empty state **names what it looked
 * for**, so the user leaves with an edit to make rather than a dead end.
 */
describe('ScreensEmpty (DS-R1 AC-3)', () => {
  it('names every probe that ran, one by one', () => {
    render(
      createElement(ScreensEmpty, {
        probed: ['screenHeading', 'iaTable'],
        onOpenSpec: vi.fn()
      })
    )

    expect(screen.getByText('Nenhuma Tela reconhecida nesta Spec')).toBeTruthy()
    const probes = screen.getAllByRole('listitem').map((item) => item.textContent)
    expect(probes).toEqual([
      'Títulos de Tela — "## Tela — Login", "### Screen: Checkout"',
      'A tabela de Arquitetura da Informação — a primeira coluna chamada Surface, Screen ou Tela'
    ])
  })

  it('offers opening the Spec in the editor — the edit the copy just described', () => {
    const onOpenSpec = vi.fn()
    render(createElement(ScreensEmpty, { probed: ['screenHeading'], onOpenSpec }))

    fireEvent.click(screen.getByRole('button', { name: 'Abrir a Spec no editor' }))
    expect(onOpenSpec).toHaveBeenCalledTimes(1)
  })
})

describe('SpecLoadError (DS-R1 AC-5, DS-R17)', () => {
  it('shows the failure message and a working retry for a retryable error', () => {
    const onRetry = vi.fn()
    render(
      createElement(SpecLoadError, {
        error: { kind: 'operation', scope: 'io', message: 'ENOENT', retryable: true },
        onRetry
      })
    )

    expect(screen.getByText('Não foi possível ler a Spec')).toBeTruthy()
    expect(screen.getByText('ENOENT')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('offers no retry button when the failure is not retryable', () => {
    render(
      createElement(SpecLoadError, {
        error: { kind: 'operation', scope: 'io', message: 'permissão negada', retryable: false },
        onRetry: vi.fn()
      })
    )

    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).toBeNull()
  })
})
