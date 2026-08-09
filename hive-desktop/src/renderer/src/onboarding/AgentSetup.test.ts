// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { act, cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react'
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
    version: null,
    detectCommand: over.id,
    installHint: `instale ${over.id}`,
    installable: false,
    installCommand: null,
    docsUrl: `https://docs.example/${over.id}`,
    ...over
  }
}

function mockAgents(
  list: AgentMeta[],
  installAgent: ReturnType<typeof vi.fn> = vi.fn(() => vi.fn())
): {
  openExternal: ReturnType<typeof vi.fn>
  agents: ReturnType<typeof vi.fn>
  installAgent: ReturnType<typeof vi.fn>
} {
  const openExternal = vi.fn()
  const agents = vi.fn(async () => list)
  window.hive = {
    ...window.hive,
    profile: { ...window.hive?.profile, agents, installAgent },
    openExternal
  } as typeof window.hive
  return { openExternal, agents, installAgent }
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

    await waitFor(() => expect(screen.getByText('Instalação pelo fornecedor')).toBeTruthy())
    expect(screen.getByText('instale devin')).toBeTruthy()
    // Not installable → no button Hive couldn't honour (AO-R4).
    expect(screen.queryByLabelText('Instalar devin agora')).toBeNull()
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

/**
 * agent-onboarding (M17). The screen's two new jobs: it can look again, and it
 * can install. Both exist because of one report — a CLI that was installed and
 * that Hive kept calling missing — where the only thing the old screen could
 * offer was a shell command and a link out.
 */
describe('AgentSetup — scan and install (agent-onboarding)', () => {
  it('reports what the scan found and offers to run it again, folding in what appeared', async () => {
    const missing = agent({ id: 'claude-cli', available: false, installable: true })
    const found = agent({ id: 'claude-cli', available: true, version: '2.1.226 (Claude Code)' })
    const agents = vi
      .fn<() => Promise<AgentMeta[]>>()
      .mockResolvedValueOnce([missing])
      .mockResolvedValueOnce([found])
    window.hive = {
      ...window.hive,
      profile: { ...window.hive?.profile, agents, installAgent: vi.fn(() => vi.fn()) },
      openExternal: vi.fn()
    } as typeof window.hive

    render(createElement(AgentSetup, { onComplete: vi.fn() }))
    await waitFor(() =>
      expect(screen.getByText('Nenhum agente encontrado neste computador.')).toBeTruthy()
    )

    fireEvent.click(screen.getByText('Procurar de novo'))

    // The re-probe is a *refresh*, not another cached answer.
    await waitFor(() => expect(agents).toHaveBeenLastCalledWith(true))
    await waitFor(() =>
      expect(screen.getByText('1 de 1 agentes encontrados neste computador.')).toBeTruthy()
    )
    // Newly found → enabled, default, and the version is on the card as evidence.
    expect(screen.getByText('2.1.226 (Claude Code)')).toBeTruthy()
    expect(screen.getByText('1 agente habilitado.')).toBeTruthy()
  })

  it('a re-scan never disturbs a choice the user already made', async () => {
    const claude = agent({ id: 'claude-cli', available: true })
    const copilot = agent({ id: 'github-copilot', available: false, installable: true })
    const agents = vi
      .fn<() => Promise<AgentMeta[]>>()
      .mockResolvedValueOnce([claude, copilot])
      .mockResolvedValueOnce([claude, { ...copilot, available: true }])
    const onComplete = vi.fn()
    window.hive = {
      ...window.hive,
      profile: { ...window.hive?.profile, agents, installAgent: vi.fn(() => vi.fn()) },
      openExternal: vi.fn()
    } as typeof window.hive

    render(createElement(AgentSetup, { onComplete }))
    await waitFor(() => expect(screen.getByText('1 agente habilitado.')).toBeTruthy())
    // Turn the detected one off, *then* re-scan.
    fireEvent.click(screen.getByLabelText('Habilitar ou desabilitar claude-cli'))
    fireEvent.click(screen.getByText('Procurar de novo'))

    await waitFor(() => expect(screen.getByText('1 agente habilitado.')).toBeTruthy())
    fireEvent.click(screen.getByText('Continuar'))
    // Only the agent that crossed from missing to found was switched on. The
    // one the user had just turned off stayed off — a re-scan reports the
    // machine, it doesn't overrule a choice made on this screen.
    expect(onComplete).toHaveBeenCalledWith(['github-copilot'], 'github-copilot')
  })

  it('installs an agent from its card, streams npm, and enables it once the probe confirms', async () => {
    const installed = agent({ id: 'claude-cli', available: true, version: '2.1.226' })
    let emit: (event: unknown) => void = () => {}
    const installAgent = vi.fn((_id: string, onEvent: (event: unknown) => void) => {
      emit = onEvent
      return vi.fn()
    })
    mockAgents(
      [
        agent({
          id: 'claude-cli',
          available: false,
          installable: true,
          installCommand: 'npm install -g @anthropic-ai/claude-code'
        })
      ],
      installAgent
    )

    render(createElement(AgentSetup, { onComplete: vi.fn() }))
    await waitFor(() => expect(screen.getByText('O Hive instala para você')).toBeTruthy())
    // The command is shown before the click — the user knows what will run.
    expect(screen.getByText('npm install -g @anthropic-ai/claude-code')).toBeTruthy()

    fireEvent.click(screen.getByLabelText('Instalar claude-cli agora'))
    expect(installAgent).toHaveBeenCalledWith('claude-cli', expect.any(Function))

    act(() => emit({ type: 'progress', message: 'added 214 packages in 12s' }))
    expect(screen.getByText('Instalando claude-cli…')).toBeTruthy()
    expect(screen.getByText('added 214 packages in 12s')).toBeTruthy()

    act(() => emit({ type: 'done', agent: installed }))
    await waitFor(() => expect(screen.getByText('Prontos para usar')).toBeTruthy())
    // Installing IS the consent to use it: enabled, and the default when none was set.
    expect(screen.getByText('1 agente habilitado.')).toBeTruthy()
    expect(
      (screen.getByLabelText('Habilitar ou desabilitar claude-cli') as HTMLInputElement).checked
    ).toBe(true)
  })

  it('says what went wrong, keeps npm’s output, and offers the retry + the command to copy', async () => {
    let emit: (event: unknown) => void = () => {}
    const installAgent = vi.fn((_id: string, onEvent: (event: unknown) => void) => {
      emit = onEvent
      return vi.fn()
    })
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    mockAgents(
      [
        agent({
          id: 'github-copilot',
          available: false,
          installable: true,
          installCommand: 'npm install -g @github/copilot'
        })
      ],
      installAgent
    )

    render(createElement(AgentSetup, { onComplete: vi.fn() }))
    await waitFor(() => expect(screen.getByLabelText('Instalar github-copilot agora')).toBeTruthy())
    fireEvent.click(screen.getByLabelText('Instalar github-copilot agora'))

    act(() => emit({ type: 'error', reason: 'permission', detail: 'npm ERR! code EACCES' }))

    expect(
      screen.getByText(
        'Sem permissão para instalar pacotes globais. Copie o comando e rode com a permissão necessária.'
      )
    ).toBeTruthy()
    expect(screen.getByText('npm ERR! code EACCES')).toBeTruthy()

    // The escape hatch the message points at.
    fireEvent.click(screen.getByLabelText('Copiar o comando de instalação do github-copilot'))
    expect(writeText).toHaveBeenCalledWith('npm install -g @github/copilot')

    fireEvent.click(screen.getByLabelText('Tentar instalar github-copilot de novo'))
    expect(installAgent).toHaveBeenCalledTimes(2)
  })

  it('kills an install still running when the screen unmounts', async () => {
    const cancel = vi.fn()
    const installAgent = vi.fn(() => cancel)
    mockAgents(
      [agent({ id: 'claude-cli', available: false, installable: true })],
      installAgent as unknown as ReturnType<typeof vi.fn>
    )

    const { unmount } = render(createElement(AgentSetup, { onComplete: vi.fn() }))
    await waitFor(() => expect(screen.getByLabelText('Instalar claude-cli agora')).toBeTruthy())
    fireEvent.click(screen.getByLabelText('Instalar claude-cli agora'))
    unmount()

    // Otherwise npm keeps writing into a global prefix with nobody listening.
    expect(cancel).toHaveBeenCalled()
  })
})
