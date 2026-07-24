// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { SourceControlPanel, type SourceControlPanelProps } from './SourceControlPanel'
import { GitProvider, type GitStore } from './useGit'
import type { GitFileChange, GitStatus } from './gitStatus'
import { createGitStore } from '../testSupport/gitStoreMock'

// The DS ContextMenu (Radix) doesn't open on right-click cleanly in jsdom, so
// — mirroring Explorer.test's approach — mock the family to render its content
// inline (menu items become plain buttons). Everything else in the DS bundle
// is the real component (AlertDialog, Button, IconButton).
vi.mock('@hive/design-system', async (orig) => {
  const actual = await orig<typeof import('@hive/design-system')>()
  return {
    ...actual,
    ContextMenu: ({ children }: { children?: ReactNode }) => createElement('div', {}, children),
    ContextMenuTrigger: ({ children }: { children?: ReactNode }) => children,
    ContextMenuContent: ({ children }: { children?: ReactNode }) =>
      createElement('div', { role: 'menu' }, children),
    ContextMenuItem: ({ children, onSelect }: { children?: ReactNode; onSelect?: () => void }) =>
      createElement('button', { role: 'menuitem', onClick: onSelect }, children),
    ContextMenuSeparator: () => createElement('hr'),
    // The SCM header overflow (GIT-R7) uses the DropdownMenu family.
    DropdownMenu: ({ children }: { children?: ReactNode }) => createElement('div', null, children),
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

function status(changes: GitFileChange[], over: Partial<GitStatus> = {}): GitStatus {
  return {
    branch: 'main',
    detached: false,
    oid: 'abc',
    upstream: null,
    ahead: 0,
    behind: 0,
    changes,
    ...over
  }
}

function store(over: Partial<GitStore> = {}): GitStore {
  return createGitStore({ status: status([]), ...over })
}

function renderPanel(s: GitStore, props: SourceControlPanelProps = {}): void {
  render(createElement(GitProvider, { store: s }, createElement(SourceControlPanel, props)))
}

afterEach(() => {
  cleanup()
})

describe('SourceControlPanel', () => {
  it('shows the git-missing state when the binary is unavailable', () => {
    renderPanel(store({ repo: { isRepo: false, gitMissing: true }, status: null }))
    expect(screen.getByText('Git não encontrado')).toBeTruthy()
  })

  it('shows the initialize-repo state and runs init on click', () => {
    const s = store({ repo: { isRepo: false, gitMissing: false }, status: null })
    renderPanel(s)
    expect(screen.getByText('Este workspace ainda não usa git')).toBeTruthy()
    fireEvent.click(screen.getByText('Inicializar repositório'))
    expect(s.init).toHaveBeenCalled()
  })

  it('shows the calm clean state naming the branch', () => {
    renderPanel(store({ status: status([]) }))
    expect(screen.getByText('Nenhuma alteração')).toBeTruthy()
    expect(screen.getByText(/Tudo salvo em main/)).toBeTruthy()
  })

  it('names no branch (detached) in the clean state', () => {
    renderPanel(store({ status: status([], { branch: null, detached: true }) }))
    expect(screen.getByText('Tudo salvo. Faça uma alteração para começar.')).toBeTruthy()
  })

  it('renders the branch header + grouped changes when dirty', () => {
    renderPanel(store({ status: status([chg('a.txt', '.', 'M'), chg('b.txt', 'A', '.')]) }))
    expect(screen.getByLabelText('Branch atual: main')).toBeTruthy()
    expect(screen.getByText('Alterações prontas')).toBeTruthy()
    expect(screen.getByText('Alterações')).toBeTruthy()
    expect(screen.getByText('a.txt')).toBeTruthy()
  })

  it('refresh button calls the store refresh', () => {
    const s = store({ status: status([chg('a.txt', '.', 'M')]) })
    renderPanel(s)
    fireEvent.click(screen.getByLabelText('Atualizar'))
    expect(s.refresh).toHaveBeenCalled()
  })

  it('forwards a row click to onOpenDiff', () => {
    const onOpenDiff = vi.fn()
    renderPanel(store({ status: status([chg('a.txt', '.', 'M')]) }), { onOpenDiff })
    fireEvent.click(screen.getByRole('button', { name: /a\.txt/ }))
    expect(onOpenDiff).toHaveBeenCalledWith(expect.objectContaining({ path: 'a.txt' }), 'unstaged')
  })

  it('renders the commit box above the list', () => {
    renderPanel(store({ status: status([chg('a.txt', '.', 'M')]) }))
    expect(screen.getByPlaceholderText(/Ctrl\+Enter para commitar/)).toBeTruthy()
  })

  it('marks a detached HEAD in the header', () => {
    renderPanel(
      store({ status: status([chg('a.txt', '.', 'M')], { branch: null, detached: true }) })
    )
    expect(screen.getByLabelText('Branch atual: HEAD desanexado')).toBeTruthy()
  })

  it('renders the remote overflow menu and routes each op (GIT-R7)', () => {
    const remote = {
      result: null,
      clear: vi.fn(),
      fetch: vi.fn(),
      pull: vi.fn(),
      push: vi.fn(),
      sync: vi.fn()
    }
    renderPanel(store({ status: status([chg('a.txt', '.', 'M')]) }), { remote })
    fireEvent.click(screen.getByRole('menuitem', { name: 'Sincronizar' }))
    expect(remote.sync).toHaveBeenCalled()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Buscar (fetch)' }))
    expect(remote.fetch).toHaveBeenCalled()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Receber (pull)' }))
    expect(remote.pull).toHaveBeenCalled()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Enviar (push)' }))
    expect(remote.push).toHaveBeenCalled()
  })

  it('omits the overflow menu when no remote handlers are given', () => {
    renderPanel(store({ status: status([chg('a.txt', '.', 'M')]) }))
    expect(screen.queryByLabelText('Mais ações')).toBeNull()
  })

  it('shows the merge banner and continues/aborts (GIT-R9.3)', () => {
    const s = store({
      status: status([chg('c.txt', 'U', 'U', { isConflict: true })], { mergeInProgress: true })
    })
    renderPanel(s)
    expect(screen.getByText('Resolução de merge em andamento')).toBeTruthy()
    // Continue is disabled while a conflict remains.
    expect((screen.getByText('Continuar') as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByText('Abortar'))
    expect(s.mergeAbort).toHaveBeenCalled()
  })

  it('enables merge continue once conflicts are resolved', () => {
    const s = store({ status: status([chg('a.txt', 'M', '.')], { mergeInProgress: true }) })
    renderPanel(s)
    const cont = screen.getByText('Continuar') as HTMLButtonElement
    expect(cont.disabled).toBe(false)
    fireEvent.click(cont)
    expect(s.mergeContinue).toHaveBeenCalled()
  })
})

describe('SourceControlPanel — history (GIT-R8)', () => {
  it('toggles the history timeline and opens a commit diff', async () => {
    const log = vi.fn().mockResolvedValue([
      {
        hash: 'h1',
        shortHash: 'h1',
        author: 'T',
        date: new Date().toISOString(),
        subject: 'first'
      }
    ])
    window.hive = { git: { log } } as unknown as typeof window.hive
    const onOpenCommit = vi.fn()
    renderPanel(store({ status: status([chg('a.txt', '.', 'M')]) }), { onOpenCommit })

    fireEvent.click(screen.getByLabelText('Histórico'))
    expect(await screen.findByText('first')).toBeTruthy()
    fireEvent.click(screen.getByText('first'))
    expect(onOpenCommit).toHaveBeenCalledWith('h1', 'first')

    // Toggle back to the change list.
    fireEvent.click(screen.getByLabelText('Alterações'))
    expect(screen.getByText('Alterações')).toBeTruthy()
  })

  it('scopes history to a file from the row menu, then clears the scope', async () => {
    const log = vi.fn().mockResolvedValue([
      {
        hash: 'h1',
        shortHash: 'h1',
        author: 'T',
        date: new Date().toISOString(),
        subject: 'edit a'
      }
    ])
    window.hive = { git: { log } } as unknown as typeof window.hive
    renderPanel(store({ status: status([chg('src/a.txt', '.', 'M')]) }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Ver histórico' }))
    await waitFor(() =>
      expect(log).toHaveBeenCalledWith('/ws', { skip: 0, limit: 30, file: 'src/a.txt' })
    )
    expect(await screen.findByText('Histórico de a.txt')).toBeTruthy()
    // Clearing the scope re-loads the whole-repo history.
    fireEvent.click(screen.getByText('Ver todo o histórico'))
    await waitFor(() =>
      expect(log).toHaveBeenCalledWith('/ws', { skip: 0, limit: 30, file: undefined })
    )
  })
})

describe('SourceControlPanel — row + group actions (GIT-R3)', () => {
  it('stages an unstaged row and unstages a staged row', () => {
    const s = store({
      status: status([chg('u.txt', '.', 'M'), chg('s.txt', 'A', '.')])
    })
    renderPanel(s)
    fireEvent.click(screen.getByLabelText('Preparar'))
    expect(s.stage).toHaveBeenCalledWith(['u.txt'])
    fireEvent.click(screen.getByLabelText('Retirar do preparo'))
    expect(s.unstage).toHaveBeenCalledWith(['s.txt'])
  })

  it('stages all / unstages all from the group headers', () => {
    const s = store({
      status: status([chg('u1', '.', 'M'), chg('u2', '.', 'M'), chg('s1', 'A', '.')])
    })
    renderPanel(s)
    fireEvent.click(screen.getByLabelText('Preparar tudo'))
    expect(s.stage).toHaveBeenCalledWith(['u1', 'u2'])
    fireEvent.click(screen.getByLabelText('Retirar tudo do preparo'))
    expect(s.unstage).toHaveBeenCalledWith(['s1'])
  })

  it('confirms before discarding a tracked file, then restores it', () => {
    const s = store({ status: status([chg('a.txt', '.', 'M')]) })
    renderPanel(s)
    fireEvent.click(screen.getByLabelText('Descartar alterações'))
    // The confirm dialog explains the tracked-file restore.
    expect(screen.getByText(/restaurado para o último commit/)).toBeTruthy()
    expect(s.discard).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText('Descartar'))
    expect(s.discard).toHaveBeenCalledWith(['a.txt'])
  })

  it('explains the trash route when discarding an untracked file', () => {
    const s = store({
      status: status([chg('junk.txt', '?', '?', { isUntracked: true })])
    })
    renderPanel(s)
    fireEvent.click(screen.getByLabelText('Descartar alterações'))
    expect(screen.getByText(/movido para a lixeira/)).toBeTruthy()
  })

  it('cancelling the discard dialog leaves the file untouched', () => {
    const s = store({ status: status([chg('a.txt', '.', 'M')]) })
    renderPanel(s)
    fireEvent.click(screen.getByLabelText('Descartar alterações'))
    fireEvent.click(screen.getByText('Cancelar'))
    expect(s.discard).not.toHaveBeenCalled()
    expect(screen.queryByText(/restaurado para o último commit/)).toBeNull()
  })

  it('discard-all summarizes the count in the confirmation', () => {
    const s = store({ status: status([chg('a', '.', 'M'), chg('b', '.', 'M')]) })
    renderPanel(s)
    fireEvent.click(screen.getByLabelText('Descartar tudo'))
    expect(screen.getByText(/2 arquivos serão descartados/)).toBeTruthy()
    fireEvent.click(screen.getByText('Descartar'))
    expect(s.discard).toHaveBeenCalledWith(['a', 'b'])
  })

  it('offers Open diff / Stage / Copy path from the row context menu', () => {
    const onOpenDiff = vi.fn()
    const writeText = vi.fn()
    Object.assign(navigator, { clipboard: { writeText } })
    const s = store({ status: status([chg('a.txt', '.', 'M')]) })
    renderPanel(s, { onOpenDiff })

    fireEvent.click(screen.getByRole('menuitem', { name: 'Abrir diferenças' }))
    expect(onOpenDiff).toHaveBeenCalledWith(expect.objectContaining({ path: 'a.txt' }), 'unstaged')

    fireEvent.click(screen.getByRole('menuitem', { name: 'Preparar' }))
    expect(s.stage).toHaveBeenCalledWith(['a.txt'])

    fireEvent.click(screen.getByRole('menuitem', { name: 'Copiar caminho' }))
    expect(writeText).toHaveBeenCalledWith('a.txt')
  })

  it('offers Unstage from a staged row context menu', () => {
    const s = store({ status: status([chg('s.txt', 'A', '.')]) })
    renderPanel(s)
    fireEvent.click(screen.getByRole('menuitem', { name: 'Retirar do preparo' }))
    expect(s.unstage).toHaveBeenCalledWith(['s.txt'])
  })

  it('shows a conflict row with a mark-resolved (Stage) action and no group-level action', () => {
    const s = store({
      status: status([chg('c.txt', 'U', 'U', { isConflict: true })])
    })
    renderPanel(s)
    expect(screen.getByText('Conflitos de merge')).toBeTruthy()
    // The conflict group offers no header action; the row offers Stage (mark resolved).
    fireEvent.click(screen.getByLabelText('Preparar'))
    expect(s.stage).toHaveBeenCalledWith(['c.txt'])
  })
})
