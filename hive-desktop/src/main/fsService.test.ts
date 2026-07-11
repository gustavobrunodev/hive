import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  utimesSync,
  writeFileSync
} from 'fs'
import { tmpdir } from 'os'
import { basename, join } from 'path'
import { ConflictError, createFsService, type FsChangeEvent, type FsService } from './fsService'

// Real temp directories (no mocking), same approach as configStore.test.ts /
// workspaceService.test.ts — `fs` operations against a real temp dir are the
// simplest and most trustworthy way to exercise a filesystem-scoped service.
describe('FsService', () => {
  let root: string
  let service: FsService

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'hive-fs-service-'))
    service = createFsService()

    // Fixture tree:
    //   root/
    //     a.txt
    //     docs/
    //       prd.md
    //       nested/
    //         notes.txt
    writeFileSync(join(root, 'a.txt'), 'hello a')
    mkdirSync(join(root, 'docs'))
    writeFileSync(join(root, 'docs', 'prd.md'), '# PRD')
    mkdirSync(join(root, 'docs', 'nested'))
    writeFileSync(join(root, 'docs', 'nested', 'notes.txt'), 'nested notes')
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  describe('listTree()', () => {
    it('returns the fixture tree structure, sorted, with nested directories expanded', () => {
      const tree = service.listTree(root)

      expect(tree).toEqual([
        { name: 'a.txt', path: 'a.txt', type: 'file' },
        {
          name: 'docs',
          path: 'docs',
          type: 'directory',
          children: [
            {
              name: 'nested',
              path: 'docs/nested',
              type: 'directory',
              children: [{ name: 'notes.txt', path: 'docs/nested/notes.txt', type: 'file' }]
            },
            { name: 'prd.md', path: 'docs/prd.md', type: 'file' }
          ]
        }
      ])
    })

    it('can list a subdirectory via relativePath', () => {
      const tree = service.listTree(root, 'docs')
      expect(tree.map((n) => n.name)).toEqual(['nested', 'prd.md'])
    })

    it('rejects a relativePath that escapes the workspace root via ../ traversal', () => {
      expect(() => service.listTree(root, '../../../etc')).toThrow(/escapes workspace root/)
    })

    it('rejects a relativePath that is an absolute path elsewhere', () => {
      expect(() => service.listTree(root, '/etc')).toThrow(/escapes workspace root/)
    })
  })

  describe('readFile()', () => {
    it('returns the file contents as text', () => {
      expect(service.readFile(root, 'docs/prd.md')).toBe('# PRD')
      expect(service.readFile(root, 'a.txt')).toBe('hello a')
    })

    it('rejects a relativePath containing ../ traversal that escapes the workspace root', () => {
      expect(() => service.readFile(root, '../../../etc/passwd')).toThrow(/escapes workspace root/)
    })

    it('rejects an absolute relativePath pointing outside the workspace root', () => {
      expect(() => service.readFile(root, '/etc/passwd')).toThrow(/escapes workspace root/)
    })

    it('rejects a sibling directory that merely shares the root as a string prefix (the /workspace-evil trap)', () => {
      // Regression guard for the classic startsWith('/workspace') bug: a
      // sibling directory name that textually starts with `root` must still
      // be rejected, proving the check is a real path-containment test and
      // not a naive string prefix comparison.
      const evilSibling = `${root}-evil`
      mkdirSync(evilSibling, { recursive: true })
      writeFileSync(join(evilSibling, 'secret.txt'), 'nope')
      try {
        const relativeToEvil = join('..', `${basename(root)}-evil`, 'secret.txt')
        expect(() => service.readFile(root, relativeToEvil)).toThrow(/escapes workspace root/)
      } finally {
        rmSync(evilSibling, { recursive: true, force: true })
      }
    })

    it('rejects a path that resolves to a directory instead of a file', () => {
      expect(() => service.readFile(root, 'docs')).toThrow(/Not a file/)
    })
  })

  describe('watchWorkspace()', () => {
    it('fires onChange when a new file is added to the watched root', async () => {
      const events: FsChangeEvent[] = []
      const stop = service.watchWorkspace(root, (event) => events.push(event))

      try {
        // fs.watch is inherently async; poll with a timeout rather than a
        // fixed sleep.
        writeFileSync(join(root, 'new-file.txt'), 'brand new')

        await waitFor(() => events.some((e) => e.path.includes('new-file.txt')), 5000)

        const match = events.find((e) => e.path.includes('new-file.txt'))
        expect(match).toBeDefined()
        expect(match?.type).toBe('add')
      } finally {
        stop()
      }
    }, 10000)

    it('the returned stop function can be called without hanging or leaking an open handle', async () => {
      const events: FsChangeEvent[] = []
      const stop = service.watchWorkspace(root, (event) => events.push(event))

      // Prove the watcher is live before stopping it.
      writeFileSync(join(root, 'before-stop.txt'), 'x')
      await waitFor(() => events.length > 0, 5000)

      stop()

      // Calling stop() again must not throw (idempotent close).
      expect(() => stop()).not.toThrow()

      const countAfterStop = events.length
      writeFileSync(join(root, 'after-stop.txt'), 'y')
      // Give any (incorrectly) still-active watcher a chance to fire, then
      // confirm it didn't.
      await new Promise((resolve) => setTimeout(resolve, 300))
      expect(events.length).toBe(countAfterStop)
    }, 10000)
  })

  describe('statFile()', () => {
    it('returns mtimeMs and size for an existing file', () => {
      const meta = service.statFile(root, 'a.txt')
      expect(meta.size).toBe('hello a'.length)
      expect(typeof meta.mtimeMs).toBe('number')
      expect(meta.mtimeMs).toBeGreaterThan(0)
    })

    it('rejects a relativePath that escapes the workspace root', () => {
      expect(() => service.statFile(root, '../../../etc/passwd')).toThrow(/escapes workspace root/)
    })

    it('rejects a path that resolves to a directory instead of a file', () => {
      expect(() => service.statFile(root, 'docs')).toThrow(/Not a file/)
    })
  })

  describe('saveFile()', () => {
    it('saves without a baseline (unconditional overwrite) and returns fresh EntryMeta', () => {
      const meta = service.saveFile(root, 'a.txt', 'new content')
      expect(readFileSync(join(root, 'a.txt'), 'utf-8')).toBe('new content')
      expect(meta.size).toBe('new content'.length)
      expect(typeof meta.mtimeMs).toBe('number')
    })

    it('saves when expectedMtimeMs matches the current on-disk mtime (happy path)', () => {
      const baseline = service.statFile(root, 'a.txt')
      const meta = service.saveFile(root, 'a.txt', 'updated', {
        expectedMtimeMs: baseline.mtimeMs
      })
      expect(readFileSync(join(root, 'a.txt'), 'utf-8')).toBe('updated')
      expect(meta.size).toBe('updated'.length)
    })

    it('throws ConflictError{code:STALE} when the on-disk file was mutated out-of-band since the baseline', () => {
      const baseline = service.statFile(root, 'a.txt')

      // Mutate out-of-band so the on-disk mtime no longer matches the
      // baseline captured above — bump the mtime explicitly rather than
      // relying on wall-clock drift between two writes in the same tick.
      const bumpedMtime = new Date(baseline.mtimeMs + 5000)
      writeFileSync(join(root, 'a.txt'), 'changed by someone else')
      utimesSync(join(root, 'a.txt'), bumpedMtime, bumpedMtime)

      try {
        service.saveFile(root, 'a.txt', 'my overwrite', { expectedMtimeMs: baseline.mtimeMs })
        expect.unreachable()
      } catch (err) {
        expect(err).toBeInstanceOf(ConflictError)
        expect((err as ConflictError).code).toBe('STALE')
      }
      // the out-of-band write must survive untouched
      expect(readFileSync(join(root, 'a.txt'), 'utf-8')).toBe('changed by someone else')
    })

    it('rejects a relativePath that escapes the workspace root', () => {
      expect(() => service.saveFile(root, '../../../etc/passwd', 'x')).toThrow(
        /escapes workspace root/
      )
    })
  })

  describe('createFile()', () => {
    it('creates an empty file at the workspace root', () => {
      service.createFile(root, 'new.txt')
      expect(existsSync(join(root, 'new.txt'))).toBe(true)
      expect(readFileSync(join(root, 'new.txt'), 'utf-8')).toBe('')
    })

    it('creates an empty file inside an existing subdirectory', () => {
      service.createFile(root, 'docs/new.md')
      expect(existsSync(join(root, 'docs', 'new.md'))).toBe(true)
    })

    it('throws a ConflictError when the target already exists and overwrite is not set', () => {
      expect(() => service.createFile(root, 'a.txt')).toThrow(ConflictError)
      try {
        service.createFile(root, 'a.txt')
        expect.unreachable()
      } catch (err) {
        expect(err).toBeInstanceOf(ConflictError)
        expect((err as ConflictError).code).toBe('CONFLICT')
      }
      // original contents untouched
      expect(readFileSync(join(root, 'a.txt'), 'utf-8')).toBe('hello a')
    })

    it('overwrites the existing file when overwrite is true', () => {
      service.createFile(root, 'a.txt', { overwrite: true })
      expect(readFileSync(join(root, 'a.txt'), 'utf-8')).toBe('')
    })

    it('rejects an empty name', () => {
      expect(() => service.createFile(root, '')).toThrow(/Invalid name/)
    })

    it("rejects a name that is exactly '.'", () => {
      expect(() => service.createFile(root, '.')).toThrow(/Invalid name/)
    })

    it("rejects a name that is exactly '..'", () => {
      expect(() => service.createFile(root, '..')).toThrow(/Invalid name/)
    })

    it('rejects a relativePath that escapes the workspace root', () => {
      expect(() => service.createFile(root, '../escape.txt')).toThrow(/escapes workspace root/)
    })
  })

  describe('createDirectory()', () => {
    it('creates a new directory at the workspace root', () => {
      service.createDirectory(root, 'new-dir')
      expect(existsSync(join(root, 'new-dir'))).toBe(true)
    })

    it('creates nested directories recursively', () => {
      service.createDirectory(root, 'a/b/c')
      expect(existsSync(join(root, 'a', 'b', 'c'))).toBe(true)
    })

    it('is a no-op (does not throw) when the directory already exists', () => {
      expect(() => service.createDirectory(root, 'docs')).not.toThrow()
    })

    it('rejects an invalid name', () => {
      expect(() => service.createDirectory(root, '')).toThrow(/Invalid name/)
      expect(() => service.createDirectory(root, '..')).toThrow(/Invalid name/)
    })

    it('rejects a relativePath that escapes the workspace root', () => {
      expect(() => service.createDirectory(root, '../evil-dir')).toThrow(/escapes workspace root/)
    })
  })

  describe('move()', () => {
    it('renames a file within the same directory', () => {
      service.move(root, 'a.txt', 'renamed.txt')
      expect(existsSync(join(root, 'a.txt'))).toBe(false)
      expect(readFileSync(join(root, 'renamed.txt'), 'utf-8')).toBe('hello a')
    })

    it('moves a file into a different directory', () => {
      service.move(root, 'a.txt', 'docs/a.txt')
      expect(existsSync(join(root, 'a.txt'))).toBe(false)
      expect(readFileSync(join(root, 'docs', 'a.txt'), 'utf-8')).toBe('hello a')
    })

    it('moves a directory (recursively) into another directory', () => {
      service.move(root, 'docs', 'moved-docs')
      expect(existsSync(join(root, 'docs'))).toBe(false)
      expect(readFileSync(join(root, 'moved-docs', 'prd.md'), 'utf-8')).toBe('# PRD')
      expect(readFileSync(join(root, 'moved-docs', 'nested', 'notes.txt'), 'utf-8')).toBe(
        'nested notes'
      )
    })

    it('throws a ConflictError when the destination already exists and overwrite is not set', () => {
      try {
        service.move(root, 'a.txt', 'docs/prd.md')
        expect.unreachable()
      } catch (err) {
        expect(err).toBeInstanceOf(ConflictError)
        expect((err as ConflictError).code).toBe('CONFLICT')
      }
      // neither side was touched
      expect(existsSync(join(root, 'a.txt'))).toBe(true)
      expect(readFileSync(join(root, 'docs', 'prd.md'), 'utf-8')).toBe('# PRD')
    })

    it('overwrites the destination when overwrite is true', () => {
      service.move(root, 'a.txt', 'docs/prd.md', { overwrite: true })
      expect(existsSync(join(root, 'a.txt'))).toBe(false)
      expect(readFileSync(join(root, 'docs', 'prd.md'), 'utf-8')).toBe('hello a')
    })

    it('falls back to copy+remove when renameSync fails with EXDEV (cross-device move)', async () => {
      // A real cross-device move needs two separate filesystems/mounts, which
      // isn't available in a test temp dir — so the EXDEV branch is exercised
      // by mocking node:fs's renameSync to throw an EXDEV error and asserting
      // the fallback (cpSync + rmSync) still produces a correct move. node:fs
      // exports are non-configurable (spyOn can't redefine them), so this
      // uses vi.doMock + a fresh module instance instead of vi.spyOn.
      vi.resetModules()
      const exdev = Object.assign(new Error('cross-device link'), { code: 'EXDEV' })
      vi.doMock('fs', async (importOriginal) => {
        const actual = await importOriginal<typeof import('fs')>()
        return {
          ...actual,
          renameSync: vi.fn(() => {
            throw exdev
          })
        }
      })

      try {
        const { createFsService: createMockedFsService } = await import('./fsService')
        const mockedService = createMockedFsService()
        mockedService.move(root, 'a.txt', 'renamed.txt')
        expect(existsSync(join(root, 'a.txt'))).toBe(false)
        expect(readFileSync(join(root, 'renamed.txt'), 'utf-8')).toBe('hello a')
      } finally {
        vi.doUnmock('fs')
        vi.resetModules()
      }
    })

    it('propagates a non-EXDEV renameSync error unchanged', async () => {
      vi.resetModules()
      const boom = Object.assign(new Error('boom'), { code: 'EACCES' })
      vi.doMock('fs', async (importOriginal) => {
        const actual = await importOriginal<typeof import('fs')>()
        return {
          ...actual,
          renameSync: vi.fn(() => {
            throw boom
          })
        }
      })

      try {
        const { createFsService: createMockedFsService } = await import('./fsService')
        const mockedService = createMockedFsService()
        expect(() => mockedService.move(root, 'a.txt', 'renamed.txt')).toThrow('boom')
      } finally {
        vi.doUnmock('fs')
        vi.resetModules()
      }
    })

    it('rejects an invalid destination name', () => {
      expect(() => service.move(root, 'a.txt', '..')).toThrow(/Invalid name/)
    })

    it('rejects a source path that escapes the workspace root', () => {
      expect(() => service.move(root, '../../../etc/passwd', 'stolen.txt')).toThrow(
        /escapes workspace root/
      )
    })

    it('rejects a destination path that escapes the workspace root', () => {
      expect(() => service.move(root, 'a.txt', '../escaped.txt')).toThrow(/escapes workspace root/)
    })
  })

  describe('exists()', () => {
    it('returns true for an existing file and directory', () => {
      expect(service.exists(root, 'a.txt')).toBe(true)
      expect(service.exists(root, 'docs')).toBe(true)
    })

    it('returns false for a path that does not exist', () => {
      expect(service.exists(root, 'nope.txt')).toBe(false)
    })

    it('rejects a relativePath that escapes the workspace root', () => {
      expect(() => service.exists(root, '../../../etc/passwd')).toThrow(/escapes workspace root/)
    })
  })

  describe('importEntry()', () => {
    let sourceRoot: string

    beforeEach(() => {
      sourceRoot = mkdtempSync(join(tmpdir(), 'hive-fs-service-import-source-'))
    })

    afterEach(() => {
      rmSync(sourceRoot, { recursive: true, force: true })
    })

    it('imports a single file from an arbitrary OS path into the workspace', () => {
      const sourceFile = join(sourceRoot, 'imported.txt')
      writeFileSync(sourceFile, 'imported content')

      service.importEntry(root, sourceFile, 'imported.txt')

      expect(readFileSync(join(root, 'imported.txt'), 'utf-8')).toBe('imported content')
    })

    it('imports a nested folder recursively', () => {
      mkdirSync(join(sourceRoot, 'sub'))
      writeFileSync(join(sourceRoot, 'top.txt'), 'top')
      writeFileSync(join(sourceRoot, 'sub', 'inner.txt'), 'inner')

      service.importEntry(root, sourceRoot, 'imported-dir')

      expect(readFileSync(join(root, 'imported-dir', 'top.txt'), 'utf-8')).toBe('top')
      expect(readFileSync(join(root, 'imported-dir', 'sub', 'inner.txt'), 'utf-8')).toBe('inner')
    })

    it('throws a ConflictError when the destination already exists and overwrite is not set', () => {
      const sourceFile = join(sourceRoot, 'clash.txt')
      writeFileSync(sourceFile, 'new stuff')

      try {
        service.importEntry(root, sourceFile, 'a.txt')
        expect.unreachable()
      } catch (err) {
        expect(err).toBeInstanceOf(ConflictError)
        expect((err as ConflictError).code).toBe('CONFLICT')
      }
      // original destination content untouched
      expect(readFileSync(join(root, 'a.txt'), 'utf-8')).toBe('hello a')
    })

    it('overwrites the destination when overwrite is true', () => {
      const sourceFile = join(sourceRoot, 'clash.txt')
      writeFileSync(sourceFile, 'new stuff')

      service.importEntry(root, sourceFile, 'a.txt', { overwrite: true })

      expect(readFileSync(join(root, 'a.txt'), 'utf-8')).toBe('new stuff')
    })

    it('rejects a destRel that escapes the workspace root, while an arbitrary sourceAbs outside any workspace still works otherwise', () => {
      const sourceFile = join(sourceRoot, 'escape-attempt.txt')
      writeFileSync(sourceFile, 'x')

      // The dest-escape check throws regardless of how far outside the
      // workspace sourceAbs itself lives (sourceRoot here is a sibling temp
      // dir, not under root) — proving the asymmetry: sourceAbs is never
      // resolveSafe-checked, only destRel is.
      expect(() => service.importEntry(root, sourceFile, '../../../etc/escaped.txt')).toThrow(
        /escapes workspace root/
      )
      expect(existsSync(join(root, '..', '..', '..', 'etc', 'escaped.txt'))).toBe(false)

      // And to prove the asymmetry positively (not just that escaping dest
      // fails): the same arbitrary, out-of-workspace sourceAbs succeeds when
      // given a valid destRel.
      service.importEntry(root, sourceFile, 'escape-attempt.txt')
      expect(readFileSync(join(root, 'escape-attempt.txt'), 'utf-8')).toBe('x')
    })
  })

  describe('trash()', () => {
    it('rejects when no trashItem dependency was injected', async () => {
      await expect(service.trash(root, 'a.txt')).rejects.toThrow(/no trashItem dependency/)
    })

    it('calls the injected trashItem with the resolved absolute path', async () => {
      const trashItem = vi.fn().mockResolvedValue(undefined)
      const trashingService = createFsService({ trashItem })

      await trashingService.trash(root, 'a.txt')

      expect(trashItem).toHaveBeenCalledTimes(1)
      expect(trashItem).toHaveBeenCalledWith(join(root, 'a.txt'))
    })

    it('rejects a relativePath that escapes the workspace root without calling trashItem', async () => {
      const trashItem = vi.fn().mockResolvedValue(undefined)
      const trashingService = createFsService({ trashItem })

      await expect(trashingService.trash(root, '../../../etc/passwd')).rejects.toThrow(
        /escapes workspace root/
      )
      expect(trashItem).not.toHaveBeenCalled()
    })
  })
})

