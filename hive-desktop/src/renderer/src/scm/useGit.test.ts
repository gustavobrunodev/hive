// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { act, cleanup, render, renderHook, screen, waitFor } from '@testing-library/react'
import { createHiveGitMock } from '../testSupport/hiveGitMock'
import { GitProvider, useGit, useGitStore } from './useGit'
import type { GitStatus } from './gitStatus'

type GitMock = ReturnType<typeof createHiveGitMock>

function dirtyStatus(): GitStatus {
  return {
    branch: 'main',
    detached: false,
    oid: 'abc',
    upstream: null,
    ahead: 0,
    behind: 0,
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
  }
}

let gitMock: GitMock
let watchStop: ReturnType<typeof vi.fn>
let fsCallback: (() => void) | null
let changedCallback: (() => void) | null

beforeEach(() => {
  gitMock = createHiveGitMock()
  watchStop = vi.fn()
  fsCallback = null
  changedCallback = null
  gitMock.onChanged.mockImplementation((cb: () => void) => {
    changedCallback = cb
    return () => {}
  })
  window.hive = {
    git: gitMock,
    watchWorkspace: vi.fn((_ws: string, cb: () => void) => {
      fsCallback = cb
      return watchStop
    })
  } as unknown as typeof window.hive
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('useGitStore', () => {
  it('detects the repo and loads status + decorations on mount', async () => {
    gitMock.detect.mockResolvedValue({ isRepo: true, root: '/ws', gitMissing: false })
    gitMock.status.mockResolvedValue(dirtyStatus())

    const { result } = renderHook(() => useGitStore('/ws'))
    await waitFor(() => expect(result.current.repo.isRepo).toBe(true))
    expect(result.current.status?.branch).toBe('main')
    expect(result.current.decorations.get('a.txt')).toMatchObject({ kind: 'modified', letter: 'M' })
  })

  it('clears status for a non-repo (and flags gitMissing)', async () => {
    gitMock.detect.mockResolvedValue({ isRepo: false, root: null, gitMissing: true })
    const { result } = renderHook(() => useGitStore('/ws'))
    await waitFor(() => expect(result.current.repo.gitMissing).toBe(true))
    expect(result.current.status).toBeNull()
  })

  it('coalesces a burst of refresh() calls into one status re-run (debounced)', async () => {
    gitMock.detect.mockResolvedValue({ isRepo: true, root: '/ws', gitMissing: false })
    gitMock.status.mockResolvedValue(dirtyStatus())
    const { result } = renderHook(() => useGitStore('/ws'))
    await waitFor(() => expect(gitMock.status).toHaveBeenCalledTimes(1))

    act(() => {
      result.current.refresh()
      result.current.refresh()
      result.current.refresh()
    })
    await waitFor(() => expect(gitMock.status).toHaveBeenCalledTimes(2))
    // The three calls collapsed to a single extra status run.
    expect(gitMock.status).toHaveBeenCalledTimes(2)
  })

  it('runs actions through the bridge and refreshes afterward', async () => {
    gitMock.detect.mockResolvedValue({ isRepo: true, root: '/ws', gitMissing: false })
    const { result } = renderHook(() => useGitStore('/ws'))
    await waitFor(() => expect(result.current.repo.isRepo).toBe(true))

    await act(async () => {
      await result.current.stage(['a.txt'])
    })
    expect(gitMock.stage).toHaveBeenCalledWith('/ws', ['a.txt'])

    await act(async () => {
      await result.current.commit('msg', { stageAll: true })
    })
    expect(gitMock.commit).toHaveBeenCalledWith('/ws', 'msg', { stageAll: true })
    expect(result.current.busy).toBeNull()
  })

  it('exposes init / unstage / discard wrappers', async () => {
    const { result } = renderHook(() => useGitStore('/ws'))
    await act(async () => {
      await result.current.init()
      await result.current.unstage(['a'])
      await result.current.discard(['b'])
    })
    expect(gitMock.init).toHaveBeenCalledWith('/ws')
    expect(gitMock.unstage).toHaveBeenCalledWith('/ws', ['a'])
    expect(gitMock.discard).toHaveBeenCalledWith('/ws', ['b'])
  })

  it('refreshes on a git:changed ping, an fs change, and window focus', async () => {
    gitMock.detect.mockResolvedValue({ isRepo: true, root: '/ws', gitMissing: false })
    gitMock.status.mockResolvedValue(dirtyStatus())
    renderHook(() => useGitStore('/ws'))
    await waitFor(() => expect(gitMock.status).toHaveBeenCalledTimes(1))

    act(() => changedCallback?.())
    await waitFor(() => expect(gitMock.status).toHaveBeenCalledTimes(2))

    act(() => fsCallback?.())
    await waitFor(() => expect(gitMock.status).toHaveBeenCalledTimes(3))

    act(() => {
      window.dispatchEvent(new Event('focus'))
    })
    await waitFor(() => expect(gitMock.status).toHaveBeenCalledTimes(4))
  })

  it('subscribes to git:changed + fs watch and tears them down on unmount', async () => {
    const offChanged = vi.fn()
    gitMock.onChanged.mockReturnValue(offChanged)
    const { unmount } = renderHook(() => useGitStore('/ws'))
    await waitFor(() => expect(gitMock.onChanged).toHaveBeenCalled())
    unmount()
    expect(offChanged).toHaveBeenCalled()
    expect(watchStop).toHaveBeenCalled()
  })
})

describe('GitProvider / useGit', () => {
  it('provides the store to consumers', async () => {
    gitMock.detect.mockResolvedValue({ isRepo: true, root: '/ws', gitMissing: false })
    gitMock.status.mockResolvedValue(dirtyStatus())

    function Consumer(): React.JSX.Element {
      const git = useGit()
      return createElement('div', {}, git.status?.branch ?? 'none')
    }
    function Host(): React.JSX.Element {
      const store = useGitStore('/ws')
      return createElement(GitProvider, { store }, createElement(Consumer))
    }
    render(createElement(Host))
    await waitFor(() => expect(screen.getByText('main')).toBeTruthy())
  })

  it('throws when used outside a provider', () => {
    function Bare(): React.JSX.Element {
      useGit()
      return createElement('div')
    }
    // Silence the expected React error boundary console noise.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(createElement(Bare))).toThrow('useGit must be used within a GitProvider')
    spy.mockRestore()
  })
})
