import { useCallback, useEffect, useRef, useState } from 'react'
import { t } from '../i18n'
import type { EngineCapabilities } from '../chat/engineOptions'
import { pickInitial } from '../chat/engineOptions'
import type { SwitchableAgent } from '../ui/AgentSwitcher'
import { MODULE_AGENTS, moduleAgentName, type ModuleAgent, type ModuleAgentId } from './model'
import { resolveModuleAgent } from './useGeracao'

/**
 * Design Studio — who answers a chat field (criterion 4): the agents the
 * module offers and the models each one's CLI reports, as the Hive's own
 * picker shows them.
 *
 * Only Claude and Devin, whatever else the Hive has: the Copilot left the
 * product's scope (ADR 0007). The models come from `capabilities()`, the
 * `AgentAdapter` contract — nothing about either agent is written here.
 */

export interface AgenteDoCampo {
  /** The module's agents installed on this machine, in the module's order. */
  agentes: SwitchableAgent[]
  /** What the field's agent supports; `null` while it is being read. */
  capabilities: EngineCapabilities | null
  refreshing: boolean
  refresh: () => void
  escolherAgente: (id: string) => void
  escolherModelo: (id: string) => void
  escolherEsforco: (id: string) => void
}

function isModuleAgentId(id: string): id is ModuleAgentId {
  return (MODULE_AGENTS as readonly string[]).includes(id)
}

/** The model's name as the picker writes it — or its id, when the list does not have it. */
export function nomeDoModelo(
  capabilities: EngineCapabilities | null,
  modelo: string | null
): string {
  const id = modelo ?? ''
  return capabilities?.models.find((option) => option.id === id)?.label ?? id
}

/** An agent's capabilities; a read that fails is a list with no model, never a crash. */
function lerCapacidades(id: string, refresh: boolean): Promise<EngineCapabilities> {
  return window.hive.agent
    .capabilities(id, refresh ? { refresh: true } : undefined)
    .catch(() => ({ models: [], efforts: [], supportsAttachments: true }))
}

export function useAgenteDoCampo(
  agente: ModuleAgent | null,
  onAgente: (agente: ModuleAgent) => void,
  informar: (texto: string) => void
): AgenteDoCampo {
  const [agentes, setAgentes] = useState<SwitchableAgent[]>([])
  const [lidas, setLidas] = useState<{ id: string; capabilities: EngineCapabilities } | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  /** The person picked an agent: say who answers once its models are known. */
  const anunciar = useRef(false)
  const onAgenteRef = useRef(onAgente)
  useEffect(() => {
    onAgenteRef.current = onAgente
  }, [onAgente])

  useEffect(() => {
    let vivo = true
    window.hive.profile
      .agents()
      .then((todos) => {
        const instalados = MODULE_AGENTS.filter((id) =>
          todos.some((entry) => entry.id === id && entry.available)
        )
        const lista = instalados.length > 0 ? instalados : [...MODULE_AGENTS]
        if (vivo) setAgentes(lista.map((id) => ({ id, displayName: moduleAgentName(id) })))
      })
      .catch(() => {
        if (vivo) setAgentes(MODULE_AGENTS.map((id) => ({ id, displayName: moduleAgentName(id) })))
      })
    return () => {
      vivo = false
    }
  }, [])

  // The field's first agent: the module default (the Hive's, Claude or Devin).
  const semAgente = agente === null
  useEffect(() => {
    if (!semAgente) return
    let vivo = true
    void resolveModuleAgent().then((padrao) => {
      if (vivo) onAgenteRef.current(padrao)
    })
    return () => {
      vivo = false
    }
  }, [semAgente])

  const agenteId = agente?.id ?? null
  useEffect(() => {
    if (agenteId === null) return
    let vivo = true
    lerCapacidades(agenteId, false).then((capabilities) => {
      if (vivo) setLidas({ id: agenteId, capabilities })
    })
    return () => {
      vivo = false
    }
  }, [agenteId])

  const capabilities = lidas !== null && lidas.id === agenteId ? lidas.capabilities : null

  // The agent's models arrived: keep the chosen model when the list has it,
  // otherwise start where the Hive's picker starts.
  useEffect(() => {
    if (capabilities === null || agente === null) return
    const modelo = pickInitial(capabilities.models, agente.modelo ?? undefined)
    const normalizado = modelo === '' ? null : modelo
    if (normalizado !== agente.modelo) onAgenteRef.current({ ...agente, modelo: normalizado })
    if (anunciar.current) {
      anunciar.current = false
      informar(
        t('designStudio.campo.vaiResponder', agente.nome, nomeDoModelo(capabilities, modelo))
      )
    }
  }, [capabilities, agente, informar])

  const escolherAgente = useCallback(
    (id: string) => {
      if (!isModuleAgentId(id) || id === agenteId) return
      anunciar.current = true
      void window.hive.agent
        .pins()
        .catch(() => ({}) as Record<string, { model: string } | undefined>)
        .then((pins) => {
          const pin = (pins as Record<string, { model: string } | undefined>)[id]
          onAgenteRef.current({ id, nome: moduleAgentName(id), modelo: pin?.model ?? null })
        })
    },
    [agenteId]
  )

  const escolherModelo = useCallback(
    (id: string) => {
      if (agente === null) return
      onAgente({ ...agente, modelo: id === '' ? null : id })
      informar(t('designStudio.campo.vaiResponder', agente.nome, nomeDoModelo(capabilities, id)))
    },
    [agente, onAgente, informar, capabilities]
  )

  const escolherEsforco = useCallback(
    (id: string) => {
      if (agente !== null) onAgente({ ...agente, esforco: id === '' ? null : id })
    },
    [agente, onAgente]
  )

  const refresh = useCallback(() => {
    if (agenteId === null) return
    setRefreshing(true)
    void lerCapacidades(agenteId, true)
      .then((capabilities) => setLidas({ id: agenteId, capabilities }))
      .finally(() => setRefreshing(false))
  }, [agenteId])

  return {
    agentes,
    capabilities,
    refreshing,
    refresh,
    escolherAgente,
    escolherModelo,
    escolherEsforco
  }
}
