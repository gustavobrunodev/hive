import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'fs'
import { join } from 'path'

/**
 * The user's custom shortcut selection (shortcut-customization): which
 * workspace skills appear as workflow shortcuts and which specialist agents
 * appear as persona shortcuts. Arrays hold BMAD skill names in the user's
 * selection order (toggling appends, so order is meaningful). `null` for a
 * scope = never customized → the role's defaults for that scope.
 */
export interface ShortcutPrefs {
  skills: string[]
  agents: string[]
}

/**
 * Where a shortcut lives (shortcut-scopes). The two moments are different
 * jobs, so they get different sets:
 *  - `start` — the "O que você quer fazer hoje?" hero, before the first
 *    message: how a conversation *begins*.
 *  - `during` — the strip docked above the composer inside a live
 *    conversation: what you reach for *mid-thread*.
 */
export type ShortcutScope = 'start' | 'during'

/** The closed set of scopes, in display order. */
export const SHORTCUT_SCOPES: readonly ShortcutScope[] = ['start', 'during']

/** Whether a raw string names a valid scope (guards the IPC boundary). */
export function isShortcutScope(value: unknown): value is ShortcutScope {
  return typeof value === 'string' && (SHORTCUT_SCOPES as readonly string[]).includes(value)
}

/**
 * Both scopes' selections. `null` in a scope means "never customized" — that
 * scope falls back to the role's defaults, independently of the other one, so
 * customizing the hero never silently freezes the in-conversation strip.
 */
export type ShortcutSettings = Record<ShortcutScope, ShortcutPrefs | null>

/** Neither scope customized — the shape a fresh install (and a reset) has. */
export const EMPTY_SHORTCUT_SETTINGS: ShortcutSettings = { start: null, during: null }

/**
 * How Hive treats a workspace's folder (multi-workspace):
 *  - `managed` — Hive provisions BMAD (and the Second Brain vault) here, so
 *    `_bmad/`, `.claude/skills/` and `second-brain/` are created inside it.
 *  - `light`   — Hive writes **nothing** into the folder. The agent, the
 *    explorer and Source Control all work; only the BMAD-fed surfaces
 *    (workflows, personas, workspace skills) are empty, and the user can
 *    convert to `managed` at any time.
 *
 * This records the user's *intent*, not the state of the disk — the disk is
 * checked separately (`workspaceService.provisionState`) and stays the truth
 * about whether `_bmad/` actually exists. Keeping the two apart is what lets
 * a `managed` workspace whose install failed retry, and what stops a `light`
 * workspace that happens to contain someone else's `_bmad/` from being
 * silently adopted.
 */
export type WorkspaceKind = 'managed' | 'light'

/** The closed set of kinds — guards the IPC boundary and hand-edited config. */
export function isWorkspaceKind(value: unknown): value is WorkspaceKind {
  return value === 'managed' || value === 'light'
}

/**
 * One registered workspace (multi-workspace). The registry replaces the flat
 * `recentWorkspaces` path list as the thing the UI reads: a workspace is now
 * a named place with a kind and a rank, not just a path that was opened once.
 *
 * Invariants, enforced by `sanitizeWorkspaces` on every read and write so a
 * hand-edited config can never violate them:
 *  - paths are unique;
 *  - a non-empty registry has **exactly one** `primary`;
 *  - the primary is always `managed` — BMAD is the method the app is a
 *    surface for, so the workspace the user calls their main one has it.
 */
export interface WorkspaceEntry {
  path: string
  /** User-given display name; `null` = derive it from the path's last segment. */
  name: string | null
  kind: WorkspaceKind
  primary: boolean
  /** ms epoch of the last time this workspace was opened — the MRU rank. */
  lastOpenedAt: number
}

/**
 * Persisted app configuration (R2.2, R3.5). No secrets — agent CLIs manage
 * their own auth. See design.md §6 "Data & Persistence".
 */
