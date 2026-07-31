// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { cleanup, render, screen, fireEvent } from '@testing-library/react'
import { WorkspacePicker } from './WorkspacePicker'

/**
 * P1-004 — the very first screen of the app (design.md §5.1, T6). It has one
 * job (hand the click to the native folder picker) and one property that is
 * easy to lose in a refactor: it is a welcome, not a bare empty state. Both
 * are pinned here, co-located, instead of only incidentally through App.test.
 */
vi.mock('@hive/design-system', () => ({
  Button: ({ children, ...rest }: { children?: ReactNode; cut?: boolean }) => {
    delete rest.cut
    return createElement('button', { type: 'button', ...rest }, children)
  },
  // Reached through `HiveLogo`, which this screen renders directly.
  Logo: () => createElement('span')
}))

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('WorkspacePicker (P1-004)', () => {
  it('welcomes and explains what a workspace is before asking for one', () => {
    render(createElement(WorkspacePicker, { onChooseWorkspace: vi.fn() }))

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Bem-vindo ao Hive')
    expect(screen.getByText(/Escolha uma pasta no seu computador/)).toBeTruthy()
  })

  it('hands the CTA click to the caller (which opens the native picker)', () => {
    const onChooseWorkspace = vi.fn()
    render(createElement(WorkspacePicker, { onChooseWorkspace }))

    fireEvent.click(screen.getByText('Escolher workspace'))

    expect(onChooseWorkspace).toHaveBeenCalledTimes(1)
  })
})
