import { execFileSync } from 'child_process'
import { accessSync, constants, existsSync, readdirSync, statSync } from 'fs'
import { homedir } from 'os'
import { delimiter, join, sep } from 'path'

/**
 * Where the CLIs actually are — the answer to "I installed Claude Code, why
 * doesn't Hive see it?".
 *
 * A desktop app is not a terminal. Launched from a `.desktop` entry, the Dock,
 * the Start menu or an AppImage, Electron inherits the **session** environment,
 * not the login shell's: no `.zshrc`, no `.bashrc`, no nvm/fnm/volta shim, no
 * `~/.local/bin`. `PATH` is often just `/usr/local/bin:/usr/bin:/bin`. Every
 * npm-global CLI this app drives (`claude`, `copilot`, `devin`, `npx`, `npm`)
 * lives outside that set on a normal machine, so `spawn('claude')` fails
 * ENOENT and the app concludes — honestly, from where it was standing, and
 * wrongly — that the agent isn't installed. Restarting doesn't help: the next
 * launch inherits the same thin environment.
 *
 * Two independent repairs, because either one alone still misses cases:
 *
 *  1. **`cliPath()`** widens `PATH` with the login shell's own value (asked
 *     once, via `$SHELL -lic`, so an nvm/fnm/asdf shim written in an rc file is
 *     included) plus the well-known install prefixes those managers use.
 *  2. **`resolveExecutable()`** resolves a bare command to an absolute path
 *     against that widened `PATH`. On Windows this is not an optimisation but
 *     the whole ballgame: npm installs its global CLIs as a trio of shims —
 *     `claude` (a POSIX `sh` script), `claude.cmd` and `claude.ps1` — and
 *     `CreateProcess`, handed `claude`, only ever appends `.exe`. It finds no
 *     such file and reports the CLI missing on a machine where
 *     `claude --version` works in every terminal. Resolving `PATHEXT`
 *     ourselves is what fixes that, and the extension-less shim is skipped
 *     there precisely because Windows cannot execute it.
 *  3. **`spawnTarget()`** closes the last Windows gap. Resolving to
 *     `claude.cmd` is still not enough: since Node 18.20 / 20.12
 *     (CVE-2024-27980) spawning a `.cmd` or `.bat` without a shell throws
 *     `EINVAL`. A batch shim therefore goes through `cmd.exe /d /s /c` with
 *     every argument escaped for **both** of cmd's parsing passes. That
 *     escaping is not a nicety: adapters pass the user's whole prompt as one
 *     argument, and an unescaped `&` would truncate the message and run the
 *     rest as a command.
 *
 * All three are applied centrally in `createProcessRunner`, so agent probes,
 * agent turns, `npx bmad-method`, git and the MCP probe get them at once.
 * Everything here is a pure function over an injected environment; only
 * `cliPath()` memoizes (the login-shell query costs a process).
 */

/** How long the login shell gets to print its `PATH` before we give up on it. */
const LOGIN_SHELL_TIMEOUT_MS = 3000

/** Sentinels around the printed `PATH` — an interactive rc file may print its own banner. */
const PATH_OPEN = '__HIVE_PATH_OPEN__'
const PATH_CLOSE = '__HIVE_PATH_CLOSE__'

/** Injected `execFileSync` (tests pass a stub; nothing else ever overrides it). */
export type ExecSync = (file: string, args: string[]) => string

/**
 * The login shell's `PATH`, or `null` when it can't be obtained (Windows, no
 * `$SHELL`, a shell that errors or hangs, an rc file that never returns).
 *
 * `-l -i -c` is deliberate: `-l` sources the login profile, `-i` the
 * interactive rc — nvm/fnm/rbenv-style managers write to whichever the user's
 * distro treats as canonical, and asking for only one misses half of real
 * setups. The cost is that an interactive shell may print a banner, hence the
 * sentinels: we read what's between them, not the whole of stdout.
 */
