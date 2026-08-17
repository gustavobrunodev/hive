// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createContext, createElement, type ReactNode } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ThemePicker } from './ThemePicker'
import { HiveLogo } from './HiveLogo'

const RadioGroupCtx = createContext<{ value?: string; onValueChange?: (v: string) => void }>({})
const MenuCtx = createContext<{ onOpenChange?: (open: boolean) => void }>({})

vi.mock('@hive/design-system', async () => {
  const react = await import('react')
  return {
    DropdownMenu: ({
      onOpenChange,
      children
    }: {
      onOpenChange?: (open: boolean) => void
      children?: ReactNode
    }) => react.createElement(MenuCtx.Provider, { value: { onOpenChange } }, children),
    DropdownMenuTrigger: ({ children }: { children?: ReactNode }) => {
      const ctx = react.useContext(MenuCtx)
      if (!react.isValidElement(children)) return children
      const element = children as React.ReactElement<{ onClick?: () => void }>
      return react.cloneElement(element, { onClick: () => ctx.onOpenChange?.(true) })
    },
    DropdownMenuContent: ({ children }: { children?: ReactNode }) =>
      react.createElement('div', { role: 'menu' }, children),
    DropdownMenuLabel: ({ children }: { children?: ReactNode }) =>
      react.createElement('div', { role: 'presentation' }, children),
    DropdownMenuRadioGroup: ({
      value,
      onValueChange,
      children
    }: {
      value?: string
      onValueChange?: (v: string) => void
      children?: ReactNode
    }) =>
      react.createElement(RadioGroupCtx.Provider, { value: { value, onValueChange } }, children),
    DropdownMenuRadioItem: ({ value, children }: { value: string; children?: ReactNode }) => {
      const ctx = react.useContext(RadioGroupCtx)
      return react.createElement(
        'button',
        {
          type: 'button',
          role: 'menuitemradio',
          'aria-checked': ctx.value === value,
          onClick: () => ctx.onValueChange?.(value)
        },
        children
      )
    },
    Logo: ({ mark, 'aria-label': ariaLabel }: { mark?: string; 'aria-label'?: string }) =>
      react.createElement('span', {
        'data-testid': 'logo',
        'data-mark': mark,
        role: 'img',
        'aria-label': ariaLabel ?? 'Hive'
      })
  }
})

describe('ThemePicker', () => {
  afterEach(cleanup)

  it('names the active theme on the trigger, so the control says where you are', () => {
    render(createElement(ThemePicker, { theme: 'hive', onSelectTheme: vi.fn() }))

    expect(screen.getByRole('button', { name: 'Aparência (atual: Hive)' })).toBeTruthy()
  })

  it('lists the three themes with a name, a hint and a swatch of their own colours', () => {
    render(createElement(ThemePicker, { theme: 'dark', onSelectTheme: vi.fn() }))
    fireEvent.click(screen.getByRole('button', { name: /^Aparência/ }))

    const options = screen.getAllByRole('menuitemradio')
    expect(options.map((option) => option.textContent)).toEqual([
      'EscuroGrafite neutro, para horas de leitura',
      'ClaroPara ambientes bem iluminados',
      'HiveEscuro, nas cores da marca'
    ])

    // The swatch is painted from literal hex, not role tokens: a preview of a
    // theme you are not in cannot be drawn in the theme you are in.
    const swatch = options[2].querySelector<HTMLElement>('.wb-theme-swatch')
    expect(swatch?.style.getPropertyValue('--wb-swatch-bg')).toBe('#260a12')
    expect(swatch?.style.getPropertyValue('--wb-swatch-accent')).toBe('#cc7958')
  })

  it('marks the active theme and reports a pick', () => {
    const onSelectTheme = vi.fn()
    render(createElement(ThemePicker, { theme: 'light', onSelectTheme }))
    fireEvent.click(screen.getByRole('button', { name: /^Aparência/ }))

    expect(
      screen.getAllByRole('menuitemradio').map((option) => option.getAttribute('aria-checked'))
    ).toEqual(['false', 'true', 'false'])

    fireEvent.click(screen.getByRole('menuitemradio', { name: /^Hive/ }))
    expect(onSelectTheme).toHaveBeenCalledWith('hive')
  })
})

describe('HiveLogo', () => {
  afterEach(cleanup)

  it('defaults to the horizontal lockup — the identity for app chrome', () => {
    render(createElement(HiveLogo, {}))

    expect(screen.getByTestId('logo').getAttribute('data-mark')).toBe('lockup')
  })

  it('keeps the design system’s label unless the caller supplies one', () => {
    // The DS sets `aria-label="Hive"` and then spreads props over it, so
    // forwarding an explicit `undefined` would delete the accessible name
    // rather than leave the default in place.
    render(createElement(HiveLogo, {}))
    expect(screen.getByRole('img').getAttribute('aria-label')).toBe('Hive')

    cleanup()
    render(createElement(HiveLogo, { 'aria-label': 'Rótulo do chamador' }))
    expect(screen.getByRole('img').getAttribute('aria-label')).toBe('Rótulo do chamador')
  })
})
