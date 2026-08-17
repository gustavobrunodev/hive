import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  defaultShell,
  detectShells,
  quotePosixArgument,
  quotePowerShellArgument,
  resolveShell,
  shellSpawnEnv,
  shellSpawnTarget,
  type ShellInfo,
  type ShellProbe
} from './shellCatalog'
import { resetCliPathCache } from './cliEnv'

/**
 * agent-terminal (AT-R1..AT-R3). Two classes of test live here, and they fail
 * for different reasons:
 *
 *  - **Detection** is about a machine this suite doesn't run on. Every case
 *    below hands `detectShells` a fabricated filesystem, because the whole
 *    point is the setups the dev box doesn't have — a Windows without pwsh, a
 *    container without `/etc/shells`, a distro where `/bin/bash` symlinks to
 *    `/usr/bin/bash`.
 *  - **Quoting/launch** is about the three invariants in the spec: no profile
 *    is sourced, `exec` keeps the pid killable, and the exit code survives.
 *    All three are silent when broken — the turn just gets stranger.
 */

afterEach(() => {
  resetCliPathCache()
  vi.restoreAllMocks()
})

/** A probe over an explicit set of existing paths, plus an optional /etc/shells. */
function fakeProbe(
  paths: string[],
  etcShells?: string,
  links: Record<string, string> = {}
): ShellProbe {
  const set = new Set(paths)
  return {
    exists: (path) => set.has(path),
    readEtcShells: () => etcShells ?? null,
    realpath: (path) => links[path] ?? path
  }
}

describe('detectShells — POSIX', () => {
  it('lists the login shell first and marks it as the system default', () => {
    const shells = detectShells(
      { SHELL: '/usr/bin/zsh' },
      fakeProbe(['/usr/bin/zsh', '/bin/bash', '/bin/sh']),
      'linux'
    )
    expect(shells.map((shell) => shell.id)).toEqual(['zsh', 'bash', 'sh'])
    expect(shells[0]).toMatchObject({ path: '/usr/bin/zsh', family: 'zsh', systemDefault: true })
    expect(shells.filter((shell) => shell.systemDefault)).toHaveLength(1)
  })

  it('reads /etc/shells and skips its non-shell entries', () => {
    const etc = [
      '# comment',
      '/bin/bash',
      '/usr/bin/tmux',
      '/usr/bin/screen',
      '/usr/bin/fish',
      ''
    ].join('\n')
    const shells = detectShells({}, fakeProbe(['/bin/bash', '/usr/bin/fish'], etc), 'linux')
    expect(shells.map((shell) => shell.id)).toEqual(['bash', 'fish'])
  })

  it('lists one entry when two paths are the same binary through a symlink', () => {
    // Measured on this machine: /bin/bash and /usr/bin/bash are the same file.
    const shells = detectShells(
      {},
      fakeProbe(['/bin/bash', '/usr/bin/bash'], '/bin/bash\n/usr/bin/bash', {
        '/bin/bash': '/usr/bin/bash',
        '/usr/bin/bash': '/usr/bin/bash'
      }),
      'linux'
    )
    expect(shells).toHaveLength(1)
    expect(shells[0].path).toBe('/bin/bash')
  })

  it('still finds shells with no /etc/shells and no $SHELL (a container)', () => {
    const shells = detectShells({}, fakeProbe(['/bin/sh']), 'linux')
    expect(shells).toEqual([{ id: 'sh', path: '/bin/sh', family: 'sh', systemDefault: false }])
  })

  it('files dash under the sh family (it is sh-compatible, not its own language)', () => {
    const shells = detectShells({}, fakeProbe(['/bin/dash']), 'linux')
    expect(shells[0]).toMatchObject({ id: 'dash', family: 'sh' })
  })

  it('returns nothing rather than inventing a shell that is not installed', () => {
    expect(detectShells({ SHELL: '/bin/zsh' }, fakeProbe([]), 'linux')).toEqual([])
  })
})

