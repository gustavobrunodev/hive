import { describe, expect, it } from 'vitest'
import { applyCommand, emptyLog, pushCommands, replay } from './screenDocument'
import type { Command, CommandLog, ScreenDocument, ScreenNode } from './types'

/**
 * DS-R9 AC-1/AC-2/AC-3. The reducer is the *only* mutation of a screen, it is
 * pure, and it does not validate — validation runs in the adapter before
 * dispatch, so that a bad command is a readable `CapabilityViolation` instead
 * of an exception thrown mid-replay.
 */

function node(id: string, tag: string, children: ScreenNode[] = []): ScreenNode {
  return { id, tag, props: {}, children }
}

/** root → card → [input, button] */
function sampleDoc(): ScreenDocument {
  return {
    screenId: 's1',
    title: 'Login',
    root: node('page', 'wa-page', [
      node('card', 'wa-card', [node('input', 'wa-input'), node('button', 'wa-button')])
    ])
  }
}

function find(doc: ScreenDocument, id: string): ScreenNode | null {
  const walk = (current: ScreenNode | null): ScreenNode | null => {
    if (!current) return null
    if (current.id === id) return current
    for (const child of current.children) {
      const hit = walk(child)
      if (hit) return hit
    }
    return null
  }
  return walk(doc.root)
}

describe('applyCommand — AddComponent', () => {
  it('makes the node the screen root when parentId is null', () => {
    const empty: ScreenDocument = { screenId: 's1', title: 'Login', root: null }

    const next = applyCommand(empty, {
      type: 'AddComponent',
      parentId: null,
      index: 0,
      node: node('page', 'wa-page')
    })

    expect(next.root).toEqual({ id: 'page', tag: 'wa-page', props: {}, children: [] })
  })

  it('inserts into the parent children at the requested index', () => {
    const next = applyCommand(sampleDoc(), {
      type: 'AddComponent',
      parentId: 'card',
      index: 1,
      node: node('title', 'wa-callout')
    })

    expect(find(next, 'card')?.children.map((child) => child.id)).toEqual([
      'input',
      'title',
      'button'
    ])
  })

  it('stamps the command slot onto the added node', () => {
    const next = applyCommand(sampleDoc(), {
      type: 'AddComponent',
      parentId: 'card',
      slot: 'footer',
      index: 0,
      node: node('extra', 'wa-button')
    })

    expect(find(next, 'extra')?.slot).toBe('footer')
  })

  it('appends instead of throwing when the index is past the end', () => {
    const next = applyCommand(sampleDoc(), {
      type: 'AddComponent',
      parentId: 'card',
      index: 99,
      node: node('extra', 'wa-button')
    })

    expect(find(next, 'card')?.children.map((child) => child.id)).toEqual([
      'input',
      'button',
      'extra'
    ])
  })

  it('inserts at the start instead of from the end for a negative index', () => {
    const next = applyCommand(sampleDoc(), {
      type: 'AddComponent',
      parentId: 'card',
      index: -5,
      node: node('extra', 'wa-button')
    })

    expect(find(next, 'card')?.children.map((child) => child.id)).toEqual([
      'extra',
      'input',
      'button'
    ])
  })

  it('leaves the document unchanged when the parent is not in the tree', () => {
    const doc = sampleDoc()

    const next = applyCommand(doc, {
      type: 'AddComponent',
      parentId: 'ghost',
      index: 0,
      node: node('extra', 'wa-button')
    })

    expect(next).toEqual(doc)
  })

  it('leaves an empty screen unchanged when the command names a parent', () => {
    const empty: ScreenDocument = { screenId: 's1', title: 'Login', root: null }

    const next = applyCommand(empty, {
      type: 'AddComponent',
      parentId: 'card',
      index: 0,
      node: node('extra', 'wa-button')
    })

    expect(next).toEqual(empty)
  })
})