export interface Config {
  workspacePath: string | null
  // Retained; still written by install() success. No longer the source of
  // truth for routing — that becomes disk-based (see workspace-switching
  // design.md §6).
  provisioned: boolean
  // Kept as the flat MRU of paths it always was, written in lockstep with
  // `workspaces` below by `pushRecentWorkspace`/`removeRecentWorkspace` so the
  // two can never disagree. Nothing in the UI reads it any more
  // (multi-workspace) — it survives as the migration source for the registry
  // and as the shape older builds understand, so downgrading the app doesn't
  // lose the user's list.
  recentWorkspaces: string[]
  // multi-workspace: the workspace registry — the list the switcher renders.
  // Empty on a fresh install; `sanitizeWorkspaces` migrates a pre-registry
  // config out of `workspacePath` + `recentWorkspaces` on first read, so an
  // existing user opens the new switcher already populated.
  workspaces: WorkspaceEntry[]
  lastModel: string | null
  lastEffort: string | null
  // Global (app-wide, not per-workspace) profile preferences.
  //
  // `agent` (multi-agent): the user's **default** agent CLI id — the one a new
  // conversation starts on. `agents`: the full set of **enabled** agent ids the
  // user picked (onboarding + profile), the pool of agents the composer's
  // switcher offers. `agent` is expected to be a member of `agents`. Both stay
  // decoupled from the concrete agent-id union (just data on disk).
  //
  // Migration: a config written before multi-agent has `agents == null` but a
  // single `agent`; `readConfig` seeds `agents = [agent]` so older installs keep
  // exactly the agent they had, now as their (single) enabled set.
  agent: string | null
  agents: string[] | null
  role: string | null
  // How the app (and the agents) address the user — captured by the guided
  // BMAD install form, editable any time in the profile sheet. `null` until
  // first provided; display-only (greetings), never an identifier.
  userName: string | null
  // Global custom shortcut selection, per scope (shortcut-scopes). A scope is
  // `null` until the user first customizes it — role defaults apply then, and
  // "Restaurar padrão do papel" writes `null` back for that scope alone.
  //
  // Migration: a config written before the scope split holds the flat
  // `{ skills, agents }` shape, which was the *hero* selection also mirrored
  // into the strip. `sanitizeShortcutSettings` lifts it into `start`, so an
  // existing customization keeps exactly the shortcuts it had where it had
  // them, and `during` starts from the role default.
  shortcuts: ShortcutSettings
  // npm-distribution (ND-R5.4): a version the user explicitly chose to skip
  // from the update notice. `null` until a version is skipped. Checked
  // before announcing an update — a version newer than this one still
  // announces normally, and the skipped version stays reachable from the
  // update surface ("Instalar mesmo assim") rather than disappearing.
  skippedUpdateVersion: string | null
  // agent-approvals: tool calls the user answered "Sempre permitir" to, as
  // `Tool` or `Bash:<executable>` rules (see `approvalRuleFor`). Standing
  // grants, so they persist; a denial never lands here, so a mistaken "no"
  // can't quietly block the agent forever.
  approvalRules: string[]
  // agent-terminal (AT-R2): the shell id (`cmd`, `powershell`, `pwsh`,
  // `git-bash`, `bash`, `zsh`, …) agent turns run inside. `null` = automatic —
  // `cmd` on Windows, the user's `$SHELL` in POSIX (see `shellCatalog.ts`).
  // Stored as the id, not the path: a Git Bash that moves between machines (or
  // an app update that relocates it) still resolves, and an id whose shell is
  // gone falls back to automatic without erasing the choice (D-AT-4).
  agentShell: string | null
  // second-brain (SB-R7.4): the Whisper model the user pinned by hand.
  // `null` — the default, and what a "Automático" choice restores — means the
  // app picks one from the hardware probe on every launch, so a machine that
  // gains a GPU (or a user who moves their profile to a stronger laptop) is
  // re-evaluated instead of being stuck with a decision made once. Stored as
  // the bare id: an id that is neither bundled nor still downloaded falls back
  // to automatic rather than failing to transcribe.
  whisperModel: string | null
}

export const DEFAULT_CONFIG: Config = {
  workspacePath: null,
  provisioned: false,
  recentWorkspaces: [],
  workspaces: [],
  lastModel: null,
  lastEffort: null,
  agent: null,
  agents: null,
  role: null,
  userName: null,
  shortcuts: EMPTY_SHORTCUT_SETTINGS,
  skippedUpdateVersion: null,
  approvalRules: [],
  agentShell: null,
  whisperModel: null
}

/**
 * Normalizes a raw (possibly hand-edited / older-schema) enabled-agents value
 * into a clean, deduplicated, order-preserving list of non-empty strings, or
 * `null` when there's nothing usable. Same defensive philosophy as
 * `sanitizeShortcutPrefs`.
 */
export function sanitizeAgentList(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null
  const cleaned = [
    ...new Set(value.filter((item): item is string => typeof item === 'string' && item !== ''))
  ]
  return cleaned.length > 0 ? cleaned : null
}

