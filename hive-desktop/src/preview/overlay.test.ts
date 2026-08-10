// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { createSelectionOverlay, nodeIdFromPath, OVERLAY_ID } from './overlay'
import { NODE_ID_ATTRIBUTE } from './dom'

/**
 * design-studio T3.6 (DS-R5).
 *
 * The path walk is the whole of "clicking a nested Component selects the
 * deepest one, with no mode switch": `composedPath()[0]` is the innermost
 * target and crosses shadow roots, so the outermost-first alternative — which
 * is what `event.target` would give you — is precisely the bug.
 */

afterEach(() => {
  document.body.replaceChildren()
  document.head.replaceChildren()
})

describe('nodeIdFromPath', () => {
  it('takes the deepest Component, not the outermost', () => {
    const card = document.createElement('wa-card')
    card.setAttribute(NODE_ID_ATTRIBUTE, 'card')
    const button = document.createElement('wa-button')
    button.setAttribute(NODE_ID_ATTRIBUTE, 'button')
    card.appendChild(button)

    // composedPath() is ordered innermost → outermost.
    expect(nodeIdFromPath([button, card, document.body])).toBe('button')
  })

  it('walks out of a shadow root to the Component that owns it', () => {
    // The first entry of a real composedPath is usually a node inside some
    // component's shadow tree, which carries no node id of its own.
    const button = document.createElement('wa-button')
    button.setAttribute(NODE_ID_ATTRIBUTE, 'button')
    const inner = document.createElement('span')

    expect(nodeIdFromPath([inner, button, document.body])).toBe('button')
  })

  it('is null for a click that hits no Component', () => {
    expect(nodeIdFromPath([document.body, document])).toBeNull()
    expect(nodeIdFromPath([])).toBeNull()
  })
})

describe('the overlay lives outside the document tree', () => {
  it('mounts as a sibling of the stage, never inside it', () => {
    const stage = document.createElement('div')
    stage.id = 'hive-stage'
    document.body.appendChild(stage)

    const overlay = createSelectionOverlay(document)
    overlay.mount()

    const root = document.getElementById(OVERLAY_ID)!
    expect(root.parentElement).toBe(document.body)
    expect(stage.contains(root)).toBe(false)
  })

  it('carries no node id, so it can never be reconciled or exported as content', () => {
    const overlay = createSelectionOverlay(document)
    overlay.mount()
    expect(document.querySelectorAll(`[${NODE_ID_ATTRIBUTE}]`).length).toBe(0)
  })

  it('does not intercept pointer events, so it never shadows the Component under it', () => {
    const overlay = createSelectionOverlay(document)
    overlay.mount()
    expect(document.head.textContent).toContain('pointer-events: none')
  })

  it('leaves nothing behind on dispose', () => {
    const overlay = createSelectionOverlay(document)
    overlay.mount()
    overlay.dispose()
    expect(document.getElementById(OVERLAY_ID)).toBeNull()
    expect(document.head.childElementCount).toBe(0)
  })
})

