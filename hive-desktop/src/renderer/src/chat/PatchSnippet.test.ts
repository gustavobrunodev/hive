// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { PatchSnippet, PatchStat } from './PatchSnippet'
import { ToolActivityFeed } from './ToolActivityFeed'
import { collapseActivities, type ToolActivity, type ToolPatch } from './toolActivity'

afterEach(cleanup)

function patchOf(over: Partial<ToolPatch> = {}): ToolPatch {
  return {
    op: 'edit',
    path: '/ws/src/chat/Chat.tsx',
    adds: 1,
    dels: 1,
    anchored: true,
    hunks: [
      {
        lines: [
          { type: 'ctx', text: 'const a = 1', no: 11 },
          { type: 'del', text: 'const b = 2', no: 12 },
          { type: 'add', text: 'const b = 3', no: 12 },
          { type: 'ctx', text: 'const c = 3', no: 13 }
        ]
      }
    ],
    ...over
  }
}

function activityOf(over: Partial<ToolActivity> = {}): ToolActivity {
  return {
    id: 't1',
    name: 'Edit',
    detail: '/ws/src/chat/Chat.tsx',
    state: 'ok',
    seq: 0,
    startedAt: 0,
    endedAt: 10,
    patch: patchOf(),
    ...over
  }
}

const renderSnippet = (props: Partial<Parameters<typeof PatchSnippet>[0]> = {}): void => {
  render(
    createElement(PatchSnippet, {
      patch: patchOf(),
      id: 'body',
      full: false,
      onToggleFull: vi.fn(),
      ...props
    })
  )
}

describe('PatchSnippet', () => {
  it('draws the removed and added lines with their sign and the file’s own numbers', () => {
    renderSnippet()
    const removed = document.querySelector('[data-type="del"]')
    const added = document.querySelector('[data-type="add"]')
    expect(removed?.textContent).toContain('const b = 2')
    expect(added?.textContent).toContain('const b = 3')
    // One column, git-inline style: the removal keeps 12, the addition takes 12.
    expect(removed?.querySelector('.wb-patch-no')?.textContent).toBe('12')
    // The sign is real text, not a pseudo-element: a patch read aloud still
    // says which side each line is on.
    expect(removed?.querySelector('.wb-patch-sign')?.textContent).toBe('-')
    expect(added?.querySelector('.wb-patch-sign')?.textContent).toBe('+')
  })

  it('renders an unanchored patch without inventing a line number', () => {
    renderSnippet({
      patch: patchOf({
        anchored: false,
        hunks: [{ lines: [{ type: 'add', text: 'x', no: null }] }]
      })
    })
    expect(document.querySelector('.wb-patch-no')?.textContent).toBe('')
  })

  it('emphasises only the words that moved, and reassembles the line exactly', () => {
    renderSnippet({
      patch: patchOf({
        hunks: [
          {
            lines: [
              {
                type: 'add',
                text: 'const b = 3',
                no: 12,
                spans: [
                  { text: 'const b = ', changed: false },
                  { text: '3', changed: true }
                ]
              }
            ]
          }
        ]
      })
    })
    expect(document.querySelectorAll('.wb-patch-word')).toHaveLength(1)
    expect(document.querySelector('.wb-patch-word')?.textContent).toBe('3')
    // No character is dropped or doubled by the span split.
    expect(document.querySelector('.wb-patch-text')?.textContent).toBe('const b = 3')
  })

  it('caps a long patch and grows it in place rather than scrolling it away', () => {
    const lines = Array.from({ length: 30 }, (_, i) => ({
      type: 'add' as const,
      text: `line ${i}`,
      no: i + 1
    }))
    const onToggleFull = vi.fn()
    renderSnippet({ patch: patchOf({ adds: 30, dels: 0, hunks: [{ lines }] }), onToggleFull })
    expect(document.querySelectorAll('.wb-patch-line')).toHaveLength(12)
    fireEvent.click(screen.getByText('Mostrar mais 18 linhas'))
    expect(onToggleFull).toHaveBeenCalled()
  })

  it('shows every line once grown, and offers the way back', () => {
    const lines = Array.from({ length: 30 }, (_, i) => ({
      type: 'add' as const,
      text: `line ${i}`,
      no: i + 1
    }))
    renderSnippet({ patch: patchOf({ adds: 30, dels: 0, hunks: [{ lines }] }), full: true })
    expect(document.querySelectorAll('.wb-patch-line')).toHaveLength(30)
    expect(screen.getByText('Mostrar menos')).toBeTruthy()
  })

  it('says out loud when the transport cap dropped lines, so a cut patch never looks whole', () => {
    renderSnippet({ patch: patchOf({ truncated: 1200 }) })
    expect(screen.getByText('1200 linhas não exibidas')).toBeTruthy()
  })

  it('names the state a failed step leaves the diff in, instead of implying it landed', () => {
    renderSnippet({ failed: true })
    expect(screen.getByText(/não foi aplicada/)).toBeTruthy()
    expect(document.querySelector('.wb-patch')?.getAttribute('data-failed')).toBe('true')
  })

  it('narrates the scale once, so a screen reader gets it before the lines', () => {
    renderSnippet()
    expect(document.querySelector('.wb-patch-code')?.getAttribute('aria-label')).toBe(
      'Alterações em /ws/src/chat/Chat.tsx: 1 linhas adicionadas, 1 removidas'
    )
  })
})

