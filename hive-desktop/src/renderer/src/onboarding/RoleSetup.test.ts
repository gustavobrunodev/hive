// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react'
import { RoleSetup } from './RoleSetup'

/**
 * P1-004 / P1-011 (role-personalization RP-R2) — the required first-run role
 * pick. Two things needed pinning: that the gate really is required (no
 * preselect, CTA disabled until a card is chosen), and that each card previews
 * the role's *real* resolved actions, fetched over IPC — the "empty state that
 * teaches" applied to choice. The preview branch (RoleSetup.tsx:58-64) was the
 * uncovered half.
 */
vi.mock('@hive/design-system', () => ({
  Button: ({ children, ...rest }: { children?: ReactNode; cut?: boolean }) => {
    delete rest.cut
    return createElement('button', { type: 'button', ...rest }, children)
  }
}))

/** What the bridge really returns (`main/roleCatalog.ts`'s `ResolvedRoleAction`). */
interface RoleActionPreview {
  key: string
  kind: 'workflow' | 'persona'
  command: { key: string; prompt?: string }
}

function action(key: string, kind: 'workflow' | 'persona' = 'workflow'): RoleActionPreview {
  return { key, kind, command: { key: `bmad-${key}`, prompt: `/bmad-${key}` } }
}

function mockRoleActions(byRole: Record<string, RoleActionPreview[]>): ReturnType<typeof vi.fn> {
  const roleActions = vi.fn(async (roleId: string) => byRole[roleId] ?? [])
  window.hive = {
    ...window.hive,
    profile: { ...window.hive?.profile, roleActions }
  } as typeof window.hive
  return roleActions
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('RoleSetup (P1-004/P1-011)', () => {
  it('starts with nothing selected and the CTA disabled — the pick is required', () => {
    mockRoleActions({})
    render(createElement(RoleSetup, { onComplete: vi.fn() }))

    expect(screen.getByRole('radiogroup', { name: 'Qual é o seu papel?' })).toBeTruthy()
    expect(screen.queryByRole('radio', { checked: true })).toBeNull()
    expect((screen.getByText('Entrar no Hive') as HTMLButtonElement).disabled).toBe(true)
  })

  it('hands the chosen role id to onComplete', () => {
    mockRoleActions({})
    const onComplete = vi.fn()
    render(createElement(RoleSetup, { onComplete }))

    fireEvent.click(screen.getByRole('radio', { name: /Product Manager/ }))
    fireEvent.click(screen.getByText('Entrar no Hive'))

    expect(onComplete).toHaveBeenCalledWith('pm')
  })

  it('previews each role with its own resolved workflows, at most three', async () => {
    const roleActions = mockRoleActions({
      pm: [
        action('domain-research'),
        action('brainstorm'),
        action('prd'),
        action('product-brief'),
        action('persona-pm', 'persona')
      ],
      dev: [action('dev-story'), action('persona-dev', 'persona')]
    })
    render(createElement(RoleSetup, { onComplete: vi.fn() }))

    await waitFor(() => expect(screen.getByText('Criar um PRD')).toBeTruthy())
    // Three at most, in catalog order…
    expect(screen.getByText('Pesquisar o domínio')).toBeTruthy()
    expect(screen.getByText('Fazer um brainstorm')).toBeTruthy()
    expect(screen.queryByText('Criar um product brief')).toBeNull()
    // …workflows only: the specialist is not one of the preview chips.
    expect(screen.queryByText(/Conversar com/)).toBeNull()
    // The catalog is read from main, never duplicated in the renderer.
    expect(roleActions).toHaveBeenCalledWith('pm')
    expect(roleActions).toHaveBeenCalledWith('dev')
  })

  it('renders every selectable role even before the previews resolve', () => {
    mockRoleActions({})
    render(createElement(RoleSetup, { onComplete: vi.fn() }))

    // The five selectable roles (`general` is an internal fallback, never offered).
    expect(screen.getAllByRole('radio')).toHaveLength(5)
  })

  it('drops a late preview answer after unmount', async () => {
    let resolveActions: (actions: RoleActionPreview[]) => void = () => {}
    window.hive = {
      ...window.hive,
      profile: {
        ...window.hive?.profile,
        roleActions: vi.fn(
          () => new Promise<RoleActionPreview[]>((resolve) => (resolveActions = resolve))
        )
      }
    } as typeof window.hive

    const { unmount } = render(createElement(RoleSetup, { onComplete: vi.fn() }))
    unmount()
    resolveActions([action('prd')])

    await waitFor(() => expect(document.body.textContent).toBe(''))
  })
})
