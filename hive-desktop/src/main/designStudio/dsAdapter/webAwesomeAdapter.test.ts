import { describe, expect, it } from 'vitest'
import { resolve } from 'path'
import { createWebAwesomeAdapter, loadWebAwesomeCatalog } from './webAwesomeAdapter'
import type { Command, ScreenDocument, ScreenNode } from '../types'

/**
 * design-studio T2.4 — DS-R13 AC-3/4, DS-R6.
 *
 * `validate()` is the only gate between any surface and the document: the
 * reducer applies without checking (AD-2), so a rule that is missing here is a
 * rule that does not exist. It runs against the *real* committed catalog for
 * the same reason T2.1's tests do — a fixture would let a wrong catalog pass.
 */

const resourcesRoot = resolve(__dirname, '..', '..', '..', '..', 'resources')
const catalog = loadWebAwesomeCatalog(resourcesRoot)
/** Stand-ins for the ~936 KB bundle: `renderToStaticHtml` is covered in `staticHtml.test.ts`. */
const assets = { style: '/* css */', script: '/* js */' }
const adapter = createWebAwesomeAdapter(catalog, () => assets)

function node(id: string, tag: string, extra: Partial<ScreenNode> = {}): ScreenNode {
  return { id, tag, props: {}, children: [], ...extra }
}

const document_: ScreenDocument = {
  screenId: 'login',
  title: 'Login',
  root: node('n1', 'wa-card', { children: [node('n2', 'wa-button')] })
}

function validate(
  command: Command,
  doc: ScreenDocument = document_
): ReturnType<typeof adapter.validate> {
  return adapter.validate(command, doc)
}

describe('the Web Awesome adapter', () => {
  it('exposes the frozen catalog and its id', () => {
    expect(adapter.id).toBe('web-awesome')
    expect(adapter.catalog()).toBe(catalog)
    expect(adapter.catalog().components).toHaveLength(70)
  })
})

describe('validate — a tag outside the catalog (DS-R13 AC-4)', () => {
  it('rejects an added Component the design system does not have', () => {
    expect(
      validate({ type: 'AddComponent', parentId: 'n1', index: 0, node: node('n9', 'wa-fantasia') })
    ).toEqual({
      kind: 'capability',
      componentId: 'n9',
      reason: 'O Componente "wa-fantasia" não existe no design system ativo.'
    })
  })

  it('rejects a nested child with an unknown tag, not just the root of the subtree', () => {
    const subtree = node('n9', 'wa-card', { children: [node('n10', 'wa-fantasia')] })
    expect(
      validate({ type: 'AddComponent', parentId: 'n1', index: 0, node: subtree })
    ).toMatchObject({ componentId: 'n10' })
  })

  it('rejects a prop on a Component the added subtree declares wrongly', () => {
    expect(
      validate({
        type: 'AddComponent',
        parentId: 'n1',
        index: 0,
        node: node('n9', 'wa-button', { props: { variant: 'roxo' } })
      })
    ).toMatchObject({ componentId: 'n9', attemptedValue: 'roxo' })
  })

  it('rejects a SetProp on a node whose tag the active catalog no longer has', () => {
    // A Tela built under a different DS, opened here: the node is in the
    // document but its tag is not in the catalog (DS-R12 — Telas do not migrate).
    const stale: ScreenDocument = { ...document_, root: node('n1', 'wa-fantasia') }
    expect(
      validate({ type: 'SetProp', componentId: 'n1', key: 'variant', value: 'brand' }, stale)
    ).toMatchObject({
      componentId: 'n1',
      reason: 'O Componente "wa-fantasia" não existe no design system ativo.'
    })
  })

  it('accepts a Component the catalog declares', () => {
    expect(
      validate({
        type: 'AddComponent',
        parentId: 'n1',
        index: 0,
        node: node('n9', 'wa-button', { props: { variant: 'brand' } })
      })
    ).toBeNull()
  })
})

