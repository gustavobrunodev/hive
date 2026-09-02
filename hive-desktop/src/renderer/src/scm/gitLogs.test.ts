import { describe, expect, it } from 'vitest'
import {
  applyFilter,
  commandLine,
  countByFilter,
  CONSOLE_CAP,
  failed,
  formatClock,
  formatDuration,
  mergeEntry,
  outcomeLabel,
  slow,
  toPlainText,
  type GitCommandEntry
} from './gitLogs'

/**
 * git-logs — the console's data layer. These are the parts worth testing
 * without a DOM: which rows a filter keeps, what a row's outcome says, and the
 * de-duplication that decides whether the console invents a command that never
 * ran twice.
 */

let seq = 0
function entry(over: Partial<GitCommandEntry> = {}): GitCommandEntry {
  seq += 1
  return {
    id: `git#${seq}`,
    at: Date.UTC(2026, 8, 2, 19, 41, 3),
    cwd: '/ws',
    args: ['status', '--porcelain=v2'],
    code: 0,
    durationMs: 34,
    stderr: '',
    stderrTruncated: false,
    ...over
  }
}

describe('outcome', () => {
  it('treats a null exit code as a failure of its own kind — git never ran', () => {
    const missing = entry({ code: null })
    expect(failed(missing)).toBe(true)
    // Not "saiu null": nothing exited, so the sentence has to be different.
    expect(outcomeLabel(missing)).toBe('não executou')
  })

  it('names the exit code on a real failure and says ok on success', () => {
    expect(outcomeLabel(entry({ code: 128 }))).toBe('saiu 128')
    expect(outcomeLabel(entry({ code: 0 }))).toBe('ok')
    expect(failed(entry({ code: 0 }))).toBe(false)
  })
})

describe('commandLine', () => {
  it('reads as the command a person would have typed', () => {
    expect(commandLine(entry({ args: ['push', '-u', 'origin', 'main'] }))).toBe(
      'git push -u origin main'
    )
  })
})

describe('formatDuration', () => {
  it('stays in milliseconds under a second and switches to seconds above it', () => {
    expect(formatDuration(34)).toBe('34 ms')
    expect(formatDuration(999)).toBe('999 ms')
    expect(formatDuration(2840)).toBe('2,8 s')
    // Past ten seconds the tenth is noise, and pt-BR uses a comma either way.
    expect(formatDuration(41_200)).toBe('41 s')
  })

  it('never prints a negative or non-finite duration', () => {
    expect(formatDuration(-5)).toBe('0 ms')
    expect(formatDuration(Number.NaN)).toBe('0 ms')
  })
})

describe('formatClock', () => {
  it('is a wall clock, not a date', () => {
    expect(formatClock(entry().at)).toMatch(/^\d{2}:\d{2}:\d{2}$/)
  })
})

describe('applyFilter', () => {
  const entries = [
    entry({ args: ['status'], code: 0, durationMs: 20 }),
    entry({
      args: ['push'],
      code: 128,
      durationMs: 1960,
      stderr: 'fatal: could not read Username'
    }),
    entry({ args: ['fetch'], code: 0, durationMs: 2840 }),
    entry({ args: ['log'], code: 0, durationMs: 60, cwd: '/other' })
  ]

  it('keeps everything by default', () => {
    expect(applyFilter(entries, 'all', '')).toHaveLength(4)
  })

  it('keeps only failures, and only slow calls, per filter', () => {
    expect(applyFilter(entries, 'failed', '').map((e) => e.args[0])).toEqual(['push'])
    // The slow push counts as slow too — a failure is not excused from timing.
    expect(applyFilter(entries, 'slow', '').map((e) => e.args[0])).toEqual(['push', 'fetch'])
    expect(slow(entries[0])).toBe(false)
  })

  it('searches the command, the directory and the error output alike', () => {
    expect(applyFilter(entries, 'all', 'fetch').map((e) => e.args[0])).toEqual(['fetch'])
    expect(applyFilter(entries, 'all', '/other').map((e) => e.args[0])).toEqual(['log'])
    expect(applyFilter(entries, 'all', 'username').map((e) => e.args[0])).toEqual(['push'])
  })

  it('combines the filter with the search rather than letting either win', () => {
    expect(applyFilter(entries, 'failed', 'fetch')).toEqual([])
  })

  it('counts what each filter would keep, for the chips', () => {
    expect(countByFilter(entries)).toEqual({ all: 4, failed: 1, slow: 2 })
  })
})

describe('mergeEntry', () => {
  /**
   * `history()` and the `onEntry` subscription overlap by design (the store
   * subscribes first so nothing falls in the gap between the two calls), so
   * the same command arrives twice — and a console that shows the same `push`
   * twice has invented a retry that never happened.
   */
  it('ignores an entry it already holds', () => {
    const first = entry()
    const current = [first]
    // The *same array back*, not a new one holding the same rows: a fresh
    // reference would re-render the whole console on every duplicate.
    expect(mergeEntry(current, first)).toBe(current)
  })

  it('appends a new entry at the end — newest last', () => {
    const older = entry({ args: ['fetch'] })
    const newer = entry({ args: ['push'] })
    expect(mergeEntry([older], newer).map((e) => e.args[0])).toEqual(['fetch', 'push'])
  })

  it('drops the oldest past the cap', () => {
    const many = Array.from({ length: CONSOLE_CAP }, () => entry())
    const next = mergeEntry(many, entry({ args: ['push'] }))
    expect(next).toHaveLength(CONSOLE_CAP)
    expect(next[0].id).toBe(many[1].id)
    expect(next[next.length - 1].args[0]).toBe('push')
  })
})

describe('toPlainText', () => {
  /**
   * This is the format that gets pasted into an issue, so everything the UI
   * around it was carrying — the time, the directory, the outcome — has to be
   * inside the text.
   */
  it('carries the time, directory, command, cost and outcome on one line', () => {
    const text = toPlainText([entry({ args: ['fetch'], durationMs: 2840 })])
    expect(text).toContain('/ws > git fetch')
    expect(text).toContain('[2,8 s]')
    expect(text).toContain('ok')
    expect(text).toMatch(/^\d{2}:\d{2}:\d{2} /)
  })

  it('indents stderr under the command it belongs to', () => {
    const text = toPlainText([
      entry({ args: ['push'], code: 128, stderr: 'fatal: could not read Username\n' })
    ])
    expect(text).toContain('\n    fatal: could not read Username')
  })

  it('is one line per command with nothing between them', () => {
    expect(
      toPlainText([entry({ args: ['a'] }), entry({ args: ['b'] })].map((e) => e)).split('\n')
    ).toHaveLength(2)
  })
})
