import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { t } from '../i18n'
import { tituloDaConversa } from './conversaModel'
import {
  fonteName,
  MODULE_AGENTS,
  moduleAgentName,
  type FonteId,
  type ModuleAgent,
  type ModuleAgentId
} from './model'
import type { DorCitada, EventoDeGeracao } from './relatorioModel'
import type { GeracaoStore } from './useGeracao'

/**
 * Design Studio — the module's conversations while the Hive is open: what each
 * one shows, which turn is in flight, and which agent answers next.
 *
 * Main owns the transcript on disk (the person's lines and the replies, with
 * the agent and model of each) and plans every turn; this hook sends the turn
 * and listens on the module's own channel (`designStudio:conversa`) — never on
 * `agent.onEvent`, the window's one agent subscription, which is the Chat's.
 * What the app itself says in a conversation — the agent switch, the guided
 * first Relatório, a failure — lives here only (Landing, "O que a conversa
 * guarda").
 *
 * Held with the module's data, above the pages, so leaving a conversation for
 * another and coming back finds it as it was, its reply still streaming.
 */

type Bridge = Window['hive']['designStudio']
type EventoDeConversa = Parameters<Parameters<Bridge['onConversa']>[0]>[0]
type MotivoDeFalha = Extract<EventoDeGeracao, { estado: 'falhou' }>['motivo']

/** One thing a conversation shows, in order. */
export type ItemDaConversa =
  | { tipo: 'pessoa'; id: string; texto: string; anexos: string[]; citadas: DorCitada[] }
  | {
      tipo: 'agente'
      id: string
      texto: string
      agente: string | null
      modelo: string | null
      escrevendo: boolean
    }
  /** A line the app writes in the conversation: "Agente trocado para <Agente>". */
  | { tipo: 'linha'; id: string; texto: string }
  /** A failed turn. `erro` is only ever *classified* (the account lane), never shown. */
  | { tipo: 'falha'; id: string; erro: string }
  /** "Por qual Fonte quer começar?" with one button per Fonte without a Relatório (criterion 3). */
  | { tipo: 'guiada'; id: string; fontes: FonteId[]; escolhida: FonteId | null }
  /** A Relatório being generated inside the conversation, then its highlight. */
  | {
      tipo: 'geracao'
      id: string
      fonte: FonteId
      estado: 'gerando' | 'pronto' | 'falhou'
      relatorio: string | null
      motivo: MotivoDeFalha | null
    }

/** What a send carries (criteria 5–10). */
export interface Envio {
  produto: string
  conversa: string | null
  texto: string
  citadas: DorCitada[]
  anexos: Array<{ path: string; name: string }>
  relatoriosAnexados: Array<{ caminho: string; nome: string }>
  agente: ModuleAgent
}

export interface ConversaEmMemoria {
  produto: string
  id: string
  titulo: string
  itens: ItemDaConversa[]
  /** The turn in flight, by id — `null` when the agent is not answering. */
  turno: string | null
  /** A send is on its way, or the stored transcript is still being read: nothing else goes out. */
  ocupada: boolean
  /** Who answers the next message; `null` until the field resolves the module default. */
  agente: ModuleAgent | null
  /** The last send that failed — what "Conectar conta" re-sends once the account is back. */
  falhou: Envio | null
  /** The send whose turn is in flight, kept until it ends. */
  ultimo: Envio | null
}

export interface ConversasStore {
  de: (produto: string, conversa: string) => ConversaEmMemoria | undefined
  /** Reads a stored conversation into memory, once (criterion 16). */
  abrir: (produto: string, conversa: string) => void
  /** Sends; answers the conversation's id (a new one on the first message), or `null`. */
  enviar: (envio: Envio) => Promise<string | null>
  parar: (produto: string, conversa: string) => void
  /** Switches the agent mid-conversation, with the line that says so (criterion 15). */
  trocarAgente: (produto: string, conversa: string, agente: ModuleAgent) => void
  /** Starts the guided first Relatório (criterion 3). */
  iniciarGuiada: (produto: string, fontes: FonteId[]) => Promise<string | null>
  escolherFonte: (produto: string, conversa: string, fonte: FonteId) => void
  /** Sends the failed message again — the account came back. */
  reenviar: (produto: string, conversa: string) => void
}

const chave = (produto: string, conversa: string): string => `${produto}/${conversa}`

let sequencia = 0
const novoId = (): string => `item-${++sequencia}`

type Mapa = Readonly<Record<string, ConversaEmMemoria>>

