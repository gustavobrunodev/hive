import { describe, expect, it } from 'vitest'
import { addCommand, addTargetFor, componentTags, nextNodeId, slotOptionsFor } from './treeEdits'
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
