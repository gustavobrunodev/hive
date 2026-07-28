// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SecondBrainPanel } from './SecondBrainPanel'
import type { SecondBrainStore, VaultHealth } from './useSecondBrain'
import { FRESH_HEALTH } from '../testSupport/hiveSecondBrainMock'

vi.mock('@hive/design-system', () => ({
  Button: ({ children, ...rest }: { children?: ReactNode }) =>
    createElement('button', rest, children)
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

function renderPanel(
  overrides: Partial<SecondBrainStore> = {},
  handlers: { onLaunch?: () => void; onAsk?: () => void; onOpenFile?: () => void } = {}
): { onLaunch: ReturnType<typeof vi.fn>; onAsk: ReturnType<typeof vi.fn> } {
  const onLaunch = vi.fn(handlers.onLaunch)
  const onAsk = vi.fn(handlers.onAsk)
  render(
    createElement(SecondBrainPanel, {
      store: store(overrides),
      onLaunch,
      onAsk,
      onOpenFile: vi.fn(handlers.onOpenFile)
    })
  )
  return { onLaunch, onAsk }
}

const VAULT = { hasVault: true, vaultPath: '/ws/second-brain', vaultName: 'second-brain' }

describe('SecondBrainPanel (T7)', () => {
  afterEach(() => cleanup())

  it('renders the inviting empty state when there is no vault, launching /second-brain from the CTA', () => {
    const { onLaunch } = renderPanel()

    expect(screen.getByText('A base de conhecimento da squad')).toBeTruthy()
    fireEvent.click(screen.getByText('Configurar base'))
    expect(onLaunch).toHaveBeenCalledWith(
      expect.objectContaining({ command: expect.objectContaining({ prompt: '/second-brain' }) })
    )
  })

  it('shows the vault header with name and, when > 0, the raw-pending chip', () => {
    const { rerender } = render(
      createElement(SecondBrainPanel, {
        store: store({ ...VAULT, rawPending: 0 }),
        onLaunch: vi.fn(),
        onAsk: vi.fn(),
        onOpenFile: vi.fn()
      })
    )
    expect(screen.getByText('second-brain')).toBeTruthy()
    expect(screen.queryByText(/para ingerir/)).toBeNull()

    rerender(
      createElement(SecondBrainPanel, {
        store: store({ ...VAULT, rawPending: 3 }),
        onLaunch: vi.fn(),
        onAsk: vi.fn(),
        onOpenFile: vi.fn()
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

  it('opens the wiki index in the editor, at the vault-relative path (SB-R2.3)', () => {
    const onOpenFile = vi.fn()
    render(
      createElement(SecondBrainPanel, {
        store: store({ hasVault: true, vaultPath: '/ws/kb', vaultName: 'kb' }),
        onLaunch: vi.fn(),
        onAsk: vi.fn(),
        onOpenFile
      })
    )

    fireEvent.click(screen.getByText('Índice'))
    expect(onOpenFile).toHaveBeenCalledWith('kb/wiki/index.md')
    // The wiki tree browses the vault's wiki/ dir, workspace-relative.
    expect(window.hive.listTree).toHaveBeenCalledWith('/ws', 'kb/wiki')
  })

  it('falls back to the panel title when the vault has no name', () => {
    renderPanel({ hasVault: true, vaultPath: '/ws/x', vaultName: null })
    // Header falls back to "Second Brain".
    expect(screen.getByLabelText('Second Brain')).toBeTruthy()
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
