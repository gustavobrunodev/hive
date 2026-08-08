// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, renderHook, waitFor } from '@testing-library/react'
import { isLive, mergeEntries, useMcpLogs } from './useMcpLogs'
import type { McpLogEntry } from './logConsole'

/**
 * `useMcpLogs` unit tests. The two things worth proving here are the ones a
 * running app hides until it hurts: that a live batch never duplicates a row
 * `read` already delivered, and that a workspace switch can't leave the
 * previous workspace's events on screen under the new workspace's name.
 */

let seq = 0

function entry(overrides: Partial<McpLogEntry> = {}): McpLogEntry {
  seq += 1
  return {
    id: `f#${seq}`,
    server: 'playwright',
    at: 1_000 + seq,
    level: 'info',
    kind: 'notice',
    text: 'x',
    detail: '',
    sessionId: 's1',
    tool: null,
    durationMs: null,
    transport: null,
    serverVersion: null,
    raw: '{}',
    ...overrides
  }
}

/** The live-tail callback the hook handed to `watch`, once it has subscribed. */
let emit: ((batch: McpLogEntry[]) => void) | null = null
let stop: ReturnType<typeof vi.fn>
let read: ReturnType<typeof vi.fn>
let sources: ReturnType<typeof vi.fn>

beforeEach(() => {
  emit = null
  stop = vi.fn()
  read = vi.fn().mockResolvedValue([])
  sources = vi.fn().mockResolvedValue([])
  ;(window as unknown as { hive: unknown }).hive = {
    mcpLogs: {
      read,
      sources,
      openDir: vi.fn(),
      watch: vi.fn((_workspace: string, onBatch: (batch: McpLogEntry[]) => void) => {
        emit = onBatch
        return stop
      })
    }
  }
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('mergeEntries', () => {
  it('returns the same array reference for an empty batch', () => {
    const current = [entry()]
    expect(mergeEntries(current, [])).toBe(current)
  })

  it('drops ids already in the buffer — read and watch overlap by design', () => {
    const shared = entry({ id: 'dup' })
    expect(mergeEntries([shared], [shared])).toHaveLength(1)
  })

  it('returns the same reference when the whole batch is a duplicate', () => {
    const shared = entry({ id: 'dup' })
    const current = [shared]
    expect(mergeEntries(current, [shared])).toBe(current)
  })

  it('de-duplicates within one batch too', () => {
    const twice = entry({ id: 'same' })
    expect(mergeEntries([], [twice, twice])).toHaveLength(1)
  })

  it('sorts by time, breaking ties on id so the order is stable', () => {
    const merged = mergeEntries(
      [entry({ id: 'b', at: 20 })],
      [entry({ id: 'a', at: 20 }), entry({ id: 'c', at: 10 })]
    )
    expect(merged.map((row) => row.id)).toEqual(['c', 'a', 'b'])
  })

  it('caps the buffer, dropping oldest first', () => {
    const many = Array.from({ length: 4200 }, (_unused, index) =>
      entry({ id: `n${index}`, at: index })
    )
    const merged = mergeEntries([], many)
    expect(merged).toHaveLength(4000)
    expect(merged[0].at).toBe(200)
  })
})

describe('isLive', () => {
  it('is false with nothing to report', () => {
    expect(isLive(null, 5_000)).toBe(false)
  })

  it('is true inside the window and false outside it', () => {
    expect(isLive(100_000, 105_000)).toBe(true)
    expect(isLive(100_000, 130_000)).toBe(false)
  })
})

describe('useMcpLogs', () => {
  it('loads history and sources, then reports not-loading', async () => {
    const history = [entry({ text: 'histórico' })]
    read.mockResolvedValue(history)
    sources.mockResolvedValue([
      { server: 'playwright', dir: '/d', files: 2, lastActivityAt: 5 }
    ])

    const { result } = renderHook(() => useMcpLogs('/ws'))
    expect(result.current.loading).toBe(true)

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.entries).toEqual(history)
    expect(result.current.sources).toHaveLength(1)
    expect(result.current.lastAt).toBe(history[0].at)
  })

  it('surfaces a read failure as a message instead of hanging on the spinner', async () => {
    read.mockRejectedValue(new Error('sem permissão'))
    const { result } = renderHook(() => useMcpLogs('/ws'))
    await waitFor(() => expect(result.current.error).toBe('sem permissão'))
    expect(result.current.loading).toBe(false)
  })

  it('appends a live batch and marks exactly those rows fresh', async () => {
    const { result } = renderHook(() => useMcpLogs('/ws'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    const live = entry({ text: 'ao vivo' })
    emit?.([live])
    await waitFor(() => expect(result.current.entries).toHaveLength(1))
    expect(result.current.freshIds.has(live.id)).toBe(true)
  })

  it('clears the fresh marks once the entrance window passes', async () => {
    vi.useFakeTimers()
    try {
      const { result } = renderHook(() => useMcpLogs('/ws'))
      await vi.waitFor(() => expect(result.current.loading).toBe(false))
      emit?.([entry()])
      await vi.waitFor(() => expect(result.current.freshIds.size).toBe(1))
      await vi.advanceTimersByTimeAsync(700)
      expect(result.current.freshIds.size).toBe(0)
    } finally {
      vi.useRealTimers()
    }
  })

  it('re-reads sources when a server it has never seen starts logging', async () => {
    const { result } = renderHook(() => useMcpLogs('/ws'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    sources.mockClear()

    emit?.([entry({ server: 'pencil' })])
    await waitFor(() => expect(sources).toHaveBeenCalledTimes(1))

    // A second batch from the same server must not re-fetch.
    sources.mockClear()
    emit?.([entry({ server: 'pencil' })])
    await waitFor(() => expect(result.current.entries).toHaveLength(2))
    expect(sources).not.toHaveBeenCalled()
  })

  it('keeps the stream when a source refresh fails', async () => {
    const { result } = renderHook(() => useMcpLogs('/ws'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    sources.mockRejectedValue(new Error('nope'))

    emit?.([entry({ server: 'pencil' })])
    await waitFor(() => expect(result.current.entries).toHaveLength(1))
    expect(result.current.error).toBeNull()
  })

  it('drops the previous workspace the moment the new one is requested', async () => {
    read.mockResolvedValue([entry({ text: 'do primeiro workspace' })])
    const { result, rerender } = renderHook(({ ws }) => useMcpLogs(ws), {
      initialProps: { ws: '/a' }
    })
    await waitFor(() => expect(result.current.entries).toHaveLength(1))

    read.mockResolvedValue([])
    rerender({ ws: '/b' })
    // No stale frame: the old workspace's rows are gone in the same render.
    expect(result.current.entries).toEqual([])
    expect(result.current.loading).toBe(true)
  })

  it('ignores a batch that arrives before its workspace has loaded', async () => {
    let resolveRead: (value: McpLogEntry[]) => void = () => {}
    read.mockReturnValue(
      new Promise<McpLogEntry[]>((resolve) => {
        resolveRead = resolve
      })
    )
    const { result } = renderHook(() => useMcpLogs('/ws'))
    emit?.([entry({ text: 'cedo demais' })])
    expect(result.current.entries).toEqual([])

    resolveRead([])
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.entries).toEqual([])
  })

  it('re-reads on reload()', async () => {
    const { result } = renderHook(() => useMcpLogs('/ws'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    read.mockClear()
    result.current.reload()
    await waitFor(() => expect(read).toHaveBeenCalledTimes(1))
  })

  it('tears the watcher down on unmount', async () => {
    const { result, unmount } = renderHook(() => useMcpLogs('/ws'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    unmount()
    expect(stop).toHaveBeenCalled()
  })
})
