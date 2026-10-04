// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { SidebarHost } from './SidebarHost'
import type { SidebarView } from './sidebarNav'

afterEach(() => {
  cleanup()
})

const chat = createElement('div', { 'data-testid': 'chat-body' }, 'conversations')
const explorer = createElement('div', { 'data-testid': 'explorer-body' }, 'tree')
const scm = createElement('div', { 'data-testid': 'scm-body' }, 'source control')

/** The layer a body sits in — what carries the active/hidden state. */
function layerOf(testId: string): HTMLElement {
  const layer = screen.getByTestId(testId).closest('.wb-sidebar-layer')
  if (!(layer instanceof HTMLElement)) throw new Error(`no layer around ${testId}`)
  return layer
}

/** Renders the host on one view. */
function host(activeView: SidebarView): ReturnType<typeof render> {
  return render(createElement(SidebarHost, { activeView, chat, explorer, scm }))
}

describe('SidebarHost', () => {
  it('shows only the active view, and does not mount the ones never visited', () => {
    host('explorer')

    expect(layerOf('explorer-body').hasAttribute('data-active')).toBe(true)
    // Nothing else has been asked for yet — an unvisited view costs nothing.
    expect(screen.queryByTestId('scm-body')).toBeNull()
    expect(screen.queryByTestId('chat-body')).toBeNull()
  })

  it.each<[SidebarView, string]>([
    ['chat', 'chat-body'],
    ['scm', 'scm-body'],
    ['explorer', 'explorer-body']
  ])('activates the %s view when it is selected', (view, testId) => {
    host(view)
    expect(layerOf(testId).hasAttribute('data-active')).toBe(true)
  })

  /**
   * The host swaps the *navigation* surfaces only. "Revisão do agente" and
   * "Bases de conhecimento" used to be layers in here too, and that is exactly
   * what made opening one cost the user their conversation history — they are
   * work-area panes now (`WorkView`), so this host never hears about them.
   */
  it('has no layer for the chat tools, which live in the work area now', () => {
    host('chat')
    const views = Array.from(document.querySelectorAll('.wb-sidebar-layer')).map((layer) =>
      layer.getAttribute('data-view')
    )
    expect(views).not.toContain('review')
    expect(views).not.toContain('brain')
  })

  /**
   * The whole reason the layers exist: leaving a view and coming back must not
   * be the same as opening it for the first time. Unmounting the Explorer is
   * what used to close every folder and scroll the tree back to the top.
   */
  it('keeps a visited view mounted (but inactive) after switching away from it', () => {
    const { rerender } = host('explorer')

    rerender(createElement(SidebarHost, { activeView: 'scm', chat, explorer, scm }))

    // Still in the DOM, still holding its own state — just not the visible layer.
    expect(screen.getByTestId('explorer-body')).toBeTruthy()
    expect(layerOf('explorer-body').hasAttribute('data-active')).toBe(false)
    expect(layerOf('scm-body').hasAttribute('data-active')).toBe(true)
  })

  it('returns to the same, still-mounted view without recreating it', () => {
    const { rerender } = host('explorer')
    const first = screen.getByTestId('explorer-body')

    rerender(createElement(SidebarHost, { activeView: 'chat', chat, explorer, scm }))
    rerender(createElement(SidebarHost, { activeView: 'explorer', chat, explorer, scm }))

    // The very same node: a remount would have replaced it, taking its state with it.
    expect(screen.getByTestId('explorer-body')).toBe(first)
    expect(layerOf('explorer-body').hasAttribute('data-active')).toBe(true)
    expect(layerOf('chat-body').hasAttribute('data-active')).toBe(false)
  })

  it('keeps the layers in rail order regardless of the order they were visited in', () => {
    const { rerender } = host('scm')
    rerender(createElement(SidebarHost, { activeView: 'chat', chat, explorer, scm }))
    rerender(createElement(SidebarHost, { activeView: 'explorer', chat, explorer, scm }))

    const views = Array.from(document.querySelectorAll('.wb-sidebar-layer')).map((layer) =>
      layer.getAttribute('data-view')
    )
    expect(views).toEqual(['chat', 'explorer', 'scm'])
  })
})

describe('SidebarHost — the column foot', () => {
  it('pins the foot after every body, whichever view is showing', () => {
    render(
      createElement(SidebarHost, {
        activeView: 'chat',
        chat,
        explorer,
        scm,
        foot: createElement('span', { 'data-testid': 'foot' }, 'perfil')
      })
    )
    const foot = screen.getByTestId('foot').closest('.wb-sidebar-foot') as HTMLElement
    expect(foot).not.toBeNull()
    const host = document.querySelector('.wb-sidebar-host') as HTMLElement
    expect(host.compareDocumentPosition(foot) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(host.contains(foot)).toBe(false)
  })

  it('keeps the foot strip even while it holds nothing (the sidebar hidden)', () => {
    render(createElement(SidebarHost, { activeView: 'chat', chat, explorer, scm, foot: false }))
    expect(document.querySelector('.wb-sidebar-foot')?.childNodes.length).toBe(0)
  })

  it('has no foot when none is asked for', () => {
    host('chat')
    expect(document.querySelector('.wb-sidebar-foot')).toBeNull()
  })
})
