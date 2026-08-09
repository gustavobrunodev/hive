import { spawn } from 'child_process'
import { cliEnv, spawnTarget } from './cliEnv'

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
 */
export function createProcessRunner(): ProcessRunner {
  function run(command: string, args: string[], opts?: RunOptions): ProcessHandle {
    const env = opts?.env ? { ...cliEnv(), ...opts.env } : cliEnv()
    const target = spawnTarget(command, args, env.PATH, env)
    const child = spawn(target.command, target.args, {
      cwd: opts?.cwd,
      env,
      windowsVerbatimArguments: target.windowsVerbatimArguments,
      // stdin is closed (`'ignore'` → /dev/null) rather than left as an open,
      // never-written pipe. Nothing this app spawns feeds stdin — the Claude
      // CLI gets its prompt via `-p <text>` and BMAD install runs
      // non-interactively (`--yes` + explicit flags, see bmadService.ts) — but
      // a dangling stdin pipe makes `claude -p` stall for 3s waiting on input
      // it will never get, printing "Warning: no stdin data received in 3s,
      // proceeding without it." Handing it an immediate EOF lets it proceed at
      // once and drops the warning. stdout/stderr stay piped so `output` still
      // streams. (If a future adapter needs interactive stdin, add a
      // pty-backed ProcessRunner per the ProcessHandle doc — don't reopen this
      // pipe.)
      stdio: ['ignore', 'pipe', 'pipe']
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
        child.kill(signal ?? 'SIGTERM')
      }
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

  function run(command: string, args: string[], opts?: RunOptions): ProcessHandle {
    calls.push({ command, args, opts })
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
        if (settled) return
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
    calls
  }
}
