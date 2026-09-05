// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SecondBrainPanel } from './SecondBrainPanel'
import type { BrainSetup, BrainSetupPhase } from './useBrainSetup'
import type { SecondBrainStore, VaultHealth } from './useSecondBrain'
import { FRESH_HEALTH } from '../testSupport/hiveSecondBrainMock'

vi.mock('@hive/design-system', () => ({
  Button: ({ children, ...rest }: { children?: ReactNode }) =>
    createElement('button', rest, children)
}))

/**
 * The vault's files are browsed with the Explorer's own `FileTree` (SB-R2.3).
 * It is covered by `explorer/Explorer.test.ts`; here it stands in as a stub
 * that records the props the panel hands it — which root it browses and what
 * it calls that section — so this suite keeps testing the *panel*.
 */
vi.mock('../explorer/Explorer', () => ({
  FileTree: (props: { rootPath?: string; title?: string; initialExpandedPaths?: string[] }) =>
    createElement('div', {
      'data-testid': 'vault-tree',
      'data-root': props.rootPath,
      'data-title': props.title,
      'data-expanded': props.initialExpandedPaths?.join(',')
    })
}))

beforeEach(() => {
  window.hive = {
    ...window.hive,
    listTree: vi.fn().mockResolvedValue([])
  } as typeof window.hive
})

function store(overrides: Partial<SecondBrainStore> = {}): SecondBrainStore {
  return {
    workspace: '/ws',
    vaultPath: null,
    vaultName: null,
    rawPending: 0,
    hasVault: false,
    health: null,
    refresh: vi.fn(),
    noteIngest: vi.fn(),
    noteLint: vi.fn(),
    snoozeHealth: vi.fn(),
    ...overrides
  }
}

function health(overrides: Partial<VaultHealth> = {}): VaultHealth {
  return { ...FRESH_HEALTH, ...overrides }
}

function setup(phase: BrainSetupPhase = 'idle'): BrainSetup {
  return { phase, start: vi.fn(), recheck: vi.fn(), dismiss: vi.fn() }
}

function renderPanel(
  overrides: Partial<SecondBrainStore> = {},
  handlers: {
    onLaunch?: () => void
    onAsk?: () => void
    onOpenFile?: () => void
    setup?: BrainSetup
    onIngest?: () => void
  } = {}
): {
  onLaunch: ReturnType<typeof vi.fn>
  onAsk: ReturnType<typeof vi.fn>
  onIngest: ReturnType<typeof vi.fn>
  setup: BrainSetup
} {
  const onLaunch = vi.fn(handlers.onLaunch)
  const onAsk = vi.fn(handlers.onAsk)
  const onIngest = vi.fn(handlers.onIngest)
  const brainSetup = handlers.setup ?? setup()
  render(
    createElement(SecondBrainPanel, {
      store: store(overrides),
      onLaunch,
      onAsk,
      onOpenFile: vi.fn(handlers.onOpenFile),
      setup: brainSetup,
      onIngest
    })
  )
  return { onLaunch, onAsk, onIngest, setup: brainSetup }
}

const VAULT = { hasVault: true, vaultPath: '/ws/second-brain', vaultName: 'second-brain' }

