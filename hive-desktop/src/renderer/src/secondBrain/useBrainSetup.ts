import { useCallback, useState } from 'react'
import type { RoleAction } from '../ui/ActionRail'
import { SECOND_BRAIN_SETUP } from './secondBrainPrompts'
import type { SecondBrainStore } from './useSecondBrain'

/**
 * Where the workspace stands in the one flow that has to happen before any
 * other Second Brain action means anything:
 *
 * - `idle`   — no base, and nobody has asked for one here yet (the invitation).
 * - `running` — `/second-brain` was launched and the vault hasn't landed on
 *   disk yet. The agent is interviewing the user in the chat; every surface
 *   says *that*, instead of repeating "configure a base primeiro" as if the
 *   request had gone nowhere.
 * - `ready`  — the vault appeared after a setup this session: the moment worth
 *   confirming, and the moment to hand the user their next step.
 */
export type BrainSetupPhase = 'idle' | 'running' | 'ready'

export interface BrainSetup {
  phase: BrainSetupPhase
  /** Launches (or relaunches) `/second-brain` in its own conversation. */
  start: () => void
  /** Re-probes the disk now — the escape hatch when a watcher missed the write. */
  recheck: () => void
  /** Acknowledges the "base pronta" hand-off, returning the panel to its normal self. */
  dismiss: () => void
}

/**
 * Tracks the vault-setup flow across the surfaces that care (the panel, the
 * ingestion sheet, the ask dialog) so all three tell the same story about a
 * setup in flight. Deliberately *not* persisted: it describes what the user
 * just did in this session, and a stale "configurando…" surviving a restart
 * would be worse than no state at all — the vault probe is the source of truth
 * either way.
 *
 * Workspace-tagged + derived rather than reset in an effect (the project's
 * pure-derivation rule): switching workspaces mid-setup shows the new one's
 * real state, and switching back is honest about no longer tracking it.
 */
export function useBrainSetup(
  store: SecondBrainStore,
  launch: (action: RoleAction) => void
): BrainSetup {
  const [state, setState] = useState<{ ws: string; launched: boolean }>({
    ws: store.workspace,
    launched: false
  })
  const launched = state.ws === store.workspace && state.launched

  const start = useCallback(() => {
    setState({ ws: store.workspace, launched: true })
    launch(SECOND_BRAIN_SETUP)
  }, [store.workspace, launch])

  const { refresh, workspace } = store
  const recheck = useCallback(() => refresh(), [refresh])
  const dismiss = useCallback(() => setState({ ws: workspace, launched: false }), [workspace])

  return {
    phase: !launched ? 'idle' : store.hasVault ? 'ready' : 'running',
    start,
    recheck,
    dismiss
  }
}
