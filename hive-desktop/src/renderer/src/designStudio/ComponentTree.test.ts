// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ComponentTree } from './ComponentTree'
import { allNodeIds } from './screenTree'
import type { ScreenDocument, ScreenNode } from './documentModel'

/**
 * design-studio T5.1 (DS-R5 AC-4/AC-5). The Árvore's half of the selection.
 */

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function node(id: string, tag: string, children: ScreenNode[] = []): ScreenNode {
  return { id, tag, props: {}, children }
}

const DOC: ScreenDocument = {
  screenId: 'login',
  title: 'Login',
  root: node('n1', 'wa-page', [
    node('n2', 'wa-card', [node('n3', 'wa-input'), node('n4', 'wa-button')])
  ])
}

function renderTree(
  selectedComponentId: string | null = null,
  document: ScreenDocument = DOC
): ReturnType<typeof vi.fn> {
  const onSelect = vi.fn()
  render(createElement(ComponentTree, { document, selectedComponentId, onSelect }))
  return onSelect
}

/** A row's *own* tag, ignoring the tags of the rows nested inside it. */
function ownLabel(item: Element): string {
  return item.querySelector('.hds-tree-label-text')?.textContent ?? ''
}

/** The row for a tag — what a click on the row (not on its expand affordance) lands on. */
function rowFor(tag: string): Element {
  const item = screen.getAllByRole('treeitem').find((candidate) => ownLabel(candidate) === tag)
  if (!item) throw new Error(`no row for ${tag}`)
  return item
}

describe('ComponentTree — the Tela as a hierarchy', () => {
  it('shows every Component of the Tela, nested ones included', () => {
    renderTree()
    expect(screen.getAllByRole('treeitem').map(ownLabel)).toEqual([
      'wa-page',
      'wa-card',
      'wa-input',
      'wa-button'
    ])
  })

  it('nests them at the depth the document has them', () => {
    renderTree()
    expect(screen.getAllByRole('treeitem').map((item) => item.getAttribute('aria-level'))).toEqual([
      '1',
      '2',
      '3',
      '3'
    ])
  })

  it('renders nothing at all for a Tela with no Components', () => {
    renderTree(null, { screenId: 'login', title: 'Login', root: null })
    expect(screen.queryByRole('tree')).toBeNull()
  })

  it('expands the whole depth so the structure is visible without a click', () => {
    expect(allNodeIds(DOC.root)).toEqual(['n1', 'n2', 'n3', 'n4'])
  })
})

describe('ComponentTree — selection is single, and it comes from outside', () => {
  it('marks the selected Component, and only that one', () => {
    renderTree('n4')
    const selected = screen
      .getAllByRole('treeitem')
      .filter((item) => item.getAttribute('aria-selected') === 'true')
      .map(ownLabel)
    expect(selected).toEqual(['wa-button'])
  })

  it('marks nothing while there is no selection', () => {
    renderTree(null)
    expect(
      screen
        .getAllByRole('treeitem')
        .filter((item) => item.getAttribute('aria-selected') === 'true')
    ).toHaveLength(0)
  })

  it('emits the clicked Component, including a deeply nested one', () => {
    const onSelect = renderTree()
    fireEvent.click(rowFor('wa-input'))
    expect(onSelect).toHaveBeenCalledWith('n3')
  })

  it('reaches a container Component too — a parent is selectable, not only expandable', () => {
    const onSelect = renderTree()
    fireEvent.click(rowFor('wa-card'))
    expect(onSelect).toHaveBeenCalledWith('n2')
  })

  it('replaces the previous selection rather than adding to it (v1 is single-select)', () => {
    const onSelect = renderTree('n4')
    fireEvent.click(rowFor('wa-card'))
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith('n2')
  })
})
