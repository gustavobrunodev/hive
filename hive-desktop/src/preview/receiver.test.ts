// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { execFileSync } from 'child_process'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { createPreviewReceiver, STAGE_ID, tokenFromPath } from './receiver'
import { NODE_ID_ATTRIBUTE } from './dom'
import type { PreviewDocument, PreviewNode } from './messages'

/**
 * design-studio T3.4 (AD-4, P1-Preview AC-4).
 *
 * Two things are proven here and they are not the same thing:
 *   1. the receiver builds the DOM the document describes, through
 *      `createElement` + attribute assignment;
 *   2. no markup-parsing sink survives into the **built bundle**. (1) can be
 *      true of the source while (2) is false of the artifact — a dependency
 *      brings one in — and it is the artifact that runs in the frame.
 */

const TOKEN = 'a'.repeat(64)

function node(id: string, tag: string, extra: Partial<PreviewNode> = {}): PreviewNode {
  return { id, tag, props: {}, children: [], ...extra }
}

/**
 * A three-level tree: page → card → (input, button → icon), built by
 * composition so a variant can be expressed as a *different* document rather
 * than as a mutation of this one. The T1.7 boundary guard forbids writing
 * through `.props`/`.children` anywhere in `src/` — including here, and
 * rightly: a fixture that mutates a document is a fixture that models the bug
 * the reducer exists to prevent.
 */
const ICON = node('n5', 'wa-icon', { slot: 'start', props: { name: 'right-to-bracket' } })
const INPUT = node('n3', 'wa-input', { props: { label: 'E-mail', required: true } })

function button(props: PreviewNode['props'] = { variant: 'brand', pill: true }): PreviewNode {
  return node('n4', 'wa-button', { props, children: [ICON] })
}

function screen(cardChildren: PreviewNode[]): PreviewDocument {
  return {
    screenId: 'login',
    root: node('n1', 'wa-page', {
      props: { view: 'default' },
      children: [
        node('n2', 'wa-card', { props: { appearance: 'outlined' }, children: cardChildren })
      ]
    })
  }
}

const THREE_LEVELS: PreviewDocument = screen([INPUT, button()])

function setPath(pathname: string): void {
  window.history.replaceState({}, '', pathname)
}

function post(message: unknown): void {
  window.dispatchEvent(new MessageEvent('message', { data: message }))
}

describe('tokenFromPath', () => {
  it('reads the session token out of /<token>/index.html', () => {
    expect(tokenFromPath(`/${TOKEN}/index.html`)).toBe(TOKEN)
  })

  it('refuses a path with no token, so the frame stays silent', () => {
    expect(tokenFromPath('/')).toBeNull()
    expect(tokenFromPath('/index.html')).toBeNull()
    expect(tokenFromPath('/short/index.html')).toBeNull()
    expect(tokenFromPath(`/${'Z'.repeat(64)}/index.html`)).toBeNull()
  })
})

describe('receiver handshake', () => {
  let receiver: ReturnType<typeof createPreviewReceiver>

  afterEach(() => {
    receiver?.dispose()
    document.body.replaceChildren()
  })

  it('announces ready to the parent, carrying the session nonce', () => {
    setPath(`/${TOKEN}/index.html`)
    const parent = vi.spyOn(window.parent, 'postMessage')
    receiver = createPreviewReceiver(window)
    receiver.start()

    expect(parent).toHaveBeenCalledWith({ type: 'ready', nonce: TOKEN }, '*')
  })

  it('never speaks when it cannot name its own session', () => {
    setPath('/index.html')
    const parent = vi.spyOn(window.parent, 'postMessage')
    receiver = createPreviewReceiver(window)
    receiver.start()

    expect(parent).not.toHaveBeenCalled()
    expect(document.getElementById(STAGE_ID)).toBeNull()
  })

  it('creates the stage the Screen renders into', () => {
    setPath(`/${TOKEN}/index.html`)
    receiver = createPreviewReceiver(window)
    receiver.start()
    expect(document.getElementById(STAGE_ID)).not.toBeNull()
  })
})