function isModuleAgentId(id: string | null): id is ModuleAgentId {
  return id !== null && (MODULE_AGENTS as readonly string[]).includes(id)
}

/** The agent of a stored conversation's last reply — who keeps answering it. */
function agenteDaUltima(itens: readonly ItemDaConversa[]): ModuleAgent | null {
  const ultima = [...itens].reverse().find((item) => item.tipo === 'agente')
  if (ultima?.tipo !== 'agente' || !isModuleAgentId(ultima.agente)) return null
  return { id: ultima.agente, nome: moduleAgentName(ultima.agente), modelo: ultima.modelo }
}

function itemDaPessoa(envio: Envio): ItemDaConversa {
  return {
    tipo: 'pessoa',
    id: novoId(),
    texto: envio.texto,
    anexos: [...envio.anexos.map((a) => a.name), ...envio.relatoriosAnexados.map((r) => r.nome)],
    citadas: envio.citadas
  }
}

/** Applies one reply event to its conversation — only while that turn is the one in flight. */
function aplicarEvento(conversa: ConversaEmMemoria, evento: EventoDeConversa): ConversaEmMemoria {
  if (conversa.turno !== evento.turnId) return conversa
  const semRascunho = conversa.itens.filter((item) => !(item.tipo === 'agente' && item.escrevendo))
  if (evento.estado === 'escrevendo') {
    return {
      ...conversa,
      itens: [
        ...semRascunho,
        {
          tipo: 'agente',
          id: `resposta-${evento.turnId}`,
          texto: evento.texto,
          agente: conversa.agente?.id ?? null,
          modelo: conversa.agente?.modelo ?? null,
          escrevendo: true
        }
      ]
    }
  }
  const fim = { ...conversa, turno: null, ocupada: false }
  if (evento.estado === 'falhou') {
    return {
      ...fim,
      falhou: conversa.ultimo,
      itens: [...semRascunho, { tipo: 'falha', id: novoId(), erro: evento.erro }]
    }
  }
  if (evento.texto.trim() === '') return { ...fim, itens: semRascunho, falhou: null }
  return {
    ...fim,
    falhou: null,
    itens: [
      ...semRascunho,
      {
        tipo: 'agente',
        id: `resposta-${evento.turnId}`,
        texto: evento.texto,
        agente: evento.agente,
        modelo: evento.modelo,
        escrevendo: false
      }
    ]
  }
}

/** Applies a generation event to every conversation that asked for that Relatório. */
function aplicarGeracao(conversa: ConversaEmMemoria, evento: EventoDeGeracao): ConversaEmMemoria {
  if (conversa.produto !== evento.produto || evento.estado === 'gerando') return conversa
  let mudou = false
  const itens = conversa.itens.map((item): ItemDaConversa => {
    if (item.tipo !== 'geracao' || item.fonte !== evento.fonte || item.estado !== 'gerando') {
      return item
    }
    mudou = true
    return evento.estado === 'pronto'
      ? { ...item, estado: 'pronto', relatorio: evento.relatorio }
      : { ...item, estado: 'falhou', motivo: evento.motivo }
  })
  return mudou ? { ...conversa, itens } : conversa
}

/** A stored transcript, as the conversation draws it. */
function itensGuardados(
  lida: NonNullable<Awaited<ReturnType<Bridge['lerConversa']>>>
): ItemDaConversa[] {
  return lida.mensagens.map((m): ItemDaConversa =>
    m.papel === 'pessoa'
      ? { tipo: 'pessoa', id: m.id, texto: m.texto, anexos: m.anexos, citadas: [] }
      : {
          tipo: 'agente',
          id: m.id,
          texto: m.texto,
          agente: m.agente,
          modelo: m.modelo,
          escrevendo: false
        }
  )
}

/** What `enviarTurno` changes: the conversations, and whoever lists them. */
interface Operacoes {
  mudar: (
    produto: string,
    conversa: string,
    change: (c: ConversaEmMemoria) => ConversaEmMemoria
  ) => void
  setMapa: (change: (current: Mapa) => Mapa) => void
  aoMudar: () => void
}

