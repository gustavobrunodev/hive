import { useCallback, useEffect, useState } from 'react'

/**
 * The vault status the bridge returns — derived from `window.hive` rather than
 * imported from `src/main/*` (the M11 composite-boundary lesson: the renderer
 * never imports main; it mirrors the bridge's shape).
 */
export type VaultStatus = Awaited<ReturnType<Window['hive']['secondBrain']['getVault']>>
/** The derived health-check cadence (SB-R10) — same bridge-shaped derivation. */
export type VaultHealth = Awaited<ReturnType<Window['hive']['secondBrain']['getHealth']>>

export interface SecondBrainStore {
  workspace: string
  /** Absolute vault path, or null when unconfigured (SB-R2.2). */
  vaultPath: string | null
  /** Vault folder name, or null when unconfigured. */
  vaultName: string | null
  /** Raw items staged for ingestion — drives the activity-bar badge (SB-R2.5). */
  rawPending: number
  /** Whether a vault exists on disk (SB-R2.3 vs SB-R2.2 empty state). */
  hasVault: boolean
  /** Health-check cadence for this workspace; null until the first fetch lands (SB-R10.1). */
  health: VaultHealth | null
  /** Re-fetch the vault status (after staging, workspace changes on disk, etc.). */
  refresh: () => void
  /** SB-R10.2: records one ingest launched from Hive (advances the cadence). */
  noteIngest: () => void
  /** SB-R10.3: records a health-check run (resets the cadence). */
  noteLint: () => void
  /** SB-R10.5: postpones the ambient reminder. */
  snoozeHealth: () => void
}

const EMPTY: VaultStatus = { path: null, name: null, rawPending: 0 }

type Tagged = VaultStatus & { ws: string; health: VaultHealth | null }

/**
 * Reads and keeps current the Second Brain vault status + health-check cadence
 * for the active workspace (SB-R2, SB-R10). There is no push channel for vault
 * changes, so it fetches on mount / workspace change and exposes `refresh` for
 * callers that mutate the vault (the FAB after staging, the panel's actions).
 * Follows the workspace-tagged-state + pure-derivation pattern (no reset
 * effect, no setState-during-render — the M10 react-hooks lesson): a
 * since-switched workspace reads as empty until `refresh` lands the new status.
 *
 * The cadence mutations (`noteIngest`/`noteLint`/`snoozeHealth`) each return the
 * recomputed health from the main process, so one round trip both records the
 * event and refreshes every surface reading this store.
 */
export function useSecondBrain(workspace: string): SecondBrainStore {
  const [state, setState] = useState<Tagged>({ ws: workspace, ...EMPTY, health: null })

  // Applies a health update only while it still belongs to the on-screen
  // workspace — a switch mid-flight must not paint the old vault's cadence.
  const applyHealth = useCallback(
    (health: VaultHealth) => {
      setState((current) => (current.ws === workspace ? { ...current, health } : current))
    },
    [workspace]
  )

  const refresh = useCallback(() => {
    void Promise.all([
      window.hive.secondBrain.getVault(workspace),
      window.hive.secondBrain.getHealth(workspace)
    ]).then(([status, health]) => {
      setState({ ws: workspace, ...status, health })
    })
  }, [workspace])

  useEffect(() => {
    refresh()
  }, [refresh])

  const noteIngest = useCallback(() => {
    void window.hive.secondBrain.noteIngest(workspace).then(applyHealth)
  }, [workspace, applyHealth])

  const noteLint = useCallback(() => {
    void window.hive.secondBrain.noteLint(workspace).then(applyHealth)
  }, [workspace, applyHealth])

  const snoozeHealth = useCallback(() => {
    void window.hive.secondBrain.snoozeHealth(workspace).then(applyHealth)
  }, [workspace, applyHealth])

  const matches = state.ws === workspace
  const status = matches ? state : { ...EMPTY, ws: workspace, health: null }

  return {
    workspace,
    vaultPath: status.path,
    vaultName: status.name,
    rawPending: status.rawPending,
    hasVault: status.path !== null,
    health: status.health,
    refresh,
    noteIngest,
    noteLint,
    snoozeHealth
  }
}
