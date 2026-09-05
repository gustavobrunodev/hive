// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { SidebarHost } from './SidebarHost'
import type { SidebarView } from './ActionRail'

afterEach(() => {
  cleanup()
})

const explorer = createElement('div', { 'data-testid': 'explorer-body' }, 'tree')
const scm = createElement('div', { 'data-testid': 'scm-body' }, 'source control')
const review = createElement('div', { 'data-testid': 'review-body' }, 'agent review')
const brain = createElement('div', { 'data-testid': 'brain-body' }, 'second brain')

/** The layer a body sits in — what carries the active/hidden state. */
function layerOf(testId: string): HTMLElement {
  const layer = screen.getByTestId(testId).closest('.wb-sidebar-layer')
  if (!(layer instanceof HTMLElement)) throw new Error(`no layer around ${testId}`)
  return layer
}

/** Renders the host on one view. */
function host(activeView: SidebarView): ReturnType<typeof render> {
  return render(createElement(SidebarHost, { activeView, explorer, scm, review, brain }))
}

describe('SidebarHost', () => {
  it('shows only the active view, and does not mount the ones never visited', () => {
    host('explorer')

    expect(layerOf('explorer-body').hasAttribute('data-active')).toBe(true)
    // Nothing else has been asked for yet — an unvisited view costs nothing.
    expect(screen.queryByTestId('scm-body')).toBeNull()
    expect(screen.queryByTestId('review-body')).toBeNull()
    expect(screen.queryByTestId('brain-body')).toBeNull()
  })

  it.each<[SidebarView, string]>([
    ['scm', 'scm-body'],
    ['review', 'review-body'],
    ['brain', 'brain-body']
  ])('activates the %s view when it is selected', (view, testId) => {
    host(view)
    expect(layerOf(testId).hasAttribute('data-active')).toBe(true)
  })

  /**
   * The whole reason the layers exist: leaving a view and coming back must not
   * be the same as opening it for the first time. Unmounting the Explorer is
   * what used to close every folder and scroll the tree back to the top.
   */
  it('keeps a visited view mounted (but inactive) after switching away from it', () => {
    const { rerender } = host('explorer')

    rerender(createElement(SidebarHost, { activeView: 'scm', explorer, scm, review, brain }))

    // Still in the DOM, still holding its own state — just not the visible layer.
    expect(screen.getByTestId('explorer-body')).toBeTruthy()
    expect(layerOf('explorer-body').hasAttribute('data-active')).toBe(false)
    expect(layerOf('scm-body').hasAttribute('data-active')).toBe(true)
  })

  it('returns to the same, still-mounted view without recreating it', () => {
    const { rerender } = host('explorer')
    const first = screen.getByTestId('explorer-body')

    rerender(createElement(SidebarHost, { activeView: 'brain', explorer, scm, review, brain }))
    rerender(createElement(SidebarHost, { activeView: 'explorer', explorer, scm, review, brain }))

    // The very same node: a remount would have replaced it, taking its state with it.
    expect(screen.getByTestId('explorer-body')).toBe(first)
    expect(layerOf('explorer-body').hasAttribute('data-active')).toBe(true)
    expect(layerOf('brain-body').hasAttribute('data-active')).toBe(false)
  })

  it('keeps the layers in rail order regardless of the order they were visited in', () => {
    const { rerender } = host('brain')
    rerender(createElement(SidebarHost, { activeView: 'scm', explorer, scm, review, brain }))
    rerender(createElement(SidebarHost, { activeView: 'explorer', explorer, scm, review, brain }))

    const views = Array.from(document.querySelectorAll('.wb-sidebar-layer')).map((layer) =>
      layer.getAttribute('data-view')
    )
    expect(views).toEqual(['explorer', 'scm', 'brain'])
  })
})