describe('applyCommand — RemoveComponent', () => {
  it('removes a nested node from its parent', () => {
    const next = applyCommand(sampleDoc(), { type: 'RemoveComponent', componentId: 'input' })

    expect(find(next, 'input')).toBeNull()
    expect(find(next, 'card')?.children.map((child) => child.id)).toEqual(['button'])
  })

  it('removes the node together with its whole subtree', () => {
    const next = applyCommand(sampleDoc(), { type: 'RemoveComponent', componentId: 'card' })

    expect(find(next, 'button')).toBeNull()
    expect(next.root?.children).toEqual([])
  })

  it('empties the screen when the removed node is the root', () => {
    const next = applyCommand(sampleDoc(), { type: 'RemoveComponent', componentId: 'page' })

    expect(next.root).toBeNull()
  })

  it('leaves the document unchanged for an unknown component', () => {
    const doc = sampleDoc()

    expect(applyCommand(doc, { type: 'RemoveComponent', componentId: 'ghost' })).toEqual(doc)
  })

  it('leaves an empty screen unchanged', () => {
    const empty: ScreenDocument = { screenId: 's1', title: 'Login', root: null }

    expect(applyCommand(empty, { type: 'RemoveComponent', componentId: 'page' })).toEqual(empty)
  })
})

describe('applyCommand — MoveComponent', () => {
  it('reparents the node at the requested index, carrying its subtree', () => {
    const next = applyCommand(sampleDoc(), {
      type: 'MoveComponent',
      componentId: 'button',
      newParentId: 'page',
      index: 0
    })

    expect(next.root?.children.map((child) => child.id)).toEqual(['button', 'card'])
    expect(find(next, 'card')?.children.map((child) => child.id)).toEqual(['input'])
  })

  it('stamps the command slot onto the moved node', () => {
    const next = applyCommand(sampleDoc(), {
      type: 'MoveComponent',
      componentId: 'button',
      newParentId: 'page',
      slot: 'footer',
      index: 0
    })

    expect(find(next, 'button')?.slot).toBe('footer')
  })

  it('leaves the tree intact when the new parent is inside the moved subtree', () => {
    const doc = sampleDoc()

    const next = applyCommand(doc, {
      type: 'MoveComponent',
      componentId: 'card',
      newParentId: 'input',
      index: 0
    })

    expect(next).toEqual(doc)
  })

  it('leaves the tree intact when a node is moved into itself', () => {
    const doc = sampleDoc()

    const next = applyCommand(doc, {
      type: 'MoveComponent',
      componentId: 'card',
      newParentId: 'card',
      index: 0
    })

    expect(next).toEqual(doc)
  })

  it('leaves the tree intact when the moved node is the root', () => {
    const doc = sampleDoc()

    const next = applyCommand(doc, {
      type: 'MoveComponent',
      componentId: 'page',
      newParentId: 'card',
      index: 0
    })

    expect(next).toEqual(doc)
  })

  it('leaves an empty screen unchanged', () => {
    const empty: ScreenDocument = { screenId: 's1', title: 'Login', root: null }

    expect(
      applyCommand(empty, {
        type: 'MoveComponent',
        componentId: 'button',
        newParentId: 'page',
        index: 0
      })
    ).toEqual(empty)
  })

  it('leaves the document unchanged for an unknown component or parent', () => {
    const doc = sampleDoc()

    expect(
      applyCommand(doc, {
        type: 'MoveComponent',
        componentId: 'ghost',
        newParentId: 'page',
        index: 0
      })
    ).toEqual(doc)
    expect(
      applyCommand(doc, {
        type: 'MoveComponent',
        componentId: 'button',
        newParentId: 'ghost',
        index: 0
      })
    ).toEqual(doc)
  })
})

describe('applyCommand — SetProp', () => {
  it('writes exactly the one prop the command names', () => {
    const seeded = applyCommand(sampleDoc(), {
      type: 'SetProp',
      componentId: 'button',
      key: 'size',
      value: 'large'
    })

    const next = applyCommand(seeded, {
      type: 'SetProp',
      componentId: 'button',
      key: 'variant',
      value: 'brand'
    })

    expect(find(next, 'button')?.props).toEqual({ size: 'large', variant: 'brand' })
  })

  it('accepts boolean and number values', () => {
    let next = applyCommand(sampleDoc(), {
      type: 'SetProp',
      componentId: 'button',
      key: 'pill',
      value: true
    })
    next = applyCommand(next, {
      type: 'SetProp',
      componentId: 'button',
      key: 'tabindex',
      value: 2
    })

    expect(find(next, 'button')?.props).toEqual({ pill: true, tabindex: 2 })
  })

  // spec.md Edge Cases: "uma prop de enum recebe null/vazio → remover a prop".
  it('removes the prop when the value is null', () => {
    const seeded = applyCommand(sampleDoc(), {
      type: 'SetProp',
      componentId: 'button',
      key: 'variant',
      value: 'brand'
    })

    const next = applyCommand(seeded, {
      type: 'SetProp',
      componentId: 'button',
      key: 'variant',
      value: null
    })

    expect(find(next, 'button')?.props).toEqual({})
    expect('variant' in (find(next, 'button')?.props ?? {})).toBe(false)
  })

  it('leaves the document unchanged for an unknown component', () => {
    const doc = sampleDoc()

    expect(
      applyCommand(doc, { type: 'SetProp', componentId: 'ghost', key: 'variant', value: 'brand' })
    ).toEqual(doc)
  })

  it('leaves an empty screen unchanged', () => {
    const empty: ScreenDocument = { screenId: 's1', title: 'Login', root: null }

    expect(
      applyCommand(empty, { type: 'SetProp', componentId: 'button', key: 'variant', value: 'x' })
    ).toEqual(empty)
  })
})