describe('PatchStat', () => {
  it('shows both counts and splits the bar between them', () => {
    render(createElement(PatchStat, { adds: 6, dels: 2 }))
    expect(screen.getByText('+6')).toBeTruthy()
    expect(screen.getByText('−2')).toBeTruthy()
    expect(document.querySelectorAll('.wb-patch-seg[data-kind="add"]')).toHaveLength(4)
  })

  it('never rounds a deletion away — one removed line is exactly what a reviewer scans for', () => {
    render(createElement(PatchStat, { adds: 240, dels: 1 }))
    expect(document.querySelectorAll('.wb-patch-seg[data-kind="del"]')).toHaveLength(1)
  })

  it('never rounds an addition away either', () => {
    render(createElement(PatchStat, { adds: 1, dels: 240 }))
    expect(document.querySelectorAll('.wb-patch-seg[data-kind="add"]')).toHaveLength(1)
  })

  it('omits the count that is zero rather than printing +0', () => {
    render(createElement(PatchStat, { adds: 3, dels: 0 }))
    expect(screen.queryByText('−0')).toBeNull()
  })
})

describe('ToolActivityFeed with patches', () => {
  it('turns an editing row into the disclosure for its change, open by default', () => {
    render(createElement(ToolActivityFeed, { activities: [activityOf()], live: false }))
    const toggle = document.querySelector('.wb-activity-open')
    expect(toggle?.getAttribute('aria-expanded')).toBe('true')
    expect(document.querySelector('.wb-patch')).toBeTruthy()
    fireEvent.click(toggle as Element)
    expect(document.querySelector('.wb-patch')).toBeNull()
    expect(document.querySelector('.wb-activity-open')?.getAttribute('aria-expanded')).toBe('false')
  })

  it('leaves a row with no patch as the plain, unclickable status line it always was', () => {
    render(
      createElement(ToolActivityFeed, {
        activities: [activityOf({ name: 'Read', patch: undefined })],
        live: false
      })
    )
    expect(document.querySelector('.wb-activity-open')).toBeNull()
    expect(document.querySelector('.wb-activity-goto')).toBeNull()
  })

  it('opens the edited file by its absolute path, leaving the disclosure alone', () => {
    const onOpenFile = vi.fn()
    render(createElement(ToolActivityFeed, { activities: [activityOf()], live: false, onOpenFile }))
    fireEvent.click(document.querySelector('.wb-activity-goto') as Element)
    expect(onOpenFile).toHaveBeenCalledWith('/ws/src/chat/Chat.tsx')
    // The patch is still open: opening the file is not a second toggle.
    expect(document.querySelector('.wb-patch')).toBeTruthy()
  })

  it('hides the file control when the host has no editor to open into', () => {
    render(createElement(ToolActivityFeed, { activities: [activityOf()], live: false }))
    expect(document.querySelector('.wb-activity-goto')).toBeNull()
  })

  it('marks a failed edit’s patch as proposed-but-not-applied', () => {
    render(
      createElement(ToolActivityFeed, {
        activities: [activityOf({ state: 'failed' })],
        live: false
      })
    )
    expect(document.querySelector('.wb-patch')?.getAttribute('data-failed')).toBe('true')
  })

  it('says `novo` on a file that did not exist, and nothing on an ordinary edit', () => {
    render(
      createElement(ToolActivityFeed, {
        activities: [activityOf({ patch: patchOf({ op: 'create' }) })],
        live: false
      })
    )
    expect(screen.getByText('novo')).toBeTruthy()
    cleanup()
    render(createElement(ToolActivityFeed, { activities: [activityOf()], live: false }))
    expect(screen.queryByText('novo')).toBeNull()
  })
})

