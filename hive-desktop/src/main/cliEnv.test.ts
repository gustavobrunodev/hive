import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { delimiter, join } from 'path'
import {
  buildCliPath,
  cliEnv,
  cliPath,
  escapeCmdArgument,
  loginShellPath,
  resetCliPathCache,
  resolveExecutable,
  spawnTarget,
  wellKnownBinDirs,
  type ExecSync
} from './cliEnv'

/**
 * agent-onboarding AO-R1. This module exists because of one reproducible
 * report — "I installed the Claude Code CLI, restarted Hive, and it still says
 * it isn't installed" — with two independent causes, and every test below
 * names one of them:
 *
 *  - a GUI-launched app inherits a `PATH` with none of the npm-global
 *    prefixes on it (verified: with `PATH=/usr/local/bin:/usr/bin:/bin`, all
 *    three agent probes ENOENT on a machine where all three run in a shell);
 *  - Windows — currently the only platform with a published installer —
 *    cannot execute what npm actually writes there.
 */

const created: string[] = []

/**
 * Windows' real `PATHEXT` is upper-case and NTFS doesn't care; these tests run
 * on a case-sensitive filesystem, where `claude.CMD` would miss the
 * `claude.cmd` npm actually wrote. Lower-case here keeps the assertion about
 * *extension resolution* rather than about the host's filesystem.
 */
const WIN_PATHEXT = '.exe;.cmd'

function tempTree(files: string[]): string {
  const root = mkdtempSync(join(tmpdir(), 'hive-clienv-'))
  created.push(root)
  for (const file of files) {
    const abs = join(root, file)
    mkdirSync(join(abs, '..'), { recursive: true })
    writeFileSync(abs, '', { mode: 0o755 })
  }
  return root
}

afterEach(() => {
  resetCliPathCache()
  vi.restoreAllMocks()
  while (created.length > 0) rmSync(created.pop() as string, { recursive: true, force: true })
})

describe('loginShellPath', () => {
  it('reads what the login shell printed between the sentinels, ignoring an rc banner', () => {
    const exec = vi.fn<ExecSync>(
      () => `Welcome to your shell!\n__HIVE_PATH_OPEN__/opt/x/bin:/usr/bin__HIVE_PATH_CLOSE__`
    )
    expect(loginShellPath({ SHELL: '/bin/zsh' }, exec)).toBe('/opt/x/bin:/usr/bin')
    // `-l` (profile) *and* `-i` (rc): version managers write to whichever the
    // user's distro treats as canonical, so asking for one misses half of them.
    expect(exec.mock.calls[0][1][0]).toBe('-lic')
  })

  it('returns null when there is no $SHELL, when the shell fails, and when it prints nothing usable', () => {
    expect(loginShellPath({}, vi.fn())).toBeNull()
    expect(
      loginShellPath({ SHELL: '/bin/zsh' }, () => {
        throw new Error('rc file exploded')
      })
    ).toBeNull()
    expect(loginShellPath({ SHELL: '/bin/zsh' }, () => 'no sentinels here')).toBeNull()
    expect(
      loginShellPath({ SHELL: '/bin/zsh' }, () => '__HIVE_PATH_OPEN__  __HIVE_PATH_CLOSE__')
    ).toBeNull()
  })
})