describe('receiver render', () => {
  let receiver: ReturnType<typeof createPreviewReceiver>

  beforeEach(() => {
    setPath(`/${TOKEN}/index.html`)
    receiver = createPreviewReceiver(window)
    receiver.start()
  })

  afterEach(() => {
    receiver.dispose()
    document.body.replaceChildren()
  })

  it('builds the three-level tree the document describes', () => {
    post({ type: 'render', nonce: TOKEN, document: THREE_LEVELS })

    const stage = document.getElementById(STAGE_ID)!
    const page = stage.firstElementChild!
    expect(page.tagName.toLowerCase()).toBe('wa-page')
    const card = page.firstElementChild!
    expect(card.tagName.toLowerCase()).toBe('wa-card')
    expect(card.children.length).toBe(2)
    expect([...card.children].map((child) => child.tagName.toLowerCase())).toEqual([
      'wa-input',
      'wa-button'
    ])
    const icon = card.children[1].firstElementChild!
    expect(icon.tagName.toLowerCase()).toBe('wa-icon')
  })

  it('writes every node id back onto its element, which is what selection keys off', () => {
    post({ type: 'render', nonce: TOKEN, document: THREE_LEVELS })
    const ids = [...document.querySelectorAll(`[${NODE_ID_ATTRIBUTE}]`)].map((element) =>
      element.getAttribute(NODE_ID_ATTRIBUTE)
    )
    expect(ids).toEqual(['n1', 'n2', 'n3', 'n4', 'n5'])
  })

  it('writes string props as attributes with their value', () => {
    post({ type: 'render', nonce: TOKEN, document: THREE_LEVELS })
    const input = document.querySelector('wa-input')!
    expect(input.getAttribute('label')).toBe('E-mail')
  })

  it('writes a true boolean prop as a bare attribute, never as the string "true"', () => {
    post({ type: 'render', nonce: TOKEN, document: THREE_LEVELS })
    const button = document.querySelector('wa-button')!
    expect(button.hasAttribute('pill')).toBe(true)
    expect(button.getAttribute('pill')).toBe('')
  })

  it('omits a false boolean prop entirely — presence is what turns it on', () => {
    post({
      type: 'render',
      nonce: TOKEN,
      document: { screenId: 's', root: node('n1', 'wa-button', { props: { pill: false } }) }
    })
    expect(document.querySelector('wa-button')!.hasAttribute('pill')).toBe(false)
  })

  it('places a node into the parent slot it declares', () => {
    post({ type: 'render', nonce: TOKEN, document: THREE_LEVELS })
    expect(document.querySelector('wa-icon')!.getAttribute('slot')).toBe('start')
  })

  it('leaves the default slot unmarked rather than writing slot=""', () => {
    post({ type: 'render', nonce: TOKEN, document: THREE_LEVELS })
    expect(document.querySelector('wa-card')!.hasAttribute('slot')).toBe(false)
  })

  it('renders an empty Screen as an empty stage, not as a crash', () => {
    post({ type: 'render', nonce: TOKEN, document: { screenId: 's', root: null } })
    expect(document.getElementById(STAGE_ID)!.children.length).toBe(0)
  })

  it('ignores a message whose nonce is not this session (D-DS-4)', () => {
    post({ type: 'render', nonce: 'b'.repeat(64), document: THREE_LEVELS })
    expect(document.getElementById(STAGE_ID)!.children.length).toBe(0)
  })

  it('ignores a message with no nonce at all', () => {
    post({ type: 'render', document: THREE_LEVELS })
    post({ type: 'render', nonce: 42, document: THREE_LEVELS })
    post('render')
    post(null)
    expect(document.getElementById(STAGE_ID)!.children.length).toBe(0)
  })

  it('ignores a message type it does not implement', () => {
    post({ type: 'evaluate', nonce: TOKEN, code: 'alert(1)' })
    expect(document.getElementById(STAGE_ID)!.children.length).toBe(0)
  })

  it('stops listening after dispose', () => {
    receiver.dispose()
    post({ type: 'render', nonce: TOKEN, document: THREE_LEVELS })
    expect(document.getElementById(STAGE_ID)).toBeNull()
  })
})

/**
 * design-studio T3.5 (DS-R8, D-DS-6). "Immediate" is not a screenshot claim —
 * a full rebuild also shows the new value instantly. What separates a patch
 * from a rebuild is everything the DOM holds and the document does not: focus,
 * caret, scroll, a component's internal state. So identity is what gets
 * asserted, not appearance.
 */
