// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { ChangeGroups } from './ChangeGroups'
import type { GitFileChange, GitGroups } from './gitStatus'

function chg(
  path: string,
  index: string,
  worktree: string,
  extra: Partial<GitFileChange> = {}
): GitFileChange {
  return {
    path,
    index,
    worktree,
    isConflict: false,
    isUntracked: false,
    isIgnored: false,
    ...extra
  }
}

function groups(overrides: Partial<GitGroups> = {}): GitGroups {
  return { conflicts: [], staged: [], unstaged: [], ...overrides }
}

afterEach(() => {
  cleanup()
})

describe('ChangeGroups', () => {
  it('renders each non-empty group with a title, count and rows', () => {
    render(
      createElement(ChangeGroups, {
        groups: groups({
          conflicts: [chg('c.txt', 'U', 'U', { isConflict: true })],
          staged: [chg('a.txt', 'A', '.')],
          unstaged: [chg('dir/b.md', '.', 'M'), chg('n.txt', '?', '?', { isUntracked: true })]
        })
      })
    )
    expect(screen.getByText('Conflitos de merge')).toBeTruthy()
    expect(screen.getByText('Alterações prontas')).toBeTruthy()
    // Two groups titled "Alterações"? only unstaged uses it here.
    const changes = screen.getByRole('region', { name: 'Alterações' })
    expect(within(changes).getByText('b.md')).toBeTruthy()
    expect(within(changes).getByText('dir')).toBeTruthy()
    expect(within(changes).getByText('n.txt')).toBeTruthy()
  })

  it('omits empty groups entirely', () => {
    render(createElement(ChangeGroups, { groups: groups({ staged: [chg('a', 'A', '.')] }) }))
    expect(screen.queryByText('Conflitos de merge')).toBeNull()
    expect(screen.queryByText('Alterações prontas')).toBeTruthy()
  })

  it('tags rows with their side (staged vs unstaged) for the badge fill', () => {
    const { container } = render(
      createElement(ChangeGroups, {
        groups: groups({ staged: [chg('a', 'A', '.')], unstaged: [chg('b', '.', 'M')] })
      })
    )
    expect(container.querySelector('.wb-scm-row[data-side="staged"]')).not.toBeNull()
    expect(container.querySelector('.wb-scm-row[data-side="unstaged"]')).not.toBeNull()
  })

  it('labels a rename row with its origin path', () => {
    render(
      createElement(ChangeGroups, {
        groups: groups({ staged: [chg('new.txt', 'R', '.', { origPath: 'old.txt' })] })
      })
    )
    expect(screen.getByTitle('new.txt · renomeado de old.txt')).toBeTruthy()
  })

  it('opens a diff when a row is clicked', () => {
    const onOpenDiff = vi.fn()
    render(
      createElement(ChangeGroups, {
        groups: groups({ unstaged: [chg('a.txt', '.', 'M')] }),
        onOpenDiff
      })
    )
    fireEvent.click(screen.getByRole('button', { name: /a\.txt/ }))
    expect(onOpenDiff).toHaveBeenCalledWith(expect.objectContaining({ path: 'a.txt' }), 'unstaged')
  })

  it('renders injected group + row actions', () => {
    render(
      createElement(ChangeGroups, {
        groups: groups({ unstaged: [chg('a.txt', '.', 'M')] }),
        renderGroupActions: (side) =>
          createElement('button', { 'data-testid': `grp-${side}` }, 'g'),
        renderRowActions: (change) =>
          createElement('button', { 'data-testid': `row-${change.path}` }, 'r')
      })
    )
    expect(screen.getByTestId('grp-unstaged')).toBeTruthy()
    expect(screen.getByTestId('row-a.txt')).toBeTruthy()
  })

  it('wraps each row via wrapRow (e.g. a context menu)', () => {
    const seen: string[] = []
    render(
      createElement(ChangeGroups, {
        groups: groups({ unstaged: [chg('a.txt', '.', 'M')] }),
        wrapRow: (change, side, node) => {
          seen.push(`${side}:${change.path}`)
          return createElement('div', { 'data-testid': 'wrapped' }, node)
        }
      })
    )
    expect(seen).toEqual(['unstaged:a.txt'])
    expect(screen.getByTestId('wrapped')).toBeTruthy()
  })

  it('caps rows and summarizes the overflow (perf guard)', () => {
    const many = Array.from({ length: 501 }, (_, i) => chg(`f${i}.txt`, '.', 'M'))
    render(createElement(ChangeGroups, { groups: groups({ unstaged: many }) }))
    expect(screen.getByText('e mais 1…')).toBeTruthy()
    // The group count still reflects the true total.
    expect(screen.getByText('501')).toBeTruthy()
  })
})
