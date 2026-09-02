import { t } from '../i18n'

/**
 * The git console's data layer: the entry shape as it crosses IPC, and the
 * pure functions that turn a journal into what the console shows.
 *
 * Split out of the component for the reason `logConsole.ts` was split out of
 * `McpConsole.tsx` — these are the parts worth testing without a DOM: which
 * rows a filter keeps, what a row's headline says, how a duration is worded.
 */

/**
 * Derived from the bridge, never imported from `src/main` — the repo's
 * process-boundary rule (`moduleBoundaries.test.ts`). The renderer's only
 * contract with main is `window.hive`.
 */
export type GitCommandEntry = Awaited<ReturnType<Window['hive']['git']['logs']['history']>>[number]

/**
 * How many entries the console keeps in memory.
 *
 * Larger than main's own buffer would ever hand over in one read, so the cap
 * only ever bites on a *live* session that outruns it — which is the case
 * where dropping the oldest is exactly right.
 */
export const CONSOLE_CAP = 1000

/** Which rows the console shows. */
export type GitLogFilterId = 'all' | 'failed' | 'slow'

/** A call this slow is worth pointing at: it is the answer to "why did that hang?". */
export const SLOW_MS = 1000

export interface GitLogFilter {
  id: GitLogFilterId
  label: string
}

export const GIT_LOG_FILTERS: GitLogFilter[] = [
  { id: 'all', label: t('gitLogs.filterAll') },
  { id: 'failed', label: t('gitLogs.filterFailed') },
  { id: 'slow', label: t('gitLogs.filterSlow') }
]

/**
 * Did this command fail?
 *
 * `code !== 0` and not merely "truthy": `null` is a real and *different*
 * failure (git never spawned at all — the binary is missing), and it is the
 * one a user most needs the console to state plainly.
 *
 * A caveat that keeps this honest: `GitService` uses a non-zero exit as a
 * *question's answer* in two places — `rev-parse --verify MERGE_HEAD` says
 * "no merge in progress" by exiting 1, and `status` catches it. So a red row
 * is "git said no", not always "something is broken". The console shows them
 * because hiding a command's real outcome to make the list look calm is the
 * one thing a debugging instrument must never do.
 */
export function failed(entry: GitCommandEntry): boolean {
  return entry.code !== 0
}

export function slow(entry: GitCommandEntry): boolean {
  return entry.durationMs >= SLOW_MS
}

/** The rows a filter + free-text query keep, oldest first. */
export function applyFilter(
  entries: GitCommandEntry[],
  filter: GitLogFilterId,
  query: string
): GitCommandEntry[] {
  const needle = query.trim().toLowerCase()
  return entries.filter((entry) => {
    if (filter === 'failed' && !failed(entry)) return false
    if (filter === 'slow' && !slow(entry)) return false
    if (needle === '') return true
    return (
      commandLine(entry).toLowerCase().includes(needle) ||
      entry.cwd.toLowerCase().includes(needle) ||
      entry.stderr.toLowerCase().includes(needle)
    )
  })
}

/** How many rows each filter would keep — the counts on the filter chips. */
export function countByFilter(entries: GitCommandEntry[]): Record<GitLogFilterId, number> {
  return {
    all: entries.length,
    failed: entries.filter(failed).length,
    slow: entries.filter(slow).length
  }
}

/**
 * The command as it would have been typed.
 *
 * Arguments are joined plainly, not shell-quoted. A commit message never
 * reaches here (`GitService` passes it through a temp file with `-F`), and the
 * one argument that routinely contains spaces is a path — which reads better
 * unquoted in a log line than wrapped in quotes it never actually had.
 */
export function commandLine(entry: GitCommandEntry): string {
  return `git ${entry.args.join(' ')}`
}

/**
 * The row's outcome word: how it ended, in the vocabulary a person debugging
 * uses. `null` gets its own sentence because "git exited with null" is not a
 * thing that happened — git never ran.
 */
export function outcomeLabel(entry: GitCommandEntry): string {
  if (entry.code === null) return t('gitLogs.outcomeNotRun')
  if (entry.code === 0) return t('gitLogs.outcomeOk')
  return t('gitLogs.outcomeFailed', entry.code)
}

const SECOND = 1000

/** `34 ms` / `2,8 s` — a duration read at a glance, not a stopwatch reading. */
export function formatDuration(ms: number): string {
  const safe = Number.isFinite(ms) && ms > 0 ? Math.round(ms) : 0
  if (safe < SECOND) return t('gitLogs.durationMs', safe)
  const seconds = safe / SECOND
  return t('gitLogs.durationSeconds', seconds.toFixed(seconds < 10 ? 1 : 0).replace('.', ','))
}

/** `16:41:03` — the console's time column. */
export function formatClock(at: number): string {
  return new Date(at).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

/**
 * The whole console as plain text, for "Copiar tudo".
 *
 * One line per command in VS Code's own shape (`HH:MM:SS > git … [12 ms]`),
 * with stderr indented under the line it belongs to. This is the format that
 * gets pasted into an issue, so it has to survive losing every pixel of the UI
 * around it: the timestamp, the cwd, the command and the outcome all have to
 * be *in the text*.
 */
export function toPlainText(entries: GitCommandEntry[]): string {
  return entries
    .map((entry) => {
      const head = `${formatClock(entry.at)} ${entry.cwd} > ${commandLine(entry)} [${formatDuration(
        entry.durationMs
      )}] ${outcomeLabel(entry)}`
      if (entry.stderr.trim() === '') return head
      const body = entry.stderr
        .trimEnd()
        .split('\n')
        .map((line) => `    ${line}`)
        .join('\n')
      return `${head}\n${body}`
    })
    .join('\n')
}

/**
 * Merges one live entry into the buffer, trimming the front to the cap.
 *
 * De-duplicating by id rather than appending blindly: `history()` and the
 * `onEntry` subscription can overlap by an entry or two — a command can finish
 * between the read being issued and the listener being attached — and a
 * console that shows the same `push` twice is a console that has just invented
 * a retry that never happened.
 */
export function mergeEntry(current: GitCommandEntry[], entry: GitCommandEntry): GitCommandEntry[] {
  if (current.some((existing) => existing.id === entry.id)) return current
  const next = [...current, entry]
  return next.length > CONSOLE_CAP ? next.slice(next.length - CONSOLE_CAP) : next
}
