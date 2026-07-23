import { describe, expect, it } from 'vitest'
import {
  parseBranches,
  parseDiff,
  parseLog,
  parseNumstat,
  parseStashList,
  parseStatusV2
} from './gitParse'

/**
 * Fixtures below are captured verbatim from real `git 2.34.1` output (T3,
 * design.md §10) — `\x1f` field separators and `\0` record terminators are
 * written as `\x1f`/`\0` escapes so the exact byte layout is visible. Building
 * them here (rather than committing binary fixture files) keeps the expected
 * format legible next to each assertion.
 */

describe('parseStatusV2', () => {
  it('parses the branch header, ordinary/rename/untracked entries and rename origPath', () => {
    // Real capture: staged delete, staged-add-with-further-unstaged-edit,
    // rename+modify (path NUL origPath), and an untracked file.
    const output =
      '# branch.oid 826f937\0# branch.head main\0' +
      '1 D. N... 100644 000000 000000 2fa992c 0000000 keep.txt\0' +
      '1 AM N... 000000 100644 100644 0000000 d5a09df new.txt\0' +
      '2 RM N... 100644 100644 100644 83db48f 83db48f R100 renamed.txt\0a.txt\0' +
      '? untracked.txt\0'
    const status = parseStatusV2(output)

    expect(status.branch).toBe('main')
    expect(status.detached).toBe(false)
    expect(status.oid).toBe('826f937')
    expect(status.upstream).toBeNull()
    expect(status.ahead).toBe(0)
    expect(status.behind).toBe(0)
    expect(status.changes).toHaveLength(4)

    const [del, add, rename, untracked] = status.changes
    expect(del).toMatchObject({ path: 'keep.txt', index: 'D', worktree: '.' })
    expect(add).toMatchObject({ path: 'new.txt', index: 'A', worktree: 'M' })
    expect(rename).toMatchObject({ path: 'renamed.txt', origPath: 'a.txt', index: 'R', worktree: 'M' })
    expect(untracked).toMatchObject({ path: 'untracked.txt', isUntracked: true })
  })

  it('parses upstream + ahead/behind from the branch.ab header', () => {
    const output =
      '# branch.oid abc1234\0# branch.head main\0# branch.upstream origin/main\0# branch.ab +2 -1\0'
    const status = parseStatusV2(output)
    expect(status.upstream).toBe('origin/main')
    expect(status.ahead).toBe(2)
    expect(status.behind).toBe(1)
  })

  it('flags a detached HEAD and an unborn branch (initial oid)', () => {
    const detached = parseStatusV2('# branch.oid 5324004\0# branch.head (detached)\0')
    expect(detached.detached).toBe(true)
    expect(detached.branch).toBeNull()

    const unborn = parseStatusV2('# branch.oid (initial)\0# branch.head main\0')
    expect(unborn.oid).toBeNull()
  })

  it('parses an unmerged (UU conflict) entry and an ignored entry', () => {
    const output =
      '# branch.head main\0' +
      'u UU N... 100644 100644 100644 100644 df967b9 ba2906d e45c9c2 c.txt\0' +
      '! build/out.js\0'
    const status = parseStatusV2(output)
    const [conflict, ignored] = status.changes
    expect(conflict).toMatchObject({ path: 'c.txt', index: 'U', worktree: 'U', isConflict: true })
    expect(ignored).toMatchObject({ path: 'build/out.js', isIgnored: true })
  })

  it('preserves spaces in paths', () => {
    const status = parseStatusV2('1 .M N... 100644 100644 100644 aaa bbb my notes.md\0')
    expect(status.changes[0].path).toBe('my notes.md')
  })

  it('returns an empty, clean status for empty output', () => {
    const status = parseStatusV2('')
    expect(status.changes).toEqual([])
    expect(status.branch).toBeNull()
  })
})

describe('parseLog', () => {
  it('parses NUL-separated records with x1f fields, tolerating a missing trailing NUL', () => {
    const output =
      'c83ca73full\x1fc83ca73\x1fTester\x1f2026-07-23T13:47:01-03:00\x1fthird\0' +
      '969a11ffull\x1f969a11f\x1fTester\x1f2026-07-23T13:47:01-03:00\x1fsecond commit subject'
    const log = parseLog(output)
    expect(log).toHaveLength(2)
    expect(log[0]).toEqual({
      hash: 'c83ca73full',
      shortHash: 'c83ca73',
      author: 'Tester',
      date: '2026-07-23T13:47:01-03:00',
      subject: 'third'
    })
    expect(log[1].subject).toBe('second commit subject')
  })

  it('returns [] for empty output', () => {
    expect(parseLog('')).toEqual([])
  })
})