describe('SecondBrainPanel (T7)', () => {
  afterEach(() => cleanup())

  it('renders the inviting empty state when there is no vault, starting setup from the CTA', () => {
    const brainSetup = setup()
    const { onLaunch } = renderPanel({}, { setup: brainSetup })

    expect(screen.getByText('A squad ainda não tem uma base aqui')).toBeTruthy()
    // The invitation says what the button will do before it does it: the
    // command takes over a NEW conversation, not the one on screen.
    expect(screen.getByText(/conversa nova com o agente/)).toBeTruthy()

    fireEvent.click(screen.getByText('Configurar base'))
    expect(brainSetup.start).toHaveBeenCalledTimes(1)
    // Setup is launched through the flow, never as a bare command from here.
    expect(onLaunch).not.toHaveBeenCalled()
  })

  it('while the wizard runs, waits on it instead of re-inviting — with a re-probe and a relaunch (bug: "configure a base primeiro" over a base being created)', () => {
    const brainSetup = setup('running')
    renderPanel({}, { setup: brainSetup })

    expect(screen.getByRole('status').textContent).toBe('Configurando a base…')
    expect(screen.queryByText('Configurar base')).toBeNull()

    fireEvent.click(screen.getByText('Verificar de novo'))
    expect(brainSetup.recheck).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByText('Rodar o comando de novo'))
    expect(brainSetup.start).toHaveBeenCalledTimes(1)
  })

  it('confirms a just-created base and hands over the next step, then gets out of the way', () => {
    const brainSetup = setup('ready')
    const { onIngest } = renderPanel(VAULT, { setup: brainSetup })

    expect(screen.getByText('Base pronta — second-brain')).toBeTruthy()

    fireEvent.click(screen.getByText('Ingerir agora'))
    expect(onIngest).toHaveBeenCalledTimes(1)
    // Taking the hand-off also acknowledges it — the banner has done its job.
    expect(brainSetup.dismiss).toHaveBeenCalledTimes(1)
  })

  it('does not celebrate a base that was already there (phase idle)', () => {
    renderPanel(VAULT)
    expect(screen.queryByText(/Base pronta/)).toBeNull()
  })

  it('shows the vault header with name and, when > 0, the raw-pending chip', () => {
    const { rerender } = render(
      createElement(SecondBrainPanel, {
        store: store({ ...VAULT, rawPending: 0 }),
        onLaunch: vi.fn(),
        onAsk: vi.fn(),
        onOpenFile: vi.fn(),
        setup: setup(),
        onIngest: vi.fn()
      })
    )
    expect(screen.getByText('second-brain')).toBeTruthy()
    expect(screen.queryByText(/para ingerir/)).toBeNull()

    rerender(
      createElement(SecondBrainPanel, {
        store: store({ ...VAULT, rawPending: 3 }),
        onLaunch: vi.fn(),
        onAsk: vi.fn(),
        onOpenFile: vi.fn(),
        setup: setup(),
        onIngest: vi.fn()
      })
    )
    expect(screen.getByText('3 itens para ingerir')).toBeTruthy()
  })

  it('leads with "Perguntar à base", which opens the ask surface instead of launching a bare command (SB-R9.1)', () => {
    const { onLaunch, onAsk } = renderPanel(VAULT)

    fireEvent.click(screen.getByText('Perguntar à base'))
    expect(onAsk).toHaveBeenCalledTimes(1)
    // Asking never fires a question-less /second-brain-query.
    expect(onLaunch).not.toHaveBeenCalled()
  })

  it('launches the correct slash command for each secondary action', () => {
    const { onLaunch } = renderPanel(VAULT)

    fireEvent.click(screen.getByText('Ingerir'))
    fireEvent.click(screen.getByText('Revisar'))

    const prompts = onLaunch.mock.calls.map((call) => call[0].command.prompt)
    expect(prompts).toEqual(['/second-brain-ingest', '/second-brain-lint'])
  })

  it('browses the vault with the Explorer tree, rooted at the vault folder (SB-R2.3)', () => {
    const onOpenFile = vi.fn()
    render(
      createElement(SecondBrainPanel, {
        store: store({ hasVault: true, vaultPath: '/ws/kb', vaultName: 'kb' }),
        onLaunch: vi.fn(),
        onAsk: vi.fn(),
        onOpenFile,
        setup: setup(),
        onIngest: vi.fn()
      })
    )

    const tree = screen.getByTestId('vault-tree')
    // The whole vault, not just wiki/ — `raw/` is part of the base, and the
    // pending-ingestion chip in the header points at it.
    expect(tree.getAttribute('data-root')).toBe('kb')
    expect(tree.getAttribute('data-title')).toBe('Arquivos da base')
    // ...with the wiki open on arrival, so `index.md` is one click away.
    expect(tree.getAttribute('data-expanded')).toBe('kb/wiki')
  })

  it('falls back to the panel title when the vault has no name', () => {
    renderPanel({ hasVault: true, vaultPath: '/ws/x', vaultName: null })
    // Header falls back to "Bases de conhecimento".
    expect(screen.getByLabelText('Bases de conhecimento')).toBeTruthy()
  })

  it('shows the health card once the cadence lands (SB-R10.1)', () => {
    renderPanel({
      ...VAULT,
      health: health({
        ingestsSinceLint: 4,
        lastLintAt: '2026-07-01T00:00:00.000Z',
        daysSinceLint: 12,
        daysUntilInterval: 18
      })
    })

    expect(screen.getByLabelText('Saúde da base')).toBeTruthy()
    expect(screen.getByText('4 de 10 ingestões')).toBeTruthy()
    expect(screen.getByText('Revisada há 12 dias')).toBeTruthy()
    // A healthy base doesn't repeat the action row's "Revisar" as its own CTA.
    expect(screen.queryByText('Revisar agora')).toBeNull()
  })

  it('a due base gets its own CTA in the card, launching the same lint (SB-R10.1)', () => {
    const { onLaunch } = renderPanel({
      ...VAULT,
      health: health({ ingestsSinceLint: 10, reason: 'ingests', due: true })
    })

    fireEvent.click(screen.getByText('Revisar agora'))
    expect(onLaunch.mock.calls[0][0].command.prompt).toBe('/second-brain-lint')
  })

  it('omits the health card entirely until the cadence has been fetched', () => {
    renderPanel({ ...VAULT, health: null })
    expect(screen.queryByLabelText('Saúde da base')).toBeNull()
  })
})
