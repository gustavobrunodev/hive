import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { t } from '../i18n'
import { fonteName, moduleDefaultAgent, type FonteId, type ModuleAgent } from './model'
import type { EventoDeGeracao } from './relatorioModel'

/**
 * Design Studio — asking for a Relatório, and following it to the end
 * (criteria 12–16, Landing 18 and 19).
 *
 * Main plans the turn and owns its file; this hook starts it — one
 * `agent.send`, on the module's default agent, with the plan's scope — and
 * listens to the generation's own channel for its steps and its end. Never to
 * `agent.onEvent`: the window has one agent subscription, and it is the
 * Chat's.
 *
 * One generation at a time (criterion 16). The lock is taken synchronously,
 * before the first await, so a double click cannot slip a second turn in
 * between the plan and the send.
 */

/** The generation in flight, as the pages draw it: which one, and its step (1–4). */
export interface GeracaoEmCurso {
  turnId: string
  produto: string
  fonte: FonteId
  passo: number
}

/** A notice the module shows over its pages. */
export interface Aviso {
  id: number
  tipo: 'pronto' | 'falha' | 'ocupado'
  texto: string
  /** A failure offers "Tentar de novo" for the same Produto and Fonte (criterion 15). */
  repetir?: { produto: string; fonte: FonteId }
}

export interface GeracaoStore {
  emCurso: GeracaoEmCurso | null
  /** Asks for a Relatório — "Gerar", "Gerar Relatório de <Fonte>", "Gerar de novo". */
  pedir: (produto: string, fonte: FonteId) => void
  avisos: readonly Aviso[]
  dispensar: (id: number) => void
}

/**
 * The module's default agent, read fresh for each request: the Hive's default
 * and the pins can change between two of them. A read that fails falls back
 * to the written default rather than refusing the request.
 */
export async function resolveModuleAgent(): Promise<ModuleAgent> {
  const [hiveDefault, agents, pins] = await Promise.all([
    window.hive.profile.getAgent().catch(() => null),
    window.hive.profile.agents().catch(() => []),
    window.hive.agent.pins().catch(() => ({}))
  ])
  return moduleDefaultAgent(hiveDefault, agents, pins)
}

/** The failure's reason, in pt-BR and without one technical word (criterion 15). */
function motivoTexto(motivo: 'erro' | 'interrompido' | 'formato', fonte: FonteId): string {
  return t(`designStudio.geracao.${motivo}`, fonteName(fonte))
}

export function useGeracao(onPronto: () => void): GeracaoStore {
  const [emCurso, setEmCurso] = useState<GeracaoEmCurso | null>(null)
  const [avisos, setAvisos] = useState<Aviso[]>([])
  const lock = useRef(false)
  const nextId = useRef(0)
  const prontoRef = useRef(onPronto)
  useEffect(() => {
    prontoRef.current = onPronto
  }, [onPronto])

  const avisar = useCallback((aviso: Omit<Aviso, 'id'>) => {
    nextId.current += 1
    const id = nextId.current
    setAvisos((current) => [...current, { ...aviso, id }])
  }, [])

  const aoEvento = useCallback(
    (evento: EventoDeGeracao) => {
      if (evento.estado === 'gerando') {
        lock.current = true
        setEmCurso({
          turnId: evento.turnId,
          produto: evento.produto,
          fonte: evento.fonte,
          passo: evento.passo
        })
        return
      }
      lock.current = false
      setEmCurso(null)
      if (evento.estado === 'pronto') {
        avisar({
          tipo: 'pronto',
          texto: t('designStudio.geracao.pronto', fonteName(evento.fonte), evento.dores)
        })
        prontoRef.current()
        return
      }
      avisar({
        tipo: 'falha',
        texto: motivoTexto(evento.motivo, evento.fonte),
        repetir: { produto: evento.produto, fonte: evento.fonte }
      })
    },
    [avisar]
  )

  useEffect(() => {
    const off = window.hive.designStudio.onGeracao(aoEvento)
    // A window opened (or reloaded) mid-generation picks it up where it is.
    window.hive.designStudio
      .geracaoAtual()
      .then((atual) => {
        if (atual) aoEvento(atual)
      })
      .catch(() => {})
    return off
  }, [aoEvento])

  const pedir = useCallback(
    (produto: string, fonte: FonteId) => {
      if (lock.current) {
        avisar({ tipo: 'ocupado', texto: t('designStudio.geracao.ocupado') })
        return
      }
      lock.current = true
      void (async () => {
        const agente = await resolveModuleAgent()
        const plano = await window.hive.designStudio.planejarGeracao({ produto, fonte, agente })
        if (!plano.ok) {
          lock.current = false
          avisar({ tipo: 'ocupado', texto: t('designStudio.geracao.ocupado') })
          return
        }
        setEmCurso((current) => current ?? { turnId: plano.turnId, produto, fonte, passo: 1 })
        try {
          await window.hive.agent.send(plano.prompt, {
            agentId: agente.id,
            ...(agente.modelo ? { model: agente.modelo } : {}),
            scope: plano.scope,
            turnId: plano.turnId,
            freshSession: true
          })
        } catch {
          void window.hive.designStudio.abandonarGeracao(plano.turnId).catch(() => {})
          aoEvento({ turnId: plano.turnId, produto, fonte, estado: 'falhou', motivo: 'erro' })
        }
      })().catch(() => {
        lock.current = false
        setEmCurso(null)
        avisar({
          tipo: 'falha',
          texto: motivoTexto('erro', fonte),
          repetir: { produto, fonte }
        })
      })
    },
    [aoEvento, avisar]
  )

  const dispensar = useCallback((id: number) => {
    setAvisos((current) => current.filter((aviso) => aviso.id !== id))
  }, [])

  return useMemo(() => ({ emCurso, pedir, avisos, dispensar }), [emCurso, pedir, avisos, dispensar])
}
