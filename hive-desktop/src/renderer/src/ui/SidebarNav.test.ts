// @vitest-environment jsdom
import { createElement, useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SidebarGroupLabel, SidebarNavItem, SidebarTabs } from './SidebarNav'
import { SIDEBAR_REGION_ID, type SidebarTab } from './sidebarNav'

afterEach(cleanup)

describe('SidebarTabs', () => {
  it('exposes two named tabs and one tab stop controlling the sidebar', () => {
    const onSelect = vi.fn()
    render(createElement(SidebarTabs, { active: 'chat', onSelect }))
    expect(screen.getByRole('tablist', { name: 'Seções' })).toBeTruthy()
    const tabs = screen.getAllByRole('tab')
    expect(tabs.map((tab) => tab.textContent)).toEqual(['Chat & Cowork', 'Arquivos'])
    expect(tabs.map((tab) => tab.tabIndex)).toEqual([0, -1])
    expect(tabs.map((tab) => tab.getAttribute('aria-selected'))).toEqual(['true', 'false'])
    expect(tabs.map((tab) => tab.getAttribute('aria-controls'))).toEqual([
      SIDEBAR_REGION_ID,
      SIDEBAR_REGION_ID
    ])
    fireEvent.click(tabs[1])
    expect(onSelect).toHaveBeenCalledWith('files')
    fireEvent.click(tabs[0])
    expect(onSelect).toHaveBeenLastCalledWith('chat')
  })

  it('moves selection and focus with arrows, wraps, and supports Home and End', () => {
    function Fixture(): React.JSX.Element {
      const [active, setActive] = useState<SidebarTab>('chat')
      return createElement(SidebarTabs, { active, onSelect: setActive })
    }
    render(createElement(Fixture))
    const chat = screen.getByRole('tab', { name: 'Chat & Cowork' })
    const files = screen.getByRole('tab', { name: 'Arquivos' })
    const moves = [
      [chat, 'ArrowRight', files],
      [files, 'ArrowRight', chat],
      [chat, 'ArrowLeft', files],
      [files, 'ArrowLeft', chat],
      [chat, 'End', files],
      [files, 'Home', chat]
    ] as const
    for (const [origin, key, target] of moves) {
      expect(fireEvent.keyDown(origin, { key })).toBe(false)
      expect(document.activeElement).toBe(target)
      expect(target.getAttribute('aria-selected')).toBe('true')
      expect(target.tabIndex).toBe(0)
      expect(origin.tabIndex).toBe(-1)
    }
  })

  it('leaves Tab and other unrelated keys to the browser', () => {
    const onSelect = vi.fn()
    render(createElement(SidebarTabs, { active: 'files', onSelect }))
    const files = screen.getByRole('tab', { name: 'Arquivos' })
    for (const key of ['Tab', 'ArrowDown', 'Escape']) {
      expect(fireEvent.keyDown(files, { key })).toBe(true)
    }
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('keeps layout controls outside the tablist and preserves pane drag events', () => {
    const onDragStart = vi.fn()
    render(
      createElement(SidebarTabs, {
        active: 'chat',
        onSelect: vi.fn(),
        trailing: createElement('button', null, 'Layout'),
        dragProps: { draggable: true, onDragStart }
      })
    )
    expect(screen.getByRole('tablist').contains(screen.getByRole('button'))).toBe(false)
    const bar = screen.getByRole('tablist').parentElement!
    expect(bar.draggable).toBe(true)
    fireEvent.dragStart(bar)
    expect(onDragStart).toHaveBeenCalledOnce()
  })
})

describe('SidebarNavItem', () => {
  it('announces the active view, its hide action, and the badge meaning', () => {
    const onSelect = vi.fn()
    render(
      createElement(SidebarNavItem, {
        view: 'scm',
        label: 'Controle de versão',
        icon: createElement('svg'),
        active: true,
        togglesOff: true,
        count: 120,
        detail: '120 alterações pendentes',
        dot: true,
        onSelect,
        'aria-keyshortcuts': 'Control+Shift+G',
        'data-tour': 'git'
      })
    )
    const button = screen.getByRole('button', {
      name: 'Ocultar Controle de versão — 120 alterações pendentes'
    })
    expect(button.getAttribute('aria-current')).toBe('true')
    expect(button.getAttribute('aria-expanded')).toBe('true')
    expect(button.getAttribute('aria-controls')).toBe(SIDEBAR_REGION_ID)
    expect(button.getAttribute('aria-keyshortcuts')).toBe('Control+Shift+G')
    expect(button.getAttribute('data-tour')).toBe('git')
    expect(button.querySelector('.wb-nav-item-badge')?.textContent).toBe('99+')
    expect(button.querySelector('.wb-nav-item-dot')?.getAttribute('aria-hidden')).toBe('true')
    fireEvent.click(button)
    expect(onSelect).toHaveBeenCalledOnce()
  })

  it('exposes a hidden view without announcing a current state or empty detail', () => {
    render(
      createElement(SidebarNavItem, {
        view: 'review',
        label: 'Revisão do agente',
        icon: createElement('svg'),
        count: 3,
        detail: '',
        onSelect: vi.fn()
      })
    )
    const button = screen.getByRole('button', { name: 'Revisão do agente' })
    expect(button.getAttribute('aria-expanded')).toBe('false')
    expect(button.hasAttribute('aria-current')).toBe(false)
    expect(button.hasAttribute('data-active')).toBe(false)
    expect(button.querySelector('.wb-nav-item-badge')?.textContent).toBe('3')
    expect(button.querySelector('.wb-nav-item-dot')).toBeNull()
  })

  it('keeps dialog actions free of disclosure attributes and empty badges', () => {
    render(
      createElement(SidebarNavItem, {
        label: 'Estúdio de skills',
        icon: createElement('svg'),
        onSelect: vi.fn()
      })
    )
    const button = screen.getByRole('button', { name: 'Estúdio de skills' })
    expect(button.hasAttribute('aria-expanded')).toBe(false)
    expect(button.hasAttribute('aria-controls')).toBe(false)
    expect(button.querySelector('.wb-nav-item-badge')).toBeNull()
  })

  it('gives tool groups a discoverable heading', () => {
    render(createElement(SidebarGroupLabel, null, 'Ferramentas do chat'))
    expect(screen.getByRole('heading', { level: 2, name: 'Ferramentas do chat' })).toBeTruthy()
  })
})
