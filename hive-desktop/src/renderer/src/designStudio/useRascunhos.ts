import { useCallback, useMemo, useState } from 'react'
import type { DorCitada } from './relatorioModel'

/**
 * Design Studio — the drafts of the module's chat fields: which Dores each
 * one cites, and the question the folha asked to send.
 *
 * Lote 2 writes to it (the folha's "Citar no chat" / "Citar nesta conversa"
 * and "Perguntar ao agente"); lote 3's fields read it — the home's field and
 * one per conversation. It lives with the module's data, above the pages, so
 * a citation made on Dores is still there when the person reaches the home.
 */

/** A chat field of the module: the home's, or a conversation's. */
export type CampoId = 'inicio' | `conversa:${string}`

/** The field of one conversation, keyed the way the history keys it: Produto and id. */
export function conversationField(produto: string, conversa: string): CampoId {
  return `conversa:${produto}/${conversa}`
}

/** A question waiting to be sent: "Perguntar ao agente" asked for it (criterion 22). */
export interface PerguntaPendente {
  produto: string
  citacao: DorCitada
  texto: string
}

export interface RascunhoStore {
  /** The Dores a field cites, in the order they were cited. */
  citadas: (campo: CampoId) => readonly DorCitada[]
  estaCitada: (campo: CampoId, citacao: DorCitada) => boolean
  /** Cites a Dor in a field; citing it twice keeps one. */
  citar: (campo: CampoId, citacao: DorCitada) => void
  descitar: (campo: CampoId, citacao: DorCitada) => void
  /** Cites, or un-cites — what touching a note does on the home (criterion 38). */
  alternar: (campo: CampoId, citacao: DorCitada) => void
  limpar: (campo: CampoId) => void
  pergunta: PerguntaPendente | null
  perguntar: (pergunta: PerguntaPendente) => void
  /** Takes the pending question — the sender calls it once it has the question in hand. */
  consumirPergunta: () => PerguntaPendente | null
}

function same(a: DorCitada, b: DorCitada): boolean {
  return a.relatorio === b.relatorio && a.dor === b.dor
}

const NENHUMA: readonly DorCitada[] = []

export function useRascunhos(): RascunhoStore {
  const [campos, setCampos] = useState<Readonly<Record<string, readonly DorCitada[]>>>({})
  const [pergunta, setPergunta] = useState<PerguntaPendente | null>(null)

  const update = useCallback(
    (campo: CampoId, change: (atual: readonly DorCitada[]) => readonly DorCitada[]) =>
      setCampos((current) => ({ ...current, [campo]: change(current[campo] ?? NENHUMA) })),
    []
  )

  const citar = useCallback(
    (campo: CampoId, citacao: DorCitada) =>
      update(campo, (atual) => (atual.some((c) => same(c, citacao)) ? atual : [...atual, citacao])),
    [update]
  )
  const descitar = useCallback(
    (campo: CampoId, citacao: DorCitada) =>
      update(campo, (atual) => atual.filter((c) => !same(c, citacao))),
    [update]
  )
  const alternar = useCallback(
    (campo: CampoId, citacao: DorCitada) =>
      update(campo, (atual) =>
        atual.some((c) => same(c, citacao))
          ? atual.filter((c) => !same(c, citacao))
          : [...atual, citacao]
      ),
    [update]
  )
  const limpar = useCallback((campo: CampoId) => update(campo, () => NENHUMA), [update])

  const consumirPergunta = useCallback((): PerguntaPendente | null => {
    const atual = pergunta
    setPergunta(null)
    return atual
  }, [pergunta])

  return useMemo(
    () => ({
      citadas: (campo: CampoId) => campos[campo] ?? NENHUMA,
      estaCitada: (campo: CampoId, citacao: DorCitada) =>
        (campos[campo] ?? NENHUMA).some((c) => same(c, citacao)),
      citar,
      descitar,
      alternar,
      limpar,
      pergunta,
      perguntar: setPergunta,
      consumirPergunta
    }),
    [campos, citar, descitar, alternar, limpar, pergunta, consumirPergunta]
  )
}
