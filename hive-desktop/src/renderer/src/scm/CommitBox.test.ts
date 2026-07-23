// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { CommitBox } from './CommitBox'
import { GitProvider, type GitStore } from './useGit'
import type { GitFileChange, GitStatus } from './gitStatus'

// Mock the DS DropdownMenu family (Radix doesn't open on click cleanly in
// jsdom) so its items render inline as buttons; keep Textarea/Button real.
vi.mock('@hive/design-system', async (orig) => {
  const actual = await orig<typeof import('@hive/design-system')>()
  return {
    ...actual,
    DropdownMenu: ({ children }: { children?: ReactNode }) => createElement('div', {}, children),
    DropdownMenuTrigger: ({ children }: { children?: ReactNode }) => children,
    DropdownMenuContent: ({ children }: { children?: ReactNode }) =>
      createElement('div', { role: 'menu' }, children),
    DropdownMenuItem: ({ children, onSelect }: { children?: ReactNode; onSelect?: () => void }) =>
      createElement('button', { role: 'menuitem', onClick: onSelect }, children),
    DropdownMenuCheckboxItem: ({
      children,
      checked,
      onCheckedChange
    }: {
      children?: ReactNode
      checked?: boolean
      onCheckedChange?: (next: boolean) => void
    }) =>
      createElement(
        'button',
        {
          role: 'menuitemcheckbox',
          'aria-checked': checked,
          onClick: () => onCheckedChange?.(!checked)
        },
        children
      )
  }
})

function chg(
  path: string,
  index: string,
  worktree: string,
  extra: Partial<GitFileChange> = {}
): GitFileChange {
  return {
    path,
    index,
    worktree,
    isConflict: false,
    isUntracked: false,
    isIgnored: false,
    ...extra
  }
}

function status(changes: GitFileChange[]): GitStatus {
  return { branch: 'main', detached: false, oid: 'a', upstream: null, ahead: 0, behind: 0, changes }
}

function store(over: Partial<GitStore> = {}): GitStore {
  return {
    workspace: '/ws',
    repo: { isRepo: true, gitMissing: false },
    status: status([]),
    busy: null,
    decorations: new Map(),
    refresh: vi.fn(),
    init: vi.fn(async () => {}),
    stage: vi.fn(async () => {}),
    unstage: vi.fn(async () => {}),
    discard: vi.fn(async () => {}),
    commit: vi.fn(async () => {}),
    ...over
  }
}

function renderBox(s: GitStore): void {
  render(createElement(GitProvider, { store: s }, createElement(CommitBox)))
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('CommitBox', () => {
  it('disables Commit with a reason while the message is empty', () => {
    renderBox(store({ status: status([chg('a', 'A', '.')]) }))
    const btn = screen.getByRole('button', { name: 'Commit' })
    expect(btn.hasAttribute('disabled')).toBe(true)
    expect(btn.getAttribute('title')).toBe('Escreva uma mensagem de commit')
  })

  it('commits staged changes and clears the input', () => {
    const s = store({ status: status([chg('a', 'A', '.')]) })
    renderBox(s)
    const input = screen.getByPlaceholderText(/Ctrl\+Enter/) as HTMLTextAreaElement
    fireEvent.change(input, { target: { value: 'feat: thing' } })
    fireEvent.click(screen.getByRole('button', { name: 'Commit' }))
    expect(s.commit).toHaveBeenCalledWith('feat: thing', { amend: false, stageAll: false })
    expect(input.value).toBe('')
  })

  it('offers "Preparar tudo e commitar" when nothing is staged but the tree is dirty', () => {
    const s = store({ status: status([chg('a', '.', 'M')]) })
    renderBox(s)
    fireEvent.change(screen.getByPlaceholderText(/Ctrl\+Enter/), { target: { value: 'msg' } })
    fireEvent.click(screen.getByRole('button', { name: 'Preparar tudo e commitar' }))
    expect(s.commit).toHaveBeenCalledWith('msg', { amend: false, stageAll: true })
  })

  it('disables Commit when there is nothing to commit', () => {
    renderBox(store({ status: status([]) }))
    fireEvent.change(screen.getByPlaceholderText(/Ctrl\+Enter/), { target: { value: 'msg' } })
    const btn = screen.getByRole('button', { name: 'Commit' })
    expect(btn.hasAttribute('disabled')).toBe(true)
    expect(btn.getAttribute('title')).toBe('Nenhuma alteração para commitar')
  })

  it('commits on Ctrl+Enter', () => {
    const s = store({ status: status([chg('a', 'A', '.')]) })
    renderBox(s)
    const input = screen.getByPlaceholderText(/Ctrl\+Enter/)
    fireEvent.change(input, { target: { value: 'quick' } })
    fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true })
    expect(s.commit).toHaveBeenCalledWith('quick', { amend: false, stageAll: false })
  })

  it('amend pre-fills the last commit message and commits with --amend', async () => {
    const log = vi.fn(async () => [{ subject: 'previous subject' }])
    window.hive = { git: { log } } as unknown as typeof window.hive
    const s = store({ status: status([chg('a', 'A', '.')]) })
    renderBox(s)

    fireEvent.click(
      screen.getByRole('menuitemcheckbox', { name: 'Corrigir último commit (amend)' })
    )
    await waitFor(() =>
      expect((screen.getByPlaceholderText(/Ctrl\+Enter/) as HTMLTextAreaElement).value).toBe(
        'previous subject'
      )
    )
    fireEvent.click(screen.getByRole('button', { name: 'Corrigir commit' }))
    expect(s.commit).toHaveBeenCalledWith('previous subject', { amend: true, stageAll: false })
  })

  it('does nothing on Ctrl+Enter while disabled (empty message)', () => {
    const s = store({ status: status([chg('a', 'A', '.')]) })
    renderBox(s)
    fireEvent.keyDown(screen.getByPlaceholderText(/Ctrl\+Enter/), { key: 'Enter', ctrlKey: true })
    expect(s.commit).not.toHaveBeenCalled()
  })

  it('ignores a plain Enter (newline, not commit)', () => {
    const s = store({ status: status([chg('a', 'A', '.')]) })
    renderBox(s)
    fireEvent.change(screen.getByPlaceholderText(/Ctrl\+Enter/), { target: { value: 'x' } })
    fireEvent.keyDown(screen.getByPlaceholderText(/Ctrl\+Enter/), { key: 'Enter' })
    expect(s.commit).not.toHaveBeenCalled()
  })

  it('does not overwrite an in-progress message when amend is toggled', () => {
    const log = vi.fn(async () => [{ subject: 'previous' }])
    window.hive = { git: { log } } as unknown as typeof window.hive
    renderBox(store({ status: status([chg('a', 'A', '.')]) }))
    const input = screen.getByPlaceholderText(/Ctrl\+Enter/) as HTMLTextAreaElement
    fireEvent.change(input, { target: { value: 'my own message' } })
    fireEvent.click(
      screen.getByRole('menuitemcheckbox', { name: 'Corrigir último commit (amend)' })
    )
    expect(log).not.toHaveBeenCalled()
    expect(input.value).toBe('my own message')
  })

  it('stage-all & commit from the ▾ menu commits with stageAll', () => {
    const s = store({ status: status([chg('a', '.', 'M')]) })
    renderBox(s)
    fireEvent.change(screen.getByPlaceholderText(/Ctrl\+Enter/), { target: { value: 'm' } })
    fireEvent.click(screen.getByRole('menuitem', { name: 'Preparar tudo e commitar' }))
    expect(s.commit).toHaveBeenCalledWith('m', { stageAll: true })
  })
})
