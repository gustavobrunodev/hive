// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { cleanup, render } from '@testing-library/react'
import {
  DesignStudioIcon,
  DorIcon,
  FonteIcon,
  FullStoryIcon,
  HomeIcon,
  LikertIcon,
  RelatorioIcon,
  VozIcon
} from './icons'

afterEach(() => {
  cleanup()
})

describe('Design Studio icons', () => {
  it.each([
    ['DesignStudioIcon', DesignStudioIcon],
    ['HomeIcon', HomeIcon],
    ['DorIcon', DorIcon],
    ['RelatorioIcon', RelatorioIcon],
    ['LikertIcon', LikertIcon],
    ['VozIcon', VozIcon],
    ['FullStoryIcon', FullStoryIcon]
  ])('%s is a 16px decorative glyph in the text colour, resizable', (_name, Icon) => {
    const { container, rerender } = render(createElement(Icon))
    const svg = container.querySelector('svg') as SVGElement
    expect(svg.getAttribute('width')).toBe('16')
    expect(svg.getAttribute('stroke')).toBe('currentColor')
    expect(svg.getAttribute('aria-hidden')).toBe('true')

    rerender(createElement(Icon, { size: 20 }))
    expect((container.querySelector('svg') as SVGElement).getAttribute('height')).toBe('20')
  })
})

describe('FonteIcon', () => {
  it.each([
    ['likert', LikertIcon],
    ['voz', VozIcon],
    ['fullstory', FullStoryIcon]
  ] as const)('draws the %s glyph', (fonte, Icon) => {
    const ours = render(createElement(FonteIcon, { fonte })).container.innerHTML
    cleanup()
    expect(ours).toBe(render(createElement(Icon)).container.innerHTML)
  })
})
