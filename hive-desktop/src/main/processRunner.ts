import { spawn } from 'child_process'
import type { ChildProcess } from 'child_process'
import { statSync } from 'fs'
import { cliEnv, resolveExecutable, spawnTarget } from './cliEnv'
import { shellSpawnEnv, shellSpawnTarget, type ShellInfo } from './shellCatalog'

/**
 * Whether `dir` is a directory a process can actually be started in.
 *
 * This exists because of a failure mode that cost a whole round of debugging
 * and reads, from every surface above, as a **completely different bug**.
 *
 * `spawn(cmd, args, { cwd })` resolves `cwd` *before* it resolves the binary.
 * When the directory is gone, libuv reports `ENOENT` — and Node writes the
 * message as `spawn devin ENOENT`, naming the **command**, not the directory
 * that was actually missing. Measured on the reporter's machine: their
 * configured workspace had been deleted, and from there every single spawn
 * that carried it failed. What each caller concluded:
 *
 *   - `probeCommand` reads `{ code: null, signal: null }` as its ENOENT path
 *     → "the CLI isn't installed" → the agent card goes grey on a machine
 *     where `devin --version` answers instantly in any terminal.
 *   - `runCapture` sees a non-zero exit → returns `null` → the model catalog
 *     falls back to its seven hand-written rows with no effort ladders →
 *     "os modelos não são todos listados".
 *   - a turn fails in under a second with a message blaming the binary.
 *
 * One dead directory, three unrelated-looking symptoms, none of them
 * mentioning the directory. So the guard is here, at the one place every
 * spawn passes through, rather than in each caller: a `cwd` that isn't a
 * usable directory is **dropped**, and the process starts in the app's own
 * working directory instead of not starting at all.
 *
 * Dropping it is the right default for the read-only probes that make up most
 * callers — `devin models list` and `claude --version` answer the same
 * anywhere, and answering is strictly better than a spurious "not installed".
 * A turn is the one case where the directory is load-bearing, and
 * `cliAdapterCore` checks it up front so the user gets a message naming the
 * workspace instead of silently working in the wrong one.
 */
export function isUsableCwd(dir: string | undefined): boolean {
  if (dir === undefined || dir.trim() === '') return false
  try {
    return statSync(dir).isDirectory()
  } catch {
    return false
  }
}

/**
 * Uniform spawn/stream/kill abstraction for CLI processes driven from the
 * main process (BMAD install/update via `BmadService` (T8), the Claude CLI
 * via `ClaudeCliAdapter` (T13)). See design.md §2 "Module Responsibilities"
 * (`ProcessRunner`) and context.md decision C2 ("CLI execution model").
 *
 * A single chunk of output, tagged with which stream it came from so callers
 * can treat stdout/stderr uniformly (e.g. render both into one log/progress
 * feed) while still being able to tell them apart when it matters (e.g.
 * surfacing stderr as an error detail).
 */
export interface ProcessStreamChunk {
  stream: 'stdout' | 'stderr'
  data: string
}

/** How the process ended. `signal` is set when it was killed rather than exiting normally. */
export interface ProcessExitResult {
  code: number | null
  signal: NodeJS.Signals | null
}

export interface RunOptions {
  cwd?: string
  env?: Record<string, string>
  /**
   * Keep the child's stdin open as a writable pipe.
   *
   * Opt-in, and only one caller opts in: the ACP client, which speaks
   * newline-delimited JSON-RPC *to* the agent over stdin for the whole life of
   * the session. Everything else must keep the default (`'ignore'`), because a
   * dangling stdin pipe makes the one-shot CLIs wait three seconds for input
   * that never comes — the exact behaviour the `stdio` comment in `run`
   * documents.
   */
  stdin?: 'pipe'
  /**
   * agent-terminal (AT-R3 / D-AT-1): run this command *inside* the user's
   * chosen shell instead of spawning it directly. Opt-in per call, and only
   * the agent's own turns opt in — `git`, `npx bmad-method`, the MCP probe and
   * the `--version` availability probes each parse an exact stdout and none of
   * them is "the terminal the agent uses", so widening the blast radius would
   * be risk without a request.
   */
  shell?: boolean
  /**
   * `kill()` takes down the **whole process tree**, not just the process this
   * call started.
   *
   * This is what makes the Stop button work on Windows. `shellSpawnTarget`
   * covers POSIX with `exec` — the shell replaces itself with the CLI, same
   * pid, so a plain kill lands on the CLI — but there is no `exec` in `cmd` or
   * PowerShell. There the tree is `cmd.exe` → `claude.cmd` (an npm batch shim)
   * → `node`, and `child.kill()` reaped only `cmd.exe`: the CLI kept running,
   * kept spending tokens, and kept the inherited stdout pipe open, so Node's
   * `'close'` never fired, the turn never settled, and the transcript sat
   * "respondendo" forever. Clicking Stop looked like it did nothing because,
   * from the UI's side, it did.
   *
   * It matters on POSIX too, just less dramatically: `exec` puts the CLI at the
   * shell's pid, but the CLI's own children (a tool call shelling out) are
   * still separate processes that outlive it. A group kill reaches those.
   *
   * Opt-in for the same reason `shell` is: a one-shot `git status` has no tree
   * to speak of, and putting every probe in its own process group would be
   * blast radius with nothing asking for it.
   */
  processGroup?: boolean
}

