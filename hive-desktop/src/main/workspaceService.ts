import { existsSync, statSync } from 'fs'
import { join } from 'path'
import type { ConfigStore, WorkspaceEntry, WorkspaceKind } from './configStore'

/**
 * The slice of Electron's `dialog` module `WorkspaceService` needs. Declared
 * locally (instead of importing `electron`'s `OpenDialogOptions`/
 * `OpenDialogReturnValue` types) to keep this module's only coupling to
 * Electron at the type level, matching `configStore.ts`'s approach of taking
 * its environment as an injected argument rather than importing `electron`
 * directly. Callers wiring this into the app (T5, in `src/main/index.ts`)
 * pass the real `dialog` from `electron`; tests pass a fake.
 */
export interface DialogLike {
  showOpenDialog(options: {
    properties: string[]
  }): Promise<{ canceled: boolean; filePaths: string[] }>
}

/** Why a path could not be opened as a workspace (WS-R4/WS-R6.3). */
export type OpenFailure = 'missing' | 'not-a-directory' | 'unreadable'

/**
 * What the app has to do next for a workspace path — the single place the
 * install-vs-update-vs-ask rules live (multi-workspace). The renderer's
 * onboarding gate is a `switch` over this, so the rules can be unit-tested
 * without a window.
 *
 *  - `missing` — the folder is gone, or isn't a readable directory.
 *  - `choose` — a **secondary** workspace with no BMAD on disk: the one
 *    moment the user is asked whether Hive should install it here. Asked
 *    before anything is written and before the workspace becomes active, so
 *    cancelling leaves the app exactly as it was.
 *  - `install` — a managed workspace with no BMAD on disk yet (`primary`
 *    marks the app's main workspace, which always ends up here on first run).
 *  - `update` — a managed workspace whose BMAD is already installed.
 *  - `ready` — nothing to provision: a `light` workspace, which Hive never
 *    writes into. Straight to the work UI.
 */
export type WorkspaceRoute =
  | { step: 'missing' }
  | { step: 'choose' }
  | { step: 'install'; primary: boolean }
  | { step: 'update' }
  | { step: 'ready' }

/**
 * Result of `openWorkspace` (WS-R4/WS-R6.3): a discriminated union so callers
 * (IPC/renderer) can branch on `ok` without try/catch, mirroring
 * `fsService.ts`'s `ConflictError.code` discriminable-tag style. The `ok`
 * branch carries the `route` the caller must take next, so a successful open
 * and the decision about what to do with it are one round trip.
 */
export type OpenResult =
  | { ok: true; path: string; route: WorkspaceRoute }
  | {
      ok: false
      reason: OpenFailure
    }

/**
 * A registry entry joined with what the disk currently says about it — the
 * shape the switcher renders. `kind` is the user's intent (persisted);
 * `provisioned` and `missing` are facts re-read on every `list()`, so a
 * workspace deleted or provisioned outside the app tells the truth the next
 * time the panel opens.
 */
export interface WorkspaceInfo extends WorkspaceEntry {
  /** `name` when the user set one, else the path's last segment. */
  displayName: string
  /** Disk truth: `_bmad/_config/manifest.yaml` exists under this path. */
  provisioned: boolean
  /** Disk truth: the folder is gone, not a directory, or unreadable. */
  missing: boolean
}

/**
 * Dependencies `createWorkspaceService` can have injected beyond `dialog`,
 * keeping this module Electron/`fs`-import-free at the call-site level (the
 * same reasoning `fsService.ts`'s `FsServiceDeps` uses for `trashItem`).
 * Both default to real `fs` checks so existing two-argument callers (e.g.
 * `main/index.ts`) keep working unchanged against the real filesystem; tests
 * override them with fakes driven by a plain path→boolean map — no disk I/O
 * required.
 */
export interface WorkspaceServiceDeps {
  /** Does `p` exist on disk? Defaults to `fs.existsSync`. */
  pathExists?(p: string): boolean
  /** Is `p` a directory? Only called when `pathExists(p)` is true. Defaults to `fs.statSync(p).isDirectory()`. */
  isDirectory?(p: string): boolean
}