describe('validate — a prop outside the catalog (DS-R6 AC-4)', () => {
  it('rejects a prop the Component does not declare', () => {
    expect(validate({ type: 'SetProp', componentId: 'n2', key: 'cor', value: 'roxo' })).toEqual({
      kind: 'capability',
      componentId: 'n2',
      reason: 'A propriedade "cor" não existe em "wa-button".',
      attemptedValue: 'roxo'
    })
  })

  it('rejects a value outside the enum, naming the values that would work', () => {
    expect(validate({ type: 'SetProp', componentId: 'n2', key: 'variant', value: 'roxo' })).toEqual(
      {
        kind: 'capability',
        componentId: 'n2',
        reason:
          '"roxo" não é um valor válido para "variant" em "wa-button" ' +
          '(esperado: neutral, brand, success, warning, danger).',
        attemptedValue: 'roxo'
      }
    )
  })

  it('accepts every value the catalog lists for that enum', () => {
    for (const value of ['neutral', 'brand', 'success', 'warning', 'danger']) {
      expect(validate({ type: 'SetProp', componentId: 'n2', key: 'variant', value })).toBeNull()
    }
  })

  it('rejects a value of the wrong primitive type', () => {
    expect(
      validate({ type: 'SetProp', componentId: 'n2', key: 'pill', value: 'sim' })
    ).toMatchObject({ reason: 'A propriedade "pill" em "wa-button" espera um booleano.' })
    expect(validate({ type: 'SetProp', componentId: 'n2', key: 'name', value: 3 })).toMatchObject({
      reason: 'A propriedade "name" em "wa-button" espera um texto.'
    })
    const withIcon: ScreenDocument = { ...document_, root: node('n1', 'wa-icon') }
    expect(
      validate({ type: 'SetProp', componentId: 'n1', key: 'rotate', value: 'muito' }, withIcon)
    ).toMatchObject({ reason: 'A propriedade "rotate" em "wa-icon" espera um número.' })
    expect(
      validate({ type: 'SetProp', componentId: 'n1', key: 'rotate', value: 90 }, withIcon)
    ).toBeNull()
    expect(validate({ type: 'SetProp', componentId: 'n2', key: 'pill', value: true })).toBeNull()
  })

  it('treats null and the empty string as "remove the prop", not as an invalid value', () => {
    expect(validate({ type: 'SetProp', componentId: 'n2', key: 'variant', value: null })).toBeNull()
    expect(validate({ type: 'SetProp', componentId: 'n2', key: 'variant', value: '' })).toBeNull()
  })
})

describe('validate — slots (DS-R7 AC-4)', () => {
  it('rejects an add into a slot the parent does not declare', () => {
    expect(
      validate({
        type: 'AddComponent',
        parentId: 'n1',
        slot: 'rodape',
        index: 0,
        node: node('n9', 'wa-button')
      })
    ).toEqual({
      kind: 'capability',
      componentId: 'n9',
      reason:
        'O slot "rodape" não existe em "wa-card" ' +
        '(slots: (padrão), header, footer, media, actions, header-actions, footer-actions).',
      attemptedValue: 'rodape'
    })
  })

  it('accepts a declared slot and the default slot', () => {
    const add = (slot?: string): Command => ({
      type: 'AddComponent',
      parentId: 'n1',
      slot,
      index: 0,
      node: node('n9', 'wa-button')
    })
    expect(validate(add('footer'))).toBeNull()
    expect(validate(add())).toBeNull()
  })

  it('says so plainly when the parent declares no slots at all', () => {
    const iconRoot: ScreenDocument = { ...document_, root: node('n1', 'wa-icon') }
    expect(
      validate(
        { type: 'AddComponent', parentId: 'n1', index: 0, node: node('n9', 'wa-button') },
        iconRoot
      )
    ).toMatchObject({
      reason: 'O slot "" não existe em "wa-icon" (slots: (nenhum)).'
    })
  })

  it('rejects a nested child sitting in a slot its parent does not declare', () => {
    const subtree = node('n9', 'wa-card', {
      children: [node('n10', 'wa-button', { slot: 'rodape' })]
    })
    expect(
      validate({ type: 'AddComponent', parentId: null, index: 0, node: subtree })
    ).toMatchObject({ componentId: 'n10' })
  })
})

