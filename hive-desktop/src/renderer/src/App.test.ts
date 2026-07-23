// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement, useState, type ReactNode } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import App from './App'
import { createHiveGitMock } from './testSupport/hiveGitMock'

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
  // multi-agent: the AgentSetup first-run picker uses the DS Switch per agent.
  Switch: ({
    checked,
    onCheckedChange,
    ...rest
  }: {
    checked?: boolean
    onCheckedChange?: (checked: boolean) => void
  }) =>
    createElement('button', {
      type: 'button',
      role: 'switch',
      'aria-checked': checked,
      onClick: () => onCheckedChange?.(!checked),
      ...rest
    }),
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
// T5 (WS-R4.1, WS-R4.4): the mock also exercises `onCandidateWorkspace` (a
// "switch workspace" button standing in for T7's real chip-menu selection)
// and generates a fresh random instance id *only on mount* (a `useState`
// initializer doesn't re-run across re-renders) — this is how the T5 tests
// below prove App's `key={workspacePath}` actually remounts `WorkUI` on a
// workspace change instead of merely re-rendering it in place.
vi.mock('./WorkUI', () => ({
  WorkUI: ({
    workspace,
    onToggleTheme,
    onCandidateWorkspace
  }: {
    workspace: string
    onToggleTheme?: () => void
    onCandidateWorkspace?: (path: string) => void
  }) => {
    const [instanceId] = useState(() => Math.random().toString(36).slice(2))
    return createElement(
      'div',
      { 'data-testid': 'work-ui', 'data-instance-id': instanceId },
      `WorkUI: ${workspace}`,
      createElement('button', { onClick: onToggleTheme }, 'toggle theme'),
      createElement(
        'button',
        { onClick: () => onCandidateWorkspace?.('/home/user/switched-workspace') },
        'switch workspace'
      )
    )
  }
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
      listFiles: vi.fn().mockResolvedValue([]),
      readFile: vi.fn().mockResolvedValue(''),
      watchWorkspace: vi.fn().mockReturnValue(() => {}),
      agent: {
        capabilities: vi
          .fn()
          .mockResolvedValue({ models: [], efforts: [], supportsAttachments: false }),
        chooseAttachments: vi.fn().mockResolvedValue([]),
        start: vi.fn().mockResolvedValue(undefined),
        send: vi.fn().mockResolvedValue(undefined),
        runWorkflow: vi.fn().mockResolvedValue(undefined),
        stop: vi.fn().mockResolvedValue(undefined),
        interrupt: vi.fn().mockResolvedValue(undefined),
        onEvent: vi.fn().mockReturnValue(() => {})
      },
      installBmad: vi.fn().mockReturnValue(() => {}),
      updateBmad: vi.fn().mockReturnValue(() => {}),
      app: {
        info: vi
          .fn()
          .mockResolvedValue({ name: 'hive-desktop', version: '0.1.0', updatesSupported: false }),
        checkForUpdates: vi.fn().mockResolvedValue(undefined),
        downloadUpdate: vi.fn().mockResolvedValue(undefined),
        installUpdate: vi.fn().mockResolvedValue(undefined),
        cancelUpdate: vi.fn().mockResolvedValue(undefined),
        revealInstaller: vi.fn().mockResolvedValue(undefined),
        skipVersion: vi.fn().mockResolvedValue(undefined),
        onUpdateEvent: vi.fn().mockReturnValue(() => {})
      },
      workflows: { list: vi.fn().mockResolvedValue([]) },
      skills: { list: vi.fn().mockResolvedValue([]) },
      studio: { list: vi.fn().mockResolvedValue([]) },
      mcp: {
        list: vi.fn().mockResolvedValue([]),
        add: vi.fn().mockResolvedValue(undefined),
        update: vi.fn().mockResolvedValue(undefined),
        remove: vi.fn().mockResolvedValue(undefined),
        setEnabled: vi.fn().mockResolvedValue(undefined),
        probe: vi.fn().mockResolvedValue({ ok: true, tools: [], logs: '', durationMs: 0 })
      },
      chatHistory: {
        list: vi.fn().mockResolvedValue([]),
        get: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({
          id: '00000000-0000-4000-8000-000000000001',
          workspace: '/ws',
          agent: null,
          title: '',
          createdAt: 0,
          updatedAt: 0,
          messages: []
        }),
        append: vi.fn().mockResolvedValue(null),
        rename: vi.fn().mockResolvedValue(null),
        setCliSession: vi.fn().mockResolvedValue(undefined),
        search: vi.fn().mockResolvedValue([]),
        delete: vi.fn().mockResolvedValue(undefined)
      },
      // Default: agent + role already set, so the flow tests below skip the
      // required first-run setup steps and reach the provisioning gate. The
      // new-setup tests override getAgent/getRole to null.
      profile: {
        agents: vi.fn().mockResolvedValue([
          { id: 'claude-cli', displayName: 'Claude Code', description: '', available: true },
          { id: 'devin', displayName: 'Devin', description: '', available: false }
        ]),
        getAgent: vi.fn().mockResolvedValue('claude-cli'),
        setAgent: vi.fn().mockResolvedValue(undefined),
        getAgents: vi.fn().mockResolvedValue(["claude-cli"]),
        setAgents: vi.fn().mockResolvedValue(undefined),
        getRole: vi.fn().mockResolvedValue('pm'),
        setRole: vi.fn().mockResolvedValue(undefined),
        getUserName: vi.fn().mockResolvedValue(null),
        setUserName: vi.fn().mockResolvedValue(undefined),
        roleActions: vi.fn().mockResolvedValue([])
      },
      shortcuts: {
        catalog: vi.fn().mockResolvedValue([]),
        get: vi.fn().mockResolvedValue(null),
        set: vi.fn().mockResolvedValue(undefined),
        actions: vi.fn().mockResolvedValue([])
      },
      fs: {
        statFile: vi.fn().mockResolvedValue({ mtimeMs: 1000, size: 0 }),
        readBinary: vi.fn().mockResolvedValue({ base64: '', mime: 'application/octet-stream', size: 0 }),
        readDocx: vi.fn().mockResolvedValue({ html: '', warnings: [] }),
        readSheet: vi.fn().mockResolvedValue({ sheets: [] }),
        readSlides: vi.fn().mockResolvedValue({ title: null, slides: [] }),
        createFile: vi.fn().mockResolvedValue(undefined),
        createDirectory: vi.fn().mockResolvedValue(undefined),
        saveFile: vi.fn().mockResolvedValue({ mtimeMs: 1000, size: 0 }),
        move: vi.fn().mockResolvedValue(undefined),
        importEntry: vi.fn().mockResolvedValue(undefined),
        exists: vi.fn().mockResolvedValue(false),
        trash: vi.fn().mockResolvedValue(undefined),
        pathForFile: vi.fn().mockReturnValue('/abs/os/path/dropped.txt')
      },
      git: createHiveGitMock()
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

  // agent-selection + role-personalization: required first-run setup steps,
  // inserted between the workspace pick and the provisioning gate, shown only
  // when the (global) agent/role are unset.
  it('shows the required agent setup step before provisioning when no agent is set', async () => {
    mockHive({
      getWorkspace: vi.fn().mockResolvedValue('/home/user/my-workspace'),
      provisionState: vi.fn().mockResolvedValue(false),
      profile: {
        agents: vi.fn().mockResolvedValue([
          { id: 'claude-cli', displayName: 'Claude Code', description: 'x', available: true },
          { id: 'devin', displayName: 'Devin', description: 'y', available: false }
        ]),
        getAgent: vi.fn().mockResolvedValue(null),
        setAgent: vi.fn().mockResolvedValue(undefined),
        getAgents: vi.fn().mockResolvedValue(null),
        setAgents: vi.fn().mockResolvedValue(undefined),
        getRole: vi.fn().mockResolvedValue(null),
        setRole: vi.fn().mockResolvedValue(undefined),
        getUserName: vi.fn().mockResolvedValue(null),
        setUserName: vi.fn().mockResolvedValue(undefined),
        roleActions: vi.fn().mockResolvedValue([])
      }
    })

    render(createElement(App))

    // The agent step comes first — not the install form.
    expect(await screen.findByText('Escolha seus agentes')).toBeTruthy()
    expect(screen.queryByText('Configurar o BMAD')).toBeNull()
  })

  it('shows the required role setup step when the agent is set but the role is unset', async () => {
    mockHive({
      getWorkspace: vi.fn().mockResolvedValue('/home/user/my-workspace'),
      provisionState: vi.fn().mockResolvedValue(true),
      profile: {
        agents: vi
          .fn()
          .mockResolvedValue([
            { id: 'claude-cli', displayName: 'Claude Code', description: 'x', available: true }
          ]),
        getAgent: vi.fn().mockResolvedValue('claude-cli'),
        setAgent: vi.fn().mockResolvedValue(undefined),
        getAgents: vi.fn().mockResolvedValue(["claude-cli"]),
        setAgents: vi.fn().mockResolvedValue(undefined),
        getRole: vi.fn().mockResolvedValue(null),
        setRole: vi.fn().mockResolvedValue(undefined),
        getUserName: vi.fn().mockResolvedValue(null),
        setUserName: vi.fn().mockResolvedValue(undefined),
        roleActions: vi.fn().mockResolvedValue([])
      }
    })

    render(createElement(App))

    expect(await screen.findByText('Qual é o seu papel?')).toBeTruthy()
  })

  it('completing the role step persists it and advances to the provisioning gate', async () => {
    const setRole = vi.fn().mockResolvedValue(undefined)
    mockHive({
      getWorkspace: vi.fn().mockResolvedValue('/home/user/my-workspace'),
      provisionState: vi.fn().mockResolvedValue(true),
      profile: {
        agents: vi
          .fn()
          .mockResolvedValue([
            { id: 'claude-cli', displayName: 'Claude Code', description: 'x', available: true }
          ]),
        getAgent: vi.fn().mockResolvedValue('claude-cli'),
        setAgent: vi.fn().mockResolvedValue(undefined),
        getAgents: vi.fn().mockResolvedValue(["claude-cli"]),
        setAgents: vi.fn().mockResolvedValue(undefined),
        getRole: vi.fn().mockResolvedValue(null),
        setRole,
        getUserName: vi.fn().mockResolvedValue(null),
        setUserName: vi.fn().mockResolvedValue(undefined),
        roleActions: vi.fn().mockResolvedValue([])
      }
    })

    render(createElement(App))

    // Pick a role card, then confirm.
    const pmCard = await screen.findByText('Product Manager')
    fireEvent.click(pmCard)
    fireEvent.click(screen.getByText('Entrar no Hive'))

    await waitFor(() => expect(setRole).toHaveBeenCalledWith('pm'))
    // Provisioned workspace → update gate after the role step.
    expect(await screen.findByText('Atualizando o BMAD')).toBeTruthy()
  })

  describe('T5 — runtime workspace switch entry (WS-R4.1, WS-R4.4)', () => {
    it('re-enters checkingProvisioned and routes to the update gate for a switched, already-provisioned workspace', async () => {
      let emitDone: (() => void) | undefined
      const provisionState = vi.fn().mockResolvedValue(true)
      mockHive({
        getWorkspace: vi.fn().mockResolvedValue('/home/user/my-workspace'),
        provisionState,
        updateBmad: vi.fn((_workspace: string, onEvent: (evt: { type: string }) => void) => {
          emitDone = () => onEvent({ type: 'done' })
          return () => {}
        })
      })

      render(createElement(App))

      // Drive the initial (relaunch) update gate to ready first.
      await screen.findByText('Atualizando o BMAD')
      emitDone?.()

      const originalWorkUi = await screen.findByText('WorkUI: /home/user/my-workspace')
      const originalInstanceId = originalWorkUi.getAttribute('data-instance-id')

      fireEvent.click(screen.getByText('switch workspace'))

      // Re-enters the checkingProvisioned gate — the spinner screen shows
      // again — then, since provisionState() resolves true for the new
      // path, lands on the update gate exactly as a relaunch would.
      expect(await screen.findByText('Atualizando o BMAD')).toBeTruthy()
      expect(provisionState).toHaveBeenLastCalledWith('/home/user/switched-workspace')

      emitDone?.()

      const newWorkUi = await screen.findByText('WorkUI: /home/user/switched-workspace')
      expect(newWorkUi).toBeTruthy()

      // WS-R4.4: WorkUI remounted (fresh instance, not just re-rendered)
      // bound to the new workspace — proven by a fresh random instance id.
      const newInstanceId = newWorkUi.getAttribute('data-instance-id')
      expect(newInstanceId).toBeTruthy()
      expect(newInstanceId).not.toBe(originalInstanceId)
    })

    it('re-enters checkingProvisioned and routes to guided install for a switched, unprovisioned workspace', async () => {
      let emitDone: (() => void) | undefined
      const provisionState = vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false)
      mockHive({
        getWorkspace: vi.fn().mockResolvedValue('/home/user/my-workspace'),
        provisionState,
        updateBmad: vi.fn((_workspace: string, onEvent: (evt: { type: string }) => void) => {
          emitDone = () => onEvent({ type: 'done' })
          return () => {}
        })
      })

      render(createElement(App))

      await screen.findByText('Atualizando o BMAD')
      emitDone?.()
      await screen.findByText('WorkUI: /home/user/my-workspace')

      fireEvent.click(screen.getByText('switch workspace'))

      expect(await screen.findByText('Configurar o BMAD')).toBeTruthy()
      expect(provisionState).toHaveBeenLastCalledWith('/home/user/switched-workspace')
      expect(screen.queryByText('Atualizando o BMAD')).toBeNull()
    })
  })
})
