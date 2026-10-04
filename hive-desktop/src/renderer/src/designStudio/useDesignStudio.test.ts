// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useDesignStudio, type ModuleConversation } from './useDesignStudio'

/**
 * The module's state, held above both of its halves — the navigation in the
 * sidebar and the pages in the work area — so the two always agree on where
 * the person is, and so leaving the module and coming back finds it unchanged.
 */

const ROW: ModuleConversation = {
  id: 'c1',
  produto: 'Câmbio',
  title: 'Estorno sem aviso',
  createdAt: 1,
  updatedAt: 2,
  messageCount: 2,
  agent: 'claude-cli',
  preview: 'trecho',
  initiativePath: null
}

let conversations: ReturnType<typeof vi.fn>

beforeEach(() => {
  conversations = vi.fn(async () => [ROW])
  vi.stubGlobal('hive', { designStudio: { conversations } })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useDesignStudio', () => {
  it('opens on the module home, with only the home mounted', () => {
    const { result } = renderHook(() => useDesignStudio(false))
    expect(result.current.route).toEqual({ pagina: 'inicio' })
    expect(result.current.mountedPages).toEqual(['inicio'])
  })

  it('mounts each page the first time it is shown, and keeps it', () => {
    const { result } = renderHook(() => useDesignStudio(true))
    act(() => result.current.navigate({ pagina: 'dores' }))
    act(() =>
      result.current.navigate({ pagina: 'relatorio', relatorio: 'Pix/relatorios/voz/a.md' })
    )
    act(() => result.current.navigate({ pagina: 'inicio' }))
    expect(result.current.route).toEqual({ pagina: 'inicio' })
    expect(result.current.mountedPages).toEqual(['inicio', 'dores', 'relatorio'])
  })

  it('remembers the route each page was last shown with', () => {
    // A hidden Relatório layer still renders, and has to know which file it is.
    const relatorio = { pagina: 'relatorio', relatorio: 'Pix/relatorios/voz/a.md' } as const
    const { result } = renderHook(() => useDesignStudio(true))
    act(() => result.current.navigate(relatorio))
    act(() => result.current.navigate({ pagina: 'dores' }))
    expect(result.current.pageRoutes).toEqual({
      inicio: { pagina: 'inicio' },
      relatorio,
      dores: { pagina: 'dores' }
    })
  })

  it('does not read the disk while the module is away', () => {
    renderHook(() => useDesignStudio(false))
    expect(conversations).not.toHaveBeenCalled()
  })

  it('reads the module conversations on every arrival', async () => {
    const { result, rerender } = renderHook(({ active }) => useDesignStudio(active), {
      initialProps: { active: true }
    })
    await waitFor(() => expect(result.current.conversations).toEqual([ROW]))
    expect(result.current.loadedAt).toBeGreaterThan(0)

    rerender({ active: false })
    rerender({ active: true })
    await waitFor(() => expect(conversations).toHaveBeenCalledTimes(2))
  })

  it('keeps what it had when a read fails — a hiccup is not "no conversations"', async () => {
    const { result, rerender } = renderHook(({ active }) => useDesignStudio(active), {
      initialProps: { active: true }
    })
    await waitFor(() => expect(result.current.conversations).toEqual([ROW]))

    conversations.mockRejectedValueOnce(new Error('EACCES'))
    rerender({ active: false })
    rerender({ active: true })
    await waitFor(() => expect(conversations).toHaveBeenCalledTimes(2))
    expect(result.current.conversations).toEqual([ROW])
  })

  it('stays unloaded when the very first read fails', async () => {
    conversations.mockRejectedValueOnce(new Error('EACCES'))
    const { result } = renderHook(() => useDesignStudio(true))
    await waitFor(() => expect(conversations).toHaveBeenCalledTimes(1))
    expect(result.current.conversations).toBeNull()
  })

  it('drops a reply that lands after the module was left', async () => {
    let resolve: (rows: ModuleConversation[]) => void = () => {}
    conversations.mockImplementationOnce(
      () => new Promise<ModuleConversation[]>((done) => (resolve = done))
    )
    const { result, rerender } = renderHook(({ active }) => useDesignStudio(active), {
      initialProps: { active: true }
    })
    rerender({ active: false })
    await act(async () => resolve([ROW]))
    expect(result.current.conversations).toBeNull()
  })
})