/**
 * A running (or finished) process. `output` is an async-iterable of chunks in
 * the order they were produced; `exitCode` resolves once the process has
 * fully exited (after all output has been delivered). `kill()` is safe to
 * call multiple times / after the process has already exited (no-op).
 *
 * Deliberately deferred extension point (see context.md C2, design.md §9
 * risks): a pty-backed implementation for interactive CLI prompts is not
 * needed for BMAD (T0 verified `bmad-method install` is fully
 * non-interactive) and is out of scope here. If a future adapter genuinely
 * needs one (e.g. an interactive Claude CLI flow), add a sibling
 * `createPtyProcessRunner` implementing this exact same `ProcessRunner`
 * interface — callers written against `ProcessRunner`/`ProcessHandle` need no
 * changes. No `pty` option is threaded through `run()` today because there is
 * nothing yet for it to configure; adding an unimplemented option now would
 * just be a trap for callers.
 */
export interface ProcessHandle {
  readonly output: AsyncIterable<ProcessStreamChunk>
  readonly exitCode: Promise<ProcessExitResult>
  kill(signal?: NodeJS.Signals): void
  /**
   * Writes to the child's stdin. Present **only** when the call opted in with
   * `stdin: 'pipe'`; every other spawn gets `/dev/null` on stdin and no
   * `write` here, which is what keeps the one-shot CLIs from stalling three
   * seconds waiting for input nobody will send (see the `stdio` comment in
   * `run`). Returns `false` when the pipe is already gone.
   */
  write?(chunk: string): boolean
}

/**
 * Kills `child` and everything it started.
 *
 * Three platforms, three mechanisms, one meaning — and none of them is the
 * plain `child.kill()` this used to be:
 *
 * - **POSIX, in its own group** (`processGroup`): signal the *negative* pid,
 *   which POSIX defines as "every process in that group". This is the only
 *   form that reaches a CLI running under a shell wrapper.
 * - **Windows**: no process groups to signal, so `taskkill /T /F` walks the
 *   child tree by pid. Spawned detached and ignored — its own exit is of no
 *   interest, and an error here must never take the app with it.
 * - **Anything else**: the direct child, exactly as before.
 *
 * Every path swallows its errors. Killing an already-dead process is the
 * normal case (a second click, an escalation timer that lost a race), and
 * `process.kill` answers that with a thrown ESRCH — which the documented
 * "safe to call after exit" contract says callers must never see.
 */
function killTree(child: ChildProcess, signal: NodeJS.Signals, processGroup: boolean): void {
  const pid = child.pid
  if (pid === undefined) return
  try {
    if (process.platform === 'win32') {
      const force = signal === 'SIGKILL' ? ['/f'] : []
      spawn('taskkill', ['/pid', String(pid), '/t', ...force], {
        stdio: 'ignore',
        windowsHide: true,
        detached: true
      }).unref()
      return
    }
    if (processGroup) {
      process.kill(-pid, signal)
      return
    }
    child.kill(signal)
  } catch {
    // Already gone — see the doc above.
  }
}

export interface ProcessRunner {
  run(command: string, args: string[], opts?: RunOptions): ProcessHandle
}

/**
 * A small single-producer/multi-... (here: single-) consumer async queue.
 * `push` never blocks; `end` marks no more items will come. Consumers can
 * start iterating before any items are pushed (they'll just await the first
 * one), and items pushed before iteration starts are buffered.
 */
