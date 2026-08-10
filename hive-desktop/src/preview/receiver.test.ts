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

/** A three-level tree: page → card → (input, button → icon). */
const THREE_LEVELS: PreviewDocument = {
  screenId: 'login',
  root: node('n1', 'wa-page', {
    props: { view: 'default' },
    children: [
      node('n2', 'wa-card', {
        props: { appearance: 'outlined' },
        children: [
          node('n3', 'wa-input', { props: { label: 'E-mail', required: true } }),
          node('n4', 'wa-button', {
            props: { variant: 'brand', pill: true },
            children: [
              node('n5', 'wa-icon', { slot: 'start', props: { name: 'right-to-bracket' } })
            ]
          })
        ]
      })
    ]
  })
}

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