// DS-R9 AC-3: the reducer applies without validating. Validation is the
// adapter's job, before dispatch — never a throw from inside the reducer.
describe('applyCommand does not validate', () => {
  it('applies a tag that no catalog declares', () => {
    const next = applyCommand(sampleDoc(), {
      type: 'AddComponent',
      parentId: 'card',
      index: 0,
      node: node('bogus', 'not-a-real-element')
    })

    expect(find(next, 'bogus')?.tag).toBe('not-a-real-element')
  })

  it('applies a prop value that no catalog enum allows', () => {
    const next = applyCommand(sampleDoc(), {
      type: 'SetProp',
      componentId: 'button',
      key: 'variant',
      value: 'roxo'
    })

    expect(find(next, 'button')?.props.variant).toBe('roxo')
  })

  it('applies a prop name that no catalog declares, and a slot the parent never offers', () => {
    const next = applyCommand(sampleDoc(), {
      type: 'AddComponent',
      parentId: 'card',
      slot: 'nonexistent-slot',
      index: 0,
      node: { id: 'x', tag: 'wa-button', props: { madeUpProp: 'yes' }, children: [] }
    })

    expect(find(next, 'x')?.slot).toBe('nonexistent-slot')
    expect(find(next, 'x')?.props.madeUpProp).toBe('yes')
  })
})

// DS-R9 AC-1: surfaces never mutate the tree — the reducer returns a new
// document and leaves the input byte-for-byte intact, which is what makes
// replay-from-origin (AD-8) deterministic.
describe('applyCommand is pure', () => {
  it('never mutates the input document, for any of the four commands', () => {
    const doc = sampleDoc()
    const before = structuredClone(doc)

    applyCommand(doc, {
      type: 'AddComponent',
      parentId: 'card',
      index: 0,
      node: node('a', 'wa-tag')
    })
    applyCommand(doc, { type: 'RemoveComponent', componentId: 'input' })
    applyCommand(doc, {
      type: 'MoveComponent',
      componentId: 'button',
      newParentId: 'page',
      index: 0
    })
    applyCommand(doc, { type: 'SetProp', componentId: 'button', key: 'variant', value: 'brand' })

    expect(doc).toEqual(before)
  })

  it('returns a new document rather than the same object when something changed', () => {
    const doc = sampleDoc()

    const next = applyCommand(doc, {
      type: 'SetProp',
      componentId: 'button',
      key: 'variant',
      value: 'brand'
    })

    expect(next).not.toBe(doc)
    expect(find(doc, 'button')?.props).toEqual({})
  })
})

