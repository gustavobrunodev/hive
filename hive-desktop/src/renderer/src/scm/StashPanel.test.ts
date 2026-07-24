// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { StashPanel } from './StashPanel'
import { GitProvider } from './useGit'
import { createGitStore } from '../testSupport/gitStoreMock'
import type { GitStash } from './gitStatus'

// Radix Dialog/AlertDialog/Checkbox don't play well in jsdom; render them
// inline when open (matching WorkUI.test's approach). Button/Textarea stay real.
vi.mock('@hive/design-system', async (orig) => {
  const actual = await orig<typeof import('@hive/design-system')>()
  const passthrough =
    (role?: string) =>
    ({ children }: { children?: ReactNode }) =>
      createElement('div', role ? { role } : null, children)
  return {
    ...actual,
    Dialog: ({ open, children }: { open?: boolean; children?: ReactNode }) =>
      open ? createElement('div', { role: 'dialog' }, children) : null,
    DialogContent: passthrough(),
    DialogTitle: ({ children }: { children?: ReactNode }) => createElement('h2', null, children),
    DialogDescription: ({ children }: { children?: ReactNode }) =>
      createElement('p', null, children),
    AlertDialog: ({ open, children }: { open?: boolean; children?: ReactNode }) =>
      open ? createElement('div', { role: 'alertdialog' }, children) : null,
    AlertDialogContent: passthrough(),
    AlertDialogTitle: ({ children }: { children?: ReactNode }) =>
      createElement('h2', null, children),
    AlertDialogDescription: ({ children }: { children?: ReactNode }) =>
      createElement('p', null, children),
    AlertDialogAction: ({ children, onClick }: { children?: ReactNode; onClick?: () => void }) =>
      createElement('button', { type: 'button', onClick }, children),
    AlertDialogCancel: ({ children, onClick }: { children?: ReactNode; onClick?: () => void }) =>
      createElement('button', { type: 'button', onClick }, children),
    Checkbox: ({
      checked,
      onCheckedChange
    }: {
      checked?: boolean
      onCheckedChange?: (v: boolean) => void
    }) =>
      createElement('input', {
        type: 'checkbox',
        checked: !!checked,
        onChange: (e: { target: { checked: boolean } }) => onCheckedChange?.(e.target.checked)
      }),
    Textarea: (props: Record<string, unknown>) => createElement('textarea', props)
  }
})

function stash(index: number, message: string): GitStash {
  return { index, ref: `stash@{${index}}`, message }
}

let stashList: ReturnType<typeof vi.fn>
let store: ReturnType<typeof createGitStore>

function renderPanel(): void {
  render(createElement(GitProvider, { store }, createElement(StashPanel)))
}

beforeEach(() => {
  stashList = vi.fn().mockResolvedValue([stash(0, 'wip a'), stash(1, 'wip b')])
  store = createGitStore()
  window.hive = { git: { stashList } } as unknown as typeof window.hive
})

afterEach(() => {
  cleanup()
})

describe('StashPanel', () => {
  it('lists stashes and applies / pops one', async () => {
    renderPanel()
    expect(await screen.findByText('wip a')).toBeTruthy()
    expect(screen.getByText('2')).toBeTruthy() // count badge

    fireEvent.click(screen.getAllByText('Aplicar')[0])
    expect(store.stashApply).toHaveBeenCalledWith(0)
    fireEvent.click(screen.getAllByText('Pop')[1])
    expect(store.stashApply).toHaveBeenCalledWith(1, true)
  })

  it('confirms before dropping a stash', async () => {
    renderPanel()
    await screen.findByText('wip a')
    fireEvent.click(screen.getAllByText('Descartar')[0])
    expect(screen.getByText('Descartar stash?')).toBeTruthy()
    expect(store.stashDrop).not.toHaveBeenCalled()
    // The dialog's confirm is the last "Descartar" (after the two row buttons).
    const drops = screen.getAllByText('Descartar')
    fireEvent.click(drops[drops.length - 1])
    expect(store.stashDrop).toHaveBeenCalledWith(0)
  })

  it('creates a stash with a message and include-untracked', async () => {
    renderPanel()
    await screen.findByText('wip a')
    fireEvent.click(screen.getByLabelText('Guardar alterações'))
    fireEvent.change(screen.getByPlaceholderText('Mensagem (opcional)'), {
      target: { value: 'my wip' }
    })
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByText('Guardar'))
    expect(store.stash).toHaveBeenCalledWith({ message: 'my wip', untracked: true })
  })

  it('renders no list (only the create action) when there are no stashes', async () => {
    stashList.mockResolvedValue([])
    renderPanel()
    await waitFor(() => expect(stashList).toHaveBeenCalled())
    expect(screen.queryByText('wip a')).toBeNull()
    // The create action is still available.
    expect(screen.getByLabelText('Guardar alterações')).toBeTruthy()
  })

  it('collapses and expands the stash list', async () => {
    renderPanel()
    expect(await screen.findByText('wip a')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { expanded: true }))
    expect(screen.queryByText('wip a')).toBeNull()
    fireEvent.click(screen.getByRole('button', { expanded: false }))
    expect(screen.getByText('wip a')).toBeTruthy()
  })

  it('cancels the create and drop dialogs without acting', async () => {
    renderPanel()
    await screen.findByText('wip a')

    fireEvent.click(screen.getByLabelText('Guardar alterações'))
    fireEvent.click(screen.getByText('Cancelar'))
    expect(store.stash).not.toHaveBeenCalled()

    fireEvent.click(screen.getAllByText('Descartar')[0])
    const cancels = screen.getAllByText('Cancelar')
    fireEvent.click(cancels[cancels.length - 1])
    expect(store.stashDrop).not.toHaveBeenCalled()
  })

  it('degrades to an empty list on a stashList error', async () => {
    stashList.mockRejectedValue(new Error('boom'))
    renderPanel()
    await waitFor(() => expect(stashList).toHaveBeenCalled())
    expect(screen.queryByText('wip a')).toBeNull()
  })
})