/**
 * Normalizes a raw (possibly hand-edited / older-schema) prefs value:
 * non-object → `null`; each list keeps only non-empty strings, deduplicated,
 * preserving order. Exported for the IPC boundary (main/index.ts sanitizes
 * renderer input with the same rule the store applies on read).
 */
export function sanitizeShortcutPrefs(value: unknown): ShortcutPrefs | null {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) return null
  const raw = value as { skills?: unknown; agents?: unknown }
  const cleanList = (list: unknown): string[] => {
    if (!Array.isArray(list)) return []
    return [
      ...new Set(list.filter((item): item is string => typeof item === 'string' && item !== ''))
    ]
  }
  return { skills: cleanList(raw.skills), agents: cleanList(raw.agents) }
}

/**
 * Normalizes a raw `shortcuts` value into the two-scope shape, absorbing every
 * schema this field has had:
 *  - `null`/garbage → neither scope customized;
 *  - the pre-split flat `{ skills, agents }` → lifted into `start` (see
 *    `Config.shortcuts`);
 *  - the current `{ start, during }` → each scope sanitized on its own.
 * Never throws, so a hand-edited config.json can't leak a malformed shape into
 * the resolver.
 */
export function sanitizeShortcutSettings(value: unknown): ShortcutSettings {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) {
    return { ...EMPTY_SHORTCUT_SETTINGS }
  }
  const raw = value as Record<string, unknown>
  // The legacy shape is recognized by its own keys, not by the absence of the
  // new ones — a config carrying both (impossible today, cheap to survive)
  // resolves as the current schema.
  const scoped = 'start' in raw || 'during' in raw
  if (!scoped) {
    return { start: sanitizeShortcutPrefs(raw), during: null }
  }
  return {
    start: sanitizeShortcutPrefs(raw.start),
    during: sanitizeShortcutPrefs(raw.during)
  }
}

/**
 * The pre-registry fields a config may still be carrying, used to migrate a
 * user who has been through the single-workspace era into the registry.
 */
export interface LegacyWorkspaceFields {
  workspacePath: string | null
  recentWorkspaces: string[]
}

/** Parses one raw registry element, or `null` when it carries no usable path. */
function parseWorkspaceEntry(value: unknown): WorkspaceEntry | null {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) return null
  const raw = value as Record<string, unknown>
  const path = typeof raw.path === 'string' ? raw.path.trim() : ''
  if (path === '') return null
  const name = typeof raw.name === 'string' && raw.name.trim() !== '' ? raw.name.trim() : null
  const lastOpenedAt =
    typeof raw.lastOpenedAt === 'number' &&
    Number.isFinite(raw.lastOpenedAt) &&
    raw.lastOpenedAt > 0
      ? raw.lastOpenedAt
      : 0
  return {
    path,
    name,
    kind: isWorkspaceKind(raw.kind) ? raw.kind : 'managed',
    primary: raw.primary === true,
    lastOpenedAt
  }
}

/**
 * Restores the registry's invariants over an already-parsed list: unique
 * paths, MRU order (most recently opened first), exactly one primary, and a
 * primary that is always `managed`.
 *
 * Ordering is derived here rather than trusted from disk so every reader —
 * the switcher, the `Ctrl+N` jump list, the migration — sees the same order
 * without each having to sort. Ties keep their stored order, which is what
 * makes a freshly migrated list come out in the order the user left it.
 */
function normalizeWorkspaces(entries: WorkspaceEntry[]): WorkspaceEntry[] {
  const byPath = new Map<string, WorkspaceEntry>()
  for (const entry of entries) {
    // First writer wins: a duplicated path in a hand-edited file keeps the
    // earlier (higher-ranked, once sorted) record rather than the later one.
    if (!byPath.has(entry.path)) byPath.set(entry.path, entry)
  }
  const unique = [...byPath.values()]
  // Stable sort by recency. `Array.prototype.sort` is specified stable, so
  // equal timestamps (every entry of a freshly migrated list, and any
  // never-opened one) keep insertion order.
  unique.sort((a, b) => b.lastOpenedAt - a.lastOpenedAt)
  if (unique.length === 0) return []

  const firstPrimary = unique.find((entry) => entry.primary) ?? unique[0]
  return unique.map((entry) => {
    const primary = entry === firstPrimary
    return {
      ...entry,
      primary,
      // The primary is `managed` by definition — see `WorkspaceEntry`.
      kind: primary ? 'managed' : entry.kind
    }
  })
}