/** Plans the turn in main, then sends it — the half `enviar` and `reenviar` share. */
async function enviarTurno(
  envio: Envio,
  { mudar, setMapa, aoMudar }: Operacoes
): Promise<string | null> {
  const titulo = tituloDaConversa(envio.texto)
  const falhar = (conversa: string, erro: string): void =>
    mudar(envio.produto, conversa, (c) => ({
      ...c,
      ocupada: false,
      turno: null,
      falhou: envio,
      itens: [...c.itens, { tipo: 'falha', id: novoId(), erro }]
    }))
  let plano: Awaited<ReturnType<Bridge['planejarConversa']>>
  try {
    plano = await window.hive.designStudio.planejarConversa({
      produto: envio.produto,
      conversa: envio.conversa,
      texto: envio.texto,
      titulo,
      citadas: envio.citadas,
      relatoriosAnexados: envio.relatoriosAnexados.map((r) => r.caminho),
      anexos: envio.anexos,
      agente: { id: envio.agente.id, modelo: envio.agente.modelo }
    })
  } catch {
    if (envio.conversa !== null) falhar(envio.conversa, '')
    return envio.conversa
  }
  if (!plano.ok) {
    if (envio.conversa !== null) falhar(envio.conversa, '')
    return envio.conversa
  }
  const id = plano.conversa
  const turnId = plano.turnId
  setMapa((current) => {
    const key = chave(envio.produto, id)
    const atual = current[key] ?? {
      produto: envio.produto,
      id,
      titulo,
      itens: [itemDaPessoa(envio)],
      turno: null,
      ocupada: true,
      agente: envio.agente,
      falhou: null,
      ultimo: null
    }
    return { ...current, [key]: { ...atual, turno: turnId, ocupada: true, ultimo: envio } }
  })
  if (envio.conversa === null) aoMudar()
  try {
    await window.hive.agent.send(plano.prompt, {
      agentId: envio.agente.id,
      ...(envio.agente.modelo ? { model: envio.agente.modelo } : {}),
      scope: plano.scope,
      turnId,
      resume: plano.resume,
      freshSession: plano.freshSession,
      ...(plano.anexos.length > 0 ? { attachments: plano.anexos } : {})
    })
  } catch {
    void window.hive.designStudio.abandonarConversa(turnId).catch(() => {})
    falhar(id, '')
  }
  return id
}

/**
 * The two channels a conversation listens to: its replies (`designStudio:conversa`)
 * and the generation it may have asked for (`designStudio:geracao`). Both are
 * listeners of their own — never the window's one agent subscription.
 */
function useEventos(
  setMapa: (change: (current: Mapa) => Mapa) => void,
  mudar: Operacoes['mudar'],
  aoMudarRef: { current: (() => void) | undefined }
): void {
  useEffect(() => {
    const offConversa = window.hive.designStudio.onConversa((evento) => {
      mudar(evento.produto, evento.conversa, (c) => aplicarEvento(c, evento))
      if (evento.estado !== 'escrevendo') aoMudarRef.current?.()
    })
    const offGeracao = window.hive.designStudio.onGeracao((evento) =>
      setMapa((current) => {
        let mudou = false
        const proximo: Record<string, ConversaEmMemoria> = {}
        for (const [key, conversa] of Object.entries(current)) {
          proximo[key] = aplicarGeracao(conversa, evento)
          mudou ||= proximo[key] !== conversa
        }
        return mudou ? proximo : current
      })
    )
    return () => {
      offConversa()
      offGeracao()
    }
  }, [mudar, setMapa, aoMudarRef])
}

