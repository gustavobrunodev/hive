import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { SwitchableAgent } from '../ui/AgentSwitcher'
import { carryEffort, effortsFor, pickInitial, type EngineCapabilities } from './engineOptions'
import { initialEngine, useEnginePins, type EnginePin } from './enginePins'

/**
 * "Which agent, on which model, thinking how hard" — the decision every
 * surface that *starts a session* has to make, held in one place.
 *
 * Four surfaces make it: the composer, the Skill Studio's create form, the
 * ingestion sheet ("Documentar conhecimento") and "Perguntar à base". The last
 * two used to make it silently — they launched a slash command on whatever the
 * app default happened to be, which meant a squad running Copilot in chat
 * still had every wiki page written by Claude, with nothing on screen saying
 * so. Giving them the control meant giving them this state, and a second
 * hand-rolled copy of it is how two surfaces drift apart.
 *
 * The composer keeps its own copy on purpose: it also owns a conversation's
 * agent lock, its usage readout and its per-turn overrides, none of which
 * belong to a launcher. What it does share is the *rules* — `initialEngine`
 * for where a control opens, `carryEffort` for what survives a model switch —
 * so the two cannot disagree about the parts that matter.
 */

/**
 * What a launch carries with it — the run-config's answer, shaped for
 * `ChatHandle.launchCreation`. Every field is optional because every one of
 * them is an *override*: omitted means "whatever the conversation would do".
 */
export interface RunLaunchOpts {
  agentId?: string
  model?: string
  effort?: string
}

export interface RunConfigOptions {
  /** multi-agent: enabled agent ids, in display order. */
  agents: string[]
  /** The app default — where the choice starts. */
  defaultAgent: string | null
  /**
   * Scopes detection: a project's own `.claude/settings.json` can point the
   * CLI at another provider, so the same agent honestly answers differently in
   * two folders. Omitted where the surface has no workspace in hand.
   */
  workspace?: string
  /**
   * While `false`, nothing is read at all. A closed sheet must not spawn a CLI
   * probe on every render of the screen behind it.
   */
  active?: boolean
}

export interface RunConfig {
  /** The pool, with display names resolved — what `AgentSwitcher` renders. */
  agents: SwitchableAgent[]
  /** The chosen agent (falls back to the app default, then the first enabled). */
  agentId: string | null
  setAgent: (id: string) => void
  /** `null` while the agent's capabilities are in flight. */
  capabilities: EngineCapabilities | null
  model: string | null
  effort: string | null
  setModel: (id: string) => void
  setEffort: (id: string) => void
  /** "Redetectar": re-reads the machine instead of main's cache. */
  refresh: () => void
  refreshing: boolean
  /** engine-pins: what `EnginePicker`'s `pin` prop wants, or `undefined`. */
  pin?: { model: string | null; agentName?: string; onChange: (pin: EnginePin | null) => void }
  /** The overrides a launch carries, shaped for `launchCreation`. */
  launchOpts: RunLaunchOpts
}

export function useRunConfig({
  agents,
  defaultAgent,
  workspace,
  active = true
}: RunConfigOptions): RunConfig {
  const [capabilities, setCapabilities] = useState<EngineCapabilities | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [chosen, setChosen] = useState<string | null>(null)
  const [model, setModel] = useState<string | null>(null)
  const [effort, setEffort] = useState<string | null>(null)
  const [names, setNames] = useState<Record<string, string>>({})

  const agentId = chosen ?? defaultAgent ?? agents[0] ?? null

  // engine-pins: the persisted default for the agent in force. Same shared
  // store the composer reads, so a pin made here shows there without a reload.
  const pins = useEnginePins(agentId)
  // Read by the capabilities effect without re-running it when the pin moves —
  // pinning a row is not choosing it. Declared first so that within the commit
  // where the store reports `ready`, this already holds what it read.
  const pinRef = useRef(pins.pin)
  useEffect(() => {
    pinRef.current = pins.pin
  })
  const pinsReady = pins.ready

  /**
   * Capabilities follow the **chosen** agent, and the selection resets with
   * it: model ids are not portable (Claude's `opus` means nothing to Copilot),
   * and an agent may expose no effort at all, so carrying the previous pick
   * across a switch would send the CLI a flag it cannot parse.
   */
  useEffect(() => {
    if (!active) return
    let cancelled = false
    // Named-and-invoked (the repo's `load()` pattern) so the reset is not a
    // bare synchronous `setState` in the effect body. The reset itself matters:
    // the control has to go back to "Carregando…" while the new agent's
    // capabilities are in flight, or it shows the previous agent's model ids
    // as if they applied.
    function clearWhileLoading(): void {
      setCapabilities(null)
    }
    clearWhileLoading()
    // The surfaces with no workspace in hand call the one-argument form — a
    // bare `{}` would be a second argument that says nothing.
    void (
      workspace === undefined
        ? window.hive.agent.capabilities(agentId ?? undefined)
        : window.hive.agent.capabilities(agentId ?? undefined, { workspace })
    ).then((caps) => {
      if (cancelled) return
      setCapabilities(caps)
      const start = initialEngine(caps, pinRef.current)
      setModel(start.model)
      setEffort(start.effort)
    })
    return () => {
      cancelled = true
    }
    // `pinsReady`: the pinned default is read once per window and can land
    // after this surface opened — without re-picking then, the pin would look
    // ignored on the first open of the app.
  }, [agentId, workspace, active, pinsReady])

  useEffect(() => {
    if (!active) return
    let cancelled = false
    void window.hive.profile.agents().then((list) => {
      if (cancelled) return
      setNames(Object.fromEntries(list.map((meta) => [meta.id, meta.displayName])))
    })
    return () => {
      cancelled = true
    }
  }, [active])

  const refresh = useCallback(() => {
    setRefreshing(true)
    void window.hive.agent
      .capabilities(agentId ?? undefined, {
        ...(workspace === undefined ? {} : { workspace }),
        refresh: true
      })
      .then((caps) => {
        setCapabilities(caps)
        // Re-detection keeps what is on screen when it survived, which is why
        // the current value is handed in as the remembered one.
        setModel((current) => {
          const next = pickInitial(caps.models, current ?? undefined)
          setEffort((rung) => pickInitial(effortsFor(caps, next), rung ?? undefined))
          return next
        })
      })
      .finally(() => setRefreshing(false))
  }, [agentId, workspace])

  /** Changing the model can change the ladder under it (Devin). Carry the rung by name. */
  const changeModel = useCallback(
    (id: string) => {
      setModel(id)
      if (capabilities === null) return
      setEffort(carryEffort(effortsFor(capabilities, model), effort, effortsFor(capabilities, id)))
    },
    [capabilities, model, effort]
  )

  const pool = useMemo<SwitchableAgent[]>(
    () => agents.map((id) => ({ id, displayName: names[id] ?? id })),
    [agents, names]
  )

  return {
    agents: pool,
    agentId,
    setAgent: setChosen,
    capabilities,
    model,
    effort,
    setModel: changeModel,
    setEffort,
    refresh,
    refreshing,
    ...(agentId
      ? {
          pin: {
            model: pins.pin?.model ?? null,
            agentName: names[agentId] ?? agentId,
            onChange: pins.setPin
          }
        }
      : {}),
    launchOpts: {
      ...(agentId === null ? {} : { agentId }),
      ...(model === null ? {} : { model }),
      ...(effort === null ? {} : { effort })
    }
  }
}
