// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useChatSessions, resolveQuery } from './useChatSessions'
import type { ChatSessionMeta } from './sessionMeta'

const meta = (id: string): ChatSessionMeta => ({
  id,
  title: id,
  createdAt: 1,
  updatedAt: 1,
  agent: null,
  messageCount: 1,
  preview: id
})
function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}
const bridge = {
  list: vi.fn(async () => [meta('initial')]),
  search: vi.fn(async () => [] as ChatSessionMeta[]),
  rename: vi.fn(async (_workspace: string, id: string, title: string) => ({ ...meta(id), title })),
  delete: vi.fn(async () => undefined)
}
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('hive', { chatHistory: bridge })
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

it('ignores an older list that finishes after a more recent refresh', async () => {
  const old = deferred<ChatSessionMeta[]>()
  bridge.list.mockReturnValueOnce(old.promise)
  const { result } = renderHook(() => useChatSessions({ workspace: '/a' }))
  act(() => result.current.reload())
  await waitFor(() => expect(result.current.sessions?.[0].id).toBe('initial'))
  await act(async () => old.resolve([meta('obsolete')]))
  expect(result.current.sessions?.[0].id).toBe('initial')
})

it('does not let a prior workspace read or rename change the current workspace', async () => {
  const oldRead = deferred<ChatSessionMeta[]>()
  const oldRename = deferred<ChatSessionMeta>()
  bridge.list.mockReturnValueOnce(oldRead.promise)
  bridge.rename.mockReturnValueOnce(oldRename.promise)
  const { result, rerender } = renderHook(({ workspace }) => useChatSessions({ workspace }), {
    initialProps: { workspace: '/a' }
  })
  act(() => result.current.rename('initial', 'wrong workspace'))
  rerender({ workspace: '/b' })
  await waitFor(() => expect(result.current.status).toBe('ready'))
  await act(async () => {
    oldRead.resolve([meta('obsolete')])
    oldRename.resolve(meta('obsolete'))
  })
  expect(result.current.sessions?.[0].id).toBe('initial')
})

it('invalidates an outstanding read when a deletion succeeds', async () => {
  const { result } = renderHook(() => useChatSessions({ workspace: '/a' }))
  await waitFor(() => expect(result.current.status).toBe('ready'))
  const old = deferred<ChatSessionMeta[]>()
  bridge.list.mockReturnValueOnce(old.promise)
  act(() => {
    result.current.reload()
    result.current.remove('initial')
  })
  await waitFor(() => expect(result.current.sessions).toEqual([]))
  await act(async () => old.resolve([meta('initial')]))
  expect(result.current.sessions).toEqual([])
})

it('deleting a conversation selected before IPC does not reset a newly selected one', async () => {
  const pending = deferred<undefined>()
  bridge.delete.mockReturnValueOnce(pending.promise)
  const onNewConversation = vi.fn()
  const { result, rerender } = renderHook(
    ({ id }) => useChatSessions({ workspace: '/a', activeSessionId: id, onNewConversation }),
    { initialProps: { id: 'initial' } }
  )
  await waitFor(() => expect(result.current.status).toBe('ready'))
  act(() => result.current.remove('initial'))
  rerender({ id: 'other' })
  await act(async () => pending.resolve(undefined))
  expect(onNewConversation).not.toHaveBeenCalled()
})

it('ignores stale full-text results after clearing and retyping the same search', async () => {
  const old = deferred<ChatSessionMeta[]>()
  bridge.search.mockReturnValueOnce(old.promise).mockResolvedValueOnce([meta('fresh')])
  const { result } = renderHook(() => useChatSessions({ workspace: '/a' }))
  await waitFor(() => expect(result.current.status).toBe('ready'))
  act(() => result.current.setQuery('query'))
  await waitFor(() => expect(bridge.search).toHaveBeenCalledTimes(1))
  act(() => result.current.setQuery(''))
  act(() => result.current.setQuery('query'))
  await waitFor(() => expect(result.current.ftResults?.entries[0].id).toBe('fresh'))
  await act(async () => old.resolve([meta('obsolete')]))
  expect(resolveQuery(result.current)[0].id).toBe('fresh')
})