// DS-R9 AC-4/AC-5: the log IS the document. Replay from the origin is the
// only way a document is ever recomposed — there is no persisted snapshot.
describe('pushCommands', () => {
  const addCard: Command = {
    type: 'AddComponent',
    parentId: null,
    index: 0,
    node: node('card', 'wa-card')
  }
  const setVariant: Command = {
    type: 'SetProp',
    componentId: 'card',
    key: 'appearance',
    value: 'outlined'
  }

  it('starts from an empty log at the origin', () => {
    expect(emptyLog()).toEqual({ entries: [], cursor: 0 })
  })

  it('appends one entry per command and advances the cursor', () => {
    const log = pushCommands(emptyLog(), [addCard, setVariant], 'g1', 1000)

    expect(log.entries.map((entry) => entry.command)).toEqual([addCard, setVariant])
    expect(log.cursor).toBe(2)
  })

  it('stamps the whole batch with one groupId, so a chat turn is one step', () => {
    const log = pushCommands(emptyLog(), [addCard, setVariant], 'turn-1', 1000)

    expect(log.entries.map((entry) => entry.groupId)).toEqual(['turn-1', 'turn-1'])
    expect(log.entries.map((entry) => entry.at)).toEqual([1000, 1000])
  })

  it('keeps each pushed batch in its own group', () => {
    const first = pushCommands(emptyLog(), [addCard], 'g1', 1000)
    const second = pushCommands(first, [setVariant], 'g2', 2000)

    expect(second.entries.map((entry) => entry.groupId)).toEqual(['g1', 'g2'])
  })

  // spec.md Edge Cases: "a Skill devolve Command[] vazio → turno sem efeito,
  // sem empilhar passo de undo".
  it('returns the log untouched for an empty batch, pushing no undo step', () => {
    const log = pushCommands(emptyLog(), [addCard], 'g1', 1000)

    const next = pushCommands(log, [], 'g2', 2000)

    expect(next).toBe(log)
    expect(next.entries).toHaveLength(1)
    expect(next.cursor).toBe(1)
  })

  it('never mutates the log it was given', () => {
    const log = pushCommands(emptyLog(), [addCard], 'g1', 1000)
    const before = structuredClone(log)

    pushCommands(log, [setVariant], 'g2', 2000)

    expect(log).toEqual(before)
  })

  it('timestamps with the wall clock when no time is given', () => {
    const before = Date.now()

    const log = pushCommands(emptyLog(), [addCard], 'g1')

    expect(log.entries[0].at).toBeGreaterThanOrEqual(before)
    expect(log.entries[0].at).toBeLessThanOrEqual(Date.now())
  })
})

describe('replay', () => {
  const origin: ScreenDocument = { screenId: 's1', title: 'Login', root: null }

  function threeStepLog(): CommandLog {
    let log = pushCommands(
      emptyLog(),
      [{ type: 'AddComponent', parentId: null, index: 0, node: node('page', 'wa-page') }],
      'g1',
      1000
    )
    log = pushCommands(
      log,
      [{ type: 'AddComponent', parentId: 'page', index: 0, node: node('button', 'wa-button') }],
      'g2',
      2000
    )
    log = pushCommands(
      log,
      [{ type: 'SetProp', componentId: 'button', key: 'variant', value: 'brand' }],
      'g3',
      3000
    )
    return log
  }

  it('replays every entry up to the cursor by default', () => {
    const doc = replay(origin, threeStepLog())

    expect(doc.screenId).toBe('s1')
    expect(doc.title).toBe('Login')
    expect(find(doc, 'button')?.props.variant).toBe('brand')
  })

  it('replays exactly the requested prefix, in order', () => {
    const log = threeStepLog()

    expect(find(replay(origin, log, 2), 'button')?.props).toEqual({})
    expect(find(replay(origin, log, 1), 'button')).toBeNull()
  })

  // spec.md Edge Cases: "o usuário desfaz até a origem → o Preview mostra o
  // documento vazio da Tela".
  it('returns the empty origin document at upTo 0', () => {
    expect(replay(origin, threeStepLog(), 0)).toEqual(origin)
  })

  it('is deterministic: the same prefix always rebuilds the same document', () => {
    const log = threeStepLog()

    expect(replay(origin, log, 2)).toEqual(replay(origin, log, 2))
  })

  it('is independent of call order', () => {
    const log = threeStepLog()

    const forward = [replay(origin, log, 1), replay(origin, log, 2), replay(origin, log, 3)]
    const backward = [replay(origin, log, 3), replay(origin, log, 2), replay(origin, log, 1)]

    expect(backward).toEqual([forward[2], forward[1], forward[0]])
  })

  it('clamps upTo to the log it actually has', () => {
    const log = threeStepLog()

    expect(replay(origin, log, 99)).toEqual(replay(origin, log, 3))
    expect(replay(origin, log, -5)).toEqual(origin)
  })

  it('never mutates the origin or the log', () => {
    const log = threeStepLog()
    const logBefore = structuredClone(log)
    const originBefore = structuredClone(origin)

    replay(origin, log, 3)

    expect(log).toEqual(logBefore)
    expect(origin).toEqual(originBefore)
  })
})
