// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { cleanup, render } from '@testing-library/react'
import { HtmlPreview } from './HtmlPreview'

/**
 * Task T4 — HTML live preview component (design.md §6, context.md C4,
 * UX-R8.1/8.2/8.3).
 *
 * Covers the security posture (sandbox value, no allow-same-origin) and the
 * `reloadKey`-driven remount that resets injected script state on disk
 * reloads — plain `srcDoc` prop diffing wouldn't do that on its own.
 */
describe('HtmlPreview (T4)', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders an iframe with sandbox="allow-scripts" and srcDoc set to source', () => {
    const { container } = render(
      createElement(HtmlPreview, { source: '<p>hello</p>', reloadKey: 'v1' })
    )

    const iframe = container.querySelector('iframe') as HTMLIFrameElement
    expect(iframe).not.toBeNull()
    expect(iframe.getAttribute('sandbox')).toBe('allow-scripts')
    expect(iframe.getAttribute('srcdoc')).toBe('<p>hello</p>')
  })

  it('updates srcDoc when source changes without changing reloadKey', () => {
    const { container, rerender } = render(
      createElement(HtmlPreview, { source: '<p>one</p>', reloadKey: 'v1' })
    )
    const first = container.querySelector('iframe') as HTMLIFrameElement
    expect(first.getAttribute('srcdoc')).toBe('<p>one</p>')

    rerender(createElement(HtmlPreview, { source: '<p>two</p>', reloadKey: 'v1' }))
    const second = container.querySelector('iframe') as HTMLIFrameElement
    expect(second.getAttribute('srcdoc')).toBe('<p>two</p>')
    // Same key ⇒ React reuses the same DOM node instead of remounting.
    expect(second).toBe(first)
  })

  it('remounts the iframe (new DOM node) when reloadKey changes', () => {
    const { container, rerender } = render(
      createElement(HtmlPreview, { source: '<p>same</p>', reloadKey: 'v1' })
    )
    const first = container.querySelector('iframe') as HTMLIFrameElement

    rerender(createElement(HtmlPreview, { source: '<p>same</p>', reloadKey: 'v2' }))
    const second = container.querySelector('iframe') as HTMLIFrameElement

    expect(second).not.toBe(first)
  })
})
