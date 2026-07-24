import { describe, expect, it } from 'vitest'
import {
  buildDecorations,
  changeCount,
  gitStatusColor,
  groupChanges,
  rollupChangedFolders,
  statusKind,
  statusLetter,
  type GitFileChange,
  type GitStatus
} from './gitStatus'

/** Builds a `GitFileChange` with sensible flag defaults. */
function chg(
  path: string,
  index: string,
  worktree: string,
  flags: Partial<Pick<GitFileChange, 'isConflict' | 'isUntracked' | 'isIgnored' | 'origPath'>> = {}
): GitFileChange {
  return {
    path,
    index,
    worktree,
    isConflict: false,
    isUntracked: false,
    isIgnored: false,
    ...flags
  }
}

function status(changes: GitFileChange[]): GitStatus {
  return {
    branch: 'main',
    detached: false,
    oid: 'abc',
    upstream: null,
    ahead: 0,
    behind: 0,
    changes
  }
}

describe('statusKind / statusLetter', () => {
  it('maps each change class to its semantic kind + glyph', () => {
    expect(statusKind(chg('a', '.', 'M'))).toBe('modified')
    expect(statusKind(chg('a', 'A', '.'))).toBe('added')
    expect(statusKind(chg('a', 'D', '.'))).toBe('deleted')
    expect(statusKind(chg('a', 'R', '.'))).toBe('renamed')
    expect(statusKind(chg('a', 'C', '.'))).toBe('renamed')
    expect(statusKind(chg('a', '?', '?', { isUntracked: true }))).toBe('untracked')
    expect(statusKind(chg('a', 'U', 'U', { isConflict: true }))).toBe('conflict')
    expect(statusKind(chg('a', '!', '!', { isIgnored: true }))).toBe('ignored')

    expect(statusLetter(chg('a', '.', 'M'))).toBe('M')
    expect(statusLetter(chg('a', '?', '?', { isUntracked: true }))).toBe('U')
    expect(statusLetter(chg('a', 'U', 'U', { isConflict: true }))).toBe('C')
    expect(statusLetter(chg('a', '!', '!', { isIgnored: true }))).toBe('!')
  })

  it('prefers the worktree side over the index for the effective code', () => {
    expect(statusKind(chg('a', 'A', 'M'))).toBe('modified') // staged-add + further edit
  })
})

describe('gitStatusColor', () => {
  it('returns a CSS var per kind, sharing green for added + untracked', () => {
    expect(gitStatusColor('modified')).toBe('var(--wb-git-modified)')
    expect(gitStatusColor('added')).toBe('var(--wb-git-added)')
    expect(gitStatusColor('untracked')).toBe('var(--wb-git-added)')
    expect(gitStatusColor('conflict')).toBe('var(--wb-git-conflict)')
  })
})

describe('groupChanges', () => {
  it('splits into conflicts / staged / unstaged, dropping ignored', () => {
    const groups = groupChanges(
      status([
        chg('conf', 'U', 'U', { isConflict: true }),
        chg('staged', 'A', '.'),
        chg('unstaged', '.', 'M'),
        chg('untracked', '?', '?', { isUntracked: true }),
        chg('ignored', '!', '!', { isIgnored: true })
      ])
    )
    expect(groups.conflicts.map((c) => c.path)).toEqual(['conf'])
    expect(groups.staged.map((c) => c.path)).toEqual(['staged'])
    expect(groups.unstaged.map((c) => c.path)).toEqual(['unstaged', 'untracked'])
  })

  it('lists a staged-and-further-edited file in both groups (GIT-R2.6)', () => {
    const groups = groupChanges(status([chg('both', 'A', 'M')]))
    expect(groups.staged.map((c) => c.path)).toEqual(['both'])
    expect(groups.unstaged.map((c) => c.path)).toEqual(['both'])
  })

  it('returns empty groups for a null status', () => {
    expect(groupChanges(null)).toEqual({ conflicts: [], staged: [], unstaged: [] })
  })
})

describe('changeCount', () => {
  it('counts every row across the three groups (both sides of AM count twice)', () => {
    expect(changeCount(status([chg('both', 'A', 'M'), chg('u', '.', 'M')]))).toBe(3)
    expect(changeCount(null)).toBe(0)
  })
})

describe('buildDecorations', () => {
  it('builds a path→decoration map with letter, kind and staged flag', () => {
    const map = buildDecorations(
      status([chg('a', 'A', 'M'), chg('u', '?', '?', { isUntracked: true })])
    )
    expect(map.get('a')).toEqual({ kind: 'modified', letter: 'M', staged: true, conflict: false })
    expect(map.get('u')).toEqual({ kind: 'untracked', letter: 'U', staged: false, conflict: false })
  })

  it('returns an empty map for null', () => {
    expect(buildDecorations(null).size).toBe(0)
  })
})

describe('rollupChangedFolders', () => {
  it('collects every ancestor folder of a changed path, skipping ignored', () => {
    const map = buildDecorations(
      status([
        chg('src/deep/a.txt', '.', 'M'),
        chg('top.txt', '.', 'M'),
        chg('build/out.js', '!', '!', { isIgnored: true })
      ])
    )
    const folders = rollupChangedFolders(map)
    expect([...folders].sort()).toEqual(['src', 'src/deep'])
    // A root-level file contributes no folder; an ignored file's folder is skipped.
    expect(folders.has('build')).toBe(false)
  })
})