describe('collapseActivities', () => {
  const step = (id: string, patch?: ToolPatch): ToolActivity => ({
    id,
    name: patch ? 'Edit' : 'Read',
    state: 'ok',
    seq: 0,
    startedAt: 0,
    patch
  })

  it('folds routine steps away by recency', () => {
    const steps = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => step(id))
    expect(collapseActivities(steps, 4).map((s) => s.id)).toEqual(['c', 'd', 'e', 'f'])
  })

  it('never folds away a step that changed a file, however old it is', () => {
    // The edit is the first of six steps — pure recency would hide the one
    // thing the feed exists to show behind four file reads.
    const steps = [step('edit', patchOf()), ...['b', 'c', 'd', 'e', 'f'].map((id) => step(id))]
    expect(collapseActivities(steps, 4).map((s) => s.id)).toEqual(['edit', 'c', 'd', 'e', 'f'])
  })

  it('leaves a short turn exactly as it is', () => {
    const steps = [step('a'), step('b')]
    expect(collapseActivities(steps, 4)).toBe(steps)
  })
})

describe('the verb follows the patch, not just the tool', () => {
  it('says `Criou` for a Write that made a file, so the row stops arguing with its own chip', () => {
    render(
      createElement(ToolActivityFeed, {
        activities: [
          activityOf({ name: 'Write', patch: patchOf({ op: 'create', adds: 4, dels: 0 }) })
        ],
        live: false
      })
    )
    expect(screen.getByText('Criou')).toBeTruthy()
    expect(screen.queryByText('Editou')).toBeNull()
  })

  it('says `Criando` while it is still running', () => {
    render(
      createElement(ToolActivityFeed, {
        activities: [
          activityOf({
            name: 'Write',
            state: 'running',
            endedAt: undefined,
            patch: patchOf({ op: 'create' })
          })
        ],
        live: true
      })
    )
    expect(screen.getByText('Criando')).toBeTruthy()
  })

  it('leaves a rewrite on the ordinary editing verb — the file was already there', () => {
    render(
      createElement(ToolActivityFeed, {
        activities: [activityOf({ name: 'Write', patch: patchOf({ op: 'rewrite' }) })],
        live: false
      })
    )
    expect(screen.getByText('Editou')).toBeTruthy()
    expect(screen.getByText('reescrito')).toBeTruthy()
  })

  it('marks the panel with the op, so an all-additions file can be tinted for legibility', () => {
    render(
      createElement(ToolActivityFeed, {
        activities: [activityOf({ patch: patchOf({ op: 'create' }) })],
        live: false
      })
    )
    expect(document.querySelector('.wb-patch')?.getAttribute('data-op')).toBe('create')
  })
})
