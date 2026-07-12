import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'fs'
import { join } from 'path'

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
}

export const DEFAULT_CONFIG: Config = {
  workspacePath: null,
  provisioned: false,
  recentWorkspaces: [],
  lastModel: null,
  lastEffort: null
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
      return { ...DEFAULT_CONFIG, ...parsed }
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
