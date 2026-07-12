// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import App from './App'

/**
 * Tasks T6 (workspace pick) + T9 (guided install) + T10 (update gate) —
 * design.md §5.1–§5.2, R2.1, R3.2–R3.4, R4.1–R4.2.
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
 * logic — which is what T6/T9 actually need to prove — without touching any
 * shared config outside this task's file allowlist.
 *
 * `window.hive` is mocked entirely per-test — a real native folder-picker
 * dialog can't be driven in this environment, so mocking is the primary
 * proof for this task (see task report for the Playwright smoke pass).
 */
vi.mock('@hive/design-system', () => ({
  Button: ({ children, ...rest }: { children?: ReactNode; cut?: boolean; variant?: string }) => {
    // `cut`/`variant` are DS-only styling props — not valid DOM attributes.
    delete rest.cut
    delete rest.variant
    return createElement('button', rest, children)
  },
  Logo: ({ tone, mark }: { tone?: string; mark?: string }) =>
    createElement('span', { 'data-testid': `logo-${tone}-${mark}` }),
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
    ),
  Alert: ({ title, children, ...rest }: { title?: ReactNode; children?: ReactNode }) =>
    createElement('div', rest, createElement('strong', null, title), children),
  Progress: () => createElement('div', { role: 'progressbar' }),
  SteppedList: ({ children }: { children?: ReactNode }) => createElement('ol', null, children),
  SteppedListItem: ({ title }: { title?: ReactNode }) => createElement('li', null, title),
  // Guided-install form (BUG 1) controls — trivial DOM stand-ins so App's
  // gate tests can drive the form the real GuidedInstall now shows first.
  Checkbox: ({
    id,
    checked,
    onCheckedChange
  }: {
    id?: string
    checked?: boolean
    onCheckedChange?: (checked: boolean) => void
  }) =>
    createElement('input', {
      type: 'checkbox',
      id,
      checked: Boolean(checked),
      onChange: (e: { target: { checked: boolean } }) => onCheckedChange?.(e.target.checked)
    }),
  Field: ({ label, children }: { label?: ReactNode; children?: ReactNode }) =>
    createElement('label', null, label, children),
  Input: (props: Record<string, unknown>) => createElement('input', props),
  Label: ({ children, ...rest }: { children?: ReactNode }) =>
    createElement('label', rest, children),
  RadioGroup: ({ children }: { children?: ReactNode }) =>
    createElement('div', { role: 'radiogroup' }, children),
  RadioGroupItem: ({ id, value }: { id?: string; value?: string }) =>
    createElement('input', { type: 'radio', id, value, name: 'skill', readOnly: true }),
  Select: ({ children }: { children?: ReactNode }) => createElement('div', null, children),
  SelectContent: ({ children }: { children?: ReactNode }) => createElement('div', null, children),
  SelectItem: ({ children }: { children?: ReactNode }) => createElement('div', null, children),
  SelectTrigger: ({ children, ...rest }: { children?: ReactNode }) =>
    createElement('div', rest, children),
  SelectValue: () => createElement('span')
}))

// `WorkUI` (T19) composes `Explorer`/`Chat`, each with their own large DS
// dependency surface (Tree, MessageList, Select*, SkillCard, Resizable*,
// etc.) already thoroughly covered by Explorer.test.ts/Chat.test.ts — this
// file only needs to prove the onboarding *gate* reaches `ready` and hands
// off the right workspace, so `WorkUI` itself is mocked to a trivial marker
// rather than duplicating every one of those DS mocks here.
vi.mock('./WorkUI', () => ({
  WorkUI: ({
    workspace,
    onToggleTheme
  }: {
    workspace: string
    onToggleTheme?: () => void
  }) =>
    createElement(
      'div',
      { 'data-testid': 'work-ui' },
      `WorkUI: ${workspace}`,
      createElement('button', { onClick: onToggleTheme }, 'toggle theme')
    )
}))

