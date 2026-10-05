// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { conversationField, useRascunhos } from './useRascunhos'

/**
 * The chat drafts the folha writes and lote 3's fields read: Dores cited per
 * field (the home's, one per conversation) and the question waiting to be sent.
 */
const A = { relatorio: 'Câmbio/relatorios/voz/a.md', dor: 'estorno' }
const B = { relatorio: 'Câmbio/relatorios/likert/b.md', dor: 'cotacao' }

describe('useRascunhos', () => {
  it('cites per field, once, in the order cited', () => {
    const { result } = renderHook(() => useRascunhos())
    act(() => result.current.citar('inicio', A))
    act(() => result.current.citar('inicio', B))
    act(() => result.current.citar('inicio', A))
    expect(result.current.citadas('inicio')).toEqual([A, B])
    expect(result.current.estaCitada('inicio', B)).toBe(true)
    const conversa = conversationField('Câmbio', 'c1')
    expect(conversa).toBe('conversa:Câmbio/c1')
    expect(result.current.citadas(conversa)).toEqual([])
    expect(result.current.estaCitada(conversa, A)).toBe(false)
  })

  it('un-cites, toggles and clears', () => {
    const { result } = renderHook(() => useRascunhos())
    act(() => result.current.alternar('inicio', A))
    expect(result.current.citadas('inicio')).toEqual([A])
    act(() => result.current.alternar('inicio', A))
    expect(result.current.citadas('inicio')).toEqual([])
    act(() => result.current.citar('inicio', A))
    act(() => result.current.citar('inicio', B))
    act(() => result.current.descitar('inicio', A))
    expect(result.current.citadas('inicio')).toEqual([B])
    act(() => result.current.limpar('inicio'))
    expect(result.current.citadas('inicio')).toEqual([])
  })

  it('holds one question until the sender takes it', () => {
    const { result } = renderHook(() => useRascunhos())
    const pergunta = {
      produto: 'Câmbio',
      citacao: A,
      texto: 'Me explique a Dor “Estorno” e o que você mudaria primeiro.'
    }
    act(() => result.current.perguntar(pergunta))
    expect(result.current.pergunta).toEqual(pergunta)
    let tomada: unknown
    act(() => {
      tomada = result.current.consumirPergunta()
    })
    expect(tomada).toEqual(pergunta)
    expect(result.current.pergunta).toBeNull()
  })
})
