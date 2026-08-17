import { mkdirSync, mkdtempSync, existsSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { LEGACY_USER_DATA_NAMES, migrateUserData } from './userDataMigration'

describe('migrateUserData', () => {
  let root: string
  let current: string

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'hive-userdata-'))
    current = join(root, 'Hive')
  })

  afterEach(() => rmSync(root, { recursive: true, force: true }))

  function seedLegacy(name: string, files: Record<string, string>): string {
    const legacy = join(root, name)
    mkdirSync(legacy, { recursive: true })
    for (const [file, content] of Object.entries(files)) {
      writeFileSync(join(legacy, file), content)
    }
    return legacy
  }

  it('moves a legacy directory onto a userData dir that does not exist yet', () => {
    const legacy = seedLegacy('hive-desktop', { 'config.json': '{"userName":"Gustavo"}' })

    const result = migrateUserData(current)

    expect(result).toEqual({ moved: true, from: legacy, entries: 1 })
    expect(readFileSync(join(current, 'config.json'), 'utf-8')).toBe('{"userName":"Gustavo"}')
    expect(existsSync(legacy)).toBe(false)
  })

  it('migrates onto a directory Chromium already littered, since that is still a fresh install', () => {
    seedLegacy('hive-desktop', { 'config.json': '{}', 'chat-history.json': '[]' })
    mkdirSync(join(current, 'Cache'), { recursive: true })
    writeFileSync(join(current, 'Cookies'), '')

    const result = migrateUserData(current)

    expect(result).toMatchObject({ moved: true, entries: 2 })
    expect(existsSync(join(current, 'config.json'))).toBe(true)
    // The litter it migrated over is untouched.
    expect(existsSync(join(current, 'Cache'))).toBe(true)
  })

  it('refuses to migrate onto a userData dir that already holds real data', () => {
    seedLegacy('hive-desktop', { 'config.json': '{"userName":"antigo"}' })
    mkdirSync(current, { recursive: true })
    writeFileSync(join(current, 'config.json'), '{"userName":"atual"}')

    expect(migrateUserData(current)).toEqual({ moved: false, reason: 'already-populated' })
    expect(readFileSync(join(current, 'config.json'), 'utf-8')).toBe('{"userName":"atual"}')
  })

  it('never overwrites a file already at the target', () => {
    seedLegacy('hive-desktop', { 'config.json': '{"antigo":true}', Cookies: 'velho' })
    mkdirSync(current, { recursive: true })
    // Chromium wrote this in the current run; the legacy copy is staler.
    writeFileSync(join(current, 'Cookies'), 'novo')

    migrateUserData(current)

    expect(readFileSync(join(current, 'Cookies'), 'utf-8')).toBe('novo')
    expect(readFileSync(join(current, 'config.json'), 'utf-8')).toBe('{"antigo":true}')
  })

  it('is a no-op when there is nothing to migrate', () => {
    expect(migrateUserData(current)).toEqual({ moved: false, reason: 'no-legacy' })
    expect(existsSync(current)).toBe(false)
  })

  it('recognises every legacy name the product has shipped under', () => {
    for (const name of LEGACY_USER_DATA_NAMES) {
      const scoped = mkdtempSync(join(tmpdir(), 'hive-userdata-'))
      const target = join(scoped, 'Hive')
      mkdirSync(join(scoped, name), { recursive: true })
      writeFileSync(join(scoped, name, 'config.json'), '{}')

      expect(migrateUserData(target)).toMatchObject({ moved: true })
      expect(existsSync(join(target, 'config.json'))).toBe(true)
      rmSync(scoped, { recursive: true, force: true })
    }
  })

  it('leaves the legacy directory in place when something in it could not move', () => {
    const legacy = seedLegacy('hive-desktop', { 'config.json': '{}', 'lock.txt': 'x' })
    mkdirSync(current, { recursive: true })
    writeFileSync(join(current, 'lock.txt'), 'held')

    const result = migrateUserData(current, { ignore: ['lock.txt'] })

    expect(result).toMatchObject({ moved: true })
    expect(existsSync(legacy)).toBe(true)
    expect(readFileSync(join(legacy, 'lock.txt'), 'utf-8')).toBe('x')
  })
})
