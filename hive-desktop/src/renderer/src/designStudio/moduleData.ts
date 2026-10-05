import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useGeracao, type GeracaoStore } from './useGeracao'
import { useRascunhos, type RascunhoStore } from './useRascunhos'
import type { FonteId } from './model'
import type { Catalogo, DadosDoModulo, DorCitada, RelatorioDeFonte } from './relatorioModel'

/**
 * Design Studio — the module's data, held once for every page: the catalog,
 * the Relatórios in use, the generation, the chat drafts and the open folha.
 *
 * Held by the module's work area (`DesignStudioShell`), which stays mounted
 * once shown, so leaving the module and coming back finds the drafts and the
 * folha's place untouched. The Relatórios are re-read whenever a generation
 * publishes one.
 */

/** The folha da Dor: which Dor is open, and the element focus returns to (criterion 23). */
export interface FolhaState {
  aberta: DorCitada | null
  origem: HTMLElement | null
  /** Opens a Dor. From inside the folha (a "Na mesma tela" row) the original origin is kept. */
  abrir: (citacao: DorCitada, origem?: HTMLElement | null) => void
  fechar: () => void
}

export interface ModuleData {
  catalogo: Catalogo | null
  /** The most recent valid Relatório of each Produto × Fonte; `null` until the first read lands. */
  relatorios: readonly RelatorioDeFonte[] | null
  /** What a Fonte holds for a Produto in the period, before any Relatório (Landing 19). */
  volumeDe: (produto: string, fonte: FonteId) => number | null
  /**
   * One Relatório by its path: from the ones in use, or read on demand.
   * `undefined` while that read is on its way; `null` when the file is gone.
   */
  relatorioEm: (caminho: string) => RelatorioDeFonte | null | undefined
  /** Starts reading a Relatório that is not among the ones in use. */
  carregar: (caminho: string) => void
  recarregar: () => void
  geracao: GeracaoStore
  rascunhos: RascunhoStore
  folha: FolhaState
  /** The Produto the Dores page shows — set from outside too ("Ver todas" on the home). */
  doresProduto: string | null
  setDoresProduto: (produto: string) => void
}

/** Carries the module's data from `DesignStudioShell` down to every page and the folha. */
export const ModuleDataContext = createContext<ModuleData | null>(null)

/** The module's data, inside the module's work area. */
export function useDesignData(): ModuleData {
  const value = useContext(ModuleDataContext)
  if (!value) throw new Error('useDesignData fora do Design Studio')
  return value
}

function useFolha(): FolhaState {
  const [state, setState] = useState<{ aberta: DorCitada | null; origem: HTMLElement | null }>({
    aberta: null,
    origem: null
  })
  const abrir = useCallback((citacao: DorCitada, origem?: HTMLElement | null) => {
    setState((current) => ({
      aberta: citacao,
      origem: origem === undefined ? current.origem : origem
    }))
  }, [])
  const fechar = useCallback(() => setState((current) => ({ ...current, aberta: null })), [])
  return useMemo(() => ({ ...state, abrir, fechar }), [state, abrir, fechar])
}

export function useModuleData(): ModuleData {
  const [dados, setDados] = useState<{
    catalogo: Catalogo | null
    relatorios: readonly RelatorioDeFonte[] | null
    volumes: DadosDoModulo['volumes']
  }>({ catalogo: null, relatorios: null, volumes: {} })
  const [lidos, setLidos] = useState<Readonly<Record<string, RelatorioDeFonte | null>>>({})
  const pedidos = useRef(new Set<string>())
  const [doresProduto, setDoresProduto] = useState<string | null>(null)

  const recarregar = useCallback(() => {
    window.hive.designStudio
      .dados()
      .then((lido) =>
        setDados({ catalogo: lido.catalogo, relatorios: lido.relatorios, volumes: lido.volumes })
      )
      // A read that fails keeps what was on screen: local disk failing is not
      // "no Relatórios", and saying so would be the one wrong answer.
      .catch(() => {})
  }, [])

  useEffect(recarregar, [recarregar])

  const carregar = useCallback((caminho: string) => {
    if (pedidos.current.has(caminho)) return
    pedidos.current.add(caminho)
    window.hive.designStudio
      .relatorio(caminho)
      .then((relatorio) => setLidos((current) => ({ ...current, [caminho]: relatorio })))
      .catch(() => setLidos((current) => ({ ...current, [caminho]: null })))
  }, [])

  const relatorioEm = useCallback(
    (caminho: string): RelatorioDeFonte | null | undefined =>
      dados.relatorios?.find((relatorio) => relatorio.caminho === caminho) ?? lidos[caminho],
    [dados.relatorios, lidos]
  )

  const volumeDe = useCallback(
    (produto: string, fonte: FonteId): number | null => dados.volumes[produto]?.[fonte] ?? null,
    [dados.volumes]
  )

  const geracao = useGeracao(recarregar)
  const rascunhos = useRascunhos()
  const folha = useFolha()

  return useMemo(
    () => ({
      catalogo: dados.catalogo,
      relatorios: dados.relatorios,
      volumeDe,
      relatorioEm,
      carregar,
      recarregar,
      geracao,
      rascunhos,
      folha,
      doresProduto,
      setDoresProduto
    }),
    [dados, volumeDe, relatorioEm, carregar, recarregar, geracao, rascunhos, folha, doresProduto]
  )
}