describe('detectShells — Windows', () => {
  const winEnv = {
    SystemRoot: 'C:\\Windows',
    ComSpec: 'C:\\Windows\\System32\\cmd.exe',
    ProgramFiles: 'C:\\Program Files',
    PATH: ''
  }

  it('puts cmd first and marks it the system default (D-AT-2 — the requested Windows default)', () => {
    const shells = detectShells(
      winEnv,
      fakeProbe([
        'C:\\Windows\\System32\\cmd.exe',
        'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
        'C:\\Program Files\\Git\\bin\\bash.exe'
      ]),
      'win32'
    )
    expect(shells.map((shell) => shell.id)).toEqual(['cmd', 'powershell', 'git-bash'])
    expect(shells[0].systemDefault).toBe(true)
    expect(shells[1].systemDefault).toBe(false)
  })

  it('finds Git Bash under Program Files (x86) when the 64-bit install is absent', () => {
    const shells = detectShells(
      { ...winEnv, 'ProgramFiles(x86)': 'C:\\Program Files (x86)' },
      fakeProbe(['C:\\Program Files (x86)\\Git\\bin\\bash.exe']),
      'win32'
    )
    expect(shells).toEqual([
      {
        id: 'git-bash',
        path: 'C:\\Program Files (x86)\\Git\\bin\\bash.exe',
        family: 'bash',
        systemDefault: false
      }
    ])
  })

  it('finds a per-user Git install under LOCALAPPDATA', () => {
    const shells = detectShells(
      { ...winEnv, LOCALAPPDATA: 'C:\\Users\\ana\\AppData\\Local' },
      fakeProbe(['C:\\Users\\ana\\AppData\\Local\\Programs\\Git\\bin\\bash.exe']),
      'win32'
    )
    expect(shells[0].id).toBe('git-bash')
  })

  it('omits every shell that is not installed rather than listing it disabled', () => {
    const shells = detectShells(winEnv, fakeProbe(['C:\\Windows\\System32\\cmd.exe']), 'win32')
    expect(shells.map((shell) => shell.id)).toEqual(['cmd'])
  })
})

describe('defaultShell / resolveShell', () => {
  const zsh: ShellInfo = { id: 'zsh', path: '/usr/bin/zsh', family: 'zsh', systemDefault: true }
  const bash: ShellInfo = { id: 'bash', path: '/bin/bash', family: 'bash', systemDefault: false }
  const fish: ShellInfo = {
    id: 'fish',
    path: '/usr/bin/fish',
    family: 'fish',
    systemDefault: false
  }

  it('automatic is the system default when there is one', () => {
    expect(defaultShell([bash, zsh, fish])?.id).toBe('zsh')
  })

  it('falls back to bash, then sh, then anything — never to nothing when a shell exists', () => {
    expect(defaultShell([fish, bash])?.id).toBe('bash')
    const sh: ShellInfo = { id: 'sh', path: '/bin/sh', family: 'sh', systemDefault: false }
    expect(defaultShell([fish, sh])?.id).toBe('sh')
    expect(defaultShell([fish])?.id).toBe('fish')
    expect(defaultShell([])).toBeNull()
  })

  it('resolves the persisted choice when it is still installed', () => {
    expect(resolveShell('fish', [zsh, bash, fish])?.id).toBe('fish')
  })

  it('falls back to automatic when the chosen shell is gone (D-AT-4)', () => {
    // Git Bash uninstalled between two launches: every turn must keep working.
    expect(resolveShell('git-bash', [zsh, bash])?.id).toBe('zsh')
  })

  it('treats null as automatic', () => {
    expect(resolveShell(null, [bash, zsh])?.id).toBe('zsh')
  })
})

