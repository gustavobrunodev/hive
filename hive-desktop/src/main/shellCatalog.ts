import { readFileSync, realpathSync, statSync } from 'fs'
import { basename, join, win32 } from 'path'
import { cliPath, escapeCmdArgument, resolveExecutable, type SpawnTarget } from './cliEnv'

/**
 * Which terminal the agent runs in (agent-terminal, AT-R1..AT-R3).
 *
 * Until this module, the app never chose: `spawn(command, args)` went out with
 * no shell at all, except in the one case Node refuses without one — an npm
 * `.cmd` shim on Windows, routed through `cmd.exe` by `cliEnv.spawnTarget`. So
 * Windows already ran every agent turn inside cmd, by accident of packaging,
 * with nothing on screen saying so and no way to pick differently.
 *
 * Three jobs live here, all pure over an injected environment so they can be
 * tested on a machine that has none of the shells they describe:
 *
 *  1. **`detectShells`** — what is actually installed, with the absolute path
 *     that was found. Same standard of evidence as `AgentPicker`'s `--version`
 *     line: a list that named a shell we hadn't found would be the whole bug
 *     this feature exists to avoid, one level down.
 *  2. **`resolveShell`** — the id the user picked, or the platform default
 *     (Windows → `cmd`, POSIX → their `$SHELL`), and never a shell that is no
 *     longer on disk (D-AT-4: an uninstalled Git Bash falls back to automatic
 *     instead of failing every turn).
 *  3. **`shellSpawnTarget`** — how to actually run a command *inside* that
 *     shell. Three invariants, each of which has broken software like this
 *     before: no profile/rc is sourced (a banner lands in the stdout the
 *     `stream-json` parser reads), POSIX uses `exec` (otherwise `kill()` kills
 *     the shell and leaves the CLI running — the stop button stops nothing),
 *     and the exit code is preserved (otherwise a failed turn reports as done).
 *
 * What this module deliberately does NOT know: anything about a specific agent
 * CLI. Translating "the user picked zsh" into `CLAUDE_CODE_SHELL` is the
 * adapter's job (AT-R4, and the repo's "desacople o agente" rule).
 */

/**
 * The shell's language family — what decides how a command line is quoted and
 * which agent CLIs can honour it. Deliberately coarser than the id (`pwsh` and
 * `powershell` are both `powershell`) and finer than the platform (`bash` and
 * `zsh` differ, because Claude's `CLAUDE_CODE_SHELL` accepts exactly those two
 * and nothing else).
 */
export type ShellFamily = 'cmd' | 'powershell' | 'bash' | 'zsh' | 'fish' | 'sh'

/** One shell found on this machine. `id` is the stable key persisted in config and used by the UI. */
export interface ShellInfo {
  /** Stable id: `cmd`, `powershell`, `pwsh`, `git-bash`, `bash`, `zsh`, `fish`, `sh`, … */
  id: string
  /** The absolute path the detection actually found — the evidence, shown in the picker. */
  path: string
  family: ShellFamily
  /**
   * Whether this is what the machine would use on its own: the user's `$SHELL`
   * in POSIX, `cmd` on Windows. Exactly what "Automático" resolves to, which is
   * why the picker can label it instead of asking the user to guess.
   */
  systemDefault: boolean
}

/** POSIX shell binaries this app recognizes, mapped to their family. Anything else in `/etc/shells` is skipped. */
const POSIX_FAMILIES: Record<string, ShellFamily> = {
  bash: 'bash',
  zsh: 'zsh',
  fish: 'fish',
  sh: 'sh',
  dash: 'sh',
  ksh: 'sh'
}

/** Where POSIX shells live, in preference order (first hit per id wins). */
const POSIX_BIN_DIRS = ['/bin', '/usr/bin', '/usr/local/bin', '/opt/homebrew/bin', '/opt/local/bin']

/** `/etc/shells` — the OS's own list of valid login shells, and the only source that knows about oddball installs. */
const ETC_SHELLS = '/etc/shells'

/** Injected filesystem seam, so detection is testable without owning the machine's real shells. */
export interface ShellProbe {
  exists(path: string): boolean
  /** The file `/etc/shells`, or `null` when it isn't readable (macOS has it; a container may not). */
  readEtcShells(): string | null
  /** Resolves symlinks so `/bin/bash` and `/usr/bin/bash` don't list twice; falls back to the input. */
  realpath(path: string): string
}

