import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { join, resolve } from 'path'
import {
  EXPORT_NODE_ID_ATTRIBUTE,
  EXPORT_STAGE_ID,
  escapeAttribute,
  inlineSafe,
  renderScreenMarkup,
  renderStaticDocument
} from './staticHtml'
import {
  createWebAwesomeAdapter,
  loadWebAwesomeAssets,
  loadWebAwesomeCatalog,
  WEB_AWESOME_DIRNAME
} from './webAwesomeAdapter'
import { NODE_ID_ATTRIBUTE } from '../../../preview/dom'
import { STAGE_ID } from '../../../preview/receiver'
import type { ScreenDocument, ScreenNode } from '../types'

/**
 * design-studio T7.1 — DS-R14 AC-1/2, AD-6.
 *
 * The claim under test is not "a string comes out". It is that the *one*
 * producer of Bundle markup produces a document that renders what the Preview
 * renders, and carries everything it needs to do that with the network gone.
 * So the assertions are about the shapes the frame uses (stage id, node
 * attribute, boolean-by-presence) and about what is and is not in the file.
 */

const resourcesRoot = resolve(__dirname, '..', '..', '..', '..', 'resources')
const catalog = loadWebAwesomeCatalog(resourcesRoot)
const knownTags = new Set(catalog.components.map((component) => component.tag))

function node(id: string, tag: string, extra: Partial<ScreenNode> = {}): ScreenNode {
  return { id, tag, props: {}, children: [], ...extra }
}

function screen(root: ScreenNode | null, title = 'Login'): ScreenDocument {
  return { screenId: 'login', title, root }
}

describe('the exported markup mirrors what the Preview builds', () => {
  it('uses the same stage id and node attribute the in-frame renderer does', () => {
    // Restated across a process boundary (design §4): pinned here so the two
    // cannot drift into an Export that no longer matches the Preview.
    expect(EXPORT_STAGE_ID).toBe(STAGE_ID)
    expect(EXPORT_NODE_ID_ATTRIBUTE).toBe(NODE_ID_ATTRIBUTE)
  })

  it('renders a nested tree with every node carrying its id', () => {
    const markup = renderScreenMarkup(
      screen(
        node('n1', 'wa-card', {
          children: [node('n2', 'wa-button', { children: [node('n3', 'wa-icon')] })]
        })
      ),
      knownTags
    )
    expect(markup).toBe(
      '<wa-card data-hive-node="n1">' +
        '<wa-button data-hive-node="n2">' +
        '<wa-icon data-hive-node="n3"></wa-icon>' +
        '</wa-button>' +
        '</wa-card>'
    )
  })

  it('writes the slot as an attribute, and omits it for the default slot', () => {
    expect(
      renderScreenMarkup(screen(node('n1', 'wa-icon', { slot: 'start' })), knownTags)
    ).toContain('slot="start"')
    expect(
      renderScreenMarkup(screen(node('n1', 'wa-icon', { slot: '' })), knownTags)
    ).not.toContain('slot=')
    expect(renderScreenMarkup(screen(node('n1', 'wa-icon')), knownTags)).not.toContain('slot=')
  })

  it('writes a true boolean bare and omits a false one, exactly as the frame does', () => {
    // `disabled="false"` would turn the prop ON — a boolean attribute is true by
    // its presence. This is the rule `applyProp()` encodes in `preview/dom.ts`.
    const markup = renderScreenMarkup(
      screen(node('n1', 'wa-button', { props: { disabled: true, pill: false, variant: 'brand' } })),
      knownTags
    )
    expect(markup).toBe('<wa-button data-hive-node="n1" disabled variant="brand"></wa-button>')
  })

  it('drops an empty string prop and keeps a numeric one', () => {
    const markup = renderScreenMarkup(
      screen(node('n1', 'wa-progress-ring', { props: { value: 42, label: '' } })),
      knownTags
    )
    expect(markup).toBe('<wa-progress-ring data-hive-node="n1" value="42"></wa-progress-ring>')
  })

  it('renders a Screen with no Components as an empty stage, not as a broken file', () => {
    expect(renderScreenMarkup(screen(null), knownTags)).toBe('')
    expect(renderStaticDocument(screen(null), { style: '', script: '' }, knownTags)).toContain(
      `<div id="hive-stage"></div>`
    )
  })

  it('never self-closes a custom element', () => {
    expect(renderScreenMarkup(screen(node('n1', 'wa-divider')), knownTags)).toBe(
      '<wa-divider data-hive-node="n1"></wa-divider>'
    )
  })
})

describe('a prop value is data in the exported file, never markup', () => {
  it('escapes the four characters that would end an attribute or open a tag', () => {
    expect(escapeAttribute(`a & b < c > d " e`)).toBe('a &amp; b &lt; c &gt; d &quot; e')
  })

  it('escapes a value that tries to close its own tag and add a script', () => {
    const markup = renderScreenMarkup(
      screen(node('n1', 'wa-button', { props: { title: `"><script>alert(1)</script>` } })),
      knownTags
    )
    expect(markup).not.toContain('<script>')
    expect(markup).toContain('title="&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;"')
  })

  it('escapes the node id and the Screen title too', () => {
    expect(renderScreenMarkup(screen(node('n<1', 'wa-button')), knownTags)).toContain(
      'data-hive-node="n&lt;1"'
    )
    expect(
      renderStaticDocument(screen(null, 'Login <b>'), { style: '', script: '' }, knownTags)
    ).toContain('<title>Login &lt;b&gt;</title>')
  })
})

