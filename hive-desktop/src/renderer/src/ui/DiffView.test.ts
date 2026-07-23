// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { DiffView } from './DiffView'
import { toSplitRows, type GitDiff, type GitDiffLine } from '../scm/gitStatus'

function line(
  type: GitDiffLine['type'],
  oldNo: number | null,
  newNo: number | null,
  text: string
): GitDiffLine {
  return { type, oldNo, newNo, text }
}

const sampleDiff: GitDiff = {
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

afterEach(() => {
  cleanup()
})

describe('toSplitRows', () => {
  it('pairs deletions with the additions that follow, context on both sides', () => {
    const rows = toSplitRows(sampleDiff.hunks[0].lines)
    expect(rows).toEqual([
      {
        left: expect.objectContaining({ text: 'a' }),
        right: expect.objectContaining({ text: 'a' })
      },
      {
        left: expect.objectContaining({ text: 'B', type: 'del' }),
        right: expect.objectContaining({ text: 'BB', type: 'add' })
      },
      {
        left: expect.objectContaining({ text: 'c' }),
        right: expect.objectContaining({ text: 'c' })
      }
    ])
  })

  it('leaves the opposite cell null for an unmatched add or del', () => {
    const rows = toSplitRows([
      line('del', 1, null, 'x'),
      line('add', null, 1, 'y'),
      line('add', null, 2, 'z')
    ])
    expect(rows[0]).toEqual({
      left: expect.objectContaining({ text: 'x' }),
      right: expect.objectContaining({ text: 'y' })
    })
    expect(rows[1]).toEqual({ left: null, right: expect.objectContaining({ text: 'z' }) })
  })
})

describe('DiffView', () => {
  it('renders unified add/del/context lines with hunk header and line numbers', () => {
    render(createElement(DiffView, { diff: sampleDiff, title: 'a.txt (árvore de trabalho)' }))
    expect(screen.getByText('@@ -1,3 +1,3 @@')).toBeTruthy()
    expect(screen.getByText('a.txt (árvore de trabalho)')).toBeTruthy()
    expect(screen.getByText('BB')).toBeTruthy()
    expect(screen.getByText('B')).toBeTruthy()
    // The added line's row carries the add type.
    const addText = screen.getByText('BB')
    expect(addText.closest('[data-type="add"]')).not.toBeNull()
  })

  it('toggles to side-by-side mode', () => {
    const { container } = render(createElement(DiffView, { diff: sampleDiff }))
    expect(container.querySelector('.wb-diff-scroll')?.getAttribute('data-mode')).toBe('unified')
    fireEvent.click(screen.getByRole('button', { name: 'Lado a lado' }))
    expect(container.querySelector('.wb-diff-scroll')?.getAttribute('data-mode')).toBe('split')
    // A split row has two cells.
    expect(container.querySelectorAll('.wb-diff-srow').length).toBeGreaterThan(0)
    // And back to unified.
    fireEvent.click(screen.getByRole('button', { name: 'Unificado' }))
    expect(container.querySelector('.wb-diff-scroll')?.getAttribute('data-mode')).toBe('unified')
  })

  it('renders an empty cell opposite an unmatched line in split mode', () => {
    const diff: GitDiff = {
      binary: false,
      hunks: [
        {
          header: '@@ -1,1 +1,2 @@',
          oldStart: 1,
          newStart: 1,
          lines: [line('del', 1, null, 'x'), line('add', null, 1, 'y'), line('add', null, 2, 'z')]
        }
      ]
    }
    const { container } = render(createElement(DiffView, { diff }))
    fireEvent.click(screen.getByRole('button', { name: 'Lado a lado' }))
    expect(container.querySelector('.wb-diff-scell[data-type="empty"]')).not.toBeNull()
  })

  it('shows a binary affordance instead of garbled text', () => {
    render(createElement(DiffView, { diff: { binary: true, hunks: [] } }))
    expect(screen.getByText('Arquivo binário')).toBeTruthy()
    // No mode toggle for a binary diff.
    expect(screen.queryByRole('button', { name: 'Unificado' })).toBeNull()
  })

  it('shows a too-large affordance', () => {
    render(createElement(DiffView, { diff: { binary: false, hunks: [], tooLarge: true } }))
    expect(screen.getByText('Diferenças muito grandes')).toBeTruthy()
  })

  it('shows an empty affordance when there are no hunks', () => {
    render(createElement(DiffView, { diff: { binary: false, hunks: [] } }))
    expect(screen.getByText('Sem diferenças')).toBeTruthy()
  })

  it('renders a toolbar actions slot', () => {
    render(
      createElement(DiffView, {
        diff: sampleDiff,
        actions: createElement('button', { 'data-testid': 'stage-file' }, 'stage')
      })
    )
    expect(screen.getByTestId('stage-file')).toBeTruthy()
  })
})