export function loginShellPath(
  env: NodeJS.ProcessEnv = process.env,
  exec: ExecSync = (file, args) =>
    execFileSync(file, args, {
      encoding: 'utf-8',
      timeout: LOGIN_SHELL_TIMEOUT_MS,
      stdio: ['ignore', 'pipe', 'ignore']
    })
): string | null {
  if (process.platform === 'win32') return null
  const shell = env.SHELL
  if (!shell) return null
  try {
    const out = exec(shell, ['-lic', `printf '%s%s%s' '${PATH_OPEN}' "$PATH" '${PATH_CLOSE}'`])
    const start = out.indexOf(PATH_OPEN)
    const end = out.indexOf(PATH_CLOSE)
    if (start === -1 || end === -1 || end < start) return null
    const value = out.slice(start + PATH_OPEN.length, end).trim()
    return value === '' ? null : value
  } catch {
    // A shell that isn't there, exits non-zero, or blows the timeout tells us
    // nothing about the CLIs — fall through to the well-known prefixes.
    return null
  }
}

/**
 * Every `<nvm>/versions/node/<version>/bin` on disk. nvm's shim is a shell
 * function,
 * so a GUI-launched app inherits no node at all; listing the installed
 * versions is the only way to find the npm-global bin without a shell.
 * Newest-first by directory name so a machine with several node versions
 * prefers the most recent CLI install.
 */
function nvmBinDirs(home: string, env: NodeJS.ProcessEnv): string[] {
  const root = env.NVM_DIR || join(home, '.nvm')
  const versions = join(root, 'versions', 'node')
  try {
    if (!statSync(versions).isDirectory()) return []
    return readdirSync(versions)
      .sort()
      .reverse()
      .map((version) => join(versions, version, 'bin'))
  } catch {
    return []
  }
}

/**
 * The install prefixes package managers use, in preference order. Not a
 * fallback for `loginShellPath` but a complement: a shell may be absent
 * (`SHELL` unset in a systemd-launched session) while the directories are
 * perfectly findable, and a user who installed with `--prefix` outside their
 * rc file has the reverse problem.
 */
/**
 * The Windows npm prefix, seen from inside WSL.
 *
 * WSL appends the Windows `PATH` to an **interactive** session's, which is how
 * `claude` installed with Windows npm is runnable from a WSL shell at all — and
 * exactly what a GUI-launched process (or a login shell started from one) never
 * inherits. Measured on this machine: `zsh -lic` recovers nvm, linuxbrew and
 * `~/.local/bin` from the rc files but **not** the `/mnt/c/...` entries, because
 * those were never in the rc files to begin with. So the one CLI the user
 * actually had stayed invisible even after the login-shell query.
 *
 * Last in preference order: a native Linux install always wins.
 */
function wslWindowsBinDirs(): string[] {
  if (process.platform !== 'linux') return []
  const users = '/mnt/c/Users'
  try {
    return readdirSync(users)
      .map((user) => join(users, user, 'AppData', 'Roaming', 'npm'))
      .filter((dir) => existsSync(dir))
  } catch {
    // Not WSL (or no C: mounted) — `/mnt/c/Users` simply isn't there.
    return []
  }
}

export function wellKnownBinDirs(
  env: NodeJS.ProcessEnv = process.env,
  home: string = homedir()
): string[] {
  if (process.platform === 'win32') {
    const appData = env.APPDATA ?? join(home, 'AppData', 'Roaming')
    const localAppData = env.LOCALAPPDATA ?? join(home, 'AppData', 'Local')
    return [
      join(appData, 'npm'),
      join(localAppData, 'Microsoft', 'WindowsApps'),
      join(env.ProgramFiles ?? 'C:\\Program Files', 'nodejs'),
      join(localAppData, 'Yarn', 'bin'),
      join(home, '.bun', 'bin')
    ]
  }
  return [
    join(home, '.local', 'bin'),
    join(home, 'bin'),
    ...nvmBinDirs(home, env),
    join(home, '.npm-global', 'bin'),
    join(home, '.npm-packages', 'bin'),
    join(home, '.volta', 'bin'),
    join(home, '.bun', 'bin'),
    join(home, '.deno', 'bin'),
    join(home, '.yarn', 'bin'),
    join(home, '.config', 'yarn', 'global', 'node_modules', '.bin'),
    join(home, '.cargo', 'bin'),
    '/usr/local/bin',
    '/opt/homebrew/bin',
    '/home/linuxbrew/.linuxbrew/bin',
    '/snap/bin',
    ...wslWindowsBinDirs()
  ]
}

