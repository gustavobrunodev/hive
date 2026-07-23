import { describe, expect, it, vi } from 'vitest'
import { createFakeProcessRunner, type FakeProcessRunner } from './processRunner'
import { createGitService, GitError, type GitService } from './gitService'

/**
 * `createGitService` takes its `ProcessRunner` + `trashItem` as injected
 * dependencies (mirroring fsService/bmadService), so tests script the fake
 * `ProcessRunner` and assert exact argv, `cwd` containment, env flags, queue
 * serialization and error mapping — no real git, no spawning (T4, design.md §10).
 */

const WS = '/home/dev/workspace'

/** Scripts one stdout-only, exit-0 git invocation. */
function stdout(runner: FakeProcessRunner, data: string): void {
  runner.script({ chunks: [{ stream: 'stdout', data }], code: 0 })
}

function make(): { runner: FakeProcessRunner; service: GitService; trashItem: ReturnType<typeof vi.fn> } {
  const runner = createFakeProcessRunner()
  const trashItem = vi.fn(async () => {})
  const service = createGitService({ processRunner: runner, trashItem })
  return { runner, service, trashItem }
}

describe('GitService — git() wrapper', () => {
  it('prefixes core.quotepath=false, sets GIT_TERMINAL_PROMPT=0 and runs in the workspace cwd', async () => {
    const { runner, service } = make()
    stdout(runner, '\n') // status output
    await service.status(WS)

    expect(runner.calls[0].command).toBe('git')
    expect(runner.calls[0].args.slice(0, 2)).toEqual(['-c', 'core.quotepath=false'])
    expect(runner.calls[0].opts).toEqual({ cwd: WS, env: { GIT_TERMINAL_PROMPT: '0' } })
  })

  it('throws a GitError carrying code, stderr and command on a non-zero exit', async () => {
    const { runner, service } = make()
    runner.script({ chunks: [{ stream: 'stderr', data: 'fatal: not a git repository' }], code: 128 })

    const err = await service.status(WS).catch((e) => e)
    expect(err).toBeInstanceOf(GitError)
    expect(err.code).toBe(128)
    expect(err.stderr).toBe('fatal: not a git repository')
    expect(err.command).toBe('git status --porcelain=v2 --branch -z')
  })
})

describe('GitService.detect', () => {
  it('reports a repo + its top-level root', async () => {
    const { runner, service } = make()
    stdout(runner, 'true\n')
    stdout(runner, '/home/dev/workspace\n')

    expect(await service.detect(WS)).toEqual({
      isRepo: true,
      root: '/home/dev/workspace',
      gitMissing: false
    })
    expect(runner.calls[0].args).toEqual([
      '-c',
      'core.quotepath=false',
      'rev-parse',
      '--is-inside-work-tree'
    ])
    expect(runner.calls[1].args).toContain('--show-toplevel')
  })

  it('reports not-a-repo when rev-parse fails', async () => {
    const { runner, service } = make()
    runner.script({ chunks: [{ stream: 'stderr', data: 'fatal: not a git repo' }], code: 128 })
    expect(await service.detect(WS)).toEqual({ isRepo: false, root: null, gitMissing: false })
  })

  it('flags gitMissing when git never spawns (binary not found)', async () => {
    const { runner, service } = make()
    runner.script({ spawnError: true })
    expect(await service.detect(WS)).toEqual({ isRepo: false, root: null, gitMissing: true })
  })
})

describe('GitService.status', () => {
  it('runs the porcelain-v2 command and returns the parsed status', async () => {
    const { runner, service } = make()
    stdout(runner, '# branch.head main\0# branch.ab +1 -0\0? new.txt\0')
    const status = await service.status(WS)

    expect(runner.calls[0].args.slice(2)).toEqual([
      'status',
      '--porcelain=v2',
      '--branch',
      '-z'
    ])
    expect(status.branch).toBe('main')
    expect(status.ahead).toBe(1)
    expect(status.changes[0]).toMatchObject({ path: 'new.txt', isUntracked: true })
  })
})

describe('GitService.init + serialization', () => {
  it('runs git init', async () => {
    const { runner, service } = make()
    await service.init(WS)
    expect(runner.calls[0].args.slice(2)).toEqual(['init'])
  })

  it('serializes mutating ops per repo (the second waits for the first)', async () => {
    const { runner, service } = make()
    // First init's process takes 40ms; the second is instant. The queue must
    // hold the second's run() until the first resolves.
    runner.script({ chunks: [], code: 0, delayMs: 40 })
    runner.script({ chunks: [], code: 0 })

    const first = service.init(WS)
    const second = service.init(WS)

    await new Promise((r) => setTimeout(r, 10))
    expect(runner.calls).toHaveLength(1) // second not yet started

    await Promise.all([first, second])
    expect(runner.calls).toHaveLength(2)
    expect(runner.calls.every((c) => c.args.includes('init'))).toBe(true)
  })
})
