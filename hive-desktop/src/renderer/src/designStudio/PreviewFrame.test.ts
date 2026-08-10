// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { PreviewFrame } from './PreviewFrame'
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
