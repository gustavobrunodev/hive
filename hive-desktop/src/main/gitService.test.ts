import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
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
    expect(runner.calls[0].opts).toEqual({
      cwd: WS,
      env: { GIT_TERMINAL_PROMPT: '0', GIT_EDITOR: 'true' }
    })
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

describe('GitService.stage / unstage', () => {
  it('stages paths with add --', async () => {
    const { runner, service } = make()
    await service.stage(WS, ['a.txt', 'dir/b.md'])
    expect(runner.calls[0].args.slice(2)).toEqual(['add', '--', 'a.txt', 'dir/b.md'])
  })

  it('unstages paths with restore --staged --', async () => {
    const { runner, service } = make()
    await service.unstage(WS, ['a.txt'])
    expect(runner.calls[0].args.slice(2)).toEqual(['restore', '--staged', '--', 'a.txt'])
  })
})

describe('GitService.discard', () => {
  it('trashes an untracked file and never calls git restore for it', async () => {
    const { runner, service, trashItem } = make()
    stdout(runner, '? junk.txt\0') // scoped status: the path is untracked
    await service.discard(WS, ['junk.txt'])

    expect(trashItem).toHaveBeenCalledWith(join(WS, 'junk.txt'))
    expect(runner.calls.some((c) => c.args.includes('restore'))).toBe(false)
  })

  it('restores a tracked file to HEAD and never trashes it', async () => {
    const { runner, service, trashItem } = make()
    stdout(runner, '1 .M N... 100644 100644 100644 aaa bbb a.txt\0') // tracked modification
    await service.discard(WS, ['a.txt'])

    expect(trashItem).not.toHaveBeenCalled()
    const restore = runner.calls.find((c) => c.args.includes('restore'))
    expect(restore?.args.slice(2)).toEqual(['restore', '--staged', '--worktree', '--', 'a.txt'])
  })
})

describe('GitService.commit', () => {
  it('commits via a -F message file and returns the new hash', async () => {
    const { runner, service } = make()
    runner.script({ code: 0 }) // commit
    stdout(runner, 'deadbeefcafe\n') // rev-parse HEAD
    const result = await service.commit(WS, 'feat: do a thing')

    expect(result).toEqual({ hash: 'deadbeefcafe' })
    const commitCall = runner.calls[0].args.slice(2)
    expect(commitCall[0]).toBe('commit')
    expect(commitCall[1]).toBe('-F')
    expect(commitCall).not.toContain('--amend')
  })

  it('runs add -A first when stageAll is set', async () => {
    const { runner, service } = make()
    runner.script({ code: 0 }) // add -A
    runner.script({ code: 0 }) // commit
    stdout(runner, 'abc123\n') // rev-parse
    await service.commit(WS, 'msg', { stageAll: true })

    expect(runner.calls[0].args.slice(2)).toEqual(['add', '-A'])
    expect(runner.calls[1].args[2]).toBe('commit')
  })

  it('passes --amend when amending', async () => {
    const { runner, service } = make()
    runner.script({ code: 0 }) // commit --amend
    stdout(runner, 'abc123\n') // rev-parse
    await service.commit(WS, 'msg', { amend: true })
    expect(runner.calls[0].args).toContain('--amend')
  })
})

describe('GitService branches', () => {
  it('lists branches via for-each-ref and parses current/ahead', async () => {
    const { runner, service } = make()
    stdout(runner, 'refs/heads/main\x1fabc\x1forigin/main\x1f[ahead 1]\x1f*\n')
    const result = await service.branches(WS)

    expect(runner.calls[0].args.slice(2)).toEqual([
      'for-each-ref',
      '--format=%(refname)%1f%(objectname:short)%1f%(upstream:short)%1f%(upstream:track)%1f%(HEAD)',
      'refs/heads',
      'refs/remotes'
    ])
    expect(result.current).toBe('main')
    expect(result.branches[0]).toMatchObject({ name: 'main', ahead: 1 })
  })

  it('creates a branch with switch -c, optionally from a start point', async () => {
    const { runner, service } = make()
    await service.createBranch(WS, 'feat/x')
    expect(runner.calls[0].args.slice(2)).toEqual(['switch', '-c', 'feat/x'])

    const b = make()
    await b.service.createBranch(WS, 'feat/y', 'main')
    expect(b.runner.calls[0].args.slice(2)).toEqual(['switch', '-c', 'feat/y', 'main'])
  })

  it('checks out a ref and surfaces git\'s dirty refusal as a GitError', async () => {
    const { runner, service } = make()
    await service.checkout(WS, 'main')
    expect(runner.calls[0].args.slice(2)).toEqual(['switch', 'main'])

    const b = make()
    b.runner.script({ chunks: [{ stream: 'stderr', data: 'error: local changes' }], code: 1 })
    await expect(b.service.checkout(WS, 'other')).rejects.toBeInstanceOf(GitError)
  })

  it('renames and deletes branches (soft + force)', async () => {
    const { runner, service } = make()
    await service.renameBranch(WS, 'old', 'new')
    expect(runner.calls[0].args.slice(2)).toEqual(['branch', '-m', 'old', 'new'])

    const soft = make()
    await soft.service.deleteBranch(WS, 'gone')
    expect(soft.runner.calls[0].args.slice(2)).toEqual(['branch', '-d', 'gone'])

    const force = make()
    await force.service.deleteBranch(WS, 'gone', true)
    expect(force.runner.calls[0].args.slice(2)).toEqual(['branch', '-D', 'gone'])
  })
})

