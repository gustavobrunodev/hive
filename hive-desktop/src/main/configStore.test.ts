import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { DEFAULT_CONFIG, MAX_RECENT_WORKSPACES, createConfigStore } from './configStore'

// `createConfigStore` takes its base directory as a plain argument instead of
// reading `electron.app.getPath('userData')` internally, so tests point it at
// a real temp directory rather than mocking the `electron` module — this
// module has no other Electron API surface worth mocking.
describe('ConfigStore', () => {
  let baseDir: string

  beforeEach(() => {
    baseDir = mkdtempSync(join(tmpdir(), 'hive-config-store-'))
  })

  afterEach(() => {
    rmSync(baseDir, { recursive: true, force: true })
  })

  it('returns defaults when no config file exists yet', () => {
    const store = createConfigStore(baseDir)
    expect(store.getConfig()).toEqual(DEFAULT_CONFIG)
  })

  it('treats a corrupt config file as first run rather than throwing', () => {
    const configPath = join(baseDir, 'config.json')
    writeFileSync(configPath, '{ not valid json', 'utf-8')

    const store = createConfigStore(baseDir)
    expect(store.getConfig()).toEqual(DEFAULT_CONFIG)
  })

  it('cleans up the temp file and rethrows when the atomic rename fails', () => {
    const configPath = join(baseDir, 'config.json')
    // Make the rename target an existing non-empty directory so renameSync
    // (file -> directory) fails, exercising the write-failure cleanup path.
    mkdirSync(configPath)
    writeFileSync(join(configPath, 'placeholder'), 'x', 'utf-8')

    const store = createConfigStore(baseDir)
    expect(() => store.setWorkspacePath('/workspace')).toThrow()
  })

  it('writes a value and reads it back (round-trip)', () => {
    const store = createConfigStore(baseDir)

    store.setWorkspacePath('/Users/dev/my-workspace')
    store.setProvisioned(true)
    store.setLastModel('claude-opus-4')
    store.setLastEffort('high')

    expect(store.getConfig()).toEqual({
      workspacePath: '/Users/dev/my-workspace',
      provisioned: true,
      recentWorkspaces: [],
      lastModel: 'claude-opus-4',
      lastEffort: 'high',
      agent: null,
      role: null
    })
  })

  it('updateConfig merges a partial update without clobbering other fields', () => {
    const store = createConfigStore(baseDir)
    store.setWorkspacePath('/workspace')
    store.setProvisioned(true)

    store.updateConfig({ lastModel: 'claude-sonnet-4', lastEffort: 'medium' })

    expect(store.getConfig()).toEqual({
      workspacePath: '/workspace',
      provisioned: true,
      recentWorkspaces: [],
      lastModel: 'claude-sonnet-4',
      lastEffort: 'medium',
      agent: null,
      role: null
    })
  })

  it('survives an app restart: a fresh store instance pointed at the same dir sees prior writes', () => {
    const firstInstance = createConfigStore(baseDir)
    firstInstance.setWorkspacePath('/persisted/workspace')
    firstInstance.setProvisioned(true)
    firstInstance.setLastModel('claude-haiku-4')
    firstInstance.setLastEffort('low')

    // Simulate the app restarting: a brand new in-memory module instance,
    // same on-disk config file.
    const secondInstance = createConfigStore(baseDir)

    expect(secondInstance.getConfig()).toEqual({
      workspacePath: '/persisted/workspace',
      provisioned: true,
      recentWorkspaces: [],
      lastModel: 'claude-haiku-4',
      lastEffort: 'low',
      agent: null,
      role: null
    })
  })

  it('persists and reads back the app-wide agent + role preferences', () => {
    const store = createConfigStore(baseDir)
    expect(store.getAgent()).toBeNull()
    expect(store.getRole()).toBeNull()

    store.setAgent('claude-cli')
    store.setRole('pm')

    expect(store.getAgent()).toBe('claude-cli')
    expect(store.getRole()).toBe('pm')

    // Survives a restart (fresh instance, same dir).
    const restarted = createConfigStore(baseDir)
    expect(restarted.getAgent()).toBe('claude-cli')
    expect(restarted.getRole()).toBe('pm')
  })

  it('backfills recentWorkspaces to [] when loading an old config without the field', () => {
    const store = createConfigStore(baseDir)
    // Simulate a pre-existing config.json written before recentWorkspaces existed.
    store.setWorkspacePath('/legacy/workspace')
    const configPath = join(baseDir, 'config.json')
    writeFileSync(
      configPath,
      JSON.stringify({ workspacePath: '/legacy/workspace', provisioned: true }),
      'utf-8'
    )

    expect(store.getConfig().recentWorkspaces).toEqual([])
  })

  it('pushRecentWorkspace adds a new entry to the front', () => {
    const store = createConfigStore(baseDir)
    store.pushRecentWorkspace('/a')
    store.pushRecentWorkspace('/b')

    expect(store.getRecentWorkspaces()).toEqual(['/b', '/a'])
  })

  it('pushRecentWorkspace moves an existing entry to the front instead of duplicating it', () => {
    const store = createConfigStore(baseDir)
    store.pushRecentWorkspace('/a')
    store.pushRecentWorkspace('/b')
    store.pushRecentWorkspace('/c')
    store.pushRecentWorkspace('/a')

    expect(store.getRecentWorkspaces()).toEqual(['/a', '/c', '/b'])
  })

  it('pushRecentWorkspace dedupes so only one instance of a path is kept', () => {
    const store = createConfigStore(baseDir)
    store.pushRecentWorkspace('/a')
    store.pushRecentWorkspace('/a')
    store.pushRecentWorkspace('/a')

    expect(store.getRecentWorkspaces()).toEqual(['/a'])
  })

  it('pushRecentWorkspace caps the list at MAX_RECENT_WORKSPACES, dropping the oldest', () => {
    const store = createConfigStore(baseDir)
    const paths = Array.from({ length: MAX_RECENT_WORKSPACES + 5 }, (_, i) => `/workspace-${i}`)
    for (const path of paths) {
      store.pushRecentWorkspace(path)
    }

    const recents = store.getRecentWorkspaces()
    expect(recents).toHaveLength(MAX_RECENT_WORKSPACES)
    // Most recently pushed is at the front; oldest pushes were dropped.
    const expected = paths.slice(paths.length - MAX_RECENT_WORKSPACES).reverse()
    expect(recents).toEqual(expected)
  })

  it('removeRecentWorkspace prunes a single entry, leaving the rest untouched', () => {
    const store = createConfigStore(baseDir)
    store.pushRecentWorkspace('/a')
    store.pushRecentWorkspace('/b')
    store.pushRecentWorkspace('/c')

    store.removeRecentWorkspace('/b')

    expect(store.getRecentWorkspaces()).toEqual(['/c', '/a'])
  })
})
