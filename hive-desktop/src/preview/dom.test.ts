// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { applyProp, applyProps, buildSubtree, createNodeElement, NODE_ID_ATTRIBUTE } from './dom'
import { messageFor } from './messages'
import type { PreviewNode } from './messages'

/**
 * design-studio T3.4 (AD-4, P1-Preview AC-4) — the value-writing rules, and
 * the shared nonce check (D-DS-4), at the unit these mistakes actually happen
 * in. The receiver's own suite proves the same rules end to end; this one
 * covers the value shapes the catalog can produce (`number`, `false`, `''`)
 * that a rendered Screen would not obviously show.
 */

function node(tag: string, extra: Partial<PreviewNode> = {}): PreviewNode {
  return { id: 'n1', tag, props: {}, children: [], ...extra }
}

describe('applyProp', () => {
  it('writes a string value verbatim', () => {
    const element = document.createElement('wa-input')
    applyProp(element, 'label', 'E-mail')
    expect(element.getAttribute('label')).toBe('E-mail')
  })

  it('stringifies a number rather than dropping it', () => {
    const element = document.createElement('wa-icon')
    applyProp(element, 'rotate', 90)
    expect(element.getAttribute('rotate')).toBe('90')
  })

  it('writes 0 rather than treating it as empty', () => {
    const element = document.createElement('wa-icon')
    applyProp(element, 'rotate', 0)
    expect(element.getAttribute('rotate')).toBe('0')
  })

  it('writes true as a bare attribute', () => {
    const element = document.createElement('wa-button')
    applyProp(element, 'pill', true)
    expect(element.getAttribute('pill')).toBe('')
  })

  it('removes the attribute for false — presence is what turns a boolean on', () => {
    const element = document.createElement('wa-button')
    element.setAttribute('pill', '')
    applyProp(element, 'pill', false)
    expect(element.hasAttribute('pill')).toBe(false)
  })

  it('removes the attribute for the empty string (the spec’s "clear the prop")', () => {
    const element = document.createElement('wa-button')
    element.setAttribute('variant', 'brand')
    applyProp(element, 'variant', '')
    expect(element.hasAttribute('variant')).toBe(false)
  })
})

describe('applyProps', () => {
  it('writes the slot the node declares', () => {
    const element = document.createElement('wa-icon')
    applyProps(element, node('wa-icon', { slot: 'start' }))
    expect(element.getAttribute('slot')).toBe('start')
  })

  it('leaves the default slot unmarked for both undefined and empty', () => {
    const undefinedSlot = document.createElement('wa-icon')
    applyProps(undefinedSlot, node('wa-icon'))
    expect(undefinedSlot.hasAttribute('slot')).toBe(false)

    const emptySlot = document.createElement('wa-icon')
    emptySlot.setAttribute('slot', 'start')
    applyProps(emptySlot, node('wa-icon', { slot: '' }))
    expect(emptySlot.hasAttribute('slot')).toBe(false)
  })
})

describe('createNodeElement / buildSubtree', () => {
  it('tags the element with its node id', () => {
    const element = createNodeElement(document, node('wa-button'))
    expect(element.getAttribute(NODE_ID_ATTRIBUTE)).toBe('n1')
  })

  it('builds children in document order', () => {
    const tree = node('wa-card', {
      children: [
        { id: 'a', tag: 'wa-input', props: {}, children: [] },
        { id: 'b', tag: 'wa-button', props: {}, children: [] }
      ]
    })
    const element = buildSubtree(document, tree)
    expect([...element.children].map((child) => child.getAttribute(NODE_ID_ATTRIBUTE))).toEqual([
      'a',
      'b'
    ])
  })
})

describe('messageFor — the shared nonce check (D-DS-4)', () => {
  const NONCE = 'a'.repeat(64)

  it('accepts a well-formed message for this session', () => {
    expect(messageFor({ type: 'render', nonce: NONCE }, NONCE, ['render'])).toEqual({
      type: 'render',
      nonce: NONCE
    })
  })

  it('rejects a wrong nonce, a missing nonce and a non-string nonce', () => {
    expect(messageFor({ type: 'render', nonce: 'b'.repeat(64) }, NONCE, ['render'])).toBeNull()
    expect(messageFor({ type: 'render' }, NONCE, ['render'])).toBeNull()
    expect(messageFor({ type: 'render', nonce: 7 }, NONCE, ['render'])).toBeNull()
  })

  it('rejects an unlisted type and a non-string type', () => {
    expect(messageFor({ type: 'evaluate', nonce: NONCE }, NONCE, ['render'])).toBeNull()
    expect(messageFor({ type: 9, nonce: NONCE }, NONCE, ['render'])).toBeNull()
  })

  it('rejects anything that is not an object', () => {
    expect(messageFor(null, NONCE, ['render'])).toBeNull()
    expect(messageFor(undefined, NONCE, ['render'])).toBeNull()
    expect(messageFor('render', NONCE, ['render'])).toBeNull()
    expect(messageFor(42, NONCE, ['render'])).toBeNull()
  })
})
