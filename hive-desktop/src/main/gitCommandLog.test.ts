import { describe, expect, it, vi } from 'vitest'
import { createGitCommandLog, type GitCommandEntry } from './gitCommandLog'

/**
 * git-logs — the command journal main keeps so the console can open onto
 * history rather than onto "nothing has happened since you looked".
 */

function entry(
  over: Partial<Omit<GitCommandEntry, 'id' | 'stderrTruncated'>> = {}
): Omit<GitCommandEntry, 'id' | 'stderrTruncated'> {
  return {
    at: 1_700_000_000_000,
    cwd: '/ws',
    args: ['status', '--porcelain=v2'],
    code: 0,
    durationMs: 30,
    stderr: '',
    ...over
  }
}

describe('createGitCommandLog', () => {
  it('records entries oldest-first with stable, distinct ids', () => {
    const log = createGitCommandLog()
    log.record(entry({ args: ['fetch'] }))
    log.record(entry({ args: ['push'] }))

    const history = log.history()
    expect(history.map((e) => e.args[0])).toEqual(['fetch', 'push'])
    expect(new Set(history.map((e) => e.id)).size).toBe(2)
  })

  it('hands out a copy, so a caller cannot mutate the journal', () => {
    const log = createGitCommandLog()
    log.record(entry())
    log.history().length = 0
    expect(log.history()).toHaveLength(1)
  })

  it('drops the oldest past the cap instead of growing without bound', () => {
    const log = createGitCommandLog(3)
    for (const name of ['a', 'b', 'c', 'd', 'e']) log.record(entry({ args: [name] }))

    expect(log.history().map((e) => e.args[0])).toEqual(['c', 'd', 'e'])
  })

  it('flags a capped stderr rather than splicing an ellipsis into it', () => {
    const log = createGitCommandLog()
    const short = log.record(entry({ stderr: 'fatal: no upstream' }))
    const long = log.record(entry({ stderr: 'x'.repeat(5000) }))

    expect(short.stderrTruncated).toBe(false)
    expect(short.stderr).toBe('fatal: no upstream')
    expect(long.stderrTruncated).toBe(true)
    // The cut is a clean slice — no marker text, which is the renderer's job
    // to say (main never writes UI copy).
    expect(long.stderr).toBe('x'.repeat(4000))
  })

  it('pushes each new entry to subscribers and stops on unsubscribe', () => {
    const log = createGitCommandLog()
    const seen: string[] = []
    const off = log.subscribe((e) => seen.push(e.args[0]))

    log.record(entry({ args: ['pull'] }))
    off()
    log.record(entry({ args: ['push'] }))

    expect(seen).toEqual(['pull'])
  })

  /**
   * A dead window's sender throws when written to. The git call that is only
   * *reporting* itself must not fail because of it — and the other listeners
   * must still be told.
   */
  it('survives a throwing subscriber and still reaches the others', () => {
    const log = createGitCommandLog()
    const angry = vi.fn(() => {
      throw new Error('render frame was disposed')
    })
    const calm = vi.fn()
    log.subscribe(angry)
    log.subscribe(calm)

    expect(() => log.record(entry())).not.toThrow()
    expect(angry).toHaveBeenCalledOnce()
    expect(calm).toHaveBeenCalledOnce()
  })

  it('clears the journal without dropping subscriptions', () => {
    const log = createGitCommandLog()
    const seen = vi.fn()
    log.subscribe(seen)
    log.record(entry())

    log.clear()
    expect(log.history()).toHaveLength(0)

    log.record(entry({ args: ['log'] }))
    expect(log.history()).toHaveLength(1)
    expect(seen).toHaveBeenCalledTimes(2)
  })
})