/**
 * Normalizes a raw `workspaces` value into the registry, absorbing both
 * schemas this app has had:
 *  - a real registry array → each element parsed, invariants restored;
 *  - nothing usable → **migrated** from `legacy` (the single-workspace era's
 *    `workspacePath` + `recentWorkspaces`), so an existing user's list is
 *    already there the first time the switcher opens.
 *
 * Every migrated workspace is `managed`: before the registry existed, opening
 * a workspace at all meant going through the BMAD install/update gate, so
 * that is what those paths are. The active one becomes the primary.
 *
 * `now` is injected so the migration's timestamps are deterministic in tests.
 * Never throws — a hand-edited config.json can't leak a malformed registry.
 */
export function sanitizeWorkspaces(
  value: unknown,
  legacy: LegacyWorkspaceFields = { workspacePath: null, recentWorkspaces: [] },
  now: number = Date.now()
): WorkspaceEntry[] {
  const parsed = Array.isArray(value)
    ? value.map(parseWorkspaceEntry).filter((entry): entry is WorkspaceEntry => entry !== null)
    : []
  if (parsed.length > 0) return normalizeWorkspaces(parsed)

  const legacyPaths = [
    ...(typeof legacy.workspacePath === 'string' && legacy.workspacePath !== ''
      ? [legacy.workspacePath]
      : []),
    ...(Array.isArray(legacy.recentWorkspaces)
      ? legacy.recentWorkspaces.filter(
          (path): path is string => typeof path === 'string' && path !== ''
        )
      : [])
  ]
  return normalizeWorkspaces(
    legacyPaths.map((path, index) => ({
      path,
      name: null,
      kind: 'managed' as const,
      primary: index === 0,
      // Descending, so the migrated order is the order the user left it in.
      lastOpenedAt: now - index
    }))
  )
}

/**
 * Applies `patch` to `path`'s registry entry, registering it first when it
 * isn't there yet, and hands the result back normalized.
 *
 * A brand-new entry is `managed` and — when the registry is empty — primary:
 * the first workspace a user ever opens is their main one, which is exactly
 * what the pre-registry app assumed. `patch` still wins over both, so the
 * "adicionar workspace" flow can register a `light` secondary in one call.
 */
function touchWorkspace(
  entries: WorkspaceEntry[],
  path: string,
  patch: Partial<Omit<WorkspaceEntry, 'path'>>
): WorkspaceEntry[] {
  const existing = entries.find((entry) => entry.path === path)
  const base: WorkspaceEntry = existing ?? {
    path,
    name: null,
    kind: 'managed',
    primary: entries.length === 0,
    lastOpenedAt: 0
  }
  const next: WorkspaceEntry = { ...base, ...patch, path }
  const others = entries.filter((entry) => entry.path !== path)
  // A patch that claims the primary flag has to strip it from whoever held it,
  // otherwise `normalizeWorkspaces` would keep the *other* one (it resolves a
  // conflict by MRU rank, which is not the user's intent here).
  const rest = next.primary ? others.map((entry) => ({ ...entry, primary: false })) : others
  return sanitizeWorkspaces([next, ...rest])
}

const CONFIG_FILE_NAME = 'config.json'

/** Max entries retained in `Config.recentWorkspaces` (MRU, WS-R2.1). */
export const MAX_RECENT_WORKSPACES = 10

export interface ConfigStore {
  getConfig(): Config
  updateConfig(partial: Partial<Config>): void
  setWorkspacePath(path: string): void
  setProvisioned(value: boolean): void
  setLastModel(id: string): void
  setLastEffort(id: string): void
  getAgent(): string | null
  setAgent(id: string): void
  getEnabledAgents(): string[] | null
  setEnabledAgents(ids: string[]): void
  getRole(): string | null
  setRole(id: string): void
  getUserName(): string | null
  setUserName(name: string | null): void
  getShortcuts(): ShortcutSettings
  setShortcuts(scope: ShortcutScope, prefs: ShortcutPrefs | null): void
  getSkippedUpdateVersion(): string | null
  setSkippedUpdateVersion(version: string | null): void
  /** agent-approvals: the standing "Sempre permitir" rules (sanitized). */
  getApprovalRules(): string[]
  setApprovalRules(rules: string[]): void
  /** agent-terminal: the chosen shell id, or `null` for automatic. */
  getAgentShell(): string | null
  setAgentShell(id: string | null): void
  /** second-brain: the pinned Whisper model id, or `null` for automatic. */
  getWhisperModel(): string | null
  setWhisperModel(id: string | null): void
  getRecentWorkspaces(): string[]
  pushRecentWorkspace(path: string): void
  removeRecentWorkspace(path: string): void
  /** multi-workspace: the registry, MRU-ordered, invariants restored. */
  getWorkspaces(): WorkspaceEntry[]
  /**
   * Registers `path` if it isn't in the registry yet, then applies `patch` to
   * it. The one write path for everything the switcher can change (kind,
   * name, recency), so the invariants are restored exactly once, on write.
   * A brand-new entry defaults to `managed` and becomes the primary when the
   * registry is empty — the first workspace a user ever opens is their main
   * one, which is also what the pre-registry app did.
   */
  upsertWorkspace(path: string, patch?: Partial<Omit<WorkspaceEntry, 'path'>>): void
  /** Drops `path` from the registry (and the MRU). Never touches the disk. */
  removeWorkspace(path: string): void
  /** Moves the primary flag to `path` (a no-op if it isn't registered). */
  setPrimaryWorkspace(path: string): void
}

