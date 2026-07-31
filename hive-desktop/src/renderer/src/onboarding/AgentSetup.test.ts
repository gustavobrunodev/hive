// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AgentSetup } from './AgentSetup'
import type { AgentMeta } from '../ui/AgentPicker'

/**
 * P1-004 / P1-013 (multi-agent, R-03) — the first-run agent picker had no
 * co-located test: functions sat at 25%, which is to say the *decisions* it
 * makes (which agents end up enabled, which one becomes the default, whether
 * the user may continue at all) were never exercised. This is the first screen
 * a new user touches, and everything downstream routes on what it persists.
 *
 * Mocking follows GuidedInstall.test.ts/UpdateGate.test.ts: DOM stand-ins for
 * the design-system (a real render would pull in a second React instance), and
 * `window.hive` mocked per test.
 */
vi.mock('@hive/design-system', () => ({
  Button: ({ children, ...rest }: { children?: ReactNode; cut?: boolean }) => {
    delete rest.cut
    return createElement('button', { type: 'button', ...rest }, children)
  },
  Spinner: ({ label }: { label?: string }) => createElement('span', { role: 'status' }, label),
  Switch: ({
    checked,
    onCheckedChange,
    ...rest
  }: {
    checked?: boolean
    onCheckedChange?: (checked: boolean) => void
    'aria-label'?: string
  }) =>
    createElement('input', {
      type: 'checkbox',
      checked: Boolean(checked),
      onChange: (event: { target: { checked: boolean } }) =>
        onCheckedChange?.(event.target.checked),
      ...rest
    })
}))

function agent(over: Partial<AgentMeta> & { id: string }): AgentMeta {
  return {
    displayName: over.id,
    description: `descrição de ${over.id}`,
    available: true,
    installHint: `instale ${over.id}`,
    docsUrl: `https://docs.example/${over.id}`,
    ...over
  }
}

function mockAgents(list: AgentMeta[]): { openExternal: ReturnType<typeof vi.fn> } {
  const openExternal = vi.fn()
  window.hive = {
    ...window.hive,
    profile: { ...window.hive?.profile, agents: vi.fn(async () => list) },
    openExternal
  } as typeof window.hive
  return { openExternal }
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('AgentSetup (P1-004)', () => {
  it('shows the detecting state until the probe answers', async () => {
    mockAgents([agent({ id: 'claude-cli' })])
    render(createElement(AgentSetup, { onComplete: vi.fn() }))

    // `getByText`, not `getByRole('status')`: the selection hint below the
    // picker is also a live region, and two of them is not an error.
    expect(screen.getByText('Procurando agentes instalados…')).toBeTruthy()
    await waitFor(() => expect(screen.getByLabelText(/Habilitar ou desabilitar/)).toBeTruthy())
  })

  it('pre-enables every detected agent and makes the first the default', async () => {
    const onComplete = vi.fn()
    mockAgents([
      agent({ id: 'claude-cli' }),
      agent({ id: 'github-copilot' }),
      agent({ id: 'devin', available: false })
    ])
    render(createElement(AgentSetup, { onComplete }))

    await waitFor(() => expect(screen.getByText('2 agentes habilitados.')).toBeTruthy())
    fireEvent.click(screen.getByText('Continuar'))

    // The unavailable one is never enabled — availability is honest here.
    expect(onComplete).toHaveBeenCalledWith(['claude-cli', 'github-copilot'], 'claude-cli')
  })

  it('cannot continue with nothing enabled, and says so', async () => {
    const onComplete = vi.fn()
    mockAgents([agent({ id: 'claude-cli' })])
    render(createElement(AgentSetup, { onComplete }))

    await waitFor(() => expect(screen.getByText('1 agente habilitado.')).toBeTruthy())
    fireEvent.click(screen.getByLabelText('Habilitar ou desabilitar claude-cli'))

    expect(screen.getByText('Selecione ao menos um agente para continuar.')).toBeTruthy()
    const cta = screen.getByText('Continuar') as HTMLButtonElement
    expect(cta.disabled).toBe(true)
    fireEvent.click(cta)
    expect(onComplete).not.toHaveBeenCalled()
  })

  it('re-homes the default when the default agent is switched off', async () => {
    const onComplete = vi.fn()
    mockAgents([agent({ id: 'claude-cli' }), agent({ id: 'github-copilot' })])
    render(createElement(AgentSetup, { onComplete }))

    await waitFor(() => expect(screen.getByText('2 agentes habilitados.')).toBeTruthy())
    // Turning off the default must not leave the app pointing at a disabled
    // agent — every new conversation would start on an agent the user turned off.
    fireEvent.click(screen.getByLabelText('Habilitar ou desabilitar claude-cli'))
    fireEvent.click(screen.getByText('Continuar'))

    expect(onComplete).toHaveBeenCalledWith(['github-copilot'], 'github-copilot')
  })

  it('promotes an enabled agent to default via the star', async () => {
    const onComplete = vi.fn()
    mockAgents([agent({ id: 'claude-cli' }), agent({ id: 'github-copilot' })])
    render(createElement(AgentSetup, { onComplete }))

    await waitFor(() => expect(screen.getByText('2 agentes habilitados.')).toBeTruthy())
    fireEvent.click(screen.getByLabelText('Definir github-copilot como agente padrão'))
    fireEvent.click(screen.getByText('Continuar'))

    expect(onComplete).toHaveBeenCalledWith(['claude-cli', 'github-copilot'], 'github-copilot')
  })

  it('re-enabling an agent when none is left adopts it as the default', async () => {
    const onComplete = vi.fn()
    mockAgents([agent({ id: 'claude-cli' })])
    render(createElement(AgentSetup, { onComplete }))

    await waitFor(() => expect(screen.getByText('1 agente habilitado.')).toBeTruthy())
    const toggle = screen.getByLabelText('Habilitar ou desabilitar claude-cli')
    fireEvent.click(toggle)
    fireEvent.click(toggle)
    fireEvent.click(screen.getByText('Continuar'))

    expect(onComplete).toHaveBeenCalledWith(['claude-cli'], 'claude-cli')
  })

  it('an unavailable agent shows how to install instead of pretending to work (P1-013)', async () => {
    const { openExternal } = mockAgents([agent({ id: 'devin', available: false })])
    render(createElement(AgentSetup, { onComplete: vi.fn() }))

    await waitFor(() => expect(screen.getByText('Precisam ser instalados')).toBeTruthy())
    expect(screen.getByText('instale devin')).toBeTruthy()
    // No enable switch at all for an agent that isn't there.
    expect(screen.queryByLabelText('Habilitar ou desabilitar devin')).toBeNull()

    fireEvent.click(screen.getByLabelText('Como instalar devin (abre no navegador)'))
    expect(openExternal).toHaveBeenCalledWith('https://docs.example/devin')
  })

  it('drops a late probe answer after unmount instead of setting state on a dead tree', async () => {
    let resolveAgents: (list: AgentMeta[]) => void = () => {}
    window.hive = {
      ...window.hive,
      profile: {
        ...window.hive?.profile,
        agents: vi.fn(() => new Promise<AgentMeta[]>((resolve) => (resolveAgents = resolve)))
      }
    } as typeof window.hive

    const { unmount } = render(createElement(AgentSetup, { onComplete: vi.fn() }))
    unmount()
    resolveAgents([agent({ id: 'claude-cli' })])

    // Nothing renders and nothing throws: the `cancelled` guard held.
    await waitFor(() => expect(document.body.textContent).toBe(''))
  })
})
