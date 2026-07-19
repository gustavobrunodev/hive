// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { IntentGrid } from './IntentGrid'
import type { RoleAction } from '../ui/ActionRail'

/**
 * IntentGrid in isolation (no window.hive surface — it's a pure view).
 * Chat.test.ts covers the composed hero (launching workflows, greeting,
 * custom labels); this file covers the interactions that don't need the full
 * Chat harness: keyboard activation of a pill, the "Em andamento" recents
 * indicator, and the "Personalizar" entry point.
 */

const ACTIONS: RoleAction[] = [
  { key: 'prd', kind: 'workflow', command: { key: 'bmad-prd', prompt: '/bmad-prd' } },
  {
    key: 'persona-pm',
    kind: 'persona',
    command: { key: 'bmad-agent-pm', prompt: '/bmad-agent-pm' }
  }
]

afterEach(cleanup)

describe('IntentGrid', () => {
  it('launches a pill with Enter and Space (keyboard parity with click)', () => {
    const onLaunch = vi.fn()
    render(createElement(IntentGrid, { actions: ACTIONS, onLaunch }))

    const pill = screen.getByText('Criar um PRD').closest('article') as Element
    fireEvent.keyDown(pill, { key: 'Enter' })
    fireEvent.keyDown(pill, { key: ' ' })
    // Any other key is inert.
    fireEvent.keyDown(pill, { key: 'a' })
    expect(onLaunch).toHaveBeenCalledTimes(2)
  })

  it('shows the "Em andamento" indicator for a recent whose reply is still running', () => {
    render(
      createElement(IntentGrid, {
        actions: ACTIONS,
        onLaunch: vi.fn(),
        onOpenRecent: vi.fn(),
        recents: [
          {
            id: 's1',
            agent: null,
            title: 'Rodando',
            createdAt: 1,
            updatedAt: 2,
            messageCount: 1,
            preview: ''
          },
          {
            id: 's2',
            agent: null,
            title: 'Parada',
            createdAt: 1,
            updatedAt: 2,
            messageCount: 1,
            preview: ''
          }
        ],
        runningIds: ['s1']
      })
    )

    expect(screen.getByText('Em andamento')).toBeTruthy()
    expect(screen.getByText('Rodando')).toBeTruthy()
  })

  it('opens a recent conversation on click', () => {
    const onOpenRecent = vi.fn()
    render(
      createElement(IntentGrid, {
        actions: ACTIONS,
        onLaunch: vi.fn(),
        onOpenRecent,
        recents: [
          {
            id: 's1',
            agent: null,
            title: 'Ontem',
            createdAt: 1,
            updatedAt: 2,
            messageCount: 1,
            preview: ''
          }
        ]
      })
    )

    fireEvent.click(screen.getByRole('button', { name: 'Abrir conversa: Ontem' }))
    expect(onOpenRecent).toHaveBeenCalledWith('s1')
  })

  it('keeps the "Personalizar" pill reachable even when every shortcut was deselected', () => {
    const onCustomize = vi.fn()
    render(createElement(IntentGrid, { actions: [], onLaunch: vi.fn(), onCustomize }))

    fireEvent.click(screen.getByRole('button', { name: 'Personalizar atalhos' }))
    expect(onCustomize).toHaveBeenCalledTimes(1)
    // No workflow pills — and no persona group label either.
    expect(screen.queryByText('Falar com um especialista')).toBeNull()
  })

  it('renders no pill row at all when there are no actions and no customization hook', () => {
    render(createElement(IntentGrid, { actions: [], onLaunch: vi.fn() }))
    expect(screen.queryByRole('list')).toBeNull()
  })
})
