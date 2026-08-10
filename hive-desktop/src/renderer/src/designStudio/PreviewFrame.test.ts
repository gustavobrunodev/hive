// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { PreviewFrame } from './PreviewFrame'
import { nonceFromUrl } from './previewBridge'
import { VIEWPORT_PRESETS } from './viewport'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const URL = 'hive-studio://preview/abc/index.html'

function mockPreview(openPreview = vi.fn().mockResolvedValue(URL)): {
  openPreview: ReturnType<typeof vi.fn>
  closePreview: ReturnType<typeof vi.fn>
} {
  const closePreview = vi.fn().mockResolvedValue(undefined)
  window.hive = {
    ...window.hive,
    designStudio: { openPreview, closePreview }
  } as unknown as typeof window.hive
  return { openPreview, closePreview }
}

describe('PreviewFrame (T4.6, D-DS-7)', () => {
  it('renders at the device’s real pixel size, never at the bench’s', async () => {
    mockPreview()
    render(createElement(PreviewFrame, { size: VIEWPORT_PRESETS.desktop }))

    const frame = (await screen.findByTitle('Preview da Tela')) as HTMLIFrameElement
    expect(frame.style.width).toBe('1440px')
    expect(frame.style.height).toBe('900px')
    expect(frame.width).toBe('1440')
    // The reduction belongs to an ancestor; a transform here would change the
    // width the document inside the frame sees.
    expect(frame.style.transform).toBe('')
  })

  it('follows the preset to the new real size', async () => {
    mockPreview()
    const { rerender } = render(createElement(PreviewFrame, { size: VIEWPORT_PRESETS.desktop }))
    rerender(createElement(PreviewFrame, { size: VIEWPORT_PRESETS.mobile }))

    const frame = (await screen.findByTitle('Preview da Tela')) as HTMLIFrameElement
    expect(frame.style.width).toBe('390px')
  })

  it('is sandboxed without allow-same-origin (AD-5) and points at the session URL', async () => {
    mockPreview()
    render(createElement(PreviewFrame, { size: VIEWPORT_PRESETS.mobile }))

    const frame = (await screen.findByTitle('Preview da Tela')) as HTMLIFrameElement
    await waitFor(() => expect(frame.getAttribute('src')).toBe(URL))
    expect(frame.getAttribute('sandbox')).toBe('allow-scripts')
  })

  it('retires the session on unmount, so a leaked token stops resolving', async () => {
    const { closePreview } = mockPreview()
    const { unmount } = render(createElement(PreviewFrame, { size: VIEWPORT_PRESETS.mobile }))
    await screen.findByTitle('Preview da Tela')

    unmount()
    expect(closePreview).toHaveBeenCalledWith(URL)
  })

  it('retires a session that opened after the frame was already gone', async () => {
    let settle: (url: string) => void = () => {}
    const { closePreview } = mockPreview(
      vi.fn(
        () =>
          new Promise<string>((resolve) => {
            settle = resolve
          })
      )
    )
    const { unmount } = render(createElement(PreviewFrame, { size: VIEWPORT_PRESETS.mobile }))

    unmount()
    settle(URL)
    await waitFor(() => expect(closePreview).toHaveBeenCalledWith(URL))
  })

  it('stays absent rather than throwing when the session cannot be opened', async () => {
    mockPreview(vi.fn().mockRejectedValue(new Error('sem protocolo')))
    render(createElement(PreviewFrame, { size: VIEWPORT_PRESETS.mobile }))

    const frame = (await screen.findByTitle('Preview da Tela')) as HTMLIFrameElement
    expect(frame.getAttribute('src')).toBeNull()
  })
})

/**
 * T5.1 (DS-R5 AC-4/AC-5). The stage's half of the selection. The channel is
 * the phase-3 bridge, so what is proved here is the *wiring*: the session
 * token in the URL becomes the nonce, a click inside the frame arrives as a
 * selection, and a selection made in the Árvore goes back out to the frame.
 */
describe('PreviewFrame — the selection channel (T5.1)', () => {
  const DOC = {
    screenId: 'login',
    root: { id: 'n1', tag: 'wa-card', props: {}, children: [] }
  }

  /** Messages the frame would have received, in order. */
  function outbound(frame: HTMLIFrameElement): Record<string, unknown>[] {
    const posted: Record<string, unknown>[] = []
    Object.defineProperty(frame, 'contentWindow', {
      configurable: true,
      value: {
        postMessage: (message: Record<string, unknown>) => posted.push(message)
      }
    })
    return posted
  }

  it('takes the nonce from the session URL — the token never travels twice', () => {
    expect(nonceFromUrl('hive-studio://preview/abc123/index.html')).toBe('abc123')
    expect(nonceFromUrl('hive-studio://userdata/sessions.json')).toBeNull()
  })

  it('turns a click inside the frame into a selection, nonce and source checked', async () => {
    mockPreview()
    const onSelectComponent = vi.fn()
    render(
      createElement(PreviewFrame, {
        size: VIEWPORT_PRESETS.mobile,
        document: DOC,
        onSelectComponent
      })
    )
    const frame = (await screen.findByTitle('Preview da Tela')) as HTMLIFrameElement
    await waitFor(() => expect(frame.getAttribute('src')).toBe(URL))
    const source = { postMessage: vi.fn() }
    Object.defineProperty(frame, 'contentWindow', { configurable: true, value: source })

    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'selected', nonce: 'abc', componentId: 'n1' },
        source: source as unknown as Window
      })
    )
    expect(onSelectComponent).toHaveBeenCalledWith('n1')

    // A message carrying the wrong nonce is not this frame's, whatever it says.
    onSelectComponent.mockClear()
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'selected', nonce: 'outro', componentId: 'n2' },
        source: source as unknown as Window
      })
    )
    expect(onSelectComponent).not.toHaveBeenCalled()
  })

  it('pushes the Árvore’s selection back into the frame once it has handshaken', async () => {
    mockPreview()
    const { rerender } = render(
      createElement(PreviewFrame, {
        size: VIEWPORT_PRESETS.mobile,
        document: DOC,
        selectedComponentId: null
      })
    )
    const frame = (await screen.findByTitle('Preview da Tela')) as HTMLIFrameElement
    await waitFor(() => expect(frame.getAttribute('src')).toBe(URL))
    const posted = outbound(frame)

    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'ready', nonce: 'abc' },
        source: frame.contentWindow as unknown as Window
      })
    )

    rerender(
      createElement(PreviewFrame, {
        size: VIEWPORT_PRESETS.mobile,
        document: DOC,
        selectedComponentId: 'n1'
      })
    )

    expect(posted).toContainEqual({ type: 'select', componentId: 'n1', nonce: 'abc' })
  })

  it('renders the document the tab is holding, without renavigating the frame', async () => {
    mockPreview()
    render(createElement(PreviewFrame, { size: VIEWPORT_PRESETS.mobile, document: DOC }))
    const frame = (await screen.findByTitle('Preview da Tela')) as HTMLIFrameElement
    await waitFor(() => expect(frame.getAttribute('src')).toBe(URL))
    const posted = outbound(frame)

    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'ready', nonce: 'abc' },
        source: frame.contentWindow as unknown as Window
      })
    )

    expect(posted).toContainEqual({ type: 'render', document: DOC, nonce: 'abc' })
    expect(frame.getAttribute('src')).toBe(URL)
  })
})