describe('reconciliation by node id', () => {
  let receiver: ReturnType<typeof createPreviewReceiver>

  beforeEach(() => {
    setPath(`/${TOKEN}/index.html`)
    receiver = createPreviewReceiver(window)
    receiver.start()
    post({ type: 'render', nonce: TOKEN, document: THREE_LEVELS })
  })

  afterEach(() => {
    receiver.dispose()
    document.body.replaceChildren()
  })

  const byId = (id: string): Element => document.querySelector(`[${NODE_ID_ATTRIBUTE}="${id}"]`)!

  /** THREE_LEVELS with one prop of one node changed — a `SetProp`. */
  const VARIANT_CHANGED = screen([INPUT, button({ variant: 'danger', pill: true })])

  it('does NOT recreate the patched element — same node reference before and after', () => {
    const before = byId('n4')
    post({ type: 'render', nonce: TOKEN, document: VARIANT_CHANGED })

    expect(byId('n4')).toBe(before)
    expect(byId('n4').getAttribute('variant')).toBe('danger')
  })

  it('leaves every untouched element in place too, not just the patched one', () => {
    const before = ['n1', 'n2', 'n3', 'n5'].map(byId)
    post({ type: 'render', nonce: TOKEN, document: VARIANT_CHANGED })

    expect(['n1', 'n2', 'n3', 'n5'].map(byId)).toEqual(before)
  })

  it('keeps DOM state the document does not carry — focus survives a patch', () => {
    const input = byId('n3') as HTMLElement
    input.tabIndex = 0
    input.focus()
    expect(document.activeElement).toBe(input)

    post({ type: 'render', nonce: TOKEN, document: VARIANT_CHANGED })
    expect(document.activeElement).toBe(input)
  })

  it('removes a prop the new document no longer has, without touching the element', () => {
    const before = byId('n4')
    post({
      type: 'render',
      nonce: TOKEN,
      document: screen([INPUT, button({ variant: 'brand' })])
    })

    expect(byId('n4')).toBe(before)
    expect(byId('n4').hasAttribute('pill')).toBe(false)
  })

  it('never strips an attribute the component itself reflected', () => {
    // Lit components write their own state back to attributes. Treating "not
    // in props" as "ours to remove" would fight the component on every patch.
    byId('n4').setAttribute('size', 'medium')
    post({ type: 'render', nonce: TOKEN, document: VARIANT_CHANGED })
    expect(byId('n4').getAttribute('size')).toBe('medium')
  })

  it('moves an existing element on reorder rather than rebuilding it', () => {
    const input = byId('n3')
    const buttonElement = byId('n4')

    post({ type: 'render', nonce: TOKEN, document: screen([button(), INPUT]) })
    expect([...byId('n2').children]).toEqual([buttonElement, input])
  })

  it('adds only the new node, keeping its siblings', () => {
    const card = byId('n2')
    const input = byId('n3')

    post({
      type: 'render',
      nonce: TOKEN,
      document: screen([INPUT, button(), node('n6', 'wa-divider')])
    })

    expect(byId('n2')).toBe(card)
    expect(byId('n3')).toBe(input)
    expect(byId('n6').tagName.toLowerCase()).toBe('wa-divider')
  })

  it('removes a node that is gone, and only that node', () => {
    const buttonElement = byId('n4')

    post({ type: 'render', nonce: TOKEN, document: screen([button()]) })
    expect(document.querySelector(`[${NODE_ID_ATTRIBUTE}="n3"]`)).toBeNull()
    expect(byId('n4')).toBe(buttonElement)
  })

  it('rebuilds when the id is reused for a different tag — setAttribute cannot morph one', () => {
    const before = byId('n3')

    post({
      type: 'render',
      nonce: TOKEN,
      document: screen([node('n3', 'wa-textarea'), button()])
    })

    expect(byId('n3')).not.toBe(before)
    expect(byId('n3').tagName.toLowerCase()).toBe('wa-textarea')
  })
})

/**
 * design-studio T3.6 (DS-R5 AC-4/5, and the edge case where the chat removes
 * the selected Component).
 */
