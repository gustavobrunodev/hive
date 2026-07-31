import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'fs'
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

  /**
   * P0-007 (test-design-qa.md, risk R-08 — DATA, score 6). The vault is
   * git-versioned and shared with the squad, so a corrupted note is not a
   * local inconvenience — it propagates on the next push.
   *
   * "Atomic" here is achieved structurally rather than by a temp-file rename:
   * every stage targets a FRESH generated filename, so a failed or partial
   * write can only ever damage the file being written, never an existing note.
   * These tests pin that property, which is the thing that must not regress if
   * the naming scheme is ever changed.
   */
  describe('write safety (P0-007, R-08)', () => {
    it('never overwrites an existing note, even for identical content in the same second', () => {
      const vault = createSecondBrainVault({
        now: () => new Date(2026, 6, 25, 15, 30, 12),
        rand: (() => {
          let n = 0
          return () => `r${n++}`
        })()
      })

      const first = vault.stageRaw(ws, 'the same text')
      const second = vault.stageRaw(ws, 'the same text')

      expect(second.absPath).not.toBe(first.absPath)
      expect(readFileSync(first.absPath, 'utf-8')).toBe('the same text')
      expect(readFileSync(second.absPath, 'utf-8')).toBe('the same text')
      expect(vault.countRawPending(ws)).toBe(2)
    })

    it('a failed stage leaves every previously staged note untouched', () => {
      let n = 0
      const vault = createSecondBrainVault({
        now: () => new Date(2026, 6, 25, 15, 30, 12),
        rand: () => `s${n++}`
      })
      const kept = vault.stageRaw(ws, 'must survive')

      // Make the inbox unwritable, so the next write fails at the fs layer —
      // the shape of a disk-full or permissions failure mid-session.
      const rawDir = join(ws, 'second-brain', 'raw')
      chmodSync(rawDir, 0o500)
      try {
        expect(() => vault.stageRaw(ws, 'this one cannot land')).toThrow()
      } finally {
        chmodSync(rawDir, 0o700)
      }

      // The earlier note is byte-identical, and no half-written file appeared.
      expect(readFileSync(kept.absPath, 'utf-8')).toBe('must survive')
      expect(vault.countRawPending(ws)).toBe(1)
    })

    it('refuses to stage content that is only whitespace, before touching the disk', () => {
      // A no-op ingestion that still created a file would put an empty note in
      // front of the whole squad on the next sync.
      const vault = createSecondBrainVault()
      expect(() => vault.stageRaw(ws, '   \n\t  ')).toThrow(/empty content/)
      expect(existsSync(join(ws, 'second-brain'))).toBe(false)
      expect(vault.countRawPending(ws)).toBe(0)
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