describe('GitService remotes', () => {
  it('fetches and pulls (--ff)', async () => {
    const f = make()
    await f.service.fetch(WS)
    expect(f.runner.calls[0].args.slice(2)).toEqual(['fetch'])

    const p = make()
    await p.service.pull(WS)
    expect(p.runner.calls[0].args.slice(2)).toEqual(['pull', '--ff'])
  })

  it('pushes plainly, and publishes with -u origin <current> when setUpstream', async () => {
    const plain = make()
    await plain.service.push(WS)
    expect(plain.runner.calls[0].args.slice(2)).toEqual(['push'])

    const pub = make()
    stdout(pub.runner, 'feature/x\n') // rev-parse --abbrev-ref HEAD
    pub.runner.script({ code: 0 }) // push -u
    await pub.service.push(WS, { setUpstream: true })
    expect(pub.runner.calls[1].args.slice(2)).toEqual(['push', '-u', 'origin', 'feature/x'])
  })

  it('syncs by pulling then pushing', async () => {
    const { runner, service } = make()
    runner.script({ code: 0 }) // pull
    runner.script({ code: 0 }) // push
    await service.sync(WS)
    expect(runner.calls[0].args.slice(2)).toEqual(['pull', '--ff'])
    expect(runner.calls[1].args.slice(2)).toEqual(['push'])
  })

  it('propagates git\'s real stderr on an auth failure (D-GIT-1)', async () => {
    const { runner, service } = make()
    runner.script({
      chunks: [{ stream: 'stderr', data: 'fatal: Authentication failed for https://host/repo' }],
      code: 128
    })
    const err = await service.push(WS).catch((e) => e)
    expect(err).toBeInstanceOf(GitError)
    expect(err.stderr).toContain('Authentication failed')
  })
})

describe('GitService log / diff / commitDiff', () => {
  it('logs newest-first with pagination and optional file scope', async () => {
    const { runner, service } = make()
    stdout(runner, 'h1\x1fs1\x1fauth\x1f2026-01-01\x1fsubject one')
    const commits = await service.log(WS, { file: 'a.txt', skip: 10, limit: 25 })

    expect(runner.calls[0].args.slice(2)).toEqual([
      'log',
      '--pretty=format:%H%x1f%h%x1f%an%x1f%aI%x1f%s',
      '-z',
      '--skip=10',
      '-n',
      '25',
      '--',
      'a.txt'
    ])
    expect(commits[0]).toMatchObject({ hash: 'h1', subject: 'subject one' })
  })

  it('diffs the working tree and the staged side', async () => {
    const work = make()
    stdout(work.runner, '@@ -1 +1 @@\n-a\n+b')
    const d = await work.service.diff(WS, 'a.txt', 'working')
    expect(work.runner.calls[0].args.slice(2)).toEqual(['diff', '--', 'a.txt'])
    expect(d.hunks).toHaveLength(1)

    const staged = make()
    stdout(staged.runner, '')
    await staged.service.diff(WS, 'a.txt', 'staged')
    expect(staged.runner.calls[0].args.slice(2)).toEqual(['diff', '--staged', '--', 'a.txt'])
  })

  it('reports an over-cap diff as tooLarge without shipping it', async () => {
    const { runner, service } = make()
    stdout(runner, 'x'.repeat(2_000_001))
    const d = await service.diff(WS, 'big.txt', 'working')
    expect(d).toEqual({ hunks: [], binary: false, tooLarge: true })
  })

  it('returns a commit\'s numstat files and unified patch', async () => {
    const { runner, service } = make()
    stdout(runner, '2\t1\ta.txt\0') // show --numstat -z
    stdout(runner, '@@ -1,2 +1,3 @@\n a\n+b\n c') // show patch
    const result = await service.commitDiff(WS, 'abc123')

    expect(runner.calls[0].args.slice(2)).toEqual([
      'show',
      'abc123',
      '--numstat',
      '--format=',
      '-z'
    ])
    expect(result.files[0]).toMatchObject({ path: 'a.txt', added: 2, deleted: 1 })
    expect(result.diff.hunks).toHaveLength(1)
  })
})

