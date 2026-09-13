// @vitest-environment jsdom
import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { UserMenu, type UserMenuProps } from './UserMenu'

afterEach(cleanup)

function props(overrides: Partial<UserMenuProps> = {}): UserMenuProps {
  return {
    userName: '  Ana Maria Silva  ',
    role: 'dev',
    onOpenSettings: vi.fn(),
    onOpenApp: vi.fn(),
    onSignOut: vi.fn(),
    ...overrides
  }
}

function openMenu(): HTMLElement {
  const trigger = screen.getByRole('button', { name: /menu do usuário/i })
  fireEvent.keyDown(trigger, { key: 'Enter' })
  return trigger
}

describe('UserMenu', () => {
  it('shows trimmed identity and initials in the avatar and menu', async () => {
    render(createElement(UserMenu, props()))
    const trigger = screen.getByRole('button', { name: 'Menu do usuário: Ana Maria Silva' })
    expect(trigger.querySelector('.wb-usermenu-avatar')?.textContent).toBe('AS')
    expect(trigger.querySelector('.wb-usermenu-role')?.textContent).toBe('Desenvolvedor')
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu')
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    openMenu()
    const menu = await screen.findByRole('menu')
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(menu.querySelector('.wb-usermenu-head-name')?.textContent).toBe('Ana Maria Silva')
    expect(menu.querySelector('.wb-usermenu-head-avatar')?.textContent).toBe('AS')
    expect(menu.querySelector('.wb-usermenu-head-role')?.textContent).toBe('Desenvolvedor')
    expect(within(menu).getAllByRole('menuitem')).toHaveLength(3)
    expect(trigger.hasAttribute('aria-describedby')).toBe(false)
    expect(menu.querySelector('.wb-usermenu-item-dot')).toBeNull()
  })

  it.each([null, '', '   '])('uses the unnamed avatar fallback for %j', async (userName) => {
    render(createElement(UserMenu, props({ userName, role: null })))
    const trigger = screen.getByRole('button', { name: 'Abrir menu do usuário' })
    expect(trigger.querySelector('.wb-usermenu-name')?.textContent).toBe('Sem nome')
    expect(trigger.querySelector('.wb-usermenu-avatar svg')).toBeTruthy()
    expect(trigger.querySelector('.wb-usermenu-role')?.textContent).toBe('Geral')
    openMenu()
    const menu = await screen.findByRole('menu')
    expect(menu.querySelector('.wb-usermenu-head-name')?.textContent).toBe('Sem nome')
    expect(menu.querySelector('.wb-usermenu-head-avatar svg')).toBeTruthy()
  })

  it('announces pending updates from the closed avatar and the update destination', async () => {
    const options = props({ updatePending: true })
    const view = render(createElement(UserMenu, options))
    const trigger = screen.getByRole('button', { name: /Menu do usuário:/ })
    const description = document.getElementById(trigger.getAttribute('aria-describedby')!)
    expect(description?.textContent).toBe('Atualização disponível')
    expect(trigger.querySelector('.wb-usermenu-dot')).toBeTruthy()
    openMenu()
    const menu = await screen.findByRole('menu')
    const updateItem = within(menu).getByRole('menuitem', { name: /Versão e atualizações/ })
    expect(updateItem.querySelector('[aria-label="Atualização disponível"]')).toBeTruthy()
    view.rerender(createElement(UserMenu, { ...options, updatePending: false }))
    expect(trigger.hasAttribute('aria-describedby')).toBe(false)
    expect(trigger.querySelector('.wb-usermenu-dot')).toBeNull()
    expect(updateItem.querySelector('[aria-label="Atualização disponível"]')).toBeNull()
  })

  it.each([
    ['Configurações', 'onOpenSettings'],
    ['Versão e atualizações', 'onOpenApp'],
    ['Sair do Hive', 'onSignOut']
  ] as const)('opens %s and dismisses its menu', async (label, action) => {
    const options = props()
    render(createElement(UserMenu, options))
    const trigger = openMenu()
    const item = await screen.findByRole('menuitem', { name: new RegExp(`^${label}`) })
    fireEvent.click(item)
    expect(options[action]).toHaveBeenCalledOnce()
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
    await waitFor(() => expect(document.activeElement).toBe(trigger))
  })

  it('supports keyboard selection, Escape and returning focus to the avatar', async () => {
    const options = props()
    render(createElement(UserMenu, options))
    const trigger = openMenu()
    const settings = await screen.findByRole('menuitem', { name: /^Configurações/ })
    await waitFor(() => expect(document.activeElement).toBe(settings))
    fireEvent.keyDown(settings, { key: 'ArrowDown' })
    const updates = screen.getByRole('menuitem', { name: /^Versão e atualizações/ })
    await waitFor(() => expect(document.activeElement).toBe(updates))
    fireEvent.keyDown(updates, { key: 'Enter' })
    expect(options.onOpenApp).toHaveBeenCalledOnce()
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
    openMenu()
    const menu = await screen.findByRole('menu')
    fireEvent.keyDown(menu, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
    await waitFor(() => expect(document.activeElement).toBe(trigger))
  })
})
