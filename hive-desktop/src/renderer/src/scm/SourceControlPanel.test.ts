// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SourceControlPanel, type SourceControlPanelProps } from './SourceControlPanel'
import { GitProvider, type GitStore } from './useGit'
import type { GitFileChange, GitStatus } from './gitStatus'

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

  it('renders the commitBox slot above the list', () => {
    renderPanel(store({ status: status([chg('a.txt', '.', 'M')]) }), {
      commitBox: createElement('div', { 'data-testid': 'commit-box' }, 'box')
    })
    expect(screen.getByTestId('commit-box')).toBeTruthy()
  })

  it('marks a detached HEAD in the header', () => {
    renderPanel(
      store({ status: status([chg('a.txt', '.', 'M')], { branch: null, detached: true }) })
    )
    expect(screen.getByLabelText('Branch atual: HEAD desanexado')).toBeTruthy()
  })
})