export interface WorkspaceService {
  /**
   * Opens the native directory picker and returns the chosen path — and
   * nothing else. Deliberately free of side effects (multi-workspace): the
   * kind question has to be answered *between* picking a folder and
   * committing to it, so picking can't be the thing that commits.
   */
  pickFolder(): Promise<string | null>
  getWorkspace(): string | null
  isProvisioned(): boolean
  /** Disk-based provisioning check for an arbitrary path (WS-R3.1–R3.2), independent of the active workspace. */
  provisionState(path: string): boolean
  /** Delegates to `ConfigStore.getRecentWorkspaces()` (WS-R2). */
  getRecentWorkspaces(): string[]
  /**
   * Read-only: validates `path` and works out what would happen if it were
   * opened, without persisting anything. What the "adicionar workspace" flow
   * calls right after the picker, to find out whether it owes the user the
   * kind question.
   */
  previewWorkspace(path: string): OpenResult
  /**
   * Validates `path`, registers it (creating the entry when new), persists it
   * as the active workspace and MRU head (WS-R4/WS-R2.2), and reports the
   * route to take; on failure returns a reason and prunes `path` from the
   * registry (WS-R2.3/WS-R6.3).
   *
   * `kind` is the answer to the `choose` step — passed only when the user has
   * just been asked. Omitted, an existing entry keeps the kind it had and a
   * new one is `managed`.
   */
  openWorkspace(path: string, kind?: WorkspaceKind): OpenResult
  /** multi-workspace: the registry joined with disk state, MRU-ordered. */
  listWorkspaces(): WorkspaceInfo[]
  /** Renames a workspace for display; an empty name restores the folder name. */
  renameWorkspace(path: string, name: string | null): void
  /**
   * Turns a `light` workspace into a `managed` one ("Instalar o BMAD aqui").
   * Only ever converts in this direction: dropping back to `light` would
   * leave a `_bmad/` behind and make the label a lie.
   */
  adoptWorkspace(path: string): void
  /**
   * Makes `path` the primary workspace. The primary is always `managed`, so a
   * `light` workspace is converted on the way — the caller then routes it
   * through the install gate like any other unprovisioned managed workspace.
   */
  setPrimaryWorkspace(path: string): void
  /**
   * Drops a workspace from the list. Never touches the disk — the folder and
   * anything Hive installed in it stay exactly where they are. Refuses to
   * forget the primary (`false`), which would leave the app with no main
   * workspace.
   */
  forgetWorkspace(path: string): boolean
}

/** Last path segment of an absolute path — the workspace's default display name. */
export function folderName(path: string): string {
  const segments = path.split(/[/\\]/).filter(Boolean)
  return segments[segments.length - 1] ?? path
}

/**
 * Creates a `WorkspaceService` wrapping a `ConfigStore` with workspace-
 * specific operations (R2.1–R2.3, WS-R3, WS-R4, WS-R6.3) and, since
 * multi-workspace, the registry: pick a folder, work out what opening it
 * would mean, commit to it, and edit the list afterwards.
 *
 * `configStore`, `dialog`, and `deps` (`pathExists`/`isDirectory`) are all
 * injected (mirroring `configStore.ts`'s `baseDir` injection) so this module
 * never has to import `electron` itself and can be unit tested with a real
 * `ConfigStore` (pointed at a temp dir) plus fakes — no module mocking
 * required.
 */
