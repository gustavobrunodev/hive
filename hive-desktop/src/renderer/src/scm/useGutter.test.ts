// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, renderHook, waitFor } from '@testing-library/react'
import { useGutter } from './useGutter'

let fileAtHead: ReturnType<typeof vi.fn>

beforeEach(() => {
  fileAtHead = vi.fn().mockResolvedValue('a\nb\nc')
  window.hive = { git: { fileAtHead } } as unknown as typeof window.hive
})

afterEach(() => {
  cleanup()
})

describe('useGutter', () => {
  it('computes marks from the HEAD baseline vs the draft', async () => {
    const { result } = renderHook(() => useGutter('/ws', 'a.txt', 'a\nB\nc', true))
    await waitFor(() => expect(result.current).toEqual([null, 'modified', null]))
    expect(fileAtHead).toHaveBeenCalledWith('/ws', 'a.txt')
  })

  it('is empty (and never fetches) when disabled', async () => {
    const { result } = renderHook(() => useGutter('/ws', 'a.txt', 'a\nB\nc', false))
    await waitFor(() => expect(result.current).toEqual([]))
    expect(fileAtHead).not.toHaveBeenCalled()
  })

  it('recomputes as the draft changes', async () => {
    const { result, rerender } = renderHook(
      ({ draft }: { draft: string }) => useGutter('/ws', 'a.txt', draft, true),
      { initialProps: { draft: 'a\nb\nc' } }
    )
    await waitFor(() => expect(result.current).toEqual([null, null, null]))
    rerender({ draft: 'a\nb\nc\nd' })
    await waitFor(() => expect(result.current).toEqual([null, null, null, 'add']))
  })

  it('treats a file with no HEAD version as all-added', async () => {
    fileAtHead.mockResolvedValue('')
    const { result } = renderHook(() => useGutter('/ws', 'new.txt', 'x\ny', true))
    await waitFor(() => expect(result.current).toEqual(['add', 'add']))
  })

  it('degrades to an empty baseline on a fileAtHead error', async () => {
    fileAtHead.mockRejectedValue(new Error('boom'))
    const { result } = renderHook(() => useGutter('/ws', 'a.txt', 'x', true))
    // Empty baseline → all-added; a single-line draft becomes one 'add'.
    await waitFor(() => expect(result.current).toEqual(['add']))
  })
})