describe('App — first-run workspace gate + guided install + update gate (T6, T9, T10)', () => {
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
      openExternal: vi.fn().mockResolvedValue(undefined),
      getWorkspace: vi.fn().mockResolvedValue(null),
      isProvisioned: vi.fn().mockResolvedValue(false),
      provisionState: vi.fn().mockResolvedValue(false),
      getRecentWorkspaces: vi.fn().mockResolvedValue([]),
      openWorkspace: vi.fn().mockResolvedValue({ ok: false, reason: 'missing' }),
      listTree: vi.fn().mockResolvedValue([]),
      readFile: vi.fn().mockResolvedValue(''),
      watchWorkspace: vi.fn().mockReturnValue(() => {}),
      agent: {
        capabilities: vi
          .fn()
          .mockResolvedValue({ models: [], efforts: [], supportsAttachments: false }),
        start: vi.fn().mockResolvedValue(undefined),
        send: vi.fn().mockResolvedValue(undefined),
        runWorkflow: vi.fn().mockResolvedValue(undefined),
        onEvent: vi.fn().mockReturnValue(() => {})
      },
      installBmad: vi.fn().mockReturnValue(() => {}),
      updateBmad: vi.fn().mockReturnValue(() => {}),
      workflows: { list: vi.fn().mockResolvedValue([]) },
      fs: {
        statFile: vi.fn().mockResolvedValue({ mtimeMs: 1000, size: 0 }),
        createFile: vi.fn().mockResolvedValue(undefined),
        createDirectory: vi.fn().mockResolvedValue(undefined),
        saveFile: vi.fn().mockResolvedValue({ mtimeMs: 1000, size: 0 }),
        move: vi.fn().mockResolvedValue(undefined),
        importEntry: vi.fn().mockResolvedValue(undefined),
        exists: vi.fn().mockResolvedValue(false),
        trash: vi.fn().mockResolvedValue(undefined),
        pathForFile: vi.fn().mockReturnValue('/abs/os/path/dropped.txt')
      }
    }
    window.hive = Object.assign(defaults, overrides)
  }

  it('shows the picker screen when no workspace is persisted', async () => {
    mockHive({ getWorkspace: vi.fn().mockResolvedValue(null) })

    render(createElement(App))

    expect(await screen.findByText('Bem-vindo ao Hive')).toBeTruthy()
    expect(screen.getByText('Escolher workspace')).toBeTruthy()
  })

  it('skips the picker and shows the update gate for an already-provisioned returning user (R8.2)', async () => {
    mockHive({
      getWorkspace: vi.fn().mockResolvedValue('/home/user/my-workspace'),
      provisionState: vi.fn().mockResolvedValue(true)
    })

    render(createElement(App))

    expect(await screen.findByText('Atualizando o BMAD')).toBeTruthy()
    expect(screen.queryByText('Bem-vindo ao Hive')).toBeNull()
    expect(screen.queryByText('Preparando seu workspace')).toBeNull()
  })

  it('advances from the update gate to the ready placeholder once updateBmad() reports done', async () => {
    let emitDone: (() => void) | undefined
    mockHive({
      getWorkspace: vi.fn().mockResolvedValue('/home/user/my-workspace'),
      provisionState: vi.fn().mockResolvedValue(true),
      updateBmad: vi.fn((_workspace: string, onEvent: (evt: { type: string }) => void) => {
        emitDone = () => onEvent({ type: 'done' })
        return () => {}
      })
    })

    render(createElement(App))

    await screen.findByText('Atualizando o BMAD')
    expect(emitDone).toBeTruthy()
    emitDone?.()

    expect(await screen.findByText('WorkUI: /home/user/my-workspace')).toBeTruthy()

    const initialTheme = document.documentElement.getAttribute('data-theme')
    fireEvent.click(screen.getByText('toggle theme'))
    const toggledTheme = document.documentElement.getAttribute('data-theme')
    expect(toggledTheme).not.toBe(initialTheme)

    // Toggle back — exercises both branches of the dark/light ternary.
    fireEvent.click(screen.getByText('toggle theme'))
    expect(document.documentElement.getAttribute('data-theme')).toBe(initialTheme)
  })

  it('"continue anyway" on a failed update advances to ready without retrying (R4.2)', async () => {
    let emitError: (() => void) | undefined
    mockHive({
      getWorkspace: vi.fn().mockResolvedValue('/home/user/my-workspace'),
      provisionState: vi.fn().mockResolvedValue(true),
      updateBmad: vi.fn(
        (_workspace: string, onEvent: (evt: { type: string; message?: string }) => void) => {
          emitError = () => onEvent({ type: 'error', message: 'falha de rede' })
          return () => {}
        }
      )
    })

    render(createElement(App))

    await screen.findByText('Atualizando o BMAD')
    emitError?.()

    const continueButton = await screen.findByText('Continuar mesmo assim')
    fireEvent.click(continueButton)

    expect(await screen.findByText('WorkUI: /home/user/my-workspace')).toBeTruthy()
  })

  it('shows the guided install screen for a returning user whose workspace is not yet provisioned', async () => {
    mockHive({
      getWorkspace: vi.fn().mockResolvedValue('/home/user/my-workspace'),
      provisionState: vi.fn().mockResolvedValue(false)
    })

    render(createElement(App))

    // Guided install now opens on its configuration form (BUG 1).
    expect(await screen.findByText('Configurar o BMAD')).toBeTruthy()
  })

  it('advances to the guided install screen (not straight to ready) after a fresh pick', async () => {
    mockHive({
      getWorkspace: vi.fn().mockResolvedValue(null),
      chooseWorkspace: vi.fn().mockResolvedValue('/home/user/chosen-workspace'),
      provisionState: vi.fn().mockResolvedValue(false)
    })

    render(createElement(App))

    const chooseButton = await screen.findByText('Escolher workspace')
    fireEvent.click(chooseButton)

    // A fresh, unprovisioned pick lands on the guided-install configuration
    // form (BUG 1) — not straight to the work UI, and not silently installing.
    expect(await screen.findByText('Configurar o BMAD')).toBeTruthy()
  })

  it('routes a first-run pick of an already-provisioned folder to the update gate, not install (WS-R3.3)', async () => {
    // Regression test for the latent bug: routing must be decided by a
    // disk-based provisionState() check on the *specific* picked path, not
    // a global config.provisioned flag — otherwise a first-run pick of a
    // folder that already has BMAD installed incorrectly lands on
    // `installing` instead of `updating`.
    const provisionState = vi.fn().mockResolvedValue(true)
    mockHive({
      getWorkspace: vi.fn().mockResolvedValue(null),
      chooseWorkspace: vi.fn().mockResolvedValue('/home/user/already-provisioned'),
      provisionState
    })

    render(createElement(App))

    const chooseButton = await screen.findByText('Escolher workspace')
    fireEvent.click(chooseButton)

    expect(await screen.findByText('Atualizando o BMAD')).toBeTruthy()
    expect(screen.queryByText('Configurar o BMAD')).toBeNull()
    expect(provisionState).toHaveBeenCalledWith('/home/user/already-provisioned')
  })

  it('advances from guided install to the ready placeholder once installBmad() reports done', async () => {
    let emitDone: (() => void) | undefined
    mockHive({
      getWorkspace: vi.fn().mockResolvedValue('/home/user/my-workspace'),
      provisionState: vi.fn().mockResolvedValue(false),
      installBmad: vi.fn(
        (_workspace: string, _options: unknown, onEvent: (evt: { type: string }) => void) => {
          emitDone = () => onEvent({ type: 'done' })
          return () => {}
        }
      )
    })

    render(createElement(App))

    // Submit the config form to kick off the install, then drive it to done.
    fireEvent.click(await screen.findByText('Instalar BMAD'))
    await screen.findByText('Preparando seu workspace')
    expect(emitDone).toBeTruthy()
    emitDone?.()

    expect(await screen.findByText('WorkUI: /home/user/my-workspace')).toBeTruthy()
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
      expect(screen.getByText('Bem-vindo ao Hive')).toBeTruthy()
    })
    expect(screen.getByText('Escolher workspace')).toBeTruthy()
  })
})