/**
 * Creates a ConfigStore that persists JSON at `<baseDir>/config.json`.
 *
 * `baseDir` is injected rather than read from `electron.app.getPath('userData')`
 * internally so this module has zero dependency on the `electron` package at
 * runtime and can be unit tested against a plain temp directory — no mocking
 * required. Callers wiring this into the app (T5) pass
 * `app.getPath('userData')` as `baseDir`.
 *
 * Reads/writes always go straight to disk (no in-memory cache), so disk is
 * the single source of truth: a fresh `createConfigStore(sameBaseDir)` call
 * (e.g. after an app restart) sees whatever was last written.
 */
export function createConfigStore(baseDir: string): ConfigStore {
  const configPath = join(baseDir, CONFIG_FILE_NAME)

  function readConfig(): Config {
    if (!existsSync(configPath)) {
      return { ...DEFAULT_CONFIG }
    }
    try {
      const raw = readFileSync(configPath, 'utf-8')
      const parsed = JSON.parse(raw) as Partial<Config>
      const merged = { ...DEFAULT_CONFIG, ...parsed }
      // multi-agent migration: an older config has a single `agent` and no
      // `agents` set — seed the enabled set from it so nothing is lost.
      const agents = sanitizeAgentList(merged.agents)
      merged.agents = agents ?? (merged.agent ? [merged.agent] : null)
      // multi-workspace: the registry is normalized on every read, and
      // migrated out of `workspacePath` + `recentWorkspaces` when a
      // pre-registry config has no `workspaces` yet.
      merged.workspaces = sanitizeWorkspaces(merged.workspaces, {
        workspacePath: merged.workspacePath,
        recentWorkspaces: merged.recentWorkspaces
      })
      return merged
    } catch {
      // Missing/corrupt file (or unreadable) — treat as first run rather than throw.
      return { ...DEFAULT_CONFIG }
    }
  }

  function writeConfig(config: Config): void {
    mkdirSync(baseDir, { recursive: true })
    // Write-to-temp-then-rename so a crash mid-write can never leave a
    // half-written config.json behind; rename is atomic on the same volume.
    const tmpPath = `${configPath}.tmp-${process.pid}-${Date.now()}`
    writeFileSync(tmpPath, JSON.stringify(config, null, 2), 'utf-8')
    try {
      renameSync(tmpPath, configPath)
    } catch (err) {
      try {
        unlinkSync(tmpPath)
      } catch {
        // best-effort cleanup
      }
      throw err
    }
  }

  function updateConfig(partial: Partial<Config>): void {
    const current = readConfig()
    writeConfig({ ...current, ...partial })
  }

  return {
    getConfig: readConfig,
    updateConfig,
    setWorkspacePath: (path: string) => updateConfig({ workspacePath: path }),
    setProvisioned: (value: boolean) => updateConfig({ provisioned: value }),
    setLastModel: (id: string) => updateConfig({ lastModel: id }),
    setLastEffort: (id: string) => updateConfig({ lastEffort: id }),
    getAgent: () => readConfig().agent,
    setAgent: (id: string) => updateConfig({ agent: id }),
    getEnabledAgents: () => sanitizeAgentList(readConfig().agents),
    // Persists the enabled set (sanitized). Keeps the default `agent` coherent:
    // if the current default isn't in the new set, the first enabled agent
    // becomes the default (an empty set clears both fields to null).
    setEnabledAgents: (ids: string[]) => {
      const current = readConfig()
      const agents = sanitizeAgentList(ids)
      const agent =
        agents == null ? null : agents.includes(current.agent ?? '') ? current.agent : agents[0]
      writeConfig({ ...current, agents, agent })
    },
    getRole: () => readConfig().role,
    setRole: (id: string) => updateConfig({ role: id }),
    getUserName: () => readConfig().userName,
    // Normalized on write: trimmed, and an empty string clears back to null
    // (the greeting falls back to the neutral copy).
    setUserName: (name: string | null) => {
      const trimmed = name?.trim() ?? ''
      updateConfig({ userName: trimmed === '' ? null : trimmed })
    },
    // Sanitized on read AND write, so a hand-edited config.json can't leak a
    // malformed shape into the resolver. Writes are per-scope: setting one
    // scope re-reads and preserves the other, so the two can never clobber
    // each other even when both are edited in the same picker session.
    getShortcuts: () => sanitizeShortcutSettings(readConfig().shortcuts),
    setShortcuts: (scope: ShortcutScope, prefs: ShortcutPrefs | null) => {
      const current = readConfig()
      const settings = sanitizeShortcutSettings(current.shortcuts)
      settings[scope] = sanitizeShortcutPrefs(prefs)
      writeConfig({ ...current, shortcuts: settings })
    },
    getSkippedUpdateVersion: () => readConfig().skippedUpdateVersion,
    setSkippedUpdateVersion: (version: string | null) =>
      updateConfig({ skippedUpdateVersion: version }),
    // Same read-and-write sanitization as `shortcuts`: these grant the agent
    // standing permission, so a hand-edited (or older-schema) config can never
    // put a non-string into the rule set.
    getApprovalRules: () => sanitizeAgentList(readConfig().approvalRules) ?? [],
    setApprovalRules: (rules: string[]) =>
      updateConfig({ approvalRules: sanitizeAgentList(rules) ?? [] }),
    // agent-terminal: normalized the same way `userName` is — a blank id is
    // "automatic", never an empty-string id nothing can ever resolve.
    getAgentShell: () => {
      const value = readConfig().agentShell
      return typeof value === 'string' && value.trim() !== '' ? value : null
    },
    setAgentShell: (id: string | null) => {
      const trimmed = id?.trim() ?? ''
      updateConfig({ agentShell: trimmed === '' ? null : trimmed })
    },
    getWhisperModel: () => {
      const value = readConfig().whisperModel
      return typeof value === 'string' && value.trim() !== '' ? value : null
    },
    setWhisperModel: (id: string | null) => {
      const trimmed = id?.trim() ?? ''
      updateConfig({ whisperModel: trimmed === '' ? null : trimmed })
    },
    getRecentWorkspaces: () => readConfig().recentWorkspaces,
    // Writes both halves of the workspace list in one transaction
    // (multi-workspace): the flat MRU older builds understand, and the
    // registry the switcher reads. Splitting them into two calls is what
    // would let them drift, so they never are.
    pushRecentWorkspace: (path: string) => {
      const current = readConfig()
      const deduped = current.recentWorkspaces.filter((p) => p !== path)
      const recentWorkspaces = [path, ...deduped].slice(0, MAX_RECENT_WORKSPACES)
      writeConfig({
        ...current,
        recentWorkspaces,
        workspaces: touchWorkspace(current.workspaces, path, { lastOpenedAt: Date.now() })
      })
    },
    removeRecentWorkspace: (path: string) => {
      const current = readConfig()
      writeConfig({
        ...current,
        recentWorkspaces: current.recentWorkspaces.filter((p) => p !== path),
        workspaces: sanitizeWorkspaces(current.workspaces.filter((entry) => entry.path !== path))
      })
    },
    getWorkspaces: () => readConfig().workspaces,
    upsertWorkspace: (path: string, patch: Partial<Omit<WorkspaceEntry, 'path'>> = {}) => {
      const current = readConfig()
      writeConfig({ ...current, workspaces: touchWorkspace(current.workspaces, path, patch) })
    },
    removeWorkspace: (path: string) => {
      const current = readConfig()
      writeConfig({
        ...current,
        recentWorkspaces: current.recentWorkspaces.filter((p) => p !== path),
        workspaces: sanitizeWorkspaces(current.workspaces.filter((entry) => entry.path !== path))
      })
    },
    setPrimaryWorkspace: (path: string) => {
      const current = readConfig()
      if (!current.workspaces.some((entry) => entry.path === path)) return
      writeConfig({
        ...current,
        workspaces: sanitizeWorkspaces(
          current.workspaces.map((entry) => ({ ...entry, primary: entry.path === path }))
        )
      })
    }
  }
}