describe('selection', () => {
  let receiver: ReturnType<typeof createPreviewReceiver>
  let posted: unknown[]

  beforeEach(() => {
    setPath(`/${TOKEN}/index.html`)
    posted = []
    vi.spyOn(window.parent, 'postMessage').mockImplementation((message: unknown) => {
      posted.push(message)
    })
    receiver = createPreviewReceiver(window)
    receiver.start()
    post({ type: 'render', nonce: TOKEN, document: THREE_LEVELS })
  })

  afterEach(() => {
    receiver.dispose()
    vi.restoreAllMocks()
    document.body.replaceChildren()
    document.head.replaceChildren()
  })

  const byId = (id: string): Element => document.querySelector(`[${NODE_ID_ATTRIBUTE}="${id}"]`)!

  it('selects the deepest Component under a click on a nested one, with no mode switch', () => {
    byId('n5').dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }))

    // n5 (wa-icon) sits inside n4 (wa-button) inside n2 (wa-card): the deepest
    // one wins, and nothing had to be armed first.
    expect(posted).toEqual([
      { type: 'ready', nonce: TOKEN },
      { type: 'selected', nonce: TOKEN, componentId: 'n5' }
    ])
    expect(document.querySelector<HTMLElement>('.hive-chip')!.textContent).toBe('wa-icon')
  })

  it('replaces the previous selection rather than adding to it (v1 is single-select)', () => {
    byId('n5').dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }))
    byId('n3').dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }))

    expect(posted.at(-1)).toEqual({ type: 'selected', nonce: TOKEN, componentId: 'n3' })
    expect(document.querySelector<HTMLElement>('.hive-chip')!.textContent).toBe('wa-input')
  })

  it('clears the selection on a click that hits no Component', () => {
    byId('n5').dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }))
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }))

    expect(posted.at(-1)).toEqual({ type: 'selected', nonce: TOKEN, componentId: null })
    expect(document.querySelector<HTMLElement>('.hive-chip')!.style.display).toBe('none')
  })

  it('follows a selection made in the Tree, and does not echo it back', () => {
    post({ type: 'select', nonce: TOKEN, componentId: 'n4' })

    expect(document.querySelector<HTMLElement>('.hive-chip')!.textContent).toBe('wa-button')
    expect(posted).toEqual([{ type: 'ready', nonce: TOKEN }])
  })

  it('ignores a select message whose nonce is not this session', () => {
    post({ type: 'select', nonce: 'b'.repeat(64), componentId: 'n4' })
    expect(document.querySelector<HTMLElement>('.hive-chip')!.style.display).toBe('none')
  })

  it('drops the outline when the selected Component is removed by a render', () => {
    post({ type: 'select', nonce: TOKEN, componentId: 'n3' })
    expect(document.querySelector<HTMLElement>('.hive-chip')!.style.display).toBe('block')

    post({ type: 'render', nonce: TOKEN, document: screen([button()]) })
    expect(document.querySelector<HTMLElement>('.hive-chip')!.style.display).toBe('none')
  })

  it('keeps the outline on a Component that survived the render', () => {
    post({ type: 'select', nonce: TOKEN, componentId: 'n4' })
    post({ type: 'render', nonce: TOKEN, document: screen([button()]) })
    expect(document.querySelector<HTMLElement>('.hive-chip')!.textContent).toBe('wa-button')
  })

  it('outlines on hover, and drops it when the pointer leaves every Component', () => {
    // jsdom has no PointerEvent; MouseEvent carries the composedPath() the
    // handler reads, and the listener is registered by event name.
    byId('n4').dispatchEvent(new MouseEvent('pointermove', { bubbles: true, composed: true }))
    const box = document.querySelector<HTMLElement>('.hive-hover')!
    expect(box.style.display).toBe('block')

    document.body.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, composed: true }))
    expect(box.style.display).toBe('none')
  })

  it('re-measures the outlines when the frame is resized', () => {
    post({ type: 'select', nonce: TOKEN, componentId: 'n4' })
    window.dispatchEvent(new Event('resize'))
    expect(document.querySelector<HTMLElement>('.hive-selected')!.style.display).toBe('block')
  })

  it('stops selecting after dispose', () => {
    receiver.dispose()
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }))
    expect(posted).toEqual([{ type: 'ready', nonce: TOKEN }])
  })
})

/**
 * The guard runs against the built artifact, and rebuilds it first so a source
 * change cannot pass by testing a stale bundle.
 */
describe('the built receiver bundle contains no markup-parsing sink (AD-4)', () => {
  const packageRoot = join(__dirname, '..', '..')
  const bundlePath = join(packageRoot, 'resources', 'design-studio-preview', 'receiver.js')

  it('is committed, so what ships is what was reviewed', () => {
    expect(existsSync(bundlePath)).toBe(true)
  })

  it('has no innerHTML, and no other way to turn a string into DOM', () => {
    execFileSync('node', [join(packageRoot, 'scripts', 'buildPreviewReceiver.mjs')], {
      cwd: packageRoot,
      stdio: 'ignore'
    })
    const bundle = readFileSync(bundlePath, 'utf-8')

    for (const sink of [
      'innerHTML',
      'outerHTML',
      'insertAdjacentHTML',
      'document.write',
      'createContextualFragment',
      'DOMParser',
      'eval(',
      'new Function'
    ]) {
      expect(bundle).not.toContain(sink)
    }
  })
})
