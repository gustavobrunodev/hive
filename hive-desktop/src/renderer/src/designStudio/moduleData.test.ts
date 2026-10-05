// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { relatorio, stubBridge } from './__tests__/fixtures'
import { useDesignData, useModuleData } from './moduleData'

/**
 * The module's data, held once above the pages: the reads, the on-demand
 * Relatório cache, the volumes and the folha's origin.
 */

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useModuleData', () => {
  it('reads the catalog, the Relatórios in use and the volumes', async () => {
    stubBridge({ relatorios: [relatorio('Pix', 'voz', [{}])] })
    const { result } = renderHook(() => useModuleData())
    expect(result.current.catalogo).toBeNull()
    await waitFor(() => expect(result.current.catalogo).not.toBeNull())
    expect(result.current.relatorios).toHaveLength(1)
    expect(result.current.volumeDe('Pix', 'voz')).toBe(6112)
    expect(result.current.volumeDe('Cartões', 'voz')).toBeNull()
  })

  it('keeps what it had when a read fails', async () => {
    stubBridge()
    window.hive.designStudio.dados = vi.fn(async () => {
      throw new Error('disco')
    })
    const { result } = renderHook(() => useModuleData())
    await act(async () => {})
    expect(result.current.catalogo).toBeNull()
    expect(result.current.relatorios).toBeNull()
  })

  it('reads an older Relatório once, however many times it is asked for', async () => {
    const antigo = relatorio('Pix', 'voz', [{}], { caminho: 'Pix/relatorios/voz/a.md' })
    const bridge = stubBridge({ porCaminho: { 'Pix/relatorios/voz/a.md': antigo } })
    const { result } = renderHook(() => useModuleData())
    expect(result.current.relatorioEm('Pix/relatorios/voz/a.md')).toBeUndefined()
    act(() => result.current.carregar('Pix/relatorios/voz/a.md'))
    act(() => result.current.carregar('Pix/relatorios/voz/a.md'))
    await waitFor(() =>
      expect(result.current.relatorioEm('Pix/relatorios/voz/a.md')).toEqual(antigo)
    )
    expect(bridge.relatorio).toHaveBeenCalledTimes(1)
  })

  it('opens and closes the folha, keeping the first origin while it walks through other Dores', () => {
    stubBridge()
    const { result } = renderHook(() => useModuleData())
    const nota = document.createElement('button')
    act(() => result.current.folha.abrir({ relatorio: 'a', dor: '1' }, nota))
    act(() => result.current.folha.abrir({ relatorio: 'a', dor: '2' }))
    expect(result.current.folha.aberta).toEqual({ relatorio: 'a', dor: '2' })
    expect(result.current.folha.origem).toBe(nota)
    act(() => result.current.folha.abrir({ relatorio: 'a', dor: '3' }, null))
    expect(result.current.folha.origem).toBeNull()
    act(() => result.current.folha.fechar())
    expect(result.current.folha.aberta).toBeNull()
  })

  it('remembers the Produto Dores shows, set from anywhere', () => {
    stubBridge()
    const { result } = renderHook(() => useModuleData())
    expect(result.current.doresProduto).toBeNull()
    act(() => result.current.setDoresProduto('Pix'))
    expect(result.current.doresProduto).toBe('Pix')
  })

  it('refuses to be read outside the module', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => renderHook(() => useDesignData())).toThrow(/fora do Design Studio/)
  })
})
