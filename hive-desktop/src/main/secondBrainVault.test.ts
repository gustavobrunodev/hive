import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync, existsSync, readFileSync, mkdirSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { createSecondBrainVault } from './secondBrainVault'

describe('SecondBrainVault', () => {
  let ws: string

  beforeEach(() => {
    ws = mkdtempSync(join(tmpdir(), 'hive-sb-vault-'))
  })

  afterEach(() => {
    rmSync(ws, { recursive: true, force: true })
  })

  describe('stageRaw()', () => {
    it('writes a timestamped raw/*.md and returns the workspace-relative path', () => {
      const vault = createSecondBrainVault({
        now: () => new Date(2026, 6, 25, 15, 30, 12),
        rand: () => 'abc123'
      })

      const { relPath, absPath } = vault.stageRaw(ws, 'my knowledge')

      expect(relPath).toBe(join('second-brain', 'raw', 'ingest-20260725-153012-abc123.md'))
      expect(existsSync(absPath)).toBe(true)
      expect(readFileSync(absPath, 'utf-8')).toBe('my knowledge')
    })

    it('does not collide when two files are staged in the same second (random suffix)', () => {
      let n = 0
      const vault = createSecondBrainVault({
        now: () => new Date(2026, 6, 25, 15, 30, 12),
        rand: () => `r${n++}`
      })

      const a = vault.stageRaw(ws, 'one')
      const b = vault.stageRaw(ws, 'two')

      expect(a.relPath).not.toBe(b.relPath)
      expect(readFileSync(a.absPath, 'utf-8')).toBe('one')
      expect(readFileSync(b.absPath, 'utf-8')).toBe('two')
    })

    it('refuses empty / whitespace-only content', () => {
      const vault = createSecondBrainVault()
      expect(() => vault.stageRaw(ws, '')).toThrow(/empty/)
      expect(() => vault.stageRaw(ws, '   \n\t ')).toThrow(/empty/)
    })

    it('uses real defaults (a Date + random suffix) when none are injected', () => {
      const vault = createSecondBrainVault()
      const { relPath, absPath } = vault.stageRaw(ws, 'x')
      expect(relPath).toMatch(/^second-brain[\\/]raw[\\/]ingest-\d{8}-\d{6}-[a-z0-9]+\.md$/)
      expect(existsSync(absPath)).toBe(true)
    })
  })

  describe('countRawPending()', () => {
    it('is 0 when the vault / raw dir does not exist', () => {
      const vault = createSecondBrainVault()
      expect(vault.countRawPending(ws)).toBe(0)
    })

    it('counts only files in raw/, ignoring subdirectories', () => {
      const rawDir = join(ws, 'second-brain', 'raw')
      mkdirSync(rawDir, { recursive: true })
      writeFileSync(join(rawDir, 'a.md'), 'a')
      writeFileSync(join(rawDir, 'b.md'), 'b')
      mkdirSync(join(rawDir, 'nested'))

      expect(createSecondBrainVault().countRawPending(ws)).toBe(2)
    })

    it('returns 0 when raw/ exists but is not a directory', () => {
      mkdirSync(join(ws, 'second-brain'), { recursive: true })
      writeFileSync(join(ws, 'second-brain', 'raw'), 'not a dir')
      expect(createSecondBrainVault().countRawPending(ws)).toBe(0)
    })

    it('reflects a freshly staged file', () => {
      const vault = createSecondBrainVault()
      expect(vault.countRawPending(ws)).toBe(0)
      vault.stageRaw(ws, 'hello')
      expect(vault.countRawPending(ws)).toBe(1)
    })
  })
})