export function createWorkspaceService(
  configStore: ConfigStore,
  dialog: DialogLike,
  deps: WorkspaceServiceDeps = {}
): WorkspaceService {
  const pathExists = deps.pathExists ?? existsSync
  const isDirectory = deps.isDirectory ?? ((p: string) => statSync(p).isDirectory())

  function provisionState(path: string): boolean {
    return pathExists(join(path, '_bmad', '_config', 'manifest.yaml'))
  }

  function getRecentWorkspaces(): string[] {
    return configStore.getRecentWorkspaces()
  }

  /** `null` when the folder is usable, otherwise why it isn't (WS-R6.3 — never throws). */
  function validate(path: string): OpenFailure | null {
    try {
      if (!pathExists(path)) return 'missing'
      if (!isDirectory(path)) return 'not-a-directory'
      return null
    } catch {
      // Permission denied / EACCES and similar: surfaced as 'unreadable'
      // rather than throwing (WS-R6.3 — non-fatal).
      return 'unreadable'
    }
  }

  /**
   * The install-vs-update-vs-ask rules, over a folder that is known to exist.
   *
   * The order matters: a `light` workspace short-circuits before the disk is
   * consulted (its whole promise is that Hive doesn't look for its own files
   * in there), a folder that already carries a BMAD install is adopted rather
   * than questioned (asking would be noise — the answer is on disk), and only
   * then is a genuinely new *secondary* folder handed the question.
   */
  function routeFor(path: string): WorkspaceRoute {
    const entry = configStore.getWorkspaces().find((candidate) => candidate.path === path)
    if (entry?.kind === 'light') return { step: 'ready' }

    const provisioned = provisionState(path)
    if (entry) return provisioned ? { step: 'update' } : { step: 'install', primary: entry.primary }
    if (provisioned) return { step: 'update' }

    const hasPrimary = configStore.getWorkspaces().some((candidate) => candidate.primary)
    // The very first workspace is the main one, and the main one always gets
    // BMAD — there is nothing to ask.
    return hasPrimary ? { step: 'choose' } : { step: 'install', primary: true }
  }

  function previewWorkspace(path: string): OpenResult {
    const failure = validate(path)
    if (failure) return { ok: false, reason: failure }
    return { ok: true, path, route: routeFor(path) }
  }

  function openWorkspace(path: string, kind?: WorkspaceKind): OpenResult {
    const failure = validate(path)
    if (failure) {
      configStore.removeWorkspace(path)
      return { ok: false, reason: failure }
    }

    // Register before routing so a brand-new workspace is routed as the entry
    // it just became — in particular, the first one ever opened is the primary
    // and therefore routes to `install`, never to `choose`.
    const existing = configStore.getWorkspaces().find((candidate) => candidate.path === path)
    configStore.upsertWorkspace(path, {
      kind: kind ?? existing?.kind ?? 'managed',
      lastOpenedAt: Date.now()
    })
    configStore.setWorkspacePath(path)
    configStore.pushRecentWorkspace(path)
    return { ok: true, path, route: routeFor(path) }
  }

  async function pickFolder(): Promise<string | null> {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  }

  function getWorkspace(): string | null {
    return configStore.getConfig().workspacePath
  }

  function isProvisioned(): boolean {
    return configStore.getConfig().provisioned
  }

  function listWorkspaces(): WorkspaceInfo[] {
    return configStore.getWorkspaces().map((entry) => {
      const missing = validate(entry.path) !== null
      return {
        ...entry,
        displayName: entry.name ?? folderName(entry.path),
        // A folder we can't read can't be interrogated about BMAD either —
        // reporting `false` there would render as "sem BMAD", which is a
        // different (and wrong) story from "esta pasta sumiu".
        provisioned: missing ? false : provisionState(entry.path),
        missing
      }
    })
  }

  function renameWorkspace(path: string, name: string | null): void {
    const trimmed = name?.trim() ?? ''
    configStore.upsertWorkspace(path, { name: trimmed === '' ? null : trimmed })
  }

  function adoptWorkspace(path: string): void {
    configStore.upsertWorkspace(path, { kind: 'managed' })
  }

  function setPrimaryWorkspace(path: string): void {
    configStore.upsertWorkspace(path, { kind: 'managed' })
    configStore.setPrimaryWorkspace(path)
  }

  function forgetWorkspace(path: string): boolean {
    const entry = configStore.getWorkspaces().find((candidate) => candidate.path === path)
    if (!entry || entry.primary) return false
    configStore.removeWorkspace(path)
    return true
  }

  return {
    pickFolder,
    getWorkspace,
    isProvisioned,
    provisionState,
    getRecentWorkspaces,
    previewWorkspace,
    openWorkspace,
    listWorkspaces,
    renameWorkspace,
    adoptWorkspace,
    setPrimaryWorkspace,
    forgetWorkspace
  }
}
