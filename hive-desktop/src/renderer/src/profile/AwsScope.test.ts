// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { AwsScope } from './AwsScope'
import { awsLoginStateFixture, awsReadyFixture, awsStatusFixture } from '../testSupport/hiveAwsMock'
import type { AwsSessionState, AwsStatus } from '../aws/useAwsSession'

/**
 * Perfil › Conexão AWS. The panel's job is to answer, before any click, "will
 * Claude work right now, and as whom?" — so every test here is about a claim
 * the panel makes, and about the states where it must NOT make one.
 */

function session(status: AwsStatus | null, over: Partial<AwsSessionState> = {}): AwsSessionState {
  return {
    status,
    login: awsLoginStateFixture(),
    refresh: vi.fn(),
    connect: vi.fn(),
    cancel: vi.fn(),
    chooseProfile: vi.fn(),
    ...over
  }
}

function renderScope(state: AwsSessionState): ReturnType<typeof render> {
  return render(createElement(AwsScope, { session: state, onOpenUrl: vi.fn(), onCopyUrl: vi.fn() }))
}

afterEach(cleanup)

describe('AwsScope', () => {
  it('draws a skeleton until main answers, rather than a fact that may change', () => {
    const { container } = renderScope(session(null))
    expect(container.querySelector('.wb-aws-skeleton')).toBeTruthy()
  })

  it('makes no claim on a machine that is not on Bedrock', () => {
    renderScope(session(awsStatusFixture()))
    expect(screen.getByText('Claude não está usando o Bedrock')).toBeTruthy()
    expect(screen.queryByRole('meter')).toBeNull()
  })

  it('leads with the session ring and states how much is left', () => {
    renderScope(session(awsReadyFixture()))
    const meter = screen.getByRole('meter', { name: 'Tempo restante da sessão AWS' })
    expect(meter.getAttribute('aria-valuetext')).toBe('6 h')
    expect(screen.getByText('Sessão ativa')).toBeTruthy()
  })

  it('names the account, the role and the region — the answer to "as whom?"', () => {
    renderScope(session(awsReadyFixture()))
    expect(screen.getByText('0607-9590-2845')).toBeTruthy()
    expect(screen.getByText('AdministratorAccess')).toBeTruthy()
    expect(screen.getByText('us-east-1')).toBeTruthy()
  })

  it('says where the profile came from, so the reader can check it', () => {
    renderScope(session(awsReadyFixture()))
    expect(screen.getByText('definido no settings.json do Claude')).toBeTruthy()
  })

  it('offers a renewal, and hands it to the service', () => {
    const connect = vi.fn()
    renderScope(session(awsReadyFixture({ state: 'expired', expiresInMs: -1 }), { connect }))
    fireEvent.click(screen.getByRole('button', { name: 'Renovar sessão' }))
    expect(connect).toHaveBeenCalled()
  })

  it('says "entrar" rather than "renovar" when there was never a session', () => {
    renderScope(session(awsReadyFixture({ state: 'absent', expiresInMs: null, expiresAt: null })))
    expect(screen.getByRole('button', { name: 'Entrar na AWS' })).toBeTruthy()
  })

  it('draws no countdown for a profile that has nothing to count', () => {
    // A ring reading zero for static keys would be a lie shaped like a
    // measurement.
    const { container } = renderScope(
      session(awsReadyFixture({ state: 'unmanaged', authKind: 'static' }))
    )
    expect(screen.queryByRole('meter')).toBeNull()
    expect(container.querySelector('.wb-aws-dial-static')).toBeTruthy()
    expect(screen.getByText(/chaves de acesso fixas/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Renovar|Entrar/ })).toBeNull()
  })

  it('names the missing profile and points at the file it is missing from', () => {
    renderScope(
      session(awsReadyFixture({ state: 'not-configured', profile: 'ghost', authKind: 'unknown' }))
    )
    expect(screen.getByText(/O perfil "ghost" não está no ~\/.aws\/config/)).toBeTruthy()
  })

  it('offers the install when the aws CLI is missing, and no reconnect it cannot honour', () => {
    renderScope(session(awsReadyFixture({ cliAvailable: false, state: 'expired' })))
    expect(screen.getByText('AWS CLI não encontrada')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Renovar sessão' })).toBeNull()
  })

  it('lists the profiles and says which already have a session', () => {
    renderScope(
      session(
        awsReadyFixture({
          profiles: [
            {
              name: 'acme-dev',
              accountId: '060795902845',
              roleName: 'Admin',
              region: 'us-east-1',
              authKind: 'sso',
              signedIn: true
            },
            {
              name: 'acme-prod',
              accountId: '241533149506',
              roleName: 'ReadOnly',
              region: 'sa-east-1',
              authKind: 'sso',
              signedIn: false
            }
          ]
        })
      )
    )
    expect(screen.getByText('com sessão')).toBeTruthy()
    expect(screen.getByText('sem sessão')).toBeTruthy()
    expect(screen.getByText('0607-9590-2845 · Admin · us-east-1')).toBeTruthy()
  })

  it('pins a profile through the service, and offers the way back to automatic', () => {
    const chooseProfile = vi.fn()
    renderScope(
      session(
        awsReadyFixture({
          profileSource: 'hive',
          profiles: [
            {
              name: 'acme-prod',
              accountId: null,
              roleName: null,
              region: null,
              authKind: 'sso',
              signedIn: false
            }
          ]
        }),
        { chooseProfile }
      )
    )
    fireEvent.click(screen.getByRole('button', { name: /acme-prod/ }))
    expect(chooseProfile).toHaveBeenCalledWith('acme-prod')
    fireEvent.click(screen.getByRole('button', { name: /Detectar automaticamente/ }))
    expect(chooseProfile).toHaveBeenCalledWith(null)
  })

  it('marks "automatic" as selected while nothing is pinned', () => {
    renderScope(session(awsReadyFixture()))
    const auto = screen.getByRole('button', { name: /Detectar automaticamente/ })
    expect(auto.getAttribute('aria-pressed')).toBe('true')
  })

  it('draws the live login inline, so the panel is not a second copy of the beacon', () => {
    renderScope(
      session(awsReadyFixture({ state: 'expired' }), {
        login: awsLoginStateFixture({
          phase: 'browser',
          profile: 'acme-dev',
          url: 'https://oidc.example/authorize',
          startedAt: 1000
        })
      })
    )
    expect(screen.getByText('Entrando na AWS')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Abrir de novo/ })).toBeTruthy()
  })

  it('warns while the session is still usable — "dá para continuar", not an alarm', () => {
    renderScope(session(awsReadyFixture({ state: 'expiring' })))
    expect(screen.getByText('Sessão quase no fim')).toBeTruthy()
    expect(
      screen.getByText('Dá para continuar. Renovamos sozinhos quando ela acabar.')
    ).toBeTruthy()
  })

  it('names the credential kind for a credential_process profile too', () => {
    renderScope(session(awsReadyFixture({ state: 'unmanaged', authKind: 'process' })))
    expect(screen.getByText(/um credential_process/)).toBeTruthy()
  })

  it('falls back to a plain sentence for a kind it does not have words for', () => {
    renderScope(session(awsReadyFixture({ state: 'unmanaged', authKind: 'sso' })))
    expect(screen.getByText(/uma configuração que o Hive não reconhece/)).toBeTruthy()
  })

  it('omits a fact it does not know, rather than printing an empty row', () => {
    const { container } = renderScope(
      session(awsReadyFixture({ accountId: null, roleName: null, region: null }))
    )
    expect(container.querySelectorAll('.wb-aws-fact')).toHaveLength(1)
  })

  it('draws no profile list on a machine whose ~/.aws/config has none', () => {
    const { container } = renderScope(session(awsReadyFixture({ profiles: [] })))
    expect(container.querySelector('.wb-aws-profiles')).toBeNull()
  })

  it('marks the pinned profile in the list, so the pin is visible where it applies', () => {
    renderScope(
      session(
        awsReadyFixture({
          profileSource: 'hive',
          profiles: [
            {
              name: 'acme-dev',
              accountId: null,
              roleName: null,
              region: null,
              authKind: 'sso',
              signedIn: true
            }
          ]
        })
      )
    )
    expect(screen.getByRole('button', { name: /acme-dev/ }).getAttribute('aria-pressed')).toBe(
      'true'
    )
    expect(
      screen.getByRole('button', { name: /Detectar automaticamente/ }).getAttribute('aria-pressed')
    ).toBe('false')
  })

  it('opens the AWS CLI install page from the no-CLI notice', () => {
    const onOpenUrl = vi.fn()
    render(
      createElement(AwsScope, {
        session: session(awsReadyFixture({ cliAvailable: false })),
        onOpenUrl,
        onCopyUrl: vi.fn()
      })
    )
    fireEvent.click(screen.getByRole('button', { name: /Como instalar a AWS CLI/ }))
    expect(onOpenUrl).toHaveBeenCalledWith(expect.stringContaining('docs.aws.amazon.com'))
  })
})
