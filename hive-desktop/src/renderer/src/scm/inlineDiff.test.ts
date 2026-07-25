import { describe, expect, it } from 'vitest'
import { buildInlineModel, stepHunk } from './inlineDiff'
import type { GitDiff, GitDiffLine } from './gitStatus'

function line(
  type: GitDiffLine['type'],
  oldNo: number | null,
  newNo: number | null,
  text: string
): GitDiffLine {
  return { type, oldNo, newNo, text }
}

describe('buildInlineModel', () => {
  it('interleaves file context with a hunk’s add/del/ctx rows', () => {
    // Current file (post-image): the agent changed line 2 (B → BB).
    const fileLines = ['a', 'BB', 'c', 'd']
    const diff: GitDiff = {
      binary: false,
      hunks: [
        {
          header: '@@ -1,3 +1,3 @@',
          oldStart: 1,
          newStart: 1,
          lines: [
            line('ctx', 1, 1, 'a'),
            line('del', 2, null, 'B'),
            line('add', null, 2, 'BB'),
            line('ctx', 3, 3, 'c')
          ]
        }
      ]
    }
    const { rows, anchors } = buildInlineModel(diff, fileLines)

    // ctx a, del B (phantom), add BB, ctx c, then trailing context d.
    expect(rows.map((r) => [r.type, r.text, r.lineNo])).toEqual([
      ['context', 'a', 1],
      ['del', 'B', null],
      ['add', 'BB', 2],
      ['context', 'c', 3],
      ['context', 'd', 4]
    ])
    // The hunk anchors on its first added line.
    expect(anchors).toEqual([2])
  })

  it('anchors a pure-deletion hunk on its newStart and renders phantom del rows', () => {
    const fileLines = ['keep1', 'keep2']
    const diff: GitDiff = {
      binary: false,
      hunks: [
        {
          header: '@@ -2,2 +1,0 @@',
          oldStart: 2,
          newStart: 1,
          lines: [line('del', 2, null, 'gone-a'), line('del', 3, null, 'gone-b')]
        }
      ]
    }
    const { rows, anchors } = buildInlineModel(diff, fileLines)
    expect(rows.filter((r) => r.type === 'del').map((r) => r.text)).toEqual(['gone-a', 'gone-b'])
    expect(anchors).toEqual([1])
    // The full current file still shows as trailing context.
    expect(rows.filter((r) => r.type === 'context').map((r) => r.text)).toEqual(['keep1', 'keep2'])
  })

  it('handles two hunks in newStart order with untouched context between', () => {
    const fileLines = ['L1_NEW', 'l2', 'l3', 'l4', 'L5_NEW']
    const diff: GitDiff = {
      binary: false,
      hunks: [
        {
          header: '@@ -1 +1 @@',
          oldStart: 1,
          newStart: 1,
          lines: [line('del', 1, null, 'l1'), line('add', null, 1, 'L1_NEW')]
        },
        {
          header: '@@ -5 +5 @@',
          oldStart: 5,
          newStart: 5,
          lines: [line('del', 5, null, 'l5'), line('add', null, 5, 'L5_NEW')]
        }
      ]
    }
    const { rows, anchors } = buildInlineModel(diff, fileLines)
    expect(anchors).toEqual([1, 5])
    // The gap (l2..l4) is untouched context with no hunkIndex.
    const gap = rows.filter((r) => r.hunkIndex === null && r.type === 'context').map((r) => r.text)
    expect(gap).toEqual(['l2', 'l3', 'l4'])
    // Both added lines are present and tagged with their hunk.
    expect(rows.filter((r) => r.type === 'add').map((r) => [r.text, r.hunkIndex])).toEqual([
      ['L1_NEW', 0],
      ['L5_NEW', 1]
    ])
  })

  it('returns just file context when there are no hunks', () => {
    const { rows, anchors } = buildInlineModel({ binary: false, hunks: [] }, ['x', 'y'])
    expect(rows.map((r) => r.text)).toEqual(['x', 'y'])
    expect(rows.every((r) => r.type === 'context')).toBe(true)
    expect(anchors).toEqual([])
  })
})

describe('stepHunk', () => {
  it('advances and wraps forward/back', () => {
    expect(stepHunk(0, 3, 'next')).toBe(1)
    expect(stepHunk(2, 3, 'next')).toBe(0) // wrap
    expect(stepHunk(0, 3, 'prev')).toBe(2) // wrap
    expect(stepHunk(2, 3, 'prev')).toBe(1)
  })

  it('returns 0 when there are no hunks', () => {
    expect(stepHunk(0, 0, 'next')).toBe(0)
    expect(stepHunk(0, 0, 'prev')).toBe(0)
  })
})
