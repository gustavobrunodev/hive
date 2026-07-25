import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { createProcessRunner } from './processRunner'
import {
  createCheckpointService,
  purgeCheckpointStore,
  type CheckpointService
} from './checkpointService'

/**
 * `CheckpointService` drives the **real** system `git` against a throwaway
 * workspace + throwaway `userData` (the M10 `gitService`/`bmadCli.e2e`
 * precedent — real git in temp dirs is fast and deterministic, so it runs in
 * the default suite). Each case gets a fresh workspace + store so nothing
 * leaks between tests. design.md §9, ACR-R1.1/R1.2/R1.6/R3.1.
 */

let ws: string
let userData: string
let svc: CheckpointService

function write(rel: string, content: string): void {
  const abs = join(ws, rel)
  mkdirSync(join(abs, '..'), { recursive: true })
  writeFileSync(abs, content)
}

function read(rel: string): string {
  return readFileSync(join(ws, rel), 'utf-8')
}

beforeEach(() => {
  ws = mkdtempSync(join(tmpdir(), 'hive-cp-ws-'))
  userData = mkdtempSync(join(tmpdir(), 'hive-cp-ud-'))
  svc = createCheckpointService({ processRunner: createProcessRunner(), userDataDir: userData })
})

afterEach(() => {
  rmSync(ws, { recursive: true, force: true })
  rmSync(userData, { recursive: true, force: true })
})

describe('snapshot', () => {
  it('lazily inits a private store under userData (not in the workspace)', async () => {
    write('a.txt', 'hello\n')
    const oid = await svc.snapshot(ws)

    expect(oid).toMatch(/^[0-9a-f]{40}$/)
    // The shadow store lives under userData/checkpoints/<hash>, and the
    // workspace never gets a .git of its own.
    expect(existsSync(join(userData, 'checkpoints'))).toBe(true)
    expect(existsSync(join(ws, '.git'))).toBe(false)
  })

  it('is incremental — re-snapshotting an unchanged tree returns the same tree OID', async () => {
    write('a.txt', 'hello\n')
    const first = await svc.snapshot(ws)
    const second = await svc.snapshot(ws)
    expect(second).toBe(first)
  })

  it('honors the heavy-dir excludes (node_modules is not snapshotted)', async () => {
    write('src/keep.ts', 'export const x = 1\n')
    write('node_modules/pkg/index.js', 'module.exports = {}\n')
    const ref = await svc.snapshot(ws)

    // node_modules is excluded, so it never appears in a diff even after change.
    write('node_modules/pkg/index.js', 'module.exports = { changed: true }\n')
    write('src/keep.ts', 'export const x = 2\n')
    const changes = await svc.diffToWorkTree(ws, ref)
    expect(changes.map((c) => c.path)).toEqual(['src/keep.ts'])
  })

  it('honors the workspace .gitignore automatically', async () => {
    write('.gitignore', 'secret.txt\n')
    write('secret.txt', 'shhh\n')
    write('public.txt', 'hi\n')
    const ref = await svc.snapshot(ws)

    write('secret.txt', 'changed secret\n')
    write('public.txt', 'changed public\n')
    const changes = await svc.diffToWorkTree(ws, ref)
    expect(changes.map((c) => c.path).sort()).toEqual(['public.txt'])
  })
})

describe('diffToWorkTree', () => {
  it('detects created / modified / deleted paths with their diffs', async () => {
    write('mod.txt', 'one\ntwo\nthree\n')
    write('del.txt', 'bye\n')
    const ref = await svc.snapshot(ws)

    write('mod.txt', 'one\nTWO\nthree\n')
    write('new.txt', 'fresh\n')
    rmSync(join(ws, 'del.txt'))

    const changes = await svc.diffToWorkTree(ws, ref)
    const byPath = Object.fromEntries(changes.map((c) => [c.path, c]))

    expect(byPath['new.txt'].status).toBe('created')
    expect(byPath['mod.txt'].status).toBe('modified')
    expect(byPath['del.txt'].status).toBe('deleted')
    // The modified file's diff carries the +/- lines.
    const modLines = byPath['mod.txt'].diff.hunks.flatMap((h) => h.lines)
    expect(modLines.some((l) => l.type === 'add' && l.text === 'TWO')).toBe(true)
    expect(modLines.some((l) => l.type === 'del' && l.text === 'two')).toBe(true)
  })

  it('returns an empty set when nothing changed', async () => {
    write('a.txt', 'stable\n')
    const ref = await svc.snapshot(ws)
    expect(await svc.diffToWorkTree(ws, ref)).toEqual([])
  })

  it('marks an oversized diff tooLarge rather than shipping it', async () => {
    write('big.txt', 'seed\n')
    const ref = await svc.snapshot(ws)
    // A created file whose added content exceeds the 2MB cap.
    write('big.txt', 'x\n'.repeat(1_100_000))
    const changes = await svc.diffToWorkTree(ws, ref)
    const big = changes.find((c) => c.path === 'big.txt')!
    expect(big.diff.tooLarge).toBe(true)
    expect(big.diff.hunks).toEqual([])
  })

  it('throws a CheckpointError on an invalid baseline ref', async () => {
    write('a.txt', 'x\n')
    await svc.snapshot(ws)
    const err = await svc.diffToWorkTree(ws, 'deadbeefdeadbeef').catch((e) => e)
    expect(err.name).toBe('CheckpointError')
    expect(err.command).toContain('git diff')
  })
})