/**
 * Builds the widened `PATH`: the inherited one first (so anything the user
 * *did* export still wins), then the login shell's, then the well-known
 * prefixes. Order matters — this only ever appends, so a deliberately
 * shadowed binary keeps whatever precedence the environment gave it.
 * Duplicates and non-existent directories are dropped.
 */
export function buildCliPath(
  env: NodeJS.ProcessEnv = process.env,
  options: { shellPath?: string | null; home?: string } = {}
): string {
  const home = options.home ?? homedir()
  const shellPath = options.shellPath === undefined ? loginShellPath(env) : options.shellPath
  const inherited = (env.PATH ?? '').split(delimiter)
  const candidates = [
    ...inherited,
    ...(shellPath ?? '').split(delimiter),
    ...wellKnownBinDirs(env, home)
  ]
  const inheritedKeys = new Set(inherited.map((dir) => dir.trim().replace(/[/\\]+$/, '')))

  const seen = new Set<string>()
  const dirs: string[] = []
  for (const raw of candidates) {
    const dir = raw.trim().replace(/[/\\]+$/, '') || raw.trim()
    if (dir === '') continue
    const key = process.platform === 'win32' ? dir.toLowerCase() : dir
    if (seen.has(key)) continue
    seen.add(key)
    // An inherited entry is kept even if it doesn't exist right now (a mount
    // that appears later is the user's business); the directories *we* add have
    // to be real, so we don't pad every later `spawn` with a search through a
    // dozen paths that were never there.
    if (!inheritedKeys.has(dir) && !existsSync(dir)) continue
    dirs.push(dir)
  }
  return dirs.join(delimiter)
}

let cachedPath: string | null = null

/**
 * The widened `PATH`, computed once per app run. Memoized because
 * `loginShellPath` spawns a shell, and because nothing that would change the
 * answer happens mid-run: installing a CLI writes into a prefix that is
 * already on this list, which is exactly why a fresh install is picked up by
 * a re-probe without a restart.
 */
export function cliPath(env: NodeJS.ProcessEnv = process.env): string {
  if (cachedPath === null) cachedPath = buildCliPath(env)
  return cachedPath
}

/** Test seam: forget the memoized `PATH` (never called in production). */
export function resetCliPathCache(): void {
  cachedPath = null
}

/** The environment CLI spawns get: the app's own, with `PATH` widened. */
export function cliEnv(env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  return { ...env, PATH: cliPath(env) }
}

function isExecutableFile(candidate: string): boolean {
  try {
    if (!statSync(candidate).isFile()) return false
  } catch {
    return false
  }
  if (process.platform === 'win32') return true
  try {
    accessSync(candidate, constants.X_OK)
    return true
  } catch {
    return false
  }
}

/**
 * The suffixes to try for `command`, in order.
 *
 * Off Windows there is exactly one: the name itself. On Windows the
 * extension-less candidate is tried **only** when the command already ends in
 * a `PATHEXT` entry (`node.exe`), because otherwise it would match npm's
 * extension-less `sh` shim — a real file that `CreateProcess` cannot run, so
 * "found" would turn straight into `EINVAL` at spawn time.
 */
