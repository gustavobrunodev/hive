// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useGitLogs } from './useGitLogs'
import type { GitCommandEntry } from './gitLogs'
import { createHiveGitMock } from '../testSupport/hiveGitMock'

/**
 * git-logs — the console's store. The one thing here that is not obvious is
 * the *order* of the two IPC calls: the subscription is opened before history
 * is read, so a command that finishes between them lands twice rather than not
 * at all. These tests hold that ordering, and the merge that makes it safe.
 */

function entry(id: string, args: string[]): GitCommandEntry {
  return {
    id,
    at: 1_700_000_000_000,
    cwd: '/ws',
    args,
    code: 0,
    durationMs: 10,
    stderr: '',
    stderrTruncated: false
  }
}

/** Mounts the store; returns the live-entry listener it registered. */
function setup(history: GitCommandEntry[] | Promise<GitCommandEntry[]>): {
  git: ReturnType<typeof createHiveGitMock>
  push: (entry: GitCommandEntry) => void
} {
  const git = createHiveGitMock()
  git.logs.history.mockReturnValue(Promise.resolve(history))
  let listener: (entry: GitCommandEntry) => void = () => {}
  git.logs.onEntry.mockImplementation((cb: (entry: GitCommandEntry) => void) => {
    listener = cb
    return () => {}
  })
  vi.stubGlobal('hive', { git } as unknown as typeof window.hive)
  return { git, push: (e) => listener(e) }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useGitLogs', () => {
  it('subscribes before reading history, so nothing falls in the gap', async () => {
    let resolve: (entries: GitCommandEntry[]) => void = () => {}
    const pending = new Promise<GitCommandEntry[]>((r) => {
      resolve = r
    })
    const { git, push } = setup(pending)
    const { result } = renderHook(() => useGitLogs())

    // The subscription exists while history is still in flight — that is the
    // whole point of the ordering.
    expect(git.logs.onEntry).toHaveBeenCalled()
    act(() => push(entry('git#9', ['push'])))
    await act(async () => {
      resolve([entry('git#1', ['status'])])
      await pending
    })

    // History is older by definition, so it sorts in front of the live entry
    // that arrived while it was loading — not appended after it.
    await waitFor(() => expect(result.current.entries.map((e) => e.id)).toEqual(['git#1', 'git#9']))
    expect(result.current.loading).toBe(false)
  })

  it('never shows a command twice when history and the stream overlap', async () => {
    const shared = entry('git#1', ['fetch'])
    const { push } = setup([shared])
    const { result } = renderHook(() => useGitLogs())
    await waitFor(() => expect(result.current.entries).toHaveLength(1))

    act(() => push(shared))

    expect(result.current.entries).toHaveLength(1)
  })

  it('appends live commands as they arrive', async () => {
    const { push } = setup([entry('git#1', ['status'])])
    const { result } = renderHook(() => useGitLogs())
    await waitFor(() => expect(result.current.entries).toHaveLength(1))

    act(() => push(entry('git#2', ['commit'])))

    expect(result.current.entries.map((e) => e.args[0])).toEqual(['status', 'commit'])
  })

  it("clears main's journal, not only the local view", async () => {
    const { git } = setup([entry('git#1', ['status'])])
    const { result } = renderHook(() => useGitLogs())
    await waitFor(() => expect(result.current.entries).toHaveLength(1))

    await act(async () => result.current.clear())

    expect(git.logs.clear).toHaveBeenCalled()
    expect(result.current.entries).toEqual([])
  })

  /**
   * The unmount races the history read. Writing state after it would be a
   * React warning at best and a resurrected console at worst.
   */
  it('drops a history read that lands after unmount, and unsubscribes', async () => {
    let resolve: (entries: GitCommandEntry[]) => void = () => {}
    const pending = new Promise<GitCommandEntry[]>((r) => {
      resolve = r
    })
    const off = vi.fn()
    const git = createHiveGitMock()
    git.logs.history.mockReturnValue(pending)
    git.logs.onEntry.mockReturnValue(off)
    vi.stubGlobal('hive', { git } as unknown as typeof window.hive)

    const { result, unmount } = renderHook(() => useGitLogs())
    unmount()
    await act(async () => {
      resolve([entry('git#1', ['status'])])
      await pending
    })

    expect(off).toHaveBeenCalled()
    expect(result.current.entries).toEqual([])
  })

  it('ignores a live entry that arrives after unmount', async () => {
    const { push } = setup([])
    const { result, unmount } = renderHook(() => useGitLogs())
    await waitFor(() => expect(result.current.loading).toBe(false))
    unmount()

    act(() => push(entry('git#5', ['fetch'])))

    expect(result.current.entries).toEqual([])
  })
})
