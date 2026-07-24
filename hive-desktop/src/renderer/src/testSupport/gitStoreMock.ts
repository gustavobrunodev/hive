import { vi } from 'vitest'
import type { GitStore } from '../scm/useGit'
import type { GitStatus } from '../scm/gitStatus'

/** A clean, repo-present GitStatus for fixtures. */
export function makeStatus(over: Partial<GitStatus> = {}): GitStatus {
  return {
    branch: 'main',
    detached: false,
    oid: 'abc',
    upstream: null,
    ahead: 0,
    behind: 0,
    changes: [],
    ...over
  }
}

/**
 * A fully-stubbed `GitStore` for renderer tests that mount SCM UI through
 * `GitProvider`. Every action is a `vi.fn`; pass `over` to set state or swap a
 * specific action. Centralized so adding a store field is a one-file change.
 */
export function createGitStore(over: Partial<GitStore> = {}): GitStore {
  return {
    workspace: '/ws',
    repo: { isRepo: true, gitMissing: false },
    status: makeStatus(),
    busy: null,
    decorations: new Map(),
    refresh: vi.fn(),
    init: vi.fn(async () => {}),
    stage: vi.fn(async () => {}),
    unstage: vi.fn(async () => {}),
    discard: vi.fn(async () => {}),
    commit: vi.fn(async () => {}),
    fetch: vi.fn(async () => {}),
    pull: vi.fn(async () => {}),
    push: vi.fn(async () => {}),
    sync: vi.fn(async () => {}),
    publish: vi.fn(async () => {}),
    createBranch: vi.fn(async () => {}),
    checkout: vi.fn(async () => {}),
    renameBranch: vi.fn(async () => {}),
    deleteBranch: vi.fn(async () => {}),
    resolveConflict: vi.fn(async () => {}),
    mergeContinue: vi.fn(async () => {}),
    mergeAbort: vi.fn(async () => {}),
    stash: vi.fn(async () => {}),
    stashApply: vi.fn(async () => {}),
    stashDrop: vi.fn(async () => {}),
    ...over
  }
}
