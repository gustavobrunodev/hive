// @vitest-environment jsdom
import { createElement } from 'react'
import { cleanup, render } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useNavbarBounds } from './useNavbarBounds'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

it('tracks the pane boundary through resize, collapse and reorder, then disconnects', () => {
  const callbacks: (() => void)[] = []
  const disconnect = vi.fn()
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        callbacks.push(callback)
      }
      observe = vi.fn()
      disconnect = disconnect
    }
  )
  function Shell({
    pane,
    open,
    target = true
  }: {
    pane: string
    open: boolean
    target?: boolean
  }): React.JSX.Element {
    const ref = useNavbarBounds(pane, open)
    return createElement('div', { ref }, target && createElement('div', { 'data-navtop': '' }))
  }
  const view = render(createElement(Shell, { pane: 'rail', open: true }))
  const shell = view.container.firstElementChild as HTMLElement
  const pane = shell.firstElementChild as HTMLElement
  vi.spyOn(shell, 'getBoundingClientRect').mockReturnValue({ left: 8 } as DOMRect)
  vi.spyOn(pane, 'getBoundingClientRect').mockReturnValue({ right: 288 } as DOMRect)
  callbacks[0]()
  expect(shell.style.getPropertyValue('--wb-navbar-width')).toBe('280px')
  view.rerender(createElement(Shell, { pane: 'chat', open: false }))
  expect(disconnect).toHaveBeenCalledTimes(1)
  expect(callbacks).toHaveLength(2)
  view.rerender(createElement(Shell, { pane: 'viewer', open: false, target: false }))
  expect(disconnect).toHaveBeenCalledTimes(2)
  expect(callbacks).toHaveLength(2)
})