describe('buildCliPath', () => {
  it('appends the login shell PATH and the well-known prefixes after the inherited one', () => {
    const home = tempTree(['.nvm/versions/node/v22.22.1/bin/node', '.local/bin/claude'])
    const nvmBin = join(home, '.nvm', 'versions', 'node', 'v22.22.1', 'bin')
    const dirs = buildCliPath({ PATH: '/usr/bin' }, { shellPath: nvmBin, home }).split(delimiter)

    // The user's own PATH keeps its precedence — this only ever appends, so a
    // deliberately shadowed binary stays shadowed.
    expect(dirs[0]).toBe('/usr/bin')
    expect(dirs).toContain(nvmBin)
    expect(dirs).toContain(join(home, '.local', 'bin'))
  })

  it('de-duplicates, ignoring a trailing separator and empty entries', () => {
    const dirs = buildCliPath(
      { PATH: `/usr/bin${delimiter}/usr/bin/${delimiter}${delimiter}/opt/bin` },
      { shellPath: '/usr/bin', home: '/home/dev' }
    ).split(delimiter)
    expect(dirs.filter((dir) => dir === '/usr/bin')).toHaveLength(1)
    expect(dirs).not.toContain('')
  })

  it('keeps an inherited entry sight unseen, and drops an added one that is not on disk', () => {
    const home = tempTree(['.local/bin/keep'])
    const dirs = buildCliPath(
      { PATH: `/does/not/exist${delimiter}/usr/bin` },
      { shellPath: '/also/not/there', home }
    ).split(delimiter)

    // The user's own PATH is theirs — a mount that appears later is their business.
    expect(dirs).toContain('/does/not/exist')
    // Ours have to be real, or every later spawn searches a dozen fictions.
    expect(dirs).not.toContain('/also/not/there')
    expect(dirs).toContain(join(home, '.local', 'bin'))
    expect(dirs).not.toContain(join(home, '.volta', 'bin'))
  })

  it('points at the Windows prefixes npm actually writes to', () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('win32')
    const dirs = wellKnownBinDirs(
      {
        APPDATA: 'C:\\Users\\dev\\AppData\\Roaming',
        LOCALAPPDATA: 'C:\\Users\\dev\\AppData\\Local'
      },
      'C:\\Users\\dev'
    )
    // `%APPDATA%\npm` first: it is where `npm i -g` puts the shims, and the
    // whole reason a Windows install went unnoticed.
    expect(dirs[0]).toContain('Roaming')
    expect(dirs[0]).toContain('npm')
    expect(dirs.some((dir) => dir.includes('nodejs'))).toBe(true)
  })

  it('falls back to the default Windows profile locations when the vars are unset', () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('win32')
    const dirs = wellKnownBinDirs({}, 'C:\\Users\\dev')
    expect(dirs[0]).toBe(join('C:\\Users\\dev', 'AppData', 'Roaming', 'npm'))
  })

  it('lists every installed node version bin, newest name first', () => {
    const home = tempTree([
      '.nvm/versions/node/v20.11.0/bin/node',
      '.nvm/versions/node/v22.22.1/bin/node'
    ])
    const dirs = wellKnownBinDirs({}, home)
    const versions = dirs.filter((dir) => dir.includes('.nvm'))
    expect(versions[0]).toContain('v22.22.1')
    expect(versions[1]).toContain('v20.11.0')
  })
})

describe('cliPath / cliEnv', () => {
  it('computes once and reuses the answer (the login-shell query costs a process)', () => {
    const env = { PATH: '/usr/bin', SHELL: '' }
    const first = cliPath(env)
    expect(cliPath(env)).toBe(first)
    expect(cliEnv(env).PATH).toBe(first)
    // Everything else in the environment travels along untouched.
    expect(cliEnv({ ...env, FOO: 'bar' }).FOO).toBe('bar')
  })
})

