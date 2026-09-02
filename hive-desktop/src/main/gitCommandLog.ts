/**
 * The git command journal — every `git` the app runs, with what it cost and
 * what it said when it failed.
 *
 * ## Why this exists
 *
 * `GitService` already surfaces git's stderr on the *one* call that failed
 * (`GitError`, D-GIT-1). That is the right thing for the user and it is not
 * enough for debugging, because the interesting failures are almost never the
 * command that reported them:
 *
 *  - a push that asks for credentials fails *after* a fetch already worked, and
 *    the difference between them is the remote it resolved;
 *  - a status that comes back empty is a lie about the workspace only if you
 *    can see it ran in the wrong `cwd`;
 *  - "the panel is slow" is a timing question, and no single error carries a
 *    timing.
 *
 * So the record is the *sequence*: which command, in which directory, how long
 * it took, how it ended. VS Code's Git output channel is the same instrument
 * and it is the one people already know how to read.
 *
 * ## Why a bounded buffer in main
 *
 * Main is where the commands are; the window is a subscriber that may not exist
 * yet (the console is closed until someone opens it) and may be replaced (a
 * reload). Keeping the journal here is what lets the console open onto history
 * instead of onto "nothing has happened since you looked".
 *
 * Bounded because a long session on a watched workspace runs a `status` per
 * burst of file writes, and an unbounded array of those is a leak with a
 * plausible excuse. The cap is generous enough to cover a debugging session and
 * small enough to never matter.
 */

/** One `git` invocation, as the console shows it. */
export interface GitCommandEntry {
  /** Monotonic within the process — the React key, and the paging cursor. */
  id: string
  /** Wall-clock start, epoch ms. */
  at: number
  /** The directory it ran in. Half of every "why did that answer come back?". */
  cwd: string
  /**
   * The arguments, **without** the fixed `--no-optional-locks -c
   * core.quotepath=false` prefix `GitService` adds to every call. Those two are
   * noise on every single row; what the reader is looking for is `push` vs
   * `fetch`, and the prefix pushes it off the end of the line.
   */
  args: string[]
  /** Exit code, or `null` when git never spawned (binary missing). */
  code: number | null
  durationMs: number
  /**
   * git's own stderr, verbatim — capped, because a failed `pull` on a big
   * repo can print thousands of lines and the console is not a file viewer.
   * Empty on the common success.
   */
  stderr: string
  /**
   * The cap bit. A flag rather than an ellipsis spliced into `stderr`, because
   * the sentence that explains the cut is UI copy, and UI copy lives in the
   * renderer's `t()` — main never writes Portuguese.
   */
  stderrTruncated: boolean
}

/** Kept small enough to be free, long enough to cover a debugging session. */
export const GIT_LOG_LIMIT = 500

/**
 * Per-entry stderr cap. Whatever git had to say that mattered, it said in the
 * first few lines; the rest is progress output and advice blocks.
 */
const STDERR_CAP = 4000

export interface GitCommandLog {
  /** Records one finished invocation and pushes it to every subscriber. */
  record(entry: Omit<GitCommandEntry, 'id' | 'stderrTruncated'>): GitCommandEntry
  /** The buffer, oldest first. */
  history(): GitCommandEntry[]
  clear(): void
  /** Subscribes to entries recorded from now on. Returns the unsubscribe. */
  subscribe(listener: (entry: GitCommandEntry) => void): () => void
}

export function createGitCommandLog(limit: number = GIT_LOG_LIMIT): GitCommandLog {
  const entries: GitCommandEntry[] = []
  const listeners = new Set<(entry: GitCommandEntry) => void>()
  let seq = 0

  function record(entry: Omit<GitCommandEntry, 'id' | 'stderrTruncated'>): GitCommandEntry {
    seq += 1
    const full: GitCommandEntry = {
      ...entry,
      id: `git#${seq}`,
      stderr: entry.stderr.slice(0, STDERR_CAP),
      stderrTruncated: entry.stderr.length > STDERR_CAP
    }
    entries.push(full)
    // A single splice per overflow rather than a shift per push: the buffer is
    // written on every status refresh, which on a watched workspace is often.
    if (entries.length > limit) entries.splice(0, entries.length - limit)
    // A throwing subscriber (a dead window's sender) must not take down the
    // git call that is only reporting itself.
    for (const listener of [...listeners]) {
      try {
        listener(full)
      } catch {
        /* a subscriber's failure is not this command's failure */
      }
    }
    return full
  }

  return {
    record,
    history: () => [...entries],
    clear: () => {
      entries.length = 0
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    }
  }
}
