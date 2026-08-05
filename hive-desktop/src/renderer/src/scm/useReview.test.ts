// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { ReviewProvider, useReview, useReviewOptional, useReviewStore } from './useReview'
import type { ReviewChange, ReviewSnapshot } from './reviewTypes'

const WS = '/ws'

function change(
  path: string,
  status: ReviewChange['status'],
  extra?: Partial<ReviewChange>
): ReviewChange {
  return {
    path,
    status,
    diff: { hunks: [], binary: false },
    adds: 0,
    dels: 0,
    ...extra
  }
}

let onChangedCb: ((evt: { workspace: string } & ReviewSnapshot) => void) | null
let reviewMock: {
  get: ReturnType<typeof vi.fn>
  acceptFile: ReturnType<typeof vi.fn>
  rejectFile: ReturnType<typeof vi.fn>
  acceptFiles: ReturnType<typeof vi.fn>
  rejectFiles: ReturnType<typeof vi.fn>
  acceptHunk: ReturnType<typeof vi.fn>
  rejectHunk: ReturnType<typeof vi.fn>
  acceptAll: ReturnType<typeof vi.fn>
  rejectAll: ReturnType<typeof vi.fn>
  onChanged: ReturnType<typeof vi.fn>
}

beforeEach(() => {
  onChangedCb = null
  reviewMock = {
    get: vi.fn(async () => ({ changes: [], turns: [] })),
    acceptFile: vi.fn(async () => ({ ok: true })),
    rejectFile: vi.fn(async () => ({ ok: true })),
    acceptFiles: vi.fn(async () => ({ ok: true })),
    rejectFiles: vi.fn(async () => ({ ok: true })),
    acceptHunk: vi.fn(async () => ({ ok: true })),
    rejectHunk: vi.fn(async () => ({ ok: true })),
    acceptAll: vi.fn(async () => ({ ok: true })),
    rejectAll: vi.fn(async () => ({ ok: true })),
    onChanged: vi.fn((cb: (evt: { workspace: string } & ReviewSnapshot) => void) => {
      onChangedCb = cb
      return () => {}
    })
  }
  window.hive = { review: reviewMock } as unknown as typeof window.hive
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('useReviewStore', () => {
  it('loads the snapshot on mount and derives pendingCount / byStatus', async () => {
    reviewMock.get.mockResolvedValueOnce({
      changes: [
        change('a.txt', 'created'),
        change('b.txt', 'modified'),
        change('c.txt', 'deleted')
      ],
      turns: [{ turnId: 't1', at: 1, paths: ['a.txt'] }]
    })
    const { result } = renderHook(() => useReviewStore(WS))

    await waitFor(() => expect(result.current.pendingCount).toBe(3))
    expect(result.current.byStatus.created.map((c) => c.path)).toEqual(['a.txt'])
    expect(result.current.byStatus.modified.map((c) => c.path)).toEqual(['b.txt'])
    expect(result.current.byStatus.deleted.map((c) => c.path)).toEqual(['c.txt'])
    expect(result.current.turns).toHaveLength(1)
    expect(result.current.isStale).toBe(false)
  })

  it('updates from a review:changed push for the matching workspace', async () => {
    const { result } = renderHook(() => useReviewStore(WS))
    await waitFor(() => expect(reviewMock.onChanged).toHaveBeenCalled())

    act(() => {
      onChangedCb!({ workspace: WS, changes: [change('x.txt', 'modified')], turns: [] })
    })
    expect(result.current.pendingCount).toBe(1)
  })

  it('ignores a push for a different workspace', async () => {
    const { result } = renderHook(() => useReviewStore(WS))
    await waitFor(() => expect(reviewMock.onChanged).toHaveBeenCalled())

    act(() => {
      onChangedCb!({ workspace: '/other', changes: [change('y.txt', 'created')], turns: [] })
    })
    expect(result.current.pendingCount).toBe(0)
  })

  it('derives isStale from a hand-edited change', async () => {
    reviewMock.get.mockResolvedValueOnce({
      changes: [change('a.txt', 'modified', { staleUserEdit: true })],
      turns: []
    })
    const { result } = renderHook(() => useReviewStore(WS))
    await waitFor(() => expect(result.current.isStale).toBe(true))
  })

  it('routes accept/reject actions to the bridge and returns the result', async () => {
    const { result } = renderHook(() => useReviewStore(WS))
    await waitFor(() => expect(reviewMock.get).toHaveBeenCalled())

    await act(async () => {
      expect(await result.current.acceptFile('a.txt')).toEqual({ ok: true })
      await result.current.rejectFile('a.txt')
      await result.current.acceptHunk('a.txt', '0:1:1')
      await result.current.rejectHunk('a.txt', '0:1:1')
      await result.current.acceptAll()
      await result.current.rejectAll()
    })

    expect(reviewMock.acceptFile).toHaveBeenCalledWith(WS, 'a.txt')
    expect(reviewMock.rejectFile).toHaveBeenCalledWith(WS, 'a.txt')
    expect(reviewMock.acceptHunk).toHaveBeenCalledWith(WS, 'a.txt', '0:1:1')
    expect(reviewMock.rejectHunk).toHaveBeenCalledWith(WS, 'a.txt', '0:1:1')
    expect(reviewMock.acceptAll).toHaveBeenCalledWith(WS)
    expect(reviewMock.rejectAll).toHaveBeenCalledWith(WS)
  })

  it('reads empty until the new workspace snapshot lands after a switch', async () => {
    reviewMock.get.mockResolvedValue({ changes: [change('a.txt', 'created')], turns: [] })
    const { result, rerender } = renderHook(({ ws }) => useReviewStore(ws), {
      initialProps: { ws: WS }
    })
    await waitFor(() => expect(result.current.pendingCount).toBe(1))

    // Switch workspace: the previous workspace's tagged state no longer matches,
    // so it derives empty until the new fetch lands.
    reviewMock.get.mockResolvedValue({ changes: [], turns: [] })
    rerender({ ws: '/other' })
    await waitFor(() => expect(result.current.pendingCount).toBe(0))
    expect(result.current.workspace).toBe('/other')
  })

  it('surfaces a {stale:true} result from a decision', async () => {
    reviewMock.rejectFile.mockResolvedValueOnce({ ok: false, stale: true })
    const { result } = renderHook(() => useReviewStore(WS))
    await waitFor(() => expect(reviewMock.get).toHaveBeenCalled())

    let res: unknown
    await act(async () => {
      res = await result.current.rejectFile('a.txt')
    })
    expect(res).toEqual({ ok: false, stale: true })
  })

  it('records a staleConflict when a decision is blocked (ACR-R3.2)', async () => {
    reviewMock.acceptFile.mockResolvedValueOnce({ ok: false, stale: true })
    const { result } = renderHook(() => useReviewStore(WS))
    await waitFor(() => expect(reviewMock.get).toHaveBeenCalled())

    await act(async () => {
      await result.current.acceptFile('a.txt')
    })
    expect(result.current.staleConflict).toEqual({ path: 'a.txt' })
  })

  it('resolveStale "mine" re-syncs then keeps the current bytes (acceptFile)', async () => {
    reviewMock.rejectHunk.mockResolvedValueOnce({ ok: false, stale: true })
    const { result } = renderHook(() => useReviewStore(WS))
    await waitFor(() => expect(reviewMock.get).toHaveBeenCalled())
    await act(async () => {
      await result.current.rejectHunk('a.txt', '0:1:1')
    })
    reviewMock.get.mockClear()

    await act(async () => {
      await result.current.resolveStale('mine')
    })
    // A get() re-syncs the mtime, then acceptFile keeps the user's bytes.
    expect(reviewMock.get).toHaveBeenCalledWith(WS)
    expect(reviewMock.acceptFile).toHaveBeenCalledWith(WS, 'a.txt')
    expect(result.current.staleConflict).toBeNull()
  })

  it('resolveStale "agent" restores the pre-turn state (rejectFile)', async () => {
    reviewMock.acceptFile.mockResolvedValueOnce({ ok: false, stale: true })
    const { result } = renderHook(() => useReviewStore(WS))
    await waitFor(() => expect(reviewMock.get).toHaveBeenCalled())
    await act(async () => {
      await result.current.acceptFile('a.txt')
    })

    await act(async () => {
      await result.current.resolveStale('agent')
    })
    expect(reviewMock.rejectFile).toHaveBeenCalledWith(WS, 'a.txt')
    expect(result.current.staleConflict).toBeNull()
  })

  it('resolveStale "cancel" dismisses without acting', async () => {
    reviewMock.acceptFile.mockResolvedValueOnce({ ok: false, stale: true })
    const { result } = renderHook(() => useReviewStore(WS))
    await waitFor(() => expect(reviewMock.get).toHaveBeenCalled())
    await act(async () => {
      await result.current.acceptFile('a.txt')
    })
    reviewMock.acceptFile.mockClear()
    reviewMock.rejectFile.mockClear()

    await act(async () => {
      await result.current.resolveStale('cancel')
    })
    expect(reviewMock.acceptFile).not.toHaveBeenCalled()
    expect(reviewMock.rejectFile).not.toHaveBeenCalled()
    expect(result.current.staleConflict).toBeNull()
  })
})

describe('ReviewProvider / useReview', () => {
  it('provides the store to the subtree', async () => {
    const { result } = renderHook(() => useReview(), {
      wrapper: ({ children }) =>
        createElement(
          ReviewProvider,
          {
            store: {
              workspace: WS,
              changes: [change('a.txt', 'created')],
              turns: [],
              pendingCount: 1,
              byStatus: { created: [change('a.txt', 'created')], modified: [], deleted: [] },
              isStale: false,
              refresh: vi.fn(),
              acceptFile: vi.fn(),
              rejectFile: vi.fn(),
              acceptFiles: vi.fn(),
              rejectFiles: vi.fn(),
              acceptHunk: vi.fn(),
              rejectHunk: vi.fn(),
              acceptAll: vi.fn(),
              rejectAll: vi.fn(),
              staleConflict: null,
              resolveStale: vi.fn()
            }
          },
          children
        )
    })
    expect(result.current.pendingCount).toBe(1)
  })

  it('throws when used outside a provider', () => {
    expect(() => renderHook(() => useReview())).toThrow('within a ReviewProvider')
  })

  it('useReviewOptional returns null outside a provider and the store within', () => {
    const { result: outside } = renderHook(() => useReviewOptional())
    expect(outside.current).toBeNull()

    const store = {
      workspace: WS,
      changes: [],
      turns: [],
      pendingCount: 0,
      byStatus: { created: [], modified: [], deleted: [] },
      isStale: false,
      refresh: vi.fn(),
      acceptFile: vi.fn(),
      rejectFile: vi.fn(),
      acceptHunk: vi.fn(),
      rejectHunk: vi.fn(),
      acceptAll: vi.fn(),
      rejectAll: vi.fn(),
      staleConflict: null,
      resolveStale: vi.fn()
    } as unknown as Parameters<typeof ReviewProvider>[0]['store']
    const { result: inside } = renderHook(() => useReviewOptional(), {
      wrapper: ({ children }) => createElement(ReviewProvider, { store }, children)
    })
    expect(inside.current).toBe(store)
  })
})