describe('resolveExecutable', () => {
  it('finds a bare command on the widened path and returns its absolute location', () => {
    const root = tempTree(['bin/claude'])
    expect(resolveExecutable('claude', join(root, 'bin'))).toBe(join(root, 'bin', 'claude'))
    expect(resolveExecutable('copilot', join(root, 'bin'))).toBeNull()
    expect(resolveExecutable('', join(root, 'bin'))).toBeNull()
  })

  it('takes a command that already carries a path as given, when it exists', () => {
    const root = tempTree(['stand-in.cjs'])
    expect(resolveExecutable(join(root, 'stand-in.cjs'), '')).toBe(join(root, 'stand-in.cjs'))
    expect(resolveExecutable(join(root, 'missing.cjs'), '')).toBeNull()
  })

  it('skips a file on PATH that is not executable', () => {
    const root = mkdtempSync(join(tmpdir(), 'hive-clienv-'))
    created.push(root)
    mkdirSync(join(root, 'bin'))
    // A same-named data file shadowing the real CLI would otherwise be spawned
    // and fail with EACCES, which reads like the CLI is broken rather than absent.
    writeFileSync(join(root, 'bin', 'claude'), 'not a program', { mode: 0o644 })
    expect(resolveExecutable('claude', join(root, 'bin'))).toBeNull()
  })

  it('skips a directory that is on PATH but not on disk', () => {
    const root = tempTree(['bin/claude'])
    const path = [join(root, 'nope'), ' ', join(root, 'bin')].join(delimiter)
    expect(resolveExecutable('claude', path)).toBe(join(root, 'bin', 'claude'))
  })

  describe('on Windows', () => {
    it('tries PATHEXT — the whole reason an installed CLI was invisible there', () => {
      vi.spyOn(process, 'platform', 'get').mockReturnValue('win32')
      // npm writes all three shims; only `.cmd` is executable by CreateProcess.
      const root = tempTree(['npm/claude', 'npm/claude.cmd', 'npm/claude.ps1'])
      expect(resolveExecutable('claude', join(root, 'npm'), { PATHEXT: WIN_PATHEXT })).toBe(
        join(root, 'npm', 'claude.cmd')
      )
    })

    it('never resolves the extension-less shim, which is a POSIX script Windows cannot run', () => {
      vi.spyOn(process, 'platform', 'get').mockReturnValue('win32')
      const root = tempTree(['npm/claude'])
      expect(resolveExecutable('claude', join(root, 'npm'), { PATHEXT: WIN_PATHEXT })).toBeNull()
    })

    it('accepts a command that already names its extension', () => {
      vi.spyOn(process, 'platform', 'get').mockReturnValue('win32')
      const root = tempTree(['sys/node.exe'])
      expect(resolveExecutable('node.exe', join(root, 'sys'), { PATHEXT: WIN_PATHEXT })).toBe(
        join(root, 'sys', 'node.exe')
      )
    })
  })
})

describe('escapeCmdArgument', () => {
  it('quotes the argument and hides every cmd.exe metacharacter behind a caret', () => {
    // The case that matters: adapters pass the user's whole prompt as ONE
    // argument. Unescaped, `&&` would end the command and run the rest.
    expect(escapeCmdArgument('build && rm -rf /')).toBe('^"build^ ^&^&^ rm^ -rf^ /^"')
    expect(escapeCmdArgument('100%PATH%')).toBe('^"100^%PATH^%^"')
  })

  it('doubles a backslash run before a quote and at the end of the argument', () => {
    expect(escapeCmdArgument('say "hi"')).toBe('^"say^ \\^"hi\\^"^"')
    expect(escapeCmdArgument('C:\\path\\')).toBe('^"C:\\path\\\\^"')
  })
})

describe('spawnTarget', () => {
  it('hands back the resolved absolute path for an ordinary binary', () => {
    const root = tempTree(['bin/claude'])
    expect(spawnTarget('claude', ['--version'], join(root, 'bin'))).toEqual({
      command: join(root, 'bin', 'claude'),
      args: ['--version']
    })
  })

  it('passes an unresolvable command through, so the failure stays a plain ENOENT', () => {
    expect(spawnTarget('claude', ['--version'], '/nowhere')).toEqual({
      command: 'claude',
      args: ['--version']
    })
  })

  it('routes a Windows .cmd shim through cmd.exe — Node refuses to spawn one directly', () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('win32')
    const root = tempTree(['npm/claude.cmd'])
    const target = spawnTarget('claude', ['-p', 'a && b'], join(root, 'npm'), {
      PATHEXT: WIN_PATHEXT,
      ComSpec: 'C:\\WINDOWS\\system32\\cmd.exe'
    })
    expect(target.command).toBe('C:\\WINDOWS\\system32\\cmd.exe')
    expect(target.args.slice(0, 3)).toEqual(['/d', '/s', '/c'])
    // One pre-escaped line, wrapped in the outer quote pair `/s` strips.
    expect(target.args[3].startsWith('"')).toBe(true)
    expect(target.args[3]).toContain('^&^&')
    expect(target.windowsVerbatimArguments).toBe(true)
  })

  it('leaves a real Windows .exe alone', () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('win32')
    const root = tempTree(['sys/git.exe'])
    const target = spawnTarget('git', ['status'], join(root, 'sys'), { PATHEXT: WIN_PATHEXT })
    expect(target.command).toBe(join(root, 'sys', 'git.exe'))
    expect(target.windowsVerbatimArguments).toBeUndefined()
  })
})