function createAsyncQueue<T>(): {
  push(item: T): void
  end(): void
  [Symbol.asyncIterator](): AsyncIterator<T>
} {
  const buffer: T[] = []
  const waiting: Array<(result: IteratorResult<T>) => void> = []
  let ended = false

  return {
    push(item: T): void {
      const resolve = waiting.shift()
      if (resolve) {
        resolve({ value: item, done: false })
      } else {
        buffer.push(item)
      }
    },
    end(): void {
      ended = true
      while (waiting.length > 0) {
        waiting.shift()!({ value: undefined as unknown as T, done: true })
      }
    },
    [Symbol.asyncIterator](): AsyncIterator<T> {
      return {
        next(): Promise<IteratorResult<T>> {
          if (buffer.length > 0) {
            return Promise.resolve({ value: buffer.shift() as T, done: false })
          }
          if (ended) {
            return Promise.resolve({ value: undefined as unknown as T, done: true })
          }
          return new Promise((resolve) => waiting.push(resolve))
        }
      }
    }
  }
}

/**
 * Creates a `ProcessRunner` backed by Node's `child_process.spawn`. This is
 * the implementation wired into real main-process services; it has no
 * `electron` dependency, only Node built-ins.
 *
 * Every spawn goes out with the **widened** environment from `cliEnv.ts`, with
 * the command resolved against it, and — on Windows, for an npm `.cmd` shim —
 * routed through `cmd.exe`. A desktop app launched from a launcher rather than
 * a terminal inherits a `PATH` holding none of the npm-global prefixes the CLIs
 * this app drives live in, and on Windows `spawn` cannot execute those shims at
 * all; without this, an installed `claude` reads as "not installed" and every
 * `npx`-backed BMAD flow fails the same way. See `cliEnv.ts` for the account.
 *
 * A command that can't be resolved is still spawned verbatim, so the failure
 * stays the ordinary ENOENT (`{ code: null }`) that availability probes and
 * error surfaces already understand — resolution repairs the lookup, it never
 * becomes a second, different way to fail.
 *
 * agent-terminal: a call that passes `shell: true` runs inside the shell the
 * user chose (`deps.shell`), which is how "escolher o terminal do agente"
 * becomes a real property of the process rather than a label. Everything else
 * keeps spawning exactly as before.
 */
export interface ProcessRunnerDeps {
  /**
   * agent-terminal: the shell chosen for agent turns, read fresh per spawn so
   * a change in the profile sheet applies to the next turn without a restart.
   * Absent (or returning `null`) keeps the pre-feature behavior — direct
   * spawn, `cliEnv`'s widened `PATH`, the npm `.cmd` route on Windows.
   */
  shell?: () => ShellInfo | null
}

/**
 * Composes the final spawn target for one call: the ordinary resolved target,
 * or that same resolved executable run *inside* the chosen shell when the
 * caller opted in and a shell is selected.
 *
 * The command is resolved first, and an unresolvable one skips the shell
 * entirely: keeping the failure as the plain ENOENT the availability probes
 * already understand beats inventing a second, shell-shaped way to fail (the
 * exact contract `cliEnv.spawnTarget` documents for its own fallback).
 */
function composeTarget(
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv,
  shell: ShellInfo | null
): ReturnType<typeof spawnTarget> {
  if (shell) {
    const resolved = resolveExecutable(command, env.PATH, env)
    if (resolved) return shellSpawnTarget(shell, resolved, args)
  }
  return spawnTarget(command, args, env.PATH, env)
}

/**
 * The `cwd` and `stdio` half of the spawn options.
 *
 * stdin is closed (`'ignore'` → /dev/null) rather than left as an open,
 * never-written pipe. Nothing this app spawns feeds stdin — the Claude CLI
 * gets its prompt via `-p <text>` and BMAD install runs non-interactively
 * (`--yes` + explicit flags, see bmadService.ts) — but a dangling stdin pipe
 * makes `claude -p` stall for 3s waiting on input it will never get, printing
 * "Warning: no stdin data received in 3s, proceeding without it." Handing it an
 * immediate EOF lets it proceed at once and drops the warning. stdout/stderr
 * stay piped so `output` still streams. The one exception is an explicit
 * `stdin: 'pipe'`, which the ACP client uses to hold a JSON-RPC conversation
 * with a long-lived agent. (If a future adapter needs *interactive* stdin, add
 * a pty-backed ProcessRunner per the ProcessHandle doc — don't reopen this.)
 *
 * `cwd` is dropped when it is not a usable directory: libuv resolves it before
 * the binary and reports the failure as an ENOENT naming the *command*, which
 * every caller above reads as "the CLI is missing". See `isUsableCwd`.
 */