describe('GitService conflicts + merge', () => {
  const tempDirs: string[] = []
  afterEach(() => {
    for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true })
  })

  it('derives conflicted paths from status', async () => {
    const { runner, service } = make()
    stdout(runner, 'u UU N... 100644 100644 100644 100644 a b c c.txt\0? junk\0')
    const list = await service.conflicts(WS)
    expect(list).toEqual([{ path: 'c.txt' }])
  })

  it('accepts current (--ours) / incoming (--theirs) then stages', async () => {
    const ours = make()
    ours.runner.script({ code: 0 }) // checkout --ours
    ours.runner.script({ code: 0 }) // add
    await ours.service.resolveConflict(WS, 'c.txt', 'current')
    expect(ours.runner.calls[0].args.slice(2)).toEqual(['checkout', '--ours', '--', 'c.txt'])
    expect(ours.runner.calls[1].args.slice(2)).toEqual(['add', '--', 'c.txt'])

    const theirs = make()
    theirs.runner.script({ code: 0 })
    theirs.runner.script({ code: 0 })
    await theirs.service.resolveConflict(WS, 'c.txt', 'incoming')
    expect(theirs.runner.calls[0].args.slice(2)).toEqual(['checkout', '--theirs', '--', 'c.txt'])
  })

  it('accepts both by stripping conflict markers, then stages', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'hive-git-conflict-'))
    tempDirs.push(dir)
    writeFileSync(
      join(dir, 'c.txt'),
      ['a', '<<<<<<< HEAD', 'ours', '=======', 'theirs', '>>>>>>> other', 'b'].join('\n')
    )
    const { runner, service } = make()
    runner.script({ code: 0 }) // add
    await service.resolveConflict(dir, 'c.txt', 'both')

    expect(readFileSync(join(dir, 'c.txt'), 'utf-8')).toBe(['a', 'ours', 'theirs', 'b'].join('\n'))
    expect(runner.calls[0].args.slice(2)).toEqual(['add', '--', 'c.txt'])
  })

  it('continues and aborts a merge', async () => {
    const cont = make()
    await cont.service.mergeContinue(WS)
    expect(cont.runner.calls[0].args.slice(2)).toEqual(['merge', '--continue'])

    const abort = make()
    await abort.service.mergeAbort(WS)
    expect(abort.runner.calls[0].args.slice(2)).toEqual(['merge', '--abort'])
  })
})

describe('GitService stash', () => {
  it('pushes a stash, optionally including untracked + a message', async () => {
    const plain = make()
    await plain.service.stash(WS)
    expect(plain.runner.calls[0].args.slice(2)).toEqual(['stash', 'push'])

    const full = make()
    await full.service.stash(WS, { untracked: true, message: 'wip' })
    expect(full.runner.calls[0].args.slice(2)).toEqual(['stash', 'push', '-u', '-m', 'wip'])
  })

  it('lists stashes', async () => {
    const { runner, service } = make()
    stdout(runner, 'stash@{0}\x1fWIP on main: abc msg')
    const list = await service.stashList(WS)
    expect(runner.calls[0].args.slice(2)).toEqual(['stash', 'list', '--format=%gd%x1f%s'])
    expect(list[0]).toMatchObject({ index: 0, message: 'WIP on main: abc msg' })
  })

  it('applies / pops / drops a stash by index', async () => {
    const apply = make()
    await apply.service.stashApply(WS, 2)
    expect(apply.runner.calls[0].args.slice(2)).toEqual(['stash', 'apply', 'stash@{2}'])

    const pop = make()
    await pop.service.stashApply(WS, 0, true)
    expect(pop.runner.calls[0].args.slice(2)).toEqual(['stash', 'pop', 'stash@{0}'])

    const drop = make()
    await drop.service.stashDrop(WS, 1)
    expect(drop.runner.calls[0].args.slice(2)).toEqual(['stash', 'drop', 'stash@{1}'])
  })
})