export const defaultShellProbe: ShellProbe = {
  exists(path) {
    try {
      return statSync(path).isFile()
    } catch {
      return false
    }
  },
  readEtcShells() {
    try {
      return readFileSync(ETC_SHELLS, 'utf-8')
    } catch {
      return null
    }
  },
  realpath(path) {
    try {
      return realpathSync(path)
    } catch {
      return path
    }
  }
}

/** Every candidate path from `/etc/shells`, comments and non-shell entries (`tmux`, `screen`) dropped. */
function etcShellPaths(probe: ShellProbe): string[] {
  const contents = probe.readEtcShells()
  if (contents === null) return []
  return contents
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#'))
    .filter((line) => POSIX_FAMILIES[basename(line)] !== undefined)
}

/**
 * The POSIX shells on this machine, deduplicated by id.
 *
 * Three sources, in preference order, because each one alone misses real
 * setups: the user's `$SHELL` (the answer to "what do I actually use?", and on
 * a homebrew/nix machine the only place that path appears), `/etc/shells` (the
 * OS's own list), and the well-known prefixes (a container with no
 * `/etc/shells` still has `/bin/sh`). Deduplication is by **realpath**, so a
 * distro where `/bin/bash` is a symlink to `/usr/bin/bash` lists bash once.
 */
function detectPosixShells(env: NodeJS.ProcessEnv, probe: ShellProbe): ShellInfo[] {
  const loginShell = typeof env.SHELL === 'string' ? env.SHELL.trim() : ''
  const candidates = [
    ...(loginShell === '' ? [] : [loginShell]),
    ...etcShellPaths(probe),
    ...POSIX_BIN_DIRS.flatMap((dir) => Object.keys(POSIX_FAMILIES).map((name) => join(dir, name)))
  ]

  const byId = new Map<string, ShellInfo>()
  const seenTargets = new Set<string>()
  for (const path of candidates) {
    const name = basename(path)
    const family = POSIX_FAMILIES[name]
    if (!family || !probe.exists(path)) continue
    const target = probe.realpath(path)
    // `dash` and `ksh` are their own ids but the `sh` family; a machine where
    // /bin/sh IS dash must not list the same binary twice under two names.
    if (byId.has(name) || seenTargets.has(target)) continue
    seenTargets.add(target)
    byId.set(name, { id: name, path, family, systemDefault: path === loginShell })
  }
  return [...byId.values()]
}

/** Where Git for Windows puts `bash.exe`, in the order the Claude CLI's own detection uses. */
function gitBashPaths(env: NodeJS.ProcessEnv): string[] {
  const programFiles = env.ProgramFiles ?? 'C:\\Program Files'
  const programFilesX86 = env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)'
  const localAppData = env.LOCALAPPDATA
  // `win32.join`, not `join`: these paths are Windows paths whether or not the
  // process building them runs on Windows, and `join` would answer with
  // forward slashes under the test runner — a detector that only works on the
  // platform it can't be tested on is the one this feature must not ship.
  return [
    win32.join(programFiles, 'Git', 'bin', 'bash.exe'),
    win32.join(programFilesX86, 'Git', 'bin', 'bash.exe'),
    ...(localAppData ? [win32.join(localAppData, 'Programs', 'Git', 'bin', 'bash.exe')] : [])
  ]
}

/**
 * The Windows shells, in the order the picker shows them: cmd first (it is the
 * platform default per D-AT-2), then the two PowerShells, then Git Bash.
 *
 * `pwsh` (PowerShell 7+) is looked up on `PATH` rather than at a fixed path —
 * it ships from the Store, MSI, winget and dotnet-tool, each with its own
 * location, and the widened `PATH` from `cliEnv` is what finds all of them.
 */
function detectWindowsShells(env: NodeJS.ProcessEnv, probe: ShellProbe): ShellInfo[] {
  const shells: ShellInfo[] = []
  const systemRoot = env.SystemRoot ?? 'C:\\Windows'

  const comSpec = env.ComSpec ?? win32.join(systemRoot, 'System32', 'cmd.exe')
  if (probe.exists(comSpec)) {
    shells.push({ id: 'cmd', path: comSpec, family: 'cmd', systemDefault: true })
  }

  const powershell = win32.join(
    systemRoot,
    'System32',
    'WindowsPowerShell',
    'v1.0',
    'powershell.exe'
  )
  if (probe.exists(powershell)) {
    shells.push({ id: 'powershell', path: powershell, family: 'powershell', systemDefault: false })
  }

  const pwsh = resolveExecutable('pwsh', cliPath(env), env)
  if (pwsh) {
    shells.push({ id: 'pwsh', path: pwsh, family: 'powershell', systemDefault: false })
  }

  const gitBash = gitBashPaths(env).find((path) => probe.exists(path))
  if (gitBash) {
    shells.push({ id: 'git-bash', path: gitBash, family: 'bash', systemDefault: false })
  }
  return shells
}

