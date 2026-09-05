// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { UnsavedGuardDialog } from './UnsavedGuardDialog'

vi.mock('@hive/design-system', () => ({
  Button: ({ children, ...rest }: { children?: ReactNode }) =>
    createElement('button', { type: 'button', ...rest }, children),
  Dialog: ({ children }: { children?: ReactNode }) =>
    createElement('div', { role: 'dialog' }, children),
  DialogContent: ({ children }: { children?: ReactNode }) => createElement('div', null, children),
  DialogTitle: ({ children }: { children?: ReactNode }) => createElement('h2', null, children),
  DialogDescription: ({ children }: { children?: ReactNode }) => createElement('p', null, children)
}))

afterEach(() => {
  cleanup()
})

function renderGuard(props: Partial<Parameters<typeof UnsavedGuardDialog>[0]> = {}): {
  onCancel: ReturnType<typeof vi.fn>
  onDiscard: ReturnType<typeof vi.fn>
  onSave: ReturnType<typeof vi.fn>
} {
  const handlers = { onCancel: vi.fn(), onDiscard: vi.fn(), onSave: vi.fn() }
  render(createElement(UnsavedGuardDialog, { open: true, ...handlers, ...props }))
  return handlers
}

describe('UnsavedGuardDialog', () => {
  it('renders nothing while closed', () => {
    render(
      createElement(UnsavedGuardDialog, {
        open: false,
        onCancel: vi.fn(),
        onDiscard: vi.fn(),
        onSave: vi.fn()
      })
    )
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('asks the three-way question with no subject when the caller names no file', () => {
    renderGuard()
    expect(screen.getByText('Alterações não salvas')).toBeTruthy()
    expect(document.querySelector('.wb-guard-subject')).toBeNull()
  })

  /**
   * A bulk close asks once per file. Without the name, the question is about
   * "este arquivo" while the editor behind the dialog may be showing another
   * one entirely — the user cannot tell what they are answering for.
   */
  it('names the file it is asking about', () => {
    renderGuard({ fileName: 'prd.md' })
    expect(screen.getByText('Arquivo: prd.md')).toBeTruthy()
    // Nothing queued behind it, so it does not promise a queue.
    expect(document.querySelector('.wb-guard-remaining')).toBeNull()
  })

  it('says how many files the same run will still ask about', () => {
    renderGuard({ fileName: 'prd.md', remaining: 2 })
    expect(screen.getByText('Mais 2 arquivos depois deste')).toBeTruthy()
  })

  it('counts a single remaining file in the singular', () => {
    renderGuard({ fileName: 'prd.md', remaining: 1 })
    expect(screen.getByText('Mais 1 arquivo depois deste')).toBeTruthy()
  })

  it('wires each of the three ways out', () => {
    const { onCancel, onDiscard, onSave } = renderGuard({ fileName: 'a.txt' })

    fireEvent.click(screen.getByText('Cancelar'))
    fireEvent.click(screen.getByText('Descartar alterações'))
    fireEvent.click(screen.getByText('Salvar'))

    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onDiscard).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledTimes(1)
  })

  it('marks the destructive way out as destructive, and only that one', () => {
    renderGuard({ fileName: 'a.txt' })
    const danger = document.querySelectorAll('.wb-btn-danger')
    expect(danger).toHaveLength(1)
    expect(danger[0]?.textContent).toBe('Descartar alterações')
  })
})
