// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { DiffView } from './DiffView'
import { HunkActions } from './HunkActions'
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

  // Agent Change Review (M11, T9): per-hunk accept/reject controls.
  describe('per-hunk controls', () => {
    const twoHunk: GitDiff = {
      binary: false,
      hunks: [
        { header: '@@ -1 +1 @@', oldStart: 1, newStart: 1, lines: [line('add', null, 1, 'x')] },
        { header: '@@ -9 +9 @@', oldStart: 9, newStart: 9, lines: [line('add', null, 9, 'y')] }
      ]
    }

    it('renders no per-hunk controls for the plain M10 diff (no handlers)', () => {
      render(createElement(DiffView, { diff: twoHunk }))
      expect(screen.queryByRole('button', { name: /Aceitar/ })).toBeNull()
    })

    it('renders a ✓/✗ strip per hunk when both handlers are passed', () => {
      render(
        createElement(DiffView, {
          diff: twoHunk,
          onHunkAccept: () => {},
          onHunkReject: () => {}
        })
      )
      // Two hunks → two accept + two reject controls.
      expect(screen.getAllByRole('button', { name: /^Aceitar/ })).toHaveLength(2)
      expect(screen.getAllByRole('button', { name: /^Rejeitar/ })).toHaveLength(2)
    })

    it('fires the handler with the matching hunkId (index:oldStart:newStart)', () => {
      const accepted: string[] = []
      const rejected: string[] = []
      render(
        createElement(DiffView, {
          diff: twoHunk,
          onHunkAccept: (id: string) => accepted.push(id),
          onHunkReject: (id: string) => rejected.push(id)
        })
      )
      fireEvent.click(screen.getAllByRole('button', { name: /^Aceitar/ })[1])
      fireEvent.click(screen.getAllByRole('button', { name: /^Rejeitar/ })[0])
      expect(accepted).toEqual(['1:9:9'])
      expect(rejected).toEqual(['0:1:1'])
    })

    it('renders no controls when only one handler is passed (needs both)', () => {
      render(createElement(DiffView, { diff: twoHunk, onHunkAccept: () => {} }))
      expect(screen.queryByRole('button', { name: /Aceitar/ })).toBeNull()
    })
  })

  // HunkActions is co-located here (not a separate .test file) so its compact
  // path (rendered above via DiffView) and its full path (rendered directly
  // below) are instrumented in one worker — otherwise v8 coverage reports only
  // one graph's branches for a component exercised through two import paths.
  describe('HunkActions (full vs compact)', () => {
    it('renders labeled ✓ Aceitar / ✗ Rejeitar buttons and fires the callbacks', () => {
      const onAccept = vi.fn()
      const onReject = vi.fn()
      render(createElement(HunkActions, { onAccept, onReject, target: 'o arquivo a.txt' }))

      const accept = screen.getByRole('button', { name: 'Aceitar o arquivo a.txt' })
      const reject = screen.getByRole('button', { name: 'Rejeitar o arquivo a.txt' })
      expect(accept.textContent).toContain('Aceitar')
      expect(reject.textContent).toContain('Rejeitar')

      fireEvent.click(accept)
      fireEvent.click(reject)
      expect(onAccept).toHaveBeenCalledTimes(1)
      expect(onReject).toHaveBeenCalledTimes(1)
    })

    it('shows the count label when provided', () => {
      render(
        createElement(HunkActions, {
          onAccept: () => {},
          onReject: () => {},
          target: 'o trecho',
          label: 'Trecho 2 de 3'
        })
      )
      expect(screen.getByText('Trecho 2 de 3')).toBeTruthy()
    })

    it('hides the text labels in compact mode (icons only)', () => {
      render(
        createElement(HunkActions, {
          onAccept: () => {},
          onReject: () => {},
          target: 'o trecho 1 de 2',
          compact: true
        })
      )
      const accept = screen.getByRole('button', { name: 'Aceitar o trecho 1 de 2' })
      expect(accept.textContent).toBe('')
    })

    // P0-006 / R-08, renderer half. The service refuses to reject a change the
    // agent never made; without this the button would still be there, still
    // clickable, and would quietly do nothing — a dead affordance is worse than
    // no affordance, because the user reads the silence as "it worked".
    it('disables Rejeitar with a stated reason when the change is the user’s own', () => {
      const onReject = vi.fn()
      render(
        createElement(HunkActions, {
          onAccept: () => {},
          onReject,
          target: 'o arquivo minhas-notas.md',
          rejectDisabledReason: 'Esta alteração é sua, não do agente'
        })
      )

      const reject = screen.getByRole('button', {
        name: 'Rejeitar o arquivo minhas-notas.md'
      }) as HTMLButtonElement
      expect(reject.disabled).toBe(true)
      expect(reject.getAttribute('title')).toBe('Esta alteração é sua, não do agente')
      fireEvent.click(reject)
      expect(onReject).not.toHaveBeenCalled()

      // Accepting is still offered — keeping the user's own bytes is harmless.
      expect(
        (
          screen.getByRole('button', {
            name: 'Aceitar o arquivo minhas-notas.md'
          }) as HTMLButtonElement
        ).disabled
      ).toBe(false)
    })
  })
})