describe('parseBranches', () => {
  it('parses local + remote branches, current marker, upstream track and gone', () => {
    const output =
      'refs/heads/main\x1fabc1234\x1forigin/main\x1f[ahead 2]\x1f*\n' +
      'refs/heads/feature/x\x1fdef5678\x1f\x1f\x1f \n' +
      'refs/heads/stale\x1f0000000\x1forigin/stale\x1f[gone]\x1f \n' +
      'refs/remotes/origin/main\x1fabc1234\x1f\x1f\x1f '
    const { branches, current } = parseBranches(output)

    expect(current).toBe('main')
    expect(branches[0]).toMatchObject({
      name: 'main',
      isHead: true,
      upstream: 'origin/main',
      ahead: 2,
      behind: 0,
      isRemote: false
    })
    expect(branches[1]).toMatchObject({ name: 'feature/x', isHead: false, upstream: null })
    expect(branches[2]).toMatchObject({ name: 'stale', gone: true })
    expect(branches[3]).toMatchObject({ name: 'origin/main', isRemote: true })
  })

  it('parses a combined ahead+behind track', () => {
    const { branches } = parseBranches('refs/heads/x\x1fa\x1forigin/x\x1f[ahead 1, behind 3]\x1f*')
    expect(branches[0]).toMatchObject({ ahead: 1, behind: 3, gone: false })
  })

  it('returns no current branch when none is marked', () => {
    const { current } = parseBranches('refs/heads/x\x1fa\x1f\x1f\x1f ')
    expect(current).toBeNull()
  })
})

describe('parseStashList', () => {
  it('parses stash ref index + message', () => {
    const output = 'stash@{0}\x1fWIP on main: abc local2\nstash@{1}\x1fOn main: wip: my stash'
    const stashes = parseStashList(output)
    expect(stashes).toEqual([
      { index: 0, ref: 'stash@{0}', message: 'WIP on main: abc local2' },
      { index: 1, ref: 'stash@{1}', message: 'On main: wip: my stash' }
    ])
  })

  it('returns [] for empty output', () => {
    expect(parseStashList('')).toEqual([])
  })
})

describe('parseNumstat', () => {
  it('parses text, rename and binary records from -z output', () => {
    // Real capture layout: binary `-\t-\tbin.dat`, then a rename with an empty
    // path field followed by orig + new paths.
    const output = '-\t-\tbin.dat\x000\t0\t\0r.txt\0r2.txt\0' + '3\t1\tf.txt\0'
    const entries = parseNumstat(output)
    expect(entries[0]).toEqual({ added: null, deleted: null, path: 'bin.dat', binary: true })
    expect(entries[1]).toEqual({
      added: 0,
      deleted: 0,
      path: 'r2.txt',
      origPath: 'r.txt',
      binary: false
    })
    expect(entries[2]).toEqual({ added: 3, deleted: 1, path: 'f.txt', binary: false })
  })

  it('skips malformed records and returns [] for empty output', () => {
    expect(parseNumstat('')).toEqual([])
    expect(parseNumstat('garbage-no-tabs\0')).toEqual([])
  })
})

describe('parseDiff', () => {
  it('parses a unified diff into hunks with old/new line numbers', () => {
    const output = [
      'diff --git a/f.txt b/f.txt',
      'index 6fe8acc..502fdbb 100644',
      '--- a/f.txt',
      '+++ b/f.txt',
      '@@ -1,5 +1,3 @@',
      ' a',
      '-B',
      '+BB',
      ' c',
      '-d',
      '-e',
      '\\ No newline at end of file'
    ].join('\n')
    const diff = parseDiff(output)

    expect(diff.binary).toBe(false)
    expect(diff.hunks).toHaveLength(1)
    const hunk = diff.hunks[0]
    expect(hunk).toMatchObject({ oldStart: 1, newStart: 1, header: '@@ -1,5 +1,3 @@' })
    expect(hunk.lines).toEqual([
      { type: 'ctx', oldNo: 1, newNo: 1, text: 'a' },
      { type: 'del', oldNo: 2, newNo: null, text: 'B' },
      { type: 'add', oldNo: null, newNo: 2, text: 'BB' },
      { type: 'ctx', oldNo: 3, newNo: 3, text: 'c' },
      { type: 'del', oldNo: 4, newNo: null, text: 'd' },
      { type: 'del', oldNo: 5, newNo: null, text: 'e' }
    ])
  })

  it('handles single-line hunk ranges (no comma) and multiple hunks', () => {
    const output = ['@@ -1 +1 @@', '-old', '+new', '@@ -10,2 +10,2 @@', ' ctx', '-x', '+y'].join(
      '\n'
    )
    const diff = parseDiff(output)
    expect(diff.hunks).toHaveLength(2)
    expect(diff.hunks[0].lines[0]).toMatchObject({ type: 'del', oldNo: 1 })
    expect(diff.hunks[1].oldStart).toBe(10)
  })

  it('flags a binary diff', () => {
    const diff = parseDiff('diff --git a/x.png b/x.png\nBinary files a/x.png and b/x.png differ')
    expect(diff.binary).toBe(true)
    expect(diff.hunks).toEqual([])
  })

  it('short-circuits an over-cap diff to a tooLarge marker', () => {
    const diff = parseDiff('irrelevant', { tooLarge: true })
    expect(diff).toEqual({ hunks: [], binary: false, tooLarge: true })
  })

  it('returns no hunks for an empty diff', () => {
    expect(parseDiff('')).toEqual({ hunks: [], binary: false })
  })
})
