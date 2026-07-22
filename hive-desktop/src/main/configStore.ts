import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'fs'
import { join } from 'path'

/**
 * The user's custom shortcut selection (shortcut-customization): which
 * workspace skills appear as workflow shortcuts and which specialist agents
 * appear as persona shortcuts — both in the "O que você quer fazer hoje?"
 * hero and the composer's shortcut strip. Arrays hold BMAD skill names in
 * the user's selection order (toggling appends, so order is meaningful).
 * `null` in `Config.shortcuts` = never customized → the role's defaults.
 */
export interface ShortcutPrefs {
  skills: string[]
  agents: string[]
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
  recentWorkspaces: string[]
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
  // Global custom shortcut selection (shortcut-customization). `null` until
  // the user first customizes — role defaults apply then, and "Restaurar
  // padrão do papel" writes `null` back.
  shortcuts: ShortcutPrefs | null
  // npm-distribution (ND-R5.4): a version the user explicitly chose to skip
  // from the update notice. `null` until a version is skipped. Checked
  // before announcing an update — a version newer than this one still
  // announces normally, and the skipped version stays reachable from the
  // update surface ("Instalar mesmo assim") rather than disappearing.
  skippedUpdateVersion: string | null
}

export const DEFAULT_CONFIG: Config = {
  workspacePath: null,
  provisioned: false,
  recentWorkspaces: [],
  lastModel: null,
  lastEffort: null,
  agent: null,
  agents: null,
  role: null,
  userName: null,
  shortcuts: null,
  skippedUpdateVersion: null
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
 * Normalizes a raw (possibly hand-edited / older-schema) `shortcuts` value:
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
  getShortcuts(): ShortcutPrefs | null
  setShortcuts(prefs: ShortcutPrefs | null): void
  getSkippedUpdateVersion(): string | null
  setSkippedUpdateVersion(version: string | null): void
  getRecentWorkspaces(): string[]
  pushRecentWorkspace(path: string): void
  removeRecentWorkspace(path: string): void
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
    // malformed shape into the resolver.
    getShortcuts: () => sanitizeShortcutPrefs(readConfig().shortcuts),
    setShortcuts: (prefs: ShortcutPrefs | null) =>
      updateConfig({ shortcuts: sanitizeShortcutPrefs(prefs) }),
    getSkippedUpdateVersion: () => readConfig().skippedUpdateVersion,
    setSkippedUpdateVersion: (version: string | null) =>
      updateConfig({ skippedUpdateVersion: version }),
    getRecentWorkspaces: () => readConfig().recentWorkspaces,
    pushRecentWorkspace: (path: string) => {
      const current = readConfig()
      const deduped = current.recentWorkspaces.filter((p) => p !== path)
      const recentWorkspaces = [path, ...deduped].slice(0, MAX_RECENT_WORKSPACES)
      writeConfig({ ...current, recentWorkspaces })
    },
    removeRecentWorkspace: (path: string) => {
      const current = readConfig()
      const recentWorkspaces = current.recentWorkspaces.filter((p) => p !== path)
      writeConfig({ ...current, recentWorkspaces })
    }
  }
}
