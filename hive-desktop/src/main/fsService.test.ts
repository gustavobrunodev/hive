import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { basename, join } from 'path'
import { createFsService, type FsChangeEvent, type FsService } from './fsService'

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