describe('validate — Components the Tela does not contain', () => {
  it('rejects an add under a parent that is not in the document', () => {
    expect(
      validate({ type: 'AddComponent', parentId: 'ghost', index: 0, node: node('n9', 'wa-button') })
    ).toMatchObject({ reason: 'O Componente "ghost" não está nesta Tela.' })
  })

  it('rejects a remove, a move and a SetProp aimed at an id that is not there', () => {
    expect(validate({ type: 'RemoveComponent', componentId: 'ghost' })).toMatchObject({
      kind: 'capability',
      componentId: 'ghost',
      reason: 'O Componente "ghost" não está nesta Tela.'
    })
    expect(
      validate({ type: 'MoveComponent', componentId: 'ghost', newParentId: 'n1', index: 0 })
    ).toMatchObject({ componentId: 'ghost' })
    expect(
      validate({ type: 'MoveComponent', componentId: 'n2', newParentId: 'ghost', index: 0 })
    ).toMatchObject({ reason: 'O Componente "ghost" não está nesta Tela.' })
    expect(
      validate({ type: 'SetProp', componentId: 'ghost', key: 'variant', value: 'brand' })
    ).toMatchObject({ componentId: 'ghost' })
  })

  it('accepts a remove and a move of Components that are there', () => {
    expect(validate({ type: 'RemoveComponent', componentId: 'n2' })).toBeNull()
    expect(
      validate({
        type: 'MoveComponent',
        componentId: 'n2',
        newParentId: 'n1',
        slot: 'footer',
        index: 0
      })
    ).toBeNull()
  })

  it('rejects a move into a slot the new parent does not declare', () => {
    expect(
      validate({
        type: 'MoveComponent',
        componentId: 'n2',
        newParentId: 'n1',
        slot: 'rodape',
        index: 0
      })
    ).toMatchObject({ componentId: 'n2', attemptedValue: 'rodape' })
  })
})

/**
 * design-studio T5.6 — DS-R7 AC-3. A move that would make a Component its own
 * ancestor is refused *before* the dispatch, and refused as a
 * `CapabilityViolation` rather than as a quiet no-op: the user dropped
 * somewhere and is owed the reason (§6, DS-R17).
 */
describe('validate — a move that would create a cycle (DS-R7 AC-3)', () => {
  const deep: ScreenDocument = {
    screenId: 'login',
    title: 'Login',
    root: node('n1', 'wa-card', {
      children: [node('n2', 'wa-card', { children: [node('n3', 'wa-card')] })]
    })
  }

  it('rejects moving a Component into its own child', () => {
    expect(
      validate({ type: 'MoveComponent', componentId: 'n2', newParentId: 'n3', index: 0 }, deep)
    ).toEqual({
      kind: 'capability',
      componentId: 'n2',
      reason:
        'O Componente "wa-card" não pode ser movido para dentro de si mesmo nem de um descendente dele.',
      attemptedValue: 'n3'
    })
  })

  it('rejects moving a Component into itself', () => {
    expect(
      validate({ type: 'MoveComponent', componentId: 'n2', newParentId: 'n2', index: 0 }, deep)
    ).toMatchObject({ kind: 'capability', componentId: 'n2', attemptedValue: 'n2' })
  })

  it('rejects a move into a deeper descendant, not only into a direct child', () => {
    expect(
      validate({ type: 'MoveComponent', componentId: 'n1', newParentId: 'n3', index: 0 }, deep)
    ).toMatchObject({ kind: 'capability', componentId: 'n1', attemptedValue: 'n3' })
  })

  it('still accepts a move that goes the other way, up the same branch', () => {
    expect(
      validate({ type: 'MoveComponent', componentId: 'n3', newParentId: 'n1', index: 0 }, deep)
    ).toBeNull()
  })
})

describe('validate — an empty Tela', () => {
  const empty: ScreenDocument = { screenId: 'empty', title: 'Vazia', root: null }

  it('rejects a SetProp aimed at a Tela with no Components at all', () => {
    expect(
      validate({ type: 'SetProp', componentId: 'n1', key: 'variant', value: 'brand' }, empty)
    ).toMatchObject({ componentId: 'n1', reason: 'O Componente "n1" não está nesta Tela.' })
  })

  it('accepts the first Component added at the root', () => {
    expect(
      validate(
        { type: 'AddComponent', parentId: null, index: 0, node: node('n1', 'wa-card') },
        empty
      )
    ).toBeNull()
  })

  it('still rejects one the catalog does not have', () => {
    expect(
      validate({ type: 'AddComponent', parentId: null, index: 0, node: node('n1', 'wa-x') }, empty)
    ).toMatchObject({ componentId: 'n1' })
  })
})

describe('extra prop rules layered on the catalog kind', () => {
  it('runs them after the kind check and reports the first reason as a violation', () => {
    const strict = createWebAwesomeAdapter(catalog, () => assets, [
      (_tag, prop, value) => (value === 'brand' ? `"${prop.name}" bloqueada pela regra.` : null)
    ])
    expect(
      strict.validate(
        { type: 'SetProp', componentId: 'n2', key: 'variant', value: 'brand' },
        document_
      )
    ).toEqual({
      kind: 'capability',
      componentId: 'n2',
      reason: '"variant" bloqueada pela regra.',
      attemptedValue: 'brand'
    })
    expect(
      strict.validate(
        { type: 'SetProp', componentId: 'n2', key: 'variant', value: 'danger' },
        document_
      )
    ).toBeNull()
  })
})
