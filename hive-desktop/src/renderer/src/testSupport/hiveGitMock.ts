import { vi } from 'vitest'

/**
 * A fully-stubbed `window.hive.git` namespace (git-management M10) for tests
 * that mount UI which reads `window.hive` but doesn't exercise git — each
 * method resolves to a benign empty value, and `onChanged` returns a no-op
 * unsubscribe. Tests that DO drive git (useGit/SourceControlPanel/StatusBar)
 * override the specific methods they need. Kept out of the gated `scm/**` glob
 * so it isn't held to the feature coverage bar.
 */
export function createHiveGitMock(): Window['hive']['git'] {
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