function spawnStdio(opts?: RunOptions): {
  cwd: string | undefined
  stdio: ['pipe' | 'ignore', 'pipe', 'pipe']
} {
  return {
    cwd: isUsableCwd(opts?.cwd) ? opts?.cwd : undefined,
    stdio: [opts?.stdin === 'pipe' ? 'pipe' : 'ignore', 'pipe', 'pipe']
  }
}

/**
 * The `write` half of a `stdin: 'pipe'` handle.
 *
 * Swallows a write to a pipe that has already gone: the agent exiting between
 * the check and the write is an ordinary race, and the caller learns *why*
 * from `exitCode` — the one place that knows. A throw here would only lose it.
 */
function stdinWriter(child: ChildProcess): (chunk: string) => boolean {
  return (chunk: string): boolean => {
    const stdin = child.stdin
    if (!stdin || stdin.destroyed) return false
    try {
      return stdin.write(chunk)
    } catch {
      return false
    }
  }
}

export function createProcessRunner(deps: ProcessRunnerDeps = {}): ProcessRunner {
  function run(command: string, args: string[], opts?: RunOptions): ProcessHandle {
    const shell = opts?.shell === true ? (deps.shell?.() ?? null) : null
    // The shell's own variables (`SHELL`, `ComSpec`) sit under `opts.env`, so
    // an adapter's agent-specific binding — which is where `CLAUDE_CODE_*`
    // lives — still wins over the generic ones.
    const env = { ...cliEnv(), ...(shell ? shellSpawnEnv(shell) : {}), ...opts?.env }
    const target = composeTarget(command, args, env, shell)
    // `detached` is what creates the process group `killTree` signals. Only on
    // POSIX: on Windows the same flag opens a console window instead, and the
    // tree walk there is `taskkill`'s job anyway.
    const processGroup = opts?.processGroup === true && process.platform !== 'win32'
    const child = spawn(target.command, target.args, {
      ...spawnStdio(opts),
      env,
      detached: processGroup,
      windowsVerbatimArguments: target.windowsVerbatimArguments
    })

    const queue = createAsyncQueue<ProcessStreamChunk>()
    let resolveExit: (result: ProcessExitResult) => void
    const exitCode = new Promise<ProcessExitResult>((resolve) => {
      resolveExit = resolve
    })

    child.stdout?.on('data', (chunk: Buffer) => {
      queue.push({ stream: 'stdout', data: chunk.toString('utf-8') })
    })
    child.stderr?.on('data', (chunk: Buffer) => {
      queue.push({ stream: 'stderr', data: chunk.toString('utf-8') })
    })

    // 'close' (not 'exit') fires after stdio streams have finished emitting
    // 'data', guaranteeing every chunk has already been queued by the time
    // consumers observe the exit result.
    child.on('close', (code, signal) => {
      queue.end()
      resolveExit({ code, signal })
    })

    // The process never started (e.g. command not found, EACCES). Surface it
    // as a completed-with-no-exit-code process rather than leaving callers
    // hanging forever.
    child.on('error', () => {
      queue.end()
      resolveExit({ code: null, signal: null })
    })

    return {
      output: queue,
      exitCode,
      kill(signal?: NodeJS.Signals): void {
        killTree(child, signal ?? 'SIGTERM', processGroup)
      },
      ...(opts?.stdin === 'pipe' ? { write: stdinWriter(child) } : {})
    }
  }

  return { run }
}

// ---------------------------------------------------------------------------
// Fake runner — for unit tests of anything that depends on ProcessRunner
// (BmadService T8, ClaudeCliAdapter T13). Exported from this same module so
// consumers `import { createFakeProcessRunner } from './processRunner'`
// rather than reaching into a test-only file.
// ---------------------------------------------------------------------------

