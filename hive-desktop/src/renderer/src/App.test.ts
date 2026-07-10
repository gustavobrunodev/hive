// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import App from './App'

/**
 * Task T6 — Onboarding: workspace-pick UI (design.md §5.1, R2.1).
 *
 * Uses `React.createElement` instead of JSX so this can stay a `.test.ts`
 * file matched by the existing `src/renderer/src/**\/*.test.ts` vitest
 * include glob (T6 is scoped to not touch `vitest.config.ts`); the
 * `@vitest-environment jsdom` docblock above opts this single file into a
 * DOM environment even though the project default is `node`.
 *
 * `@hive/design-system` is mocked with plain-DOM stand-ins: the package is
 * a separate installed copy of React from `../design-system/node_modules`
 * (it isn't part of an npm workspace with hive-desktop), so rendering its
 * real components here would load a second React instance alongside
 * hive-desktop's own and crash on `Invalid hook call`. Swapping in trivial
 * host-element equivalents keeps this test scoped to `App`'s own gating
 * logic — which is what T6 actually needs to prove — without touching any
 * shared config outside this task's file allowlist.
 *
 * `window.hive` is mocked entirely per-test — a real native folder-picker
 * dialog can't be driven in this environment, so mocking is the primary
 * proof for this task (see task report for the Playwright smoke pass).
 */
vi.mock('@hive/design-system', () => ({
  Button: ({ children, ...rest }: { children?: ReactNode }) =>
    createElement('button', rest, children),
  Panel: ({ children, ...rest }: { children?: ReactNode }) => createElement('div', rest, children),
  Spinner: ({ label }: { label?: string }) => createElement('span', { role: 'status' }, label),
  Empty: ({
    title,
    description,
    action
  }: {
    title?: ReactNode
    description?: ReactNode
    action?: ReactNode
  }) =>
    createElement(
      'div',
      null,
      createElement('h2', null, title),
      description ? createElement('p', null, description) : null,
      action
    )
}))
describe('App — first-run workspace gate (T6)', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  function mockHive(overrides: Partial<typeof window.hive>): void {
    const defaults: typeof window.hive = {
      ping: vi.fn().mockResolvedValue('pong'),
      chooseWorkspace: vi.fn().mockResolvedValue(null),
      getWorkspace: vi.fn().mockResolvedValue(null),
      isProvisioned: vi.fn().mockResolvedValue(false),
      listTree: vi.fn().mockResolvedValue([]),
      readFile: vi.fn().mockResolvedValue(''),
      watchWorkspace: vi.fn().mockReturnValue(() => {})
    }
    window.hive = Object.assign(defaults, overrides)
  }

  it('shows the picker screen when no workspace is persisted', async () => {
    mockHive({ getWorkspace: vi.fn().mockResolvedValue(null) })

    render(createElement(App))

    expect(await screen.findByText('Nenhum workspace selecionado')).toBeTruthy()
    expect(screen.getByText('Escolher workspace')).toBeTruthy()
  })

  it('skips the picker and shows the ready placeholder for a returning user', async () => {
    mockHive({ getWorkspace: vi.fn().mockResolvedValue('/home/user/my-workspace') })

    render(createElement(App))

    expect(await screen.findByText('Workspace: /home/user/my-workspace')).toBeTruthy()
    expect(screen.queryByText('Nenhum workspace selecionado')).toBeNull()
  })

  it('advances to the ready placeholder after a successful pick', async () => {
    mockHive({
      getWorkspace: vi.fn().mockResolvedValue(null),
      chooseWorkspace: vi.fn().mockResolvedValue('/home/user/chosen-workspace')
    })

    render(createElement(App))

    const chooseButton = await screen.findByText('Escolher workspace')
    fireEvent.click(chooseButton)

    expect(await screen.findByText('Workspace: /home/user/chosen-workspace')).toBeTruthy()
  })

  it('stays on the picker screen (no crash) when the user cancels the pick', async () => {
    mockHive({
      getWorkspace: vi.fn().mockResolvedValue(null),
      chooseWorkspace: vi.fn().mockResolvedValue(null)
    })

    render(createElement(App))

    const chooseButton = await screen.findByText('Escolher workspace')
    fireEvent.click(chooseButton)

    // Give the cancelled promise a tick to resolve, then assert we're still
    // on the picker (no throw, no silent blank screen).
    await waitFor(() => {
      expect(screen.getByText('Nenhum workspace selecionado')).toBeTruthy()
    })
    expect(screen.getByText('Escolher workspace')).toBeTruthy()
  })
})
