import { vi, type Mock } from 'vitest'

/** Each git bridge method as a vitest `Mock`, so tests can `.mockResolvedValue(...)` per method. */
export type HiveGitMock = Record<keyof Window['hive']['git'], Mock>

/**
 * A fully-stubbed `window.hive.git` namespace (git-management M10) for tests
 * that mount UI which reads `window.hive` but doesn't exercise git — each
 * method resolves to a benign empty value, and `onChanged` returns a no-op
 * unsubscribe. Tests that DO drive git (useGit/SourceControlPanel/StatusBar)
 * override the specific methods they need. Kept out of the gated `scm/**` glob
 * so it isn't held to the feature coverage bar.
 *
 * Returns an object of `vi.fn()` mocks (typed `HiveGitMock`) so callers can
 * `.mockResolvedValue(...)` per method; a `Mock` satisfies any function-typed
 * field, so it stays assignable to `window.hive.git`.
 */
export function createHiveGitMock(): HiveGitMock {
  return {
    detect: vi.fn().mockResolvedValue({ isRepo: false, root: null, gitMissing: false }),
    status: vi.fn().mockResolvedValue({
      branch: null,
      detached: false,
      oid: null,
      upstream: null,
      ahead: 0,
      behind: 0,
      changes: []
    }),
    init: vi.fn().mockResolvedValue(undefined),
    stage: vi.fn().mockResolvedValue(undefined),
    unstage: vi.fn().mockResolvedValue(undefined),
    discard: vi.fn().mockResolvedValue(undefined),
    commit: vi.fn().mockResolvedValue({ hash: '' }),
    branches: vi.fn().mockResolvedValue({ branches: [], current: null }),
    createBranch: vi.fn().mockResolvedValue(undefined),
    checkout: vi.fn().mockResolvedValue(undefined),
    renameBranch: vi.fn().mockResolvedValue(undefined),
    deleteBranch: vi.fn().mockResolvedValue(undefined),
    fetch: vi.fn().mockResolvedValue(undefined),
    pull: vi.fn().mockResolvedValue(undefined),
    push: vi.fn().mockResolvedValue(undefined),
    sync: vi.fn().mockResolvedValue(undefined),
    log: vi.fn().mockResolvedValue([]),
    diff: vi.fn().mockResolvedValue({ hunks: [], binary: false }),
    commitDiff: vi.fn().mockResolvedValue({ files: [], diff: { hunks: [], binary: false } }),
    fileAtHead: vi.fn().mockResolvedValue(''),
    conflicts: vi.fn().mockResolvedValue([]),
    resolveConflict: vi.fn().mockResolvedValue(undefined),
    mergeContinue: vi.fn().mockResolvedValue(undefined),
    mergeAbort: vi.fn().mockResolvedValue(undefined),
    stash: vi.fn().mockResolvedValue(undefined),
    stashList: vi.fn().mockResolvedValue([]),
    stashApply: vi.fn().mockResolvedValue(undefined),
    stashDrop: vi.fn().mockResolvedValue(undefined),
    onChanged: vi.fn().mockReturnValue(() => {})
  }
}

/** Each review bridge method as a vitest `Mock` (Agent Change Review, M11). */
export type HiveReviewMock = Record<keyof Window['hive']['review'], Mock>

/**
 * A fully-stubbed `window.hive.review` namespace for tests that mount UI which
 * reads `window.hive` but doesn't exercise the review flow — `get` resolves to
 * an empty pending set, decisions resolve `{ ok: true }`, and `onChanged`
 * returns a no-op unsubscribe. Tests that DO drive review override the methods
 * they need.
 */
export function createHiveReviewMock(): HiveReviewMock {
  return {
    get: vi.fn().mockResolvedValue({ changes: [], turns: [] }),
    acceptFile: vi.fn().mockResolvedValue({ ok: true }),
    rejectFile: vi.fn().mockResolvedValue({ ok: true }),
    acceptFiles: vi.fn().mockResolvedValue({ ok: true }),
    rejectFiles: vi.fn().mockResolvedValue({ ok: true }),
    acceptHunk: vi.fn().mockResolvedValue({ ok: true }),
    rejectHunk: vi.fn().mockResolvedValue({ ok: true }),
    acceptAll: vi.fn().mockResolvedValue({ ok: true }),
    rejectAll: vi.fn().mockResolvedValue({ ok: true }),
    onChanged: vi.fn().mockReturnValue(() => {})
  }
}