/** One scripted invocation's worth of canned behavior. */
export interface FakeProcessScript {
  /** Chunks delivered, in order, via `output`. Defaults to none. */
  chunks?: ProcessStreamChunk[]
  /** Exit code reported once chunks are delivered. Defaults to 0. */
  code?: number | null
  /** Exit signal reported. Defaults to null (normal exit). */
  signal?: NodeJS.Signals | null
  /**
   * Optional delay (ms) before chunks start flowing / before exit resolves,
   * for tests exercising "still running" states (e.g. a `kill()` mid-flight).
   * When omitted, chunks/exit resolve on the next microtask.
   */
  delayMs?: number
  /**
   * Simulates a process that never started (command not found / EACCES),
   * mirroring the real runner's `child.on('error')` path: no chunks, exit
   * resolves to `{ code: null, signal: null }`. Used by availability probes
   * (agentRegistry) to detect a missing CLI binary.
   */
  spawnError?: boolean
  /**
   * Simulates the process that made the Stop button look broken: it takes the
   * signal and keeps its output pipe open anyway.
   *
   * That is not a hypothetical. An agent turn runs *inside a shell*, so the CLI
   * is a grandchild; a kill aimed at the shell never reached it, and because the
   * CLI still held the inherited stdout, Node's `'close'` never fired and the
   * turn's exit never resolved. Any test that scripts a well-behaved kill
   * cannot see that bug — the fake would settle the turn all by itself and the
   * assertion would pass against a broken app.
   *
   * `kill()` is still recorded on the call, so a test can assert what was sent.
   */
  ignoresKill?: boolean
}

/** Record of a single `run()` invocation, for assertions in tests. */
export interface FakeProcessCall {
  command: string
  args: string[]
  opts?: RunOptions
}

export interface FakeProcessRunner extends ProcessRunner {
  /** Queues a script; the next `run()` call consumes it (FIFO). */
  script(script: FakeProcessScript): void
  /** Every `run()` invocation so far, in call order. */
  readonly calls: FakeProcessCall[]
  /**
   * The signals each call's handle received, in order and indexed alongside
   * `calls` — `kill()` with no argument records `SIGTERM`.
   *
   * A sibling array rather than a field on `FakeProcessCall`, so the many
   * existing `expect(runner.calls).toEqual([...])` assertions keep describing
   * the spawn and nothing else.
   */
  readonly kills: NodeJS.Signals[][]
}

/**
 * Creates a `ProcessRunner` that never spawns a real process. Tests call
 * `.script(...)` (possibly multiple times, for services that invoke `run()`
 * more than once) before triggering the code under test; each `run()` call
 * consumes the next queued script FIFO. If `run()` is called with nothing
 * queued, it behaves like an immediately-successful no-output process (exit
 * code 0) — a reasonable default so tests that don't care about a particular
 * invocation don't have to script it.
 */
export function createFakeProcessRunner(): FakeProcessRunner {
  const scripts: FakeProcessScript[] = []
  const calls: FakeProcessCall[] = []
  const kills: NodeJS.Signals[][] = []

  function run(command: string, args: string[], opts?: RunOptions): ProcessHandle {
    calls.push({ command, args, opts })
    const sent: NodeJS.Signals[] = []
    kills.push(sent)
    const script = scripts.shift() ?? {}
    const chunks = script.chunks ?? []

    const queue = createAsyncQueue<ProcessStreamChunk>()
    let resolveExit: (result: ProcessExitResult) => void
    let settled = false
    const exitCode = new Promise<ProcessExitResult>((resolve) => {
      resolveExit = resolve
    })

    function deliver(): void {
      if (settled) return // already killed before the scripted delay elapsed
      if (script.spawnError) {
        // Mirror the real runner's ENOENT/EACCES path: no output, no exit code.
        queue.end()
        settled = true
        resolveExit({ code: null, signal: null })
        return
      }
      for (const chunk of chunks) {
        queue.push(chunk)
      }
      queue.end()
      settled = true
      resolveExit({ code: script.code ?? 0, signal: script.signal ?? null })
    }

    if (script.delayMs && script.delayMs > 0) {
      setTimeout(deliver, script.delayMs)
    } else {
      queueMicrotask(deliver)
    }

    return {
      output: queue,
      exitCode,
      kill(signal?: NodeJS.Signals): void {
        sent.push(signal ?? 'SIGTERM')
        if (settled || script.ignoresKill) return
        settled = true
        queue.end()
        resolveExit({ code: null, signal: signal ?? 'SIGTERM' })
      }
    }
  }

  return {
    run,
    script(scriptEntry: FakeProcessScript): void {
      scripts.push(scriptEntry)
    },
    calls,
    kills
  }
}