export function useConversas(geracao: GeracaoStore, aoMudar?: () => void): ConversasStore {
  const [mapa, setMapa] = useState<Mapa>({})
  const mapaRef = useRef<Mapa>(mapa)
  useEffect(() => {
    mapaRef.current = mapa
  }, [mapa])
  const aoMudarRef = useRef(aoMudar)
  useEffect(() => {
    aoMudarRef.current = aoMudar
  }, [aoMudar])

  const mudar = useCallback(
    (produto: string, conversa: string, change: (c: ConversaEmMemoria) => ConversaEmMemoria) =>
      setMapa((current) => {
        const atual = current[chave(produto, conversa)]
        return atual ? { ...current, [chave(produto, conversa)]: change(atual) } : current
      }),
    []
  )

  useEventos(setMapa, mudar, aoMudarRef)

  const abrir = useCallback(
    (produto: string, conversa: string) => {
      if (mapaRef.current[chave(produto, conversa)]) return
      const vazia: ConversaEmMemoria = {
        produto,
        id: conversa,
        titulo: '',
        itens: [],
        turno: null,
        ocupada: true,
        agente: null,
        falhou: null,
        ultimo: null
      }
      mapaRef.current = { ...mapaRef.current, [chave(produto, conversa)]: vazia }
      setMapa((current) => ({ ...current, [chave(produto, conversa)]: vazia }))
      window.hive.designStudio
        .lerConversa(produto, conversa)
        .then((lida) => {
          const itens = lida ? itensGuardados(lida) : []
          setMapa((current) => ({
            ...current,
            [chave(produto, conversa)]: {
              ...vazia,
              titulo: lida?.titulo ?? '',
              itens: [...itens, ...(current[chave(produto, conversa)]?.itens ?? [])],
              agente: current[chave(produto, conversa)]?.agente ?? agenteDaUltima(itens),
              ocupada: false
            }
          }))
        })
        // A read that fails leaves an empty conversation that can still be written in.
        .catch(() => mudar(produto, conversa, (c) => ({ ...c, ocupada: false })))
    },
    [mudar]
  )

  const enviar = useCallback(
    async (envio: Envio): Promise<string | null> => {
      if (envio.conversa !== null) {
        const atual = mapaRef.current[chave(envio.produto, envio.conversa)]
        if (atual?.ocupada || atual?.turno) return null
        mudar(envio.produto, envio.conversa, (c) => ({
          ...c,
          ocupada: true,
          agente: envio.agente,
          itens: [...c.itens.filter((item) => item.tipo !== 'falha'), itemDaPessoa(envio)]
        }))
      }
      return enviarTurno(envio, { mudar, setMapa, aoMudar: () => aoMudarRef.current?.() })
    },
    [mudar]
  )

  const parar = useCallback((produto: string, conversa: string) => {
    const turno = mapaRef.current[chave(produto, conversa)]?.turno
    if (turno) void window.hive.agent.interrupt(turno).catch(() => {})
  }, [])

  const trocarAgente = useCallback(
    (produto: string, conversa: string, agente: ModuleAgent) =>
      mudar(produto, conversa, (c) => {
        const trocou = c.agente !== null && c.agente.id !== agente.id
        return {
          ...c,
          agente,
          itens: trocou
            ? [
                ...c.itens,
                {
                  tipo: 'linha',
                  id: novoId(),
                  texto: t('designStudio.conversa.agenteTrocado', agente.nome)
                }
              ]
            : c.itens
        }
      }),
    [mudar]
  )

  const iniciarGuiada = useCallback(
    async (produto: string, fontes: FonteId[]): Promise<string | null> => {
      const texto = t('designStudio.conversa.guiadaPedido', produto)
      const id = await window.hive.designStudio
        .novaConversa(produto, texto, tituloDaConversa(texto))
        .catch(() => null)
      if (id === null) return null
      setMapa((current) => ({
        ...current,
        [chave(produto, id)]: {
          produto,
          id,
          titulo: tituloDaConversa(texto),
          itens: [
            { tipo: 'pessoa', id: novoId(), texto, anexos: [], citadas: [] },
            { tipo: 'guiada', id: novoId(), fontes, escolhida: null }
          ],
          turno: null,
          ocupada: false,
          agente: null,
          falhou: null,
          ultimo: null
        }
      }))
      aoMudarRef.current?.()
      return id
    },
    []
  )

  const { pedir } = geracao
  const escolherFonte = useCallback(
    (produto: string, conversa: string, fonte: FonteId) => {
      if (!pedir(produto, fonte)) return
      mudar(produto, conversa, (c) => ({
        ...c,
        itens: [
          ...c.itens.map((item) =>
            item.tipo === 'guiada' && item.escolhida === null ? { ...item, escolhida: fonte } : item
          ),
          {
            tipo: 'pessoa',
            id: novoId(),
            texto: t('designStudio.conversa.comecarPor', fonteName(fonte)),
            anexos: [],
            citadas: []
          },
          {
            tipo: 'geracao',
            id: novoId(),
            fonte,
            estado: 'gerando',
            relatorio: null,
            motivo: null
          }
        ]
      }))
    },
    [pedir, mudar]
  )

  const reenviar = useCallback(
    (produto: string, conversa: string) => {
      const falhou = mapaRef.current[chave(produto, conversa)]?.falhou
      if (falhou) void enviar({ ...falhou, conversa })
    },
    [enviar]
  )

  const de = useCallback(
    (produto: string, conversa: string) => mapa[chave(produto, conversa)],
    [mapa]
  )

  return useMemo(
    () => ({ de, abrir, enviar, parar, trocarAgente, iniciarGuiada, escolherFonte, reenviar }),
    [de, abrir, enviar, parar, trocarAgente, iniciarGuiada, escolherFonte, reenviar]
  )
}
