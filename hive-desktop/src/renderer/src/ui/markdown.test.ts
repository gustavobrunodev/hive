// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { Markdown } from './markdown'

/**
 * Task T1 — Markdown renderer via react-markdown + remark-gfm (design.md §5,
 * context.md C2, UX-R7). Replaces the old hand-rolled `renderMarkdown` unit
 * test (removed alongside the function) — this covers the fidelity gaps that
 * motivated the swap (tables, nested lists, task lists) plus the link
 * click-through bridge (UX-R7.3).
 */
describe('Markdown (T1)', () => {
  beforeEach(() => {
    window.hive = {
      ...window.hive,
      openExternal: vi.fn().mockResolvedValue(undefined)
    } as typeof window.hive
  })

  afterEach(() => {
    cleanup()
  })

  const doc = [
    '# Title',
    '',
    'A [link](https://example.com) in a paragraph.',
    '',
    '| Col A | Col B |',
    '| --- | --- |',
    '| one | two |',
    '',
    '- top',
    '  - nested',
    '',
    '- [ ] todo',
    '- [x] done',
    '',
    '```js',
    'const x = 1',
    '```'
  ].join('\n')

  it('renders a heading, paragraph, link, table, nested list, task list, and code fence', () => {
    render(createElement(Markdown, { source: doc }))

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Title')

    const link = screen.getByRole('link', { name: 'link' }) as HTMLAnchorElement
    expect(link.getAttribute('href')).toBe('https://example.com')

    const table = document.querySelector('table')
    expect(table).not.toBeNull()
    const headerCells = Array.from(table!.querySelectorAll('thead th')).map((el) => el.textContent)
    expect(headerCells).toEqual(['Col A', 'Col B'])
    const bodyCells = Array.from(table!.querySelectorAll('tbody td')).map((el) => el.textContent)
    expect(bodyCells).toEqual(['one', 'two'])

    // Nested list: an <li> containing its own <ul>.
    const topItem = Array.from(document.querySelectorAll('li')).find((li) =>
      li.textContent?.trim().startsWith('top')
    )
    expect(topItem?.querySelector('ul li')?.textContent).toBe('nested')

    // GFM task list: rendered as disabled checkboxes, one checked.
    const checkboxes = Array.from(
      document.querySelectorAll('input[type="checkbox"]')
    ) as HTMLInputElement[]
    expect(checkboxes).toHaveLength(2)
    expect(checkboxes.every((box) => box.disabled)).toBe(true)
    expect(checkboxes.map((box) => box.checked)).toEqual([false, true])

    // Fenced code block.
    const code = document.querySelector('pre code')
    expect(code?.textContent).toBe('const x = 1\n')
  })

  it('clicking a link calls window.hive.openExternal and prevents in-app navigation', () => {
    render(createElement(Markdown, { source: '[go](https://example.com)' }))

    const link = screen.getByRole('link', { name: 'go' })
    const event = new MouseEvent('click', { bubbles: true, cancelable: true })
    link.dispatchEvent(event)

    expect(window.hive.openExternal).toHaveBeenCalledWith('https://example.com')
    expect(event.defaultPrevented).toBe(true)
  })
})
