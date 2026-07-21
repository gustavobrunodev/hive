import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  DEFAULT_CONFIG,
  MAX_RECENT_WORKSPACES,
  createConfigStore,
  sanitizeAgentList,
  sanitizeShortcutPrefs
} from './configStore'

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
      agents: null,
      role: null,
      userName: null,
      shortcuts: null
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
      agents: null,
      role: null,
      userName: null,
      shortcuts: null
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
      agents: null,
      role: null,
      userName: null,
      shortcuts: null
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

  it('persists the display name, trimming on write and clearing on empty/null', () => {
    const store = createConfigStore(baseDir)
    expect(store.getUserName()).toBeNull()

    store.setUserName('  Gustavo Bruno  ')
    expect(store.getUserName()).toBe('Gustavo Bruno')

    // Survives a restart (fresh instance, same dir).
    expect(createConfigStore(baseDir).getUserName()).toBe('Gustavo Bruno')

    // Whitespace-only clears back to null (greeting falls back to neutral copy)…
    store.setUserName('   ')
    expect(store.getUserName()).toBeNull()

    // …and so does an explicit null.
    store.setUserName('Ana')
    store.setUserName(null)
    expect(store.getUserName()).toBeNull()
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

// shortcut-customization: the persisted custom shortcut selection.
describe('ConfigStore — shortcuts (shortcut-customization)', () => {
  let baseDir: string

  beforeEach(() => {
    baseDir = mkdtempSync(join(tmpdir(), 'hive-config-shortcuts-'))
  })

  afterEach(() => {
    rmSync(baseDir, { recursive: true, force: true })
  })

  it('defaults to null (role defaults apply) and round-trips a selection', () => {
    const store = createConfigStore(baseDir)
    expect(store.getShortcuts()).toBeNull()

    store.setShortcuts({ skills: ['bmad-prd', 'bmad-spec'], agents: ['bmad-agent-pm'] })
    expect(store.getShortcuts()).toEqual({
      skills: ['bmad-prd', 'bmad-spec'],
      agents: ['bmad-agent-pm']
    })

    // A fresh store over the same dir reads the same selection (disk truth).
    expect(createConfigStore(baseDir).getShortcuts()).toEqual({
      skills: ['bmad-prd', 'bmad-spec'],
      agents: ['bmad-agent-pm']
    })
  })

  it('setShortcuts(null) restores the role defaults', () => {
    const store = createConfigStore(baseDir)
    store.setShortcuts({ skills: ['bmad-prd'], agents: [] })
    store.setShortcuts(null)
    expect(store.getShortcuts()).toBeNull()
  })

  it('sanitizes hand-edited config on read (bad shapes never leak)', () => {
    mkdirSync(baseDir, { recursive: true })
    writeFileSync(
      join(baseDir, 'config.json'),
      JSON.stringify({ shortcuts: { skills: ['a', 7, '', 'a'], agents: 'not-a-list' } })
    )
    expect(createConfigStore(baseDir).getShortcuts()).toEqual({ skills: ['a'], agents: [] })
  })

  it('sanitizeShortcutPrefs: non-objects → null; lists deduped, order kept', () => {
    expect(sanitizeShortcutPrefs(null)).toBeNull()
    expect(sanitizeShortcutPrefs('x')).toBeNull()
    expect(sanitizeShortcutPrefs(['x'])).toBeNull()
    expect(sanitizeShortcutPrefs({ skills: ['b', 'a', 'b'], agents: undefined })).toEqual({
      skills: ['b', 'a'],
      agents: []
    })
  })

  // multi-agent: the enabled-agents set.
  it('getEnabledAgents/setEnabledAgents round-trips and dedupes, keeping the default coherent', () => {
    const store = createConfigStore(baseDir)
    store.setAgent('claude-cli')
    store.setEnabledAgents(['claude-cli', 'devin', 'claude-cli'])

    expect(store.getEnabledAgents()).toEqual(['claude-cli', 'devin'])
    expect(store.getAgent()).toBe('claude-cli') // still in the set → unchanged
  })

  it('setEnabledAgents moves the default into the set when the old default drops out', () => {
    const store = createConfigStore(baseDir)
    store.setAgent('devin')
    store.setEnabledAgents(['claude-cli', 'github-copilot'])

    expect(store.getAgent()).toBe('claude-cli')
  })

  it('setEnabledAgents([]) clears both the set and the default', () => {
    const store = createConfigStore(baseDir)
    store.setAgent('devin')
    store.setEnabledAgents([])

    expect(store.getEnabledAgents()).toBeNull()
    expect(store.getAgent()).toBeNull()
  })

  // multi-agent migration: an older single-agent config seeds the enabled set.
  it('migrates a pre-multi-agent config (single `agent`, no `agents`) to agents:[agent]', () => {
    mkdirSync(baseDir, { recursive: true })
    writeFileSync(join(baseDir, 'config.json'), JSON.stringify({ agent: 'claude-cli' }))
    const store = createConfigStore(baseDir)

    expect(store.getEnabledAgents()).toEqual(['claude-cli'])
    expect(store.getConfig().agents).toEqual(['claude-cli'])
  })

  it('sanitizeAgentList: non-arrays → null; empties → null; deduped, order kept', () => {
    expect(sanitizeAgentList(null)).toBeNull()
    expect(sanitizeAgentList('x')).toBeNull()
    expect(sanitizeAgentList([])).toBeNull()
    expect(sanitizeAgentList(['', 7])).toBeNull()
    expect(sanitizeAgentList(['b', 'a', 'b', ''])).toEqual(['b', 'a'])
  })
})
