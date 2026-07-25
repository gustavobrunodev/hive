/**
 * Pure, runtime-free types shared across the main/preload/renderer boundary for
 * the Second Brain feature. Kept in its own module (the M11 `reviewTypes.ts`
 * lesson) so the preload `.d.ts` and the renderer can import these without
 * dragging `secondBrainService.ts`'s `child_process`/`fs` runtime into the web
 * TypeScript program.
 */

/** Second-brain skill lifecycle events (SB-R1), streamed by the provisioning gate. */
export type SkillEvent =
  | { type: 'step'; id: string; label: string }
  | { type: 'progress'; pct?: number; message: string }
  | { type: 'done'; ok: true }
  | { type: 'error'; message: string; detail?: string }

/** Where the vault lives and what it's called (SB-R2.1/2.3). */
export interface VaultInfo {
  path: string
  name: string
}

/** What `window.hive.secondBrain.getVault(ws)` returns (design §7). */
export interface VaultStatus {
  /** Absolute vault path, or null when no vault is configured (SB-R2.2). */
  path: string | null
  /** Vault folder name, or null when unconfigured. */
  name: string | null
  /** Count of raw files awaiting ingestion — drives the activity-bar badge (SB-R2.5). */
  rawPending: number
}