describe('fileAtRef', () => {
  it('returns pre-turn bytes for an existing path and null for a created one', async () => {
    write('exists.txt', 'pre-turn content\n')
    const ref = await svc.snapshot(ws)

    write('exists.txt', 'agent overwrote this\n')
    write('created.txt', 'agent made this\n')

    expect(await svc.fileAtRef(ws, ref, 'exists.txt')).toBe('pre-turn content\n')
    expect(await svc.fileAtRef(ws, ref, 'created.txt')).toBeNull()
  })
})

describe('revertPath', () => {
  it('restores modified bytes on disk', async () => {
    write('f.txt', 'original\n')
    const ref = await svc.snapshot(ws)
    write('f.txt', 'agent changed it\n')

    await svc.revertPath(ws, ref, 'f.txt')
    expect(read('f.txt')).toBe('original\n')
  })

  it('deletes a created file (it never existed pre-turn)', async () => {
    write('base.txt', 'x\n')
    const ref = await svc.snapshot(ws)
    write('created.txt', 'agent made this\n')

    await svc.revertPath(ws, ref, 'created.txt')
    expect(existsSync(join(ws, 'created.txt'))).toBe(false)
  })

  it('restores a deleted file', async () => {
    write('gone.txt', 'bring me back\n')
    const ref = await svc.snapshot(ws)
    rmSync(join(ws, 'gone.txt'))

    await svc.revertPath(ws, ref, 'gone.txt')
    expect(read('gone.txt')).toBe('bring me back\n')
  })

  it('tolerates reverting a created file that is already gone', async () => {
    write('base.txt', 'x\n')
    const ref = await svc.snapshot(ws)
    write('created.txt', 'agent made this\n')
    rmSync(join(ws, 'created.txt')) // already deleted before the revert

    await expect(svc.revertPath(ws, ref, 'created.txt')).resolves.toBeUndefined()
    expect(existsSync(join(ws, 'created.txt'))).toBe(false)
  })
})

describe('applyReverseHunk (over the GitDiffHunk patch builder, T4)', () => {
  it('rejects one hunk, restoring its bytes and leaving the file clean', async () => {
    write('f.txt', 'line1\nline2\nline3\n')
    const ref = await svc.snapshot(ws)
    write('f.txt', 'line1\nCHANGED\nline3\n')

    // The single-hunk diff of the change we want to reject.
    const [change] = await svc.diffToWorkTree(ws, ref)
    await svc.applyReverseHunk(ws, 'f.txt', change.diff.hunks[0])

    expect(read('f.txt')).toBe('line1\nline2\nline3\n')
    expect(await svc.diffToWorkTree(ws, ref)).toEqual([])
  })

  it('rejects one hunk of a two-hunk file, leaving the other hunk intact', async () => {
    // 12 lines so the two edited regions (line 1, line 12) are far enough
    // apart that git's default 3-line context keeps them as separate hunks.
    const base = Array.from({ length: 12 }, (_, i) => `l${i + 1}`)
    write('f.txt', base.join('\n') + '\n')
    const ref = await svc.snapshot(ws)
    const edited = [...base]
    edited[0] = 'L1_NEW'
    edited[11] = 'L12_NEW'
    write('f.txt', edited.join('\n') + '\n')

    const [change] = await svc.diffToWorkTree(ws, ref)
    expect(change.diff.hunks).toHaveLength(2)
    // Reject only the second hunk (line 12).
    await svc.applyReverseHunk(ws, 'f.txt', change.diff.hunks[1])

    // The first hunk's change (L1_NEW) stays; the second is reverted to l12.
    const expected = [...base]
    expected[0] = 'L1_NEW'
    expect(read('f.txt')).toBe(expected.join('\n') + '\n')
  })
})

describe('purgeCheckpointStore (test helper)', () => {
  it('removes a workspace store', async () => {
    write('a.txt', 'x\n')
    await svc.snapshot(ws)
    purgeCheckpointStore(userData, ws)
    // A fresh snapshot re-inits cleanly.
    expect(await svc.snapshot(ws)).toMatch(/^[0-9a-f]{40}$/)
  })
})
