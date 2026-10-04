// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { ChatTabBody } from './ChatTabBody'

/**
 * Decision 1's swap: the Chat & Cowork tab's body is the Hive's (Iniciativas
 * and Conversas) or the module's navigation — and the one out of sight stays
 * mounted, so the way back finds its scroll and its open folders.
 */

afterEach(() => {
  cleanup()
})

function body(designActive: boolean): ReturnType<typeof createElement> {
  return createElement(ChatTabBody, {
    designActive,
    hive: createElement('div', { 'data-testid': 'hive' }, 'conversas'),
    design: createElement('div', { 'data-testid': 'design' }, 'navegação do módulo')
  })
}

function layerOf(testId: string): HTMLElement {
  return screen.getByTestId(testId).closest('[data-chat-body]') as HTMLElement
}

describe('ChatTabBody', () => {
  it("shows the Hive's body, and does not mount the module's before its first visit", () => {
    render(body(false))
    expect(layerOf('hive').hasAttribute('data-active')).toBe(true)
    expect(screen.queryByTestId('design')).toBeNull()
  })

  it("puts the module's navigation in front, keeping the Hive's body mounted behind it", () => {
    const { rerender } = render(body(false))
    const hive = screen.getByTestId('hive')
    rerender(body(true))
    expect(layerOf('design').hasAttribute('data-active')).toBe(true)
    expect(layerOf('hive').hasAttribute('data-active')).toBe(false)
    // The very same node: nothing was torn down on the way in.
    expect(screen.getByTestId('hive')).toBe(hive)
  })

  it("keeps the module's navigation mounted after leaving it", () => {
    const { rerender } = render(body(true))
    const design = screen.getByTestId('design')
    rerender(body(false))
    expect(screen.getByTestId('design')).toBe(design)
    expect(layerOf('design').hasAttribute('data-active')).toBe(false)
    expect(layerOf('hive').hasAttribute('data-active')).toBe(true)
  })

  it('stacks the Hive first and the module second, whatever came first', () => {
    render(body(true))
    expect(
      Array.from(document.querySelectorAll('[data-chat-body]')).map((layer) =>
        layer.getAttribute('data-chat-body')
      )
    ).toEqual(['hive', 'design'])
  })
})