describe('the overlay outlines', () => {
  it('shows the hover outline on an element and hides it on null', () => {
    const overlay = createSelectionOverlay(document)
    overlay.mount()
    const element = document.createElement('wa-button')
    document.body.appendChild(element)

    overlay.hover(element)
    const box = document.querySelector<HTMLElement>('.hive-hover')!
    expect(box.style.display).toBe('block')

    overlay.hover(null)
    expect(box.style.display).toBe('none')
  })

  it('shows a 2px outline and a tag chip for the selected Component', () => {
    const overlay = createSelectionOverlay(document)
    overlay.mount()
    const element = document.createElement('wa-button')
    document.body.appendChild(element)

    overlay.select(element)
    expect(document.querySelector<HTMLElement>('.hive-selected')!.style.display).toBe('block')
    const chip = document.querySelector<HTMLElement>('.hive-chip')!
    expect(chip.style.display).toBe('block')
    expect(chip.textContent).toBe('wa-button')
  })

  it('hides both the outline and the chip when the selection is cleared', () => {
    const overlay = createSelectionOverlay(document)
    overlay.mount()
    overlay.select(document.createElement('wa-button'))
    overlay.select(null)

    expect(document.querySelector<HTMLElement>('.hive-selected')!.style.display).toBe('none')
    expect(document.querySelector<HTMLElement>('.hive-chip')!.style.display).toBe('none')
  })

  it('anchors the chip above the element, and flips it inside when flush to the top', () => {
    const overlay = createSelectionOverlay(document)
    overlay.mount()
    const element = document.createElement('wa-button')
    document.body.appendChild(element)
    const chip = document.querySelector<HTMLElement>('.hive-chip')!

    // jsdom reports every rect as zero, so the geometry is supplied here.
    const rect = (top: number): DOMRect =>
      ({ left: 40, top, width: 80, height: 24 }) as unknown as DOMRect

    element.getBoundingClientRect = () => rect(100)
    overlay.select(element)
    expect(chip.style.top).toBe('82px')

    element.getBoundingClientRect = () => rect(4)
    overlay.select(element)
    expect(chip.style.top).toBe('4px')
  })

  it('offers a reduced-motion alternative for the outline transition', () => {
    const overlay = createSelectionOverlay(document)
    overlay.mount()
    expect(document.head.textContent).toContain('prefers-reduced-motion: reduce')
  })
})

/**
 * design-studio T6.6 / §3.9. The "what just changed?" outline. It is drawn as
 * the overlay's own boxes rather than as a class on the Components, because the
 * reconciler owns those elements' attributes and would wipe it on the next
 * render — the very render a chat turn causes.
 */
describe('SelectionOverlay — the change pulse (T6.6)', () => {
  function boxes(doc: Document): Element[] {
    return [...doc.querySelectorAll(`#${OVERLAY_ID} .hive-pulse`)]
  }

  it('outlines every changed node, outside the document tree', () => {
    const doc = window.document
    const overlay = createSelectionOverlay(doc)
    overlay.mount()
    const stage = doc.createElement('div')
    const first = doc.createElement('wa-button')
    const second = doc.createElement('wa-card')
    stage.append(first, second)
    doc.body.appendChild(stage)

    overlay.pulse([first, second])

    expect(boxes(doc)).toHaveLength(2)
    // The pulse never enters the rendered tree — the export must not carry it.
    expect(stage.querySelector('.hive-pulse')).toBeNull()
    overlay.dispose()
  })

  it('replaces the previous pulse rather than stacking outlines', () => {
    const doc = window.document
    const overlay = createSelectionOverlay(doc)
    overlay.mount()
    const element = doc.createElement('wa-button')
    doc.body.appendChild(element)

    overlay.pulse([element])
    overlay.pulse([element])

    expect(boxes(doc)).toHaveLength(1)
    overlay.dispose()
  })

  it('clears on an empty pulse', () => {
    const doc = window.document
    const overlay = createSelectionOverlay(doc)
    overlay.mount()
    const element = doc.createElement('wa-button')
    doc.body.appendChild(element)

    overlay.pulse([element])
    overlay.pulse([])

    expect(boxes(doc)).toHaveLength(0)
    overlay.dispose()
  })

  it('takes its outlines with it when disposed', () => {
    const doc = window.document
    const overlay = createSelectionOverlay(doc)
    overlay.mount()
    const element = doc.createElement('wa-button')
    doc.body.appendChild(element)
    overlay.pulse([element])

    overlay.dispose()

    expect(boxes(doc)).toHaveLength(0)
  })

  it('has no animation left under prefers-reduced-motion', () => {
    const doc = window.document
    const overlay = createSelectionOverlay(doc)
    overlay.mount()

    const style = doc.querySelector('style')?.textContent ?? ''
    expect(style).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.hive-pulse \{\s*animation: none;/
    )
    overlay.dispose()
  })
})
