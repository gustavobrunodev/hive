// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { StatusBar, type StatusBarProps } from './StatusBar'
import { GitProvider, type GitStore } from '../scm/useGit'
import { createGitStore, makeStatus } from '../testSupport/gitStoreMock'

function renderBar(s: GitStore, props: Partial<StatusBarProps> = {}): void {
  const full: StatusBarProps = {
    onBranch: vi.fn(),
    onSync: vi.fn(),
    onChanges: vi.fn(),
    onInit: vi.fn(),
    ...props
  }
  render(createElement(GitProvider, { store: s }, createElement(StatusBar, full)))
}

afterEach(() => {
  cleanup()
})

describe('StatusBar', () => {
  it('renders nothing when git is missing', () => {
    const { container } = render(
      createElement(
        GitProvider,
        { store: createGitStore({ repo: { isRepo: false, gitMissing: true }, status: null }) },
        createElement(StatusBar, {
          onBranch: vi.fn(),
          onSync: vi.fn(),
          onChanges: vi.fn(),
          onInit: vi.fn()
        })
      )
    )
    expect(container.querySelector('.wb-statusbar')).toBeNull()
  })

  it('offers an initialize affordance for a non-repo workspace', () => {
    const onInit = vi.fn()
    renderBar(createGitStore({ repo: { isRepo: false, gitMissing: false }, status: null }), {
      onInit
    })
    fireEvent.click(screen.getByLabelText('Inicializar repositório git neste workspace'))
    expect(onInit).toHaveBeenCalled()
  })

  it('shows the branch pill and routes its click to onBranch', () => {
    const onBranch = vi.fn()
    renderBar(createGitStore({ status: makeStatus({ branch: 'feature/x' }) }), { onBranch })
    fireEvent.click(screen.getByLabelText('Branch atual: feature/x. Trocar de branch'))
    expect(onBranch).toHaveBeenCalled()
  })

  it('names a detached HEAD in the branch pill', () => {
    renderBar(createGitStore({ status: makeStatus({ branch: null, detached: true }) }))
    expect(screen.getByLabelText('Branch atual: HEAD desanexado. Trocar de branch')).toBeTruthy()
  })

  it('shows ahead/behind when there is an upstream and syncs on click', () => {
    const onSync = vi.fn()
    renderBar(
      createGitStore({ status: makeStatus({ upstream: 'origin/main', ahead: 2, behind: 1 }) }),
      { onSync }
    )
    const sync = screen.getByLabelText('2 à frente, 1 atrás. Sincronizar')
    expect(sync.textContent).toContain('2')
    expect(sync.textContent).toContain('1')
    fireEvent.click(sync)
    expect(onSync).toHaveBeenCalled()
  })

  it('offers Publish when there is no upstream', () => {
    renderBar(createGitStore({ status: makeStatus({ upstream: null }) }))
    expect(screen.getByLabelText('Publicar branch no remoto')).toBeTruthy()
    expect(screen.getByText('Publicar branch')).toBeTruthy()
  })

  it('shows a busy spinner + label while an op is in flight', () => {
    renderBar(createGitStore({ busy: 'sync', status: makeStatus({ upstream: 'origin/main' }) }))
    expect(screen.getByText('Sincronizando…')).toBeTruthy()
  })

  it('shows the change count and opens the SCM view on click', () => {
    const onChanges = vi.fn()
    renderBar(
      createGitStore({
        status: makeStatus({
          changes: [
            {
              path: 'a.txt',
              index: '.',
              worktree: 'M',
              isConflict: false,
              isUntracked: false,
              isIgnored: false
            }
          ]
        })
      }),
      { onChanges }
    )
    fireEvent.click(screen.getByLabelText('1 alteração. Abrir o controle de versão'))
    expect(onChanges).toHaveBeenCalled()
  })

  it('labels the changes cluster as empty when the tree is clean', () => {
    renderBar(createGitStore({ status: makeStatus() }))
    expect(screen.getByLabelText('Sem alterações. Abrir o controle de versão')).toBeTruthy()
  })

  it('renders a repo with a not-yet-loaded status (null) as detached + no changes', () => {
    renderBar(createGitStore({ repo: { isRepo: true, gitMissing: false }, status: null }))
    // No branch resolved yet → falls back to the detached label; publish (no upstream).
    expect(screen.getByLabelText('Branch atual: HEAD desanexado. Trocar de branch')).toBeTruthy()
    expect(screen.getByLabelText('Sem alterações. Abrir o controle de versão')).toBeTruthy()
  })
})
