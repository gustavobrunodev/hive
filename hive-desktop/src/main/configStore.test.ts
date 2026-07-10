import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { DEFAULT_CONFIG, createConfigStore } from './configStore'

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

  it('writes a value and reads it back (round-trip)', () => {
    const store = createConfigStore(baseDir)

    store.setWorkspacePath('/Users/dev/my-workspace')
    store.setProvisioned(true)
    store.setLastModel('claude-opus-4')
    store.setLastEffort('high')

    expect(store.getConfig()).toEqual({
      workspacePath: '/Users/dev/my-workspace',
      provisioned: true,
      lastModel: 'claude-opus-4',
      lastEffort: 'high'
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
      lastModel: 'claude-sonnet-4',
      lastEffort: 'medium'
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
      lastModel: 'claude-haiku-4',
      lastEffort: 'low'
    })
  })
})