// A separate top-level describe (rather than adding cases inside the
// existing `describe('FsService', ...)` block above) so none of the
// pre-existing `listTree()`/`watchWorkspace()` test cases are touched, per
// T3's scope — these only exercise pre-existing branches (symlink handling,
// the recursive-watch-unsupported fallback) that the file-level 90% branch
// coverage gate (T1) requires but that had no dedicated tests yet.
describe('FsService — pre-existing branch coverage (symlinks, watch fallback)', () => {
  let root: string
  let service: FsService

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'hive-fs-service-branches-'))
    service = createFsService()
    writeFileSync(join(root, 'real.txt'), 'real content')
    mkdirSync(join(root, 'real-dir'))
    writeFileSync(join(root, 'real-dir', 'inner.txt'), 'inner')
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  describe('listTree() symlink handling', () => {
    it('resolves a symlink to a file within the root as a file node', () => {
      symlinkSync(join(root, 'real.txt'), join(root, 'link-to-file.txt'))
      const tree = service.listTree(root)
      const link = tree.find((n) => n.name === 'link-to-file.txt')
      expect(link).toEqual({ name: 'link-to-file.txt', path: 'link-to-file.txt', type: 'file' })
    })

    it('resolves a symlink to a directory within the root as a directory node with children', () => {
      symlinkSync(join(root, 'real-dir'), join(root, 'link-to-dir'))
      const tree = service.listTree(root)
      const link = tree.find((n) => n.name === 'link-to-dir')
      expect(link?.type).toBe('directory')
      expect(link?.children).toEqual([{ name: 'inner.txt', path: 'link-to-dir/inner.txt', type: 'file' }])
    })

    it('silently excludes a broken symlink (target does not exist)', () => {
      symlinkSync(join(root, 'does-not-exist.txt'), join(root, 'broken-link.txt'))
      const tree = service.listTree(root)
      expect(tree.find((n) => n.name === 'broken-link.txt')).toBeUndefined()
    })

    it('silently excludes a symlink whose target escapes the workspace root', () => {
      const outside = mkdtempSync(join(tmpdir(), 'hive-fs-service-outside-'))
      try {
        writeFileSync(join(outside, 'secret.txt'), 'nope')
        symlinkSync(join(outside, 'secret.txt'), join(root, 'escaping-link.txt'))
        const tree = service.listTree(root)
        expect(tree.find((n) => n.name === 'escaping-link.txt')).toBeUndefined()
      } finally {
        rmSync(outside, { recursive: true, force: true })
      }
    })
  })

  describe('watchWorkspace() recursive-unsupported fallback', () => {
    it('falls back to a non-recursive watcher when fs.watch throws for recursive:true', async () => {
      // fs.watch's `recursive` option isn't supported on every platform; the
      // implementation catches a synchronous throw from the first (recursive)
      // attempt and retries non-recursively. Exercised here the same way the
      // move() EXDEV fallback is: mock node:fs so the first watch() call
      // throws, since this Linux/Node 22 test environment actually supports
      // recursive watching and would never hit that branch otherwise.
      vi.resetModules()
      vi.doMock('fs', async (importOriginal) => {
        const actual = await importOriginal<typeof import('fs')>()
        let calls = 0
        return {
          ...actual,
          watch: vi.fn((...args: Parameters<typeof actual.watch>) => {
            calls += 1
            if (calls === 1) {
              throw new Error('recursive watch not supported on this platform')
            }
            return actual.watch(...args)
          })
        }
      })

      try {
        const { createFsService: createMockedFsService } = await import('./fsService')
        const mockedService = createMockedFsService()
        const events: FsChangeEvent[] = []
        const stop = mockedService.watchWorkspace(root, (event) => events.push(event))
        try {
          writeFileSync(join(root, 'after-fallback.txt'), 'x')
          await waitFor(() => events.some((e) => e.path.includes('after-fallback.txt')), 5000)
          expect(events.some((e) => e.path.includes('after-fallback.txt'))).toBe(true)
        } finally {
          stop()
        }
      } finally {
        vi.doUnmock('fs')
        vi.resetModules()
      }
    }, 10000)
  })
})

/** Polls `predicate` until it returns true or `timeoutMs` elapses. */
async function waitFor(predicate: () => boolean, timeoutMs: number): Promise<void> {
  const start = Date.now()
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error('waitFor: timed out')
    }
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
}
