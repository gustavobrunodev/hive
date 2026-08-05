import { describe, expect, it } from 'vitest'
import {
  reduceToolActivity,
  settleToolActivity,
  shortenDetail,
  toolKind,
  toolLabel,
  type ToolActivity
} from './toolActivity'

describe('toolKind', () => {
  it('groups tools by what the user perceives, not by which of four read-ish tools was picked', () => {
    expect(toolKind('Read')).toBe('read')
    expect(toolKind('MultiEdit')).toBe('edit')
    expect(toolKind('Grep')).toBe('search')
    expect(toolKind('Bash')).toBe('run')
    expect(toolKind('WebFetch')).toBe('web')
    expect(toolKind('Task')).toBe('task')
  })

  it('treats an unknown or MCP tool as generic rather than guessing', () => {
    expect(toolKind('SomethingNew')).toBe('other')
    expect(toolKind('mcp__linear__create_issue')).toBe('other')
  })
})

describe('toolLabel', () => {
  it('makes an MCP tool readable, and leaves a built-in tool named as people name it', () => {
    expect(toolLabel('mcp__linear__create_issue')).toBe('linear · create issue')
    expect(toolLabel('mcp__playwright__browser_click')).toBe('playwright · browser click')
    expect(toolLabel('mcp__server')).toBe('server')
    expect(toolLabel('Bash')).toBe('Bash')
  })
})

describe('shortenDetail', () => {
  it('keeps the two path segments that identify a file, dropping the leading noise', () => {
    expect(shortenDetail('/home/dev/proj/src/chat/Chat.tsx', 'edit')).toBe('chat/Chat.tsx')
    expect(shortenDetail('README.md', 'read')).toBe('README.md')
    expect(shortenDetail('C:\\work\\app\\src\\main.ts', 'read')).toBe('src/main.ts')
  })

  it('truncates a long non-path detail instead of letting a command wrap the row', () => {
    const long = `git commit -m "${'x'.repeat(200)}"`
    const short = shortenDetail(long, 'run') as string
    expect(short.length).toBeLessThanOrEqual(96)
    expect(short.endsWith('…')).toBe(true)
  })

  it('passes an empty detail through as nothing', () => {
    expect(shortenDetail(undefined, 'run')).toBeUndefined()
    expect(shortenDetail('', 'run')).toBeUndefined()
  })
})

describe('reduceToolActivity', () => {
  it('appends a start and settles the end that pairs with it by tool id', () => {
    let activities = reduceToolActivity([], {
      name: 'Read',
      detail: '/ws/a.ts',
      toolId: 'tu-1',
      phase: 'start'
    })
    activities = reduceToolActivity(activities, {
      name: 'Bash',
      detail: 'npm test',
      toolId: 'tu-2',
      phase: 'start'
    })
    expect(activities.map((a) => a.state)).toEqual(['running', 'running'])

    // The *first* tool comes back while the second is still running — order of
    // completion is not order of start.
    activities = reduceToolActivity(activities, { name: '', toolId: 'tu-1', phase: 'end' })
    expect(activities.map((a) => [a.id, a.state])).toEqual([
      ['tu-1', 'ok'],
      ['tu-2', 'running']
    ])
  })

  it('marks a failed tool result as failed, not merely finished', () => {
    const started = reduceToolActivity([], { name: 'Bash', toolId: 'tu-1', phase: 'start' })
    const ended = reduceToolActivity(started, {
      name: '',
      toolId: 'tu-1',
      phase: 'end',
      ok: false
    })
    expect(ended[0].state).toBe('failed')
  })

  it('settles the newest running row when an end arrives with no id to pair on', () => {
    let activities = reduceToolActivity([], { name: 'Read', toolId: 'tu-1', phase: 'start' })
    activities = reduceToolActivity(activities, { name: 'Grep', toolId: 'tu-2', phase: 'start' })
    activities = reduceToolActivity(activities, { name: '', phase: 'end' })
    expect(activities.map((a) => a.state)).toEqual(['running', 'ok'])
  })

  it('ignores an end that pairs with nothing rather than inventing a phantom row', () => {
    const activities = reduceToolActivity([], { name: '', toolId: 'ghost', phase: 'end' })
    expect(activities).toEqual([])
  })

  it('returns the same array when nothing changed, so React can skip the render', () => {
    const current: ToolActivity[] = []
    expect(reduceToolActivity(current, { name: '', toolId: 'ghost', phase: 'end' })).toBe(current)
  })

  it('treats a phase-less event as a start, so an adapter that reports no phases still shows work', () => {
    const activities = reduceToolActivity([], { name: 'Write', detail: '/ws/a.ts' })
    expect(activities).toHaveLength(1)
    expect(activities[0].state).toBe('running')
  })

  it('keeps a repeated start in place instead of duplicating the row', () => {
    const first = reduceToolActivity([], { name: 'Bash', detail: 'a', toolId: 'tu-1' })
    const again = reduceToolActivity(first, { name: 'Bash', detail: 'b', toolId: 'tu-1' })
    expect(again).toHaveLength(1)
    expect(again[0].detail).toBe('b')
    expect(again[0].seq).toBe(first[0].seq)
  })
})

describe('settleToolActivity', () => {
  it('leaves no row spinning when a turn ends — a spinner that never resolves is a lie', () => {
    let activities = reduceToolActivity([], { name: 'Read', toolId: 'tu-1', phase: 'start' })
    activities = reduceToolActivity(activities, { name: 'Bash', toolId: 'tu-2', phase: 'start' })
    activities = reduceToolActivity(activities, { name: '', toolId: 'tu-1', phase: 'end' })

    expect(settleToolActivity(activities, 'failed').map((a) => a.state)).toEqual(['ok', 'failed'])
    expect(settleToolActivity(activities, 'ok').map((a) => a.state)).toEqual(['ok', 'ok'])
  })

  it('is a no-op — same reference — when everything already settled', () => {
    const done = reduceToolActivity(
      reduceToolActivity([], { name: 'Read', toolId: 'tu-1', phase: 'start' }),
      { name: '', toolId: 'tu-1', phase: 'end' }
    )
    expect(settleToolActivity(done, 'ok')).toBe(done)
  })
})
