// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPreviewBridge, type PreviewBridge } from './previewBridge'
import type { PreviewDocument } from '../../../preview/messages'

/**
 * design-studio T3.7 (D-DS-4, R-5).
 *
 * The frame's origin is opaque — `event.origin` is the string `"null"` — so
 * the two controls that replace it are what these tests are about, and each
 * gets its own case because each defends a different attack:
 *   - **wrong source**: another window on the page posting to us. Only the
 *     `event.source` identity check stops it.
 *   - **wrong nonce**: something that reached the right window object without
 *     ever seeing the frame's URL. Only the nonce check stops it.
 * A test that mixes them would pass even if one control were deleted.
 */

const NONCE = 'a'.repeat(64)

const DOCUMENT: PreviewDocument = {
  screenId: 'login',
  root: { id: 'n1', tag: 'wa-page', props: {}, children: [] }
}

interface FakeWindow {
  postMessage: ReturnType<typeof vi.fn>
}

describe('previewBridge', () => {
  let frame: HTMLIFrameElement
  let frameWindow: FakeWindow
  let bridge: PreviewBridge

  /** Delivers a message as if it came from `source`. */
  function deliver(data: unknown, source: unknown = frameWindow): void {
    const event = new MessageEvent('message', { data })
    // jsdom will not let `source` be an arbitrary object through the
    // constructor, so it is defined on the event directly.
    Object.defineProperty(event, 'source', { value: source })
    window.dispatchEvent(event)
  }

  beforeEach(() => {
    frameWindow = { postMessage: vi.fn() }
    frame = document.createElement('iframe')
    Object.defineProperty(frame, 'contentWindow', { value: frameWindow })
    document.body.appendChild(frame)
  })

  afterEach(() => {
    bridge?.dispose()
    document.body.replaceChildren()
  })

  describe('the two controls that replace origin-matching', () => {
    it('ignores a forged message from another window, even with the right nonce', () => {
      const onReady = vi.fn()
      const onSelected = vi.fn()
      bridge = createPreviewBridge({ frame, nonce: NONCE, onReady, onSelected })

      const otherWindow = { postMessage: vi.fn() }
      deliver({ type: 'ready', nonce: NONCE }, otherWindow)
      deliver({ type: 'selected', nonce: NONCE, componentId: 'n1' }, otherWindow)

      expect(onReady).not.toHaveBeenCalled()
      expect(onSelected).not.toHaveBeenCalled()
      expect(bridge.isReady()).toBe(false)
    })

    it('ignores a message with the wrong nonce, even from the real frame window', () => {
      const onReady = vi.fn()
      const onSelected = vi.fn()
      bridge = createPreviewBridge({ frame, nonce: NONCE, onReady, onSelected })

      deliver({ type: 'ready', nonce: 'b'.repeat(64) })
      deliver({ type: 'selected', nonce: 'b'.repeat(64), componentId: 'n1' })

      expect(onReady).not.toHaveBeenCalled()
      expect(onSelected).not.toHaveBeenCalled()
      expect(bridge.isReady()).toBe(false)
    })

    it('ignores a message with no nonce at all', () => {
      const onReady = vi.fn()
      bridge = createPreviewBridge({ frame, nonce: NONCE, onReady })

      deliver({ type: 'ready' })
      deliver({ type: 'ready', nonce: 42 })
      deliver('ready')
      deliver(null)

      expect(onReady).not.toHaveBeenCalled()
    })

    it('never trusts event.origin, which is the opaque "null" for this frame', () => {
      // The same `"null"` any sandboxed document produces. Accepting it would
      // accept every one of them; the bridge does not look at it, so a message
      // carrying it is judged purely on source + nonce.
      const onReady = vi.fn()
      bridge = createPreviewBridge({ frame, nonce: NONCE, onReady })

      const event = new MessageEvent('message', {
        data: { type: 'ready', nonce: NONCE },
        origin: 'null'
      })
      Object.defineProperty(event, 'source', { value: { postMessage: vi.fn() } })
      window.dispatchEvent(event)

      expect(onReady).not.toHaveBeenCalled()
    })

    it('ignores a message type outside the frame→parent vocabulary', () => {
      const onSelected = vi.fn()
      bridge = createPreviewBridge({ frame, nonce: NONCE, onSelected })
      deliver({ type: 'ready', nonce: NONCE })

      deliver({ type: 'render', nonce: NONCE, document: DOCUMENT })
      expect(onSelected).not.toHaveBeenCalled()
    })
  })

  describe('the handshake', () => {
    it('accepts ready only from the real frame with the real nonce', () => {
      const onReady = vi.fn()
      bridge = createPreviewBridge({ frame, nonce: NONCE, onReady })

      deliver({ type: 'ready', nonce: NONCE })

      expect(onReady).toHaveBeenCalledTimes(1)
      expect(bridge.isReady()).toBe(true)
    })

    it('holds a document sent before the handshake and flushes it on ready', () => {
      bridge = createPreviewBridge({ frame, nonce: NONCE })
      bridge.render(DOCUMENT)
      expect(frameWindow.postMessage).not.toHaveBeenCalled()

      deliver({ type: 'ready', nonce: NONCE })
      expect(frameWindow.postMessage).toHaveBeenCalledWith(
        { type: 'render', nonce: NONCE, document: DOCUMENT },
        '*'
      )
    })

    it('flushes only the latest document — earlier ones are stale snapshots', () => {
      const later: PreviewDocument = { screenId: 'login', root: null }
      bridge = createPreviewBridge({ frame, nonce: NONCE })
      bridge.render(DOCUMENT)
      bridge.render(later)

      deliver({ type: 'ready', nonce: NONCE })
      expect(frameWindow.postMessage).toHaveBeenCalledTimes(1)
      expect(frameWindow.postMessage).toHaveBeenCalledWith(
        { type: 'render', nonce: NONCE, document: later },
        '*'
      )
    })
  })

  describe('sending', () => {
    beforeEach(() => {
      bridge = createPreviewBridge({ frame, nonce: NONCE })
      deliver({ type: 'ready', nonce: NONCE })
      frameWindow.postMessage.mockClear()
    })

    it('stamps the nonce on every outbound message', () => {
      bridge.render(DOCUMENT)
      bridge.select('n1')

      expect(frameWindow.postMessage).toHaveBeenNthCalledWith(
        1,
        { type: 'render', nonce: NONCE, document: DOCUMENT },
        '*'
      )
      expect(frameWindow.postMessage).toHaveBeenNthCalledWith(
        2,
        { type: 'select', nonce: NONCE, componentId: 'n1' },
        '*'
      )
    })

    it("targets '*', because an opaque origin cannot be named", () => {
      bridge.render(DOCUMENT)
      expect(frameWindow.postMessage.mock.calls[0][1]).toBe('*')
    })

    it('says nothing when the frame has no contentWindow yet', () => {
      const detached = document.createElement('iframe')
      const other = createPreviewBridge({ frame: detached, nonce: NONCE })
      expect(() => other.select('n1')).not.toThrow()
      other.dispose()
    })
  })

  describe('selection coming back from the stage', () => {
    it('reports the clicked Component id', () => {
      const onSelected = vi.fn()
      bridge = createPreviewBridge({ frame, nonce: NONCE, onSelected })
      deliver({ type: 'ready', nonce: NONCE })

      deliver({ type: 'selected', nonce: NONCE, componentId: 'n4' })
      expect(onSelected).toHaveBeenCalledWith('n4')
    })

    it('reports a cleared selection as null, not as nothing', () => {
      const onSelected = vi.fn()
      bridge = createPreviewBridge({ frame, nonce: NONCE, onSelected })
      deliver({ type: 'ready', nonce: NONCE })

      deliver({ type: 'selected', nonce: NONCE, componentId: null })
      expect(onSelected).toHaveBeenCalledWith(null)
    })
  })

  it('stops listening after dispose', () => {
    const onReady = vi.fn()
    bridge = createPreviewBridge({ frame, nonce: NONCE, onReady })
    bridge.dispose()

    deliver({ type: 'ready', nonce: NONCE })
    expect(onReady).not.toHaveBeenCalled()
  })
})
