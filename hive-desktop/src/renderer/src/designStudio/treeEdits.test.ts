import { describe, expect, it } from 'vitest'
import {
  addCommand,
  addTargetFor,
  componentTags,
  moveInsideCommand,
  moveOutsideCommand,
  nextNodeId,
  placeOf,
  removeCommand,
  slotForMove,
  slotOptionsFor
} from './treeEdits'
import type { ComponentCatalog, ScreenDocument, ScreenNode } from './documentModel'

/**
 * design-studio T5.5 (DS-R7 AC-1/AC-4). Where a new Component lands, and what
 * the picker is allowed to offer — the two decisions behind "adicionar exige
 * escolher entre os Componentes do Adaptador ativo, em slot declarado".
 */

function node(id: string, tag: string, children: ScreenNode[] = []): ScreenNode {
  return { id, tag, props: {}, children }
}

const DOC: ScreenDocument = {
  screenId: 'login',
  title: 'Login',
  root: node('n1', 'wa-page', [node('n2', 'wa-card', [node('n3', 'wa-input')])])
}

const EMPTY: ScreenDocument = { screenId: 'login', title: 'Login', root: null }

const CATALOG: ComponentCatalog = {
  dsId: 'web-awesome',
  version: '3.11.0',
  components: [
    { tag: 'wa-page', slots: ['', 'header'], props: [] },
    { tag: 'wa-card', slots: ['', 'footer'], props: [] },
    { tag: 'wa-icon', slots: [], props: [] }
  ]
}

describe('addTargetFor — the selected Component is the parent', () => {
  it('adds inside the selected Component, after its existing children', () => {
    expect(addTargetFor(DOC, 'n2')).toEqual({ parentId: 'n2', parentTag: 'wa-card', index: 1 })
  })

  it('falls back to the root when nothing is selected', () => {
    expect(addTargetFor(DOC, null)).toEqual({ parentId: 'n1', parentTag: 'wa-page', index: 1 })
  })

  it('falls back to the root when the selection is not in this Tela', () => {
    expect(addTargetFor(DOC, 'ghost')).toEqual({ parentId: 'n1', parentTag: 'wa-page', index: 1 })
  })

  it('makes the first Component of an empty Tela its root', () => {
    expect(addTargetFor(EMPTY, null)).toEqual({ parentId: null, parentTag: null, index: 0 })
  })
})

describe('componentTags — DS-R7 AC-1: the catalog and nothing else', () => {
  it('offers exactly the tags the active catalog declares', () => {
    expect(componentTags(CATALOG)).toEqual(['wa-page', 'wa-card', 'wa-icon'])
  })

  it('offers nothing at all while there is no catalog', () => {
    expect(componentTags(null)).toEqual([])
  })
})

describe('slotOptionsFor — DS-R7 AC-4: the parent’s declared slots', () => {
  it('offers exactly the slots the parent declares, default included', () => {
    expect(slotOptionsFor(CATALOG, 'wa-card')).toEqual(['', 'footer'])
  })

  it('offers none for a parent that declares none', () => {
    expect(slotOptionsFor(CATALOG, 'wa-icon')).toEqual([])
  })

  it('offers none for a tag the catalog does not have', () => {
    expect(slotOptionsFor(CATALOG, 'wa-nope')).toEqual([])
  })

  it('offers none at the root, where there is no parent to declare any', () => {
    expect(slotOptionsFor(CATALOG, null)).toEqual([])
  })
})

