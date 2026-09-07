// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ConnectionScope } from './ConnectionScope'
import type { AwsSessionState } from '../aws/useAwsSession'
import type { ClaudeAuthSession, ClaudeStatus } from '../claudeAuth/useClaudeAuth'
import { awsReadyFixture, awsStatusFixture, awsLoginStateFixture } from '../testSupport/hiveAwsMock'
import {
  claudeLoginStateFixture,
  claudeSignedOutFixture,
  claudeStatusFixture
} from '../testSupport/hiveClaudeAuthMock'

/**
 * Perfil › Conexão do Claude — the two-lane screen.
 *
 * The claim under test is the one the old screen could not make: **whichever
 * way this machine is authorised, the panel opens on it**. Before, the scope
 * was AWS-only, so the majority of users found a screen about a service they
 * do not use while the thing that had stopped their message had no surface.
 */

function claudeSession(
  status: ClaudeStatus | null,
  over: Partial<ClaudeAuthSession> = {}
): ClaudeAuthSession {
  return {
    status,
    login: claudeLoginStateFixture(),
    refresh: vi.fn(),
    connect: vi.fn(),
    submitCode: vi.fn(),
    cancel: vi.fn(),
    ...over
  }
}

function awsSession(status: AwsSessionState['status']): AwsSessionState {
  return {
    status,
    login: awsLoginStateFixture(),
    refresh: vi.fn(),
    connect: vi.fn(),
    cancel: vi.fn(),
    chooseProfile: vi.fn()
  }
}

function renderScope(
  claude: ClaudeAuthSession,
  aws: AwsSessionState,
  over: { initialLane?: 'claude' | 'aws'; onReadClipboard?: () => Promise<string> } = {}
): void {
  render(
    createElement(ConnectionScope, {
      claude,
      aws,
      onOpenUrl: vi.fn(),
      onCopyUrl: vi.fn(),
      onReadClipboard: over.onReadClipboard ?? (() => Promise.resolve('')),
      ...(over.initialLane ? { initialLane: over.initialLane } : {})
    })
  )
}

afterEach(cleanup)

describe('ConnectionScope', () => {
  it('opens on the account lane, and names who is signed in', () => {
    renderScope(claudeSession(claudeStatusFixture()), awsSession(awsStatusFixture()))
    expect(screen.getByRole('tab', { name: /Conta Claude/ }).getAttribute('aria-selected')).toBe(
      'true'
    )
    expect(screen.getByText('Conta conectada')).toBeTruthy()
    expect(screen.getAllByText('pessoa@exemplo.dev · Plano Pro').length).toBeGreaterThan(0)
  })

  it('opens on the Bedrock lane when the CLI says that is where the credentials are', () => {
    renderScope(
      claudeSession(claudeStatusFixture({ state: 'third-party' })),
      awsSession(awsReadyFixture())
    )
    expect(screen.getByRole('tab', { name: /Amazon Bedrock/ }).getAttribute('aria-selected')).toBe(
      'true'
    )
    expect(screen.getByText('Sessão ativa')).toBeTruthy()
  })

  it('honours the lane a deep link asked for, whatever detection says', () => {
    renderScope(claudeSession(claudeStatusFixture()), awsSession(awsStatusFixture()), {
      initialLane: 'aws'
    })
    expect(screen.getByRole('tab', { name: /Amazon Bedrock/ }).getAttribute('aria-selected')).toBe(
      'true'
    )
  })

  it('lets the other lane be read without changing anything about the machine', () => {
    const aws = awsSession(awsReadyFixture())
    renderScope(claudeSession(claudeStatusFixture({ state: 'third-party' })), aws)
    const claudeTab = screen.getByRole('tab', { name: /Conta Claude/ })
    expect(claudeTab.getAttribute('aria-selected')).toBe('false')

    fireEvent.mouseDown(claudeTab)
    expect(claudeTab.getAttribute('aria-selected')).toBe('true')
    // The account panel now reads the machine as it is: on Bedrock, with the
    // first-party account beside the point rather than broken.
    expect(
      screen.getByText('Este computador fala com o Claude pelo Amazon Bedrock.', { exact: false })
    ).toBeTruthy()
    // …and nothing about the machine was switched — this is a place to look.
    expect(aws.chooseProfile).not.toHaveBeenCalled()
  })

  it('offers the sign-in exactly where the account is missing', () => {
    const connect = vi.fn()
    renderScope(
      claudeSession(claudeSignedOutFixture(), { connect }),
      awsSession(awsStatusFixture())
    )
    // Twice: the lane strip reads it, and the panel states it.
    expect(screen.getAllByText('Nenhuma conta conectada')).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: 'Conectar conta' }))
    expect(connect).toHaveBeenCalled()
  })

  it('offers to switch accounts once one is connected', () => {
    const connect = vi.fn()
    renderScope(claudeSession(claudeStatusFixture(), { connect }), awsSession(awsStatusFixture()))
    fireEvent.click(screen.getByRole('button', { name: 'Trocar de conta' }))
    expect(connect).toHaveBeenCalled()
  })

  it('offers no sign-in where there is nothing to sign into', () => {
    renderScope(
      claudeSession(claudeStatusFixture({ state: 'no-cli', account: null, cliAvailable: false })),
      awsSession(awsStatusFixture())
    )
    expect(screen.queryByRole('button', { name: 'Conectar conta' })).toBeNull()
    expect(screen.getByText('Claude CLI não encontrada')).toBeTruthy()
  })

  it('sends someone with no CLI to the one page that fixes it', () => {
    const onOpenUrl = vi.fn()
    render(
      createElement(ConnectionScope, {
        claude: claudeSession(claudeStatusFixture({ state: 'no-cli', cliAvailable: false })),
        aws: awsSession(awsStatusFixture()),
        onOpenUrl,
        onCopyUrl: vi.fn(),
        onReadClipboard: () => Promise.resolve('')
      })
    )
    fireEvent.click(screen.getByRole('button', { name: /Como instalar o Claude Code/ }))
    expect(onOpenUrl).toHaveBeenCalledWith(expect.stringContaining('docs.claude.com'))
  })

  it('retries a failed sign-in from the panel', () => {
    const connect = vi.fn()
    renderScope(
      claudeSession(claudeSignedOutFixture(), {
        connect,
        login: claudeLoginStateFixture({ phase: 'failed', message: 'boom', startedAt: 1 })
      }),
      awsSession(awsStatusFixture())
    )
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(connect).toHaveBeenCalled()
  })

  it('draws the live sign-in inside the panel, code field and all', () => {
    renderScope(
      claudeSession(claudeSignedOutFixture(), {
        login: claudeLoginStateFixture({ phase: 'code', url: 'https://claude.com/x', startedAt: 1 })
      }),
      awsSession(awsStatusFixture())
    )
    expect(screen.getByLabelText('Código do navegador')).toBeTruthy()
  })

  it('draws a skeleton until main has answered — the read costs a spawn', () => {
    renderScope(claudeSession(null), awsSession(null))
    expect(screen.getByRole('tab', { name: /Lendo…/ })).toBeTruthy()
    expect(screen.queryByText('Conta conectada')).toBeNull()
  })
})
