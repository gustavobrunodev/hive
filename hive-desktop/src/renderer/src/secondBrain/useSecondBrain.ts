import { useCallback, useEffect, useState } from 'react'

/**
 * The vault status the bridge returns — derived from `window.hive` rather than
 * imported from `src/main/*` (the M11 composite-boundary lesson: the renderer
 * never imports main; it mirrors the bridge's shape).
 */
export type VaultStatus = Awaited<ReturnType<Window['hive']['secondBrain']['getVault']>>

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
  /** Re-fetch the vault status (after staging, workspace changes on disk, etc.). */
  refresh: () => void
}

const EMPTY: VaultStatus = { path: null, name: null, rawPending: 0 }

type Tagged = VaultStatus & { ws: string }

/**
 * Reads and keeps current the Second Brain vault status for the active
 * workspace (SB-R2). There is no push channel for vault changes, so it fetches
 * on mount / workspace change and exposes `refresh` for callers that mutate the
 * vault (the FAB after staging, the panel's actions). Follows the
 * workspace-tagged-state + pure-derivation pattern (no reset effect, no
 * setState-during-render — the M10 react-hooks lesson): a since-switched
 * workspace reads as empty until `refresh` lands the new status.
 */
export function useSecondBrain(workspace: string): SecondBrainStore {
  const [state, setState] = useState<Tagged>({ ws: workspace, ...EMPTY })

  const refresh = useCallback(() => {
    void window.hive.secondBrain.getVault(workspace).then((status) => {
      setState({ ws: workspace, ...status })
    })
  }, [workspace])

  useEffect(() => {
    refresh()
  }, [refresh])

  const matches = state.ws === workspace
  const status = matches ? state : { ...EMPTY, ws: workspace }

  return {
    workspace,
    vaultPath: status.path,
    vaultName: status.name,
    rawPending: status.rawPending,
    hasVault: status.path !== null,
    refresh
  }
}
