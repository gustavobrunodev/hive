// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SecondBrainPanel } from './SecondBrainPanel'
import type { SecondBrainStore } from './useSecondBrain'

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
    refresh: vi.fn(),
    ...overrides
  }
}

describe('SecondBrainPanel (T7)', () => {
  afterEach(() => cleanup())

  it('renders the inviting empty state when there is no vault, launching /second-brain from the CTA', () => {
    const onLaunch = vi.fn()
    render(createElement(SecondBrainPanel, { store: store(), onLaunch, onOpenFile: vi.fn() }))

    expect(screen.getByText('A base de conhecimento da squad')).toBeTruthy()
    fireEvent.click(screen.getByText('Configurar base'))
    expect(onLaunch).toHaveBeenCalledWith(
      expect.objectContaining({ command: expect.objectContaining({ prompt: '/second-brain' }) })
    )
  })

  it('shows the vault header with name and, when > 0, the raw-pending chip', () => {
    const { rerender } = render(
      createElement(SecondBrainPanel, {
        store: store({
          hasVault: true,
          vaultPath: '/ws/second-brain',
          vaultName: 'second-brain',
          rawPending: 0
        }),
        onLaunch: vi.fn(),
        onOpenFile: vi.fn()
      })
    )
    expect(screen.getByText('second-brain')).toBeTruthy()
    expect(screen.queryByText(/para ingerir/)).toBeNull()

    rerender(
      createElement(SecondBrainPanel, {
        store: store({
          hasVault: true,
          vaultPath: '/ws/second-brain',
          vaultName: 'second-brain',
          rawPending: 3
        }),
        onLaunch: vi.fn(),
        onOpenFile: vi.fn()
      })
    )
    expect(screen.getByText('3 itens para ingerir')).toBeTruthy()
  })

  it('launches the correct slash command for each action', () => {
    const onLaunch = vi.fn()
    render(
      createElement(SecondBrainPanel, {
        store: store({ hasVault: true, vaultPath: '/ws/second-brain', vaultName: 'kb' }),
        onLaunch,
        onOpenFile: vi.fn()
      })
    )

    fireEvent.click(screen.getByText('Ingerir'))
    fireEvent.click(screen.getByText('Consultar'))
    fireEvent.click(screen.getByText('Organizar'))

    const prompts = onLaunch.mock.calls.map((c) => c[0].command.prompt)
    expect(prompts).toEqual(['/second-brain-ingest', '/second-brain-query', '/second-brain-lint'])
  })

  it('opens the wiki index in the editor, at the vault-relative path (SB-R2.3)', () => {
    const onOpenFile = vi.fn()
    render(
      createElement(SecondBrainPanel, {
        store: store({ hasVault: true, vaultPath: '/ws/kb', vaultName: 'kb' }),
        onLaunch: vi.fn(),
        onOpenFile
      })
    )

    fireEvent.click(screen.getByText('Índice'))
    expect(onOpenFile).toHaveBeenCalledWith('kb/wiki/index.md')
    // The wiki tree browses the vault's wiki/ dir, workspace-relative.
    expect(window.hive.listTree).toHaveBeenCalledWith('/ws', 'kb/wiki')
  })

  it('falls back to the panel title when the vault has no name', () => {
    render(
      createElement(SecondBrainPanel, {
        store: store({ hasVault: true, vaultPath: '/ws/x', vaultName: null }),
        onLaunch: vi.fn(),
        onOpenFile: vi.fn()
      })
    )
    // Header falls back to "Second Brain".
    expect(screen.getByLabelText('Second Brain')).toBeTruthy()
  })
})