/**
 * Every shell available on this machine, in display order. Never throws and
 * never invents: a shell that isn't on disk isn't in the list, which is the
 * whole contract the picker rests on.
 */
export function detectShells(
  env: NodeJS.ProcessEnv = process.env,
  probe: ShellProbe = defaultShellProbe,
  platform: NodeJS.Platform = process.platform
): ShellInfo[] {
  return platform === 'win32' ? detectWindowsShells(env, probe) : detectPosixShells(env, probe)
}

/**
 * What "Automático" means on this machine (AT-R2): the shell the system would
 * use anyway — `cmd` on Windows (D-AT-2, and what already happens today via
 * the npm `.cmd` shim), the user's `$SHELL` in POSIX. Falls back down the
 * list — `bash`, then `sh`, then whatever exists — so a machine with an exotic
 * `$SHELL` still resolves to something rather than to nothing.
 */
export function defaultShell(shells: ShellInfo[]): ShellInfo | null {
  return (
    shells.find((shell) => shell.systemDefault) ??
    shells.find((shell) => shell.id === 'bash') ??
    shells.find((shell) => shell.id === 'sh') ??
    shells[0] ??
    null
  )
}

/**
 * The shell a turn actually runs in: the user's pick when it is still
 * installed, otherwise the automatic one (D-AT-4 — an uninstalled Git Bash
 * must not fail every turn; the saved id stays on disk so reinstalling
 * restores the choice).
 */
export function resolveShell(selectedId: string | null, shells: ShellInfo[]): ShellInfo | null {
  if (selectedId !== null) {
    const picked = shells.find((shell) => shell.id === selectedId)
    if (picked) return picked
  }
  return defaultShell(shells)
}

/**
 * Quotes one argument for a POSIX shell command line: single quotes, with the
 * classic `'\''` dance for an embedded single quote. Everything else — `$`,
 * backticks, `&&`, newlines, the user's whole prompt — is literal inside
 * single quotes, which is the point.
 */
export function quotePosixArgument(argument: string): string {
  return `'${argument.replace(/'/g, `'\\''`)}'`
}

/**
 * Quotes one argument for a PowerShell script — **two** escaping regimes, and
 * both are load-bearing (measured against the real `powershell.exe` 5.1 on
 * Windows, not inferred):
 *
 *  1. PowerShell's own parse: single quotes, an embedded one doubled. That is
 *    what keeps `$env:PATH`, `&` and `|` inert inside the user's prompt.
 *  2. **The native-command hand-off**: PowerShell re-quotes each argument for
 *    the exe it calls, and Windows PowerShell does it wrongly — it drops
 *    embedded double quotes and eats a trailing backslash. Measured: a prompt
 *    `{"json": "sim"}` arrived at the target process as `{json: sim}`. Not an
 *    error, no warning: the agent simply received a different message than the
 *    user wrote. Pre-escaping each `"` as `\"` (and doubling a backslash run
 *    that would otherwise escape one) makes the target's own CRT argv parse
 *    recover the original byte for byte — verified across four prompts
 *    including JSON, quotes, `&`, accents and a trailing `\`.
 */
export function quotePowerShellArgument(argument: string): string {
  const forNativeArgv = argument
    // A backslash run before a quote is doubled, then the quote is escaped.
    .replace(/(\\*)"/g, '$1$1\\"')
    // A trailing backslash run would otherwise escape the closing quote
    // PowerShell adds when it re-quotes.
    .replace(/(\\+)$/, '$1$1')
  return `'${forNativeArgv.replace(/'/g, "''")}'`
}

