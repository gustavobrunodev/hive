// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SourceControlPanel, type SourceControlPanelProps } from './SourceControlPanel'
import { GitProvider, type GitStore } from './useGit'
import type { GitFileChange, GitStatus } from './gitStatus'

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
    ContextMenuSeparator: () => createElement('hr')
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