describe('shellSpawnTarget', () => {
  const bash: ShellInfo = { id: 'bash', path: '/bin/bash', family: 'bash', systemDefault: false }
  const cmd: ShellInfo = {
    id: 'cmd',
    path: 'C:\\Windows\\System32\\cmd.exe',
    family: 'cmd',
    systemDefault: true
  }
  const pwsh: ShellInfo = {
    id: 'pwsh',
    path: 'C:\\pwsh.exe',
    family: 'powershell',
    systemDefault: false
  }

  it('POSIX: execs the CLI so kill() reaches it and not just the shell', () => {
    const target = shellSpawnTarget(bash, '/usr/bin/claude', ['-p', 'oi'])
    expect(target.command).toBe('/bin/bash')
    expect(target.args[0]).toBe('-c')
    expect(target.args[1]).toBe(`exec '/usr/bin/claude' '-p' 'oi'`)
  })

  it('POSIX: never sources a profile (no -l/-i), so no rc banner lands in stdout', () => {
    const target = shellSpawnTarget(bash, '/usr/bin/claude', [])
    expect(target.args).not.toContain('-l')
    expect(target.args).not.toContain('-i')
    expect(target.args).not.toContain('-lc')
  })

  it('POSIX: a prompt full of shell metacharacters survives as one argument', () => {
    const prompt = `rode $(rm -rf /) && echo 'oi' \`whoami\` "aspas"`
    const target = shellSpawnTarget(bash, '/usr/bin/claude', ['-p', prompt])
    expect(target.args[1]).toBe(`exec '/usr/bin/claude' '-p' '${prompt.replace(/'/g, `'\\''`)}'`)
    // The single-quoted form is what makes the substitution inert.
    expect(target.args[1]).not.toMatch(/\$\(rm -rf \/\)(?![^']*')/)
  })

  it('cmd: goes through /d /s /c with both parsing passes escaped', () => {
    const target = shellSpawnTarget(cmd, 'C:\\npm\\claude.cmd', ['-p', 'a & b'])
    expect(target.command).toBe('C:\\Windows\\System32\\cmd.exe')
    expect(target.args.slice(0, 3)).toEqual(['/d', '/s', '/c'])
    expect(target.windowsVerbatimArguments).toBe(true)
    // The `&` is carets-escaped, so the prompt is not truncated into a second command.
    expect(target.args[3]).toContain('^&')
  })

  it('PowerShell: no profile, non-interactive, UTF-8 pinned, exit code preserved', () => {
    const target = shellSpawnTarget(pwsh, 'C:\\npm\\claude.cmd', ['-p', 'oi'])
    expect(target.args).toContain('-NoProfile')
    expect(target.args).toContain('-NonInteractive')
    const script = target.args[target.args.length - 1]
    expect(script).toContain('[Console]::OutputEncoding=[Text.Encoding]::UTF8')
    expect(script).toContain(`& 'C:\\npm\\claude.cmd' '-p' 'oi'`)
    expect(script.endsWith('exit $LASTEXITCODE')).toBe(true)
  })

  /**
   * The regression that measurement found, and the reason this escaping is
   * not cosmetic: run through real `powershell.exe` 5.1 WITHOUT it, the
   * prompt `{"json": "sim"}` reached the target process as `{json: sim}` —
   * PowerShell dropped the quotes while re-quoting for the native call. No
   * error, no warning: the agent just received a different message than the
   * user typed.
   */
  it('PowerShell: a double quote in the prompt is pre-escaped for the native argv parse', () => {
    const target = shellSpawnTarget(pwsh, 'C:\\claude.exe', ['-p', '{"json": "sim"}'])
    expect(target.args[target.args.length - 1]).toContain(`'{\\"json\\": \\"sim\\"}'`)
  })

  it('PowerShell: a trailing backslash is doubled so it cannot escape the re-added quote', () => {
    const target = shellSpawnTarget(pwsh, 'C:\\claude.exe', ['-p', 'C:\\dir\\'])
    expect(target.args[target.args.length - 1]).toContain(`'C:\\dir\\\\'`)
  })

  it('PowerShell: an apostrophe in the prompt is doubled, not left to end the string', () => {
    const target = shellSpawnTarget(pwsh, 'C:\\claude.exe', ['-p', "d'água"])
    expect(target.args[target.args.length - 1]).toContain("'d''água'")
  })
})

describe('quoting helpers', () => {
  it('POSIX quoting closes and reopens around an embedded single quote', () => {
    expect(quotePosixArgument("d'água")).toBe(`'d'\\''água'`)
  })

  it('PowerShell quoting doubles an embedded single quote', () => {
    expect(quotePowerShellArgument("d'água")).toBe("'d''água'")
  })
})

describe('shellSpawnEnv', () => {
  it('exports SHELL for a POSIX shell — the variable every CLI falls back to', () => {
    expect(
      shellSpawnEnv({ id: 'zsh', path: '/usr/bin/zsh', family: 'zsh', systemDefault: true })
    ).toEqual({ SHELL: '/usr/bin/zsh' })
  })

  it('exports ComSpec for cmd', () => {
    expect(
      shellSpawnEnv({ id: 'cmd', path: 'C:\\cmd.exe', family: 'cmd', systemDefault: true })
    ).toEqual({ ComSpec: 'C:\\cmd.exe' })
  })

  it('adds nothing generic for PowerShell (there is no such convention to honour)', () => {
    expect(
      shellSpawnEnv({
        id: 'pwsh',
        path: 'C:\\pwsh.exe',
        family: 'powershell',
        systemDefault: false
      })
    ).toEqual({})
  })
})