/**
 * Runs `command args` *inside* `shell` (AT-R3). `command` is expected to be an
 * already-resolved absolute path (`cliEnv.resolveExecutable`) — an unresolved
 * command is the caller's cue to spawn directly, so a missing CLI keeps
 * failing as the ordinary ENOENT that the availability probes already read
 * instead of turning into a shell error nobody models.
 *
 * Per family:
 *  - **cmd** — `/d` skips any registry AutoRun script (it would print into the
 *    stdout the stream-json parser reads), `/s` makes cmd strip exactly the
 *    outer quote pair; arguments go through the same two-pass escaping the
 *    npm-shim route already uses.
 *  - **powershell** — `-NoProfile` (no `$PROFILE` banner), `-NonInteractive`
 *    (never block a headless turn on a prompt), the output encoding pinned to
 *    UTF-8 (PowerShell otherwise re-decodes a native command's bytes with the
 *    console codepage and mangles every non-ASCII character in the transcript),
 *    and `exit $LASTEXITCODE` so a failed turn stays failed.
 *  - **bash/zsh/fish/sh** — `-c 'exec …'`. `exec` is not an optimization: it
 *    replaces the shell with the CLI, so the pid we hold is the pid we kill,
 *    and the stop button keeps working.
 */
export function shellSpawnTarget(shell: ShellInfo, command: string, args: string[]): SpawnTarget {
  if (shell.family === 'cmd') {
    return {
      command: shell.path,
      args: ['/d', '/s', '/c', `"${[command, ...args].map(escapeCmdArgument).join(' ')}"`],
      windowsVerbatimArguments: true
    }
  }
  if (shell.family === 'powershell') {
    // `&` is PowerShell's call operator and is the one token that must stay
    // unquoted; everything after it — the path included — is data.
    const call = `& ${[command, ...args].map(quotePowerShellArgument).join(' ')}`
    return {
      command: shell.path,
      args: [
        '-NoLogo',
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        `[Console]::OutputEncoding=[Text.Encoding]::UTF8; ${call}; exit $LASTEXITCODE`
      ]
    }
  }
  return {
    command: shell.path,
    args: ['-c', `exec ${[command, ...args].map(quotePosixArgument).join(' ')}`]
  }
}

/**
 * The environment additions every agent gets from the shell choice,
 * independent of which CLI it is: `SHELL` for a POSIX shell (the variable the
 * entire Unix world reads, including a CLI's own fallback detection) and
 * `ComSpec` for cmd. Agent-specific variables are the adapter's business
 * (AT-R4), not this module's.
 */
export function shellSpawnEnv(shell: ShellInfo): Record<string, string> {
  if (shell.family === 'cmd') return { ComSpec: shell.path }
  if (shell.family === 'powershell') return {}
  if (shell.id === 'git-bash') {
    return {
      SHELL: shell.path,
      // Git Bash is MSYS2, and MSYS2 rewrites any argument that *looks* like a
      // POSIX path before handing it to a native Windows exe. The agent's turn
      // goes out as `-p '<the user's message>'`, so a prompt that starts with a
      // slash — every BMAD slash command, `/bmad-prd` first among them —
      // arrives at claude.exe as `C:/Program Files/Git/bmad-prd`. Silent, and
      // it turns the workflow into gibberish. These two switch the mangling
      // off; both names exist because MSYS2 renamed the variable and honours
      // either.
      MSYS_NO_PATHCONV: '1',
      MSYS2_ARG_CONV_EXCL: '*'
    }
  }
  return { SHELL: shell.path }
}

/**
 * The spawn, rendered as the one line a person could paste into that terminal
 * themselves — what the picker shows under "ver o comando".
 *
 * Built from `shellSpawnTarget`, never re-derived: a preview that drifted from
 * the real argv would be a more convincing version of the bug this whole
 * feature exists to end.
 *
 * One transform is applied on top, and only for cmd: the caret escaping is
 * undone. Those carets are not part of the command — they are the
 * `windowsVerbatimArguments` transport, the layer that survives CreateProcess
 * so that *cmd itself* receives `"C:\…\claude.cmd" "-p" "…"`. Printing them
 * shows the user a string they can neither read nor reuse, while the
 * unescaped form is exactly what the shell runs and exactly what they would
 * type. The strip is `^X → X`, total and reversible, and it never touches the
 * POSIX or PowerShell targets, which carry no carets to begin with.
 */
export function shellCommandPreview(shell: ShellInfo, command: string, args: string[]): string {
  const target = shellSpawnTarget(shell, command, args)
  const line = [target.command, ...target.args].join(' ')
  return shell.family === 'cmd' ? line.replace(/\^(.)/g, '$1') : line
}