describe('a Component the design system does not have stops the export', () => {
  it('throws rather than writing a file that renders as nothing', () => {
    expect(() => renderScreenMarkup(screen(node('n1', 'wa-nope')), knownTags)).toThrow(/wa-nope/)
  })

  it('throws for a tag that is not a custom element name at all', () => {
    expect(() => renderScreenMarkup(screen(node('n1', 'script')), knownTags)).toThrow()
    expect(() => renderScreenMarkup(screen(node('n1', 'wa-card><script')), knownTags)).toThrow()
  })

  it('throws for a Component nested deep in the tree, not only at the root', () => {
    expect(() =>
      renderScreenMarkup(
        screen(node('n1', 'wa-card', { children: [node('n2', 'wa-nope')] })),
        knownTags
      )
    ).toThrow(/wa-nope/)
  })
})

describe('the document is self-contained (DS-R14 AC-1)', () => {
  const assets = { style: '.x{color:red}', script: 'globalThis.ok = 1' }
  const html = renderStaticDocument(screen(node('n1', 'wa-button')), assets, knownTags)

  it('inlines the stylesheet and the bundle instead of linking them', () => {
    expect(html).toContain('<style>.x{color:red}</style>')
    expect(html).toContain('<script type="module">globalThis.ok = 1</script>')
    expect(html).not.toContain('<link')
    expect(html).not.toContain('script type="module" src')
  })

  it('references no URL at all — nothing to fetch when it is opened offline', () => {
    expect(html).not.toMatch(/https?:\/\//)
    expect(html).not.toContain('hive-studio://')
  })

  it('puts the tree in the stage ahead of the deferred module', () => {
    expect(html.indexOf('<div id="hive-stage">')).toBeLessThan(html.indexOf('<script'))
    expect(html).toContain('<div id="hive-stage"><wa-button data-hive-node="n1"></wa-button></div>')
  })
})

describe('inlining cannot be broken out of', () => {
  it('neutralises a closing tag hidden inside the asset text', () => {
    expect(inlineSafe('a</script>b', 'script')).toBe('a<\\/script>b')
    expect(inlineSafe('a</SCRIPT >b', 'script')).toBe('a<\\/SCRIPT >b')
    expect(inlineSafe('a</style>b', 'style')).toBe('a<\\/style>b')
  })

  it('leaves text with no such sequence untouched', () => {
    expect(inlineSafe('const x = 1 < 2', 'script')).toBe('const x = 1 < 2')
  })

  it('is a belt: the bundle we actually ship contains neither sequence', () => {
    const dir = join(resourcesRoot, WEB_AWESOME_DIRNAME)
    const script = readFileSync(join(dir, 'webawesome.js'), 'utf-8')
    const style = readFileSync(join(dir, 'webawesome.css'), 'utf-8')
    expect(script.toLowerCase()).not.toContain('</script')
    expect(style.toLowerCase()).not.toContain('</style')
  })
})

describe('the adapter is the one that renders it (AD-6)', () => {
  it('exposes renderToStaticHtml and reads the real bundle exactly once', () => {
    let reads = 0
    const adapter = createWebAwesomeAdapter(catalog, () => {
      reads += 1
      return { style: 'S', script: 'J' }
    })
    expect(adapter.renderToStaticHtml(screen(node('n1', 'wa-button')))).toContain(
      '<wa-button data-hive-node="n1"></wa-button>'
    )
    adapter.renderToStaticHtml(screen(node('n2', 'wa-card')))
    expect(reads).toBe(1)
  })

  it('does not read the bundle for an adapter nobody exports from', () => {
    let reads = 0
    const adapter = createWebAwesomeAdapter(catalog, () => {
      reads += 1
      return { style: 'S', script: 'J' }
    })
    adapter.catalog()
    adapter.validate({ type: 'RemoveComponent', componentId: 'n1' }, screen(null))
    expect(reads).toBe(0)
  })

  it('renders the real committed bundle into a document with an upgradable Component', () => {
    const adapter = createWebAwesomeAdapter(catalog, () => loadWebAwesomeAssets(resourcesRoot))
    const html = adapter.renderToStaticHtml(
      screen(node('n1', 'wa-button', { children: [node('n2', 'wa-icon', { slot: 'start' })] }))
    )
    // The two things that make it live and offline at once: the element
    // definitions are in the file, and so is the local icon library (D-DS-8).
    expect(html).toContain('customElements')
    expect(html).toContain('registerIconLibrary')
    expect(html).not.toMatch(/https?:\/\/[^"'\s]*fontawesome[^"'\s]*\/(icons|svgs)/)
    expect(html.length).toBeGreaterThan(900_000)
  })
})