function candidateExtensions(command: string, env: NodeJS.ProcessEnv): string[] {
  if (process.platform !== 'win32') return ['']
  const pathExt = (env.PATHEXT ?? '.COM;.EXE;.BAT;.CMD').split(';').filter(Boolean)
  const alreadyExecutable = pathExt.some((extension) =>
    command.toLowerCase().endsWith(extension.toLowerCase())
  )
  return alreadyExecutable ? [''] : pathExt
}

/**
 * Resolves a bare command name to an absolute path against `pathValue`, or
 * `null` when it isn't there. A command that already carries a path separator
 * is returned as-is when it exists (callers pass absolute paths for the E2E
 * stand-in binary).
 *
 * On Windows every `PATHEXT` suffix is tried, which is what makes npm's `.cmd`
 * shims findable at all — see this module's header.
 */
export function resolveExecutable(
  command: string,
  pathValue: string = cliPath(),
  env: NodeJS.ProcessEnv = process.env
): string | null {
  if (command === '') return null
  if (command.includes('/') || command.includes(sep)) {
    return existsSync(command) ? command : null
  }

  const extensions = candidateExtensions(command, env)
  for (const dir of pathValue.split(delimiter)) {
    if (dir.trim() === '') continue
    for (const extension of extensions) {
      const candidate = join(dir, command + extension)
      if (isExecutableFile(candidate)) return candidate
    }
  }
  return null
}

/** How to actually spawn a resolved command — fed straight into `spawn`. */
export interface SpawnTarget {
  command: string
  args: string[]
  /**
   * Set for the `cmd.exe` route below: `args` is already one pre-escaped
   * command line and libuv must not re-quote it.
   */
  windowsVerbatimArguments?: boolean
}

/**
 * Escapes one argument for a `cmd.exe /d /s /c` command line.
 *
 * `cmd.exe` parses the line twice — once as a shell, where `&`, `|`, `>`, `^`
 * and `%` are operators, and once as C-style argv, where quotes and backslash
 * runs matter. Both passes have to be satisfied, in that order: build the argv
 * token first, then hide every metacharacter (including the quotes we just
 * added) from the shell pass with a caret. Same two-stage scheme `cross-spawn`
 * uses, and the reason a prompt containing `&&` survives the trip intact.
 */
export function escapeCmdArgument(argument: string): string {
  const argv = `"${argument
    // A backslash run before a quote is doubled, then the quote is escaped.
    .replace(/(\\*)"/g, '$1$1\\"')
    // A backslash run at the very end would otherwise escape our closing quote.
    .replace(/(\\*)$/, '$1$1')}"`
  return argv.replace(/[()[\]{}^=;!'+,`~%!"<>&|\s]/g, '^$&')
}

/**
 * Turns "run `command` with `args`" into something `spawn` can execute on this
 * platform: the resolved absolute path, routed through `cmd.exe` when what we
 * resolved is a batch shim. An unresolvable command is passed through
 * untouched, so the failure stays the ordinary ENOENT that availability probes
 * already read — resolution repairs the lookup, it never adds a new way to
 * fail.
 */
export function spawnTarget(
  command: string,
  args: string[],
  pathValue: string = cliPath(),
  env: NodeJS.ProcessEnv = process.env
): SpawnTarget {
  const resolved = resolveExecutable(command, pathValue, env)
  if (!resolved) return { command, args }
  if (process.platform !== 'win32' || !/\.(cmd|bat)$/i.test(resolved)) {
    return { command: resolved, args }
  }
  return {
    command: env.ComSpec ?? 'cmd.exe',
    // `/d` skips any registry AutoRun script — one would otherwise print into
    // the stdout our stream-json parsers read; `/s` makes cmd strip exactly the
    // outer quote pair and take the rest of the line verbatim.
    args: ['/d', '/s', '/c', `"${[resolved, ...args].map(escapeCmdArgument).join(' ')}"`],
    windowsVerbatimArguments: true
  }
}