describe('addCommand — one Command, carrying the choice', () => {
  it('builds an AddComponent for the chosen tag in the chosen slot', () => {
    const command = addCommand(
      { parentId: 'n2', parentTag: 'wa-card', index: 1 },
      'wa-icon',
      'footer'
    )
    expect(command).toMatchObject({
      type: 'AddComponent',
      parentId: 'n2',
      index: 1,
      slot: 'footer',
      node: { tag: 'wa-icon', props: {}, children: [] }
    })
  })

  it('omits the slot for the default one, which is what an absent slot means', () => {
    const command = addCommand({ parentId: 'n2', parentTag: 'wa-card', index: 1 }, 'wa-icon', '')
    expect(command).not.toHaveProperty('slot')
  })

  it('gives the new node an id of its own', () => {
    const first = addCommand({ parentId: null, parentTag: null, index: 0 }, 'wa-page', '')
    const second = addCommand({ parentId: null, parentTag: null, index: 0 }, 'wa-page', '')
    if (first.type !== 'AddComponent' || second.type !== 'AddComponent') throw new Error('type')
    expect(first.node.id).not.toBe(second.node.id)
  })

  it('never repeats an id across calls', () => {
    const ids = new Set(Array.from({ length: 200 }, () => nextNodeId()))
    expect(ids.size).toBe(200)
  })
})

/**
 * design-studio T5.6 (DS-R7 AC-2/AC-3). Move is indent/outdent — the only pair
 * of gestures a keyboard can make (DS-R18) — and the commands it produces are
 * ordinary `MoveComponent`s, so they undo like anything else.
 */
describe('placeOf — a node’s parent and its position', () => {
  it('finds a nested node’s parent and index', () => {
    expect(placeOf(DOC.root, 'n3')).toMatchObject({ parent: { id: 'n2' }, index: 0 })
  })

  it('has no place for the root, which has no parent', () => {
    expect(placeOf(DOC.root, 'n1')).toBeNull()
  })

  it('has no place for a node that is not in this Tela', () => {
    expect(placeOf(DOC.root, 'ghost')).toBeNull()
  })
})

describe('slotForMove — the slot a moved node lands in', () => {
  it('keeps the slot it already sits in when the new parent declares it', () => {
    expect(slotForMove(CATALOG, 'wa-card', 'footer')).toBe('footer')
  })

  it('falls back to the new parent’s first declared slot when the old one is unknown there', () => {
    expect(slotForMove(CATALOG, 'wa-page', 'footer')).toBe('')
  })

  it('keeps the slot when the new parent declares none, so validate() can say why', () => {
    expect(slotForMove(CATALOG, 'wa-icon', 'footer')).toBe('footer')
  })
})

describe('moveInsideCommand — into the sibling above', () => {
  /** page › [card(input), icon] — the icon has a sibling above it to move into. */
  const SIBLINGS: ScreenDocument = {
    screenId: 'login',
    title: 'Login',
    root: node('n1', 'wa-page', [
      node('n2', 'wa-card', [node('n3', 'wa-icon')]),
      node('n4', 'wa-icon')
    ])
  }

  it('makes the node the last child of the sibling above it', () => {
    expect(moveInsideCommand(SIBLINGS, CATALOG, 'n4')).toEqual({
      type: 'MoveComponent',
      componentId: 'n4',
      newParentId: 'n2',
      slot: '',
      index: 1
    })
  })

  it('offers nothing for the first child, which has no sibling above it', () => {
    expect(moveInsideCommand(SIBLINGS, CATALOG, 'n3')).toBeNull()
  })

  it('offers nothing for the root', () => {
    expect(moveInsideCommand(SIBLINGS, CATALOG, 'n1')).toBeNull()
  })

  it('offers nothing with no selection at all', () => {
    expect(moveInsideCommand(SIBLINGS, CATALOG, null)).toBeNull()
  })
})

describe('moveOutsideCommand — beside the parent', () => {
  it('places the node right after its own parent, one level up', () => {
    expect(moveOutsideCommand(DOC, CATALOG, 'n3')).toEqual({
      type: 'MoveComponent',
      componentId: 'n3',
      newParentId: 'n1',
      slot: '',
      index: 1
    })
  })

  it('offers nothing for a child of the root, which has nowhere further out to go', () => {
    expect(moveOutsideCommand(DOC, CATALOG, 'n2')).toBeNull()
  })

  it('offers nothing for the root itself', () => {
    expect(moveOutsideCommand(DOC, CATALOG, 'n1')).toBeNull()
  })
})

describe('removeCommand', () => {
  it('is one RemoveComponent for the node asked for', () => {
    expect(removeCommand('n3')).toEqual({ type: 'RemoveComponent', componentId: 'n3' })
  })
})