it('pauses reads while inactive and reloads a missing rename result', async () => {
  const { result, rerender } = renderHook(
    ({ active }) => useChatSessions({ workspace: '/a', active }),
    { initialProps: { active: false } }
  )
  expect(bridge.list).not.toHaveBeenCalled()
  rerender({ active: true })
  await waitFor(() => expect(result.current.status).toBe('ready'))
  bridge.rename.mockResolvedValueOnce(null as unknown as ChatSessionMeta)
  act(() => result.current.rename('initial', 'renamed'))
  await waitFor(() => expect(bridge.list).toHaveBeenCalledTimes(2))
})

it('reports a failed read as an error state and ignores one superseded by a newer read', async () => {
  const stale = deferred<ChatSessionMeta[]>()
  bridge.list.mockReturnValueOnce(stale.promise)
  const { result } = renderHook(() => useChatSessions({ workspace: '/a' }))
  // The reload starts a newer read that lands first; the failure below belongs
  // to the superseded one, so it must not blank the list it did not produce.
  act(() => result.current.reload())
  await waitFor(() => expect(result.current.status).toBe('ready'))
  await act(async () => {
    stale.resolve(Promise.reject(new Error('disk')) as unknown as ChatSessionMeta[])
  })
  expect(result.current.status).toBe('ready')
  expect(result.current.sessions?.[0].id).toBe('initial')

  // A current read that fails is a state of its own — never an empty history.
  bridge.list.mockRejectedValueOnce(new Error('disk'))
  act(() => result.current.reload())
  await waitFor(() => expect(result.current.status).toBe('error'))
  expect(result.current.sessions).toBeNull()
})

it('keeps a rename and a deletion in the open search results, not only in the loaded list', async () => {
  bridge.list.mockResolvedValue([meta('one'), meta('two')])
  bridge.search.mockResolvedValue([meta('one'), meta('two')])
  const { result } = renderHook(() => useChatSessions({ workspace: '/a' }))
  await waitFor(() => expect(result.current.status).toBe('ready'))
  act(() => result.current.setQuery('o'))
  await waitFor(() => expect(result.current.ftResults?.entries).toHaveLength(2))

  act(() => result.current.rename('one', 'renamed'))
  await waitFor(() => expect(result.current.ftResults?.entries[0].title).toBe('renamed'))
  expect(result.current.sessions?.[0].title).toBe('renamed')

  act(() => result.current.remove('two'))
  await waitFor(() => expect(result.current.ftResults?.entries).toHaveLength(1))
  expect(result.current.sessions?.map((entry) => entry.id)).toEqual(['one'])
})

it('surfaces a failed search and clears that error on the next query and on success', async () => {
  bridge.search.mockRejectedValueOnce(new Error('index'))
  const { result } = renderHook(() => useChatSessions({ workspace: '/a' }))
  await waitFor(() => expect(result.current.status).toBe('ready'))
  act(() => result.current.setQuery('broken'))
  await waitFor(() => expect(result.current.error).toBe('search'))
  expect(result.current.ftResults).toBeNull()

  // Typing again is the user retrying: the stale failure must not outlive it.
  act(() => result.current.setQuery('broken again'))
  expect(result.current.error).toBeNull()
  await waitFor(() => expect(result.current.ftResults?.query).toBe('broken again'))

  // And a search that succeeds after a failure clears the banner too.
  bridge.search.mockRejectedValueOnce(new Error('index'))
  act(() => result.current.setQuery('flaky'))
  await waitFor(() => expect(result.current.error).toBe('search'))
  bridge.search.mockResolvedValueOnce([meta('one')])
  act(() => result.current.reload())
  await waitFor(() => expect(result.current.error).toBeNull())
})
