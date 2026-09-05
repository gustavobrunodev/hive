// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { AwsLoginFlow, type AwsLoginView } from './AwsLoginFlow'
import { AwsLoginBeacon } from './AwsLoginBeacon'

/**
 * The live sign-in. What matters here is that the hand-off out of the app is
 * never a dead end: the URL is always re-openable and copyable while the CLI
 * is waiting, the step rail says whose turn it is, and a failure keeps the
 * CLI's own words behind a disclosure rather than in the user's face.
 */

const URL = 'https://oidc.us-east-1.amazonaws.com/authorize?client_id=x'

function state(over: Partial<AwsLoginView> = {}): AwsLoginView {
  return {
    phase: 'browser',
    profile: 'acme-dev',
    url: URL,
    code: null,
    message: null,
    startedAt: 1000,
    expiresAt: null,
    ...over
  }
}

function renderFlow(
  over: Partial<AwsLoginView> = {},
  handlers: Record<string, () => void> = {}
): ReturnType<typeof render> {
  return render(
    createElement(AwsLoginFlow, {
      state: state(over),
      now: 12_000,
      onOpenUrl: handlers.onOpenUrl ?? vi.fn(),
      onCopyUrl: handlers.onCopyUrl ?? vi.fn(),
      onCancel: handlers.onCancel ?? vi.fn(),
      onRetry: handlers.onRetry ?? vi.fn()
    })
  )
}

afterEach(cleanup)

describe('AwsLoginFlow', () => {
  it('names the profile and shows the step the user is on', () => {
    renderFlow()
    expect(screen.getByText('Perfil acme-dev')).toBeTruthy()
    const current = screen
      .getAllByRole('listitem')
      .find((item) => item.getAttribute('aria-current') === 'step')
    expect(current?.textContent).toContain('Autorize no navegador')
  })

  it('hints only under the live step, so the card is an instruction and not a paragraph', () => {
    renderFlow()
    expect(screen.getByText('Abrimos a página de login da sua conta')).toBeTruthy()
    expect(screen.queryByText('Falando com o AWS CLI desta máquina')).toBeNull()
  })

  it('keeps the way back in: the URL, re-openable and copyable', () => {
    const onOpenUrl = vi.fn()
    const onCopyUrl = vi.fn()
    renderFlow({}, { onOpenUrl, onCopyUrl })
    fireEvent.click(screen.getByRole('button', { name: /Abrir de novo/ }))
    expect(onOpenUrl).toHaveBeenCalledWith(URL)
    fireEvent.click(screen.getByRole('button', { name: /Copiar link/ }))
    expect(onCopyUrl).toHaveBeenCalledWith(URL)
    expect(screen.getByText('Copiado')).toBeTruthy()
  })

  it('shows the verification code when the device-code flow prints one', () => {
    renderFlow({ code: 'VFRM-JRXW' })
    expect(screen.getByText('VFRM-JRXW')).toBeTruthy()
  })

  it('shows no code slot at all in the authorization-code flow', () => {
    // Inventing an empty "code" field would invent a step the user does not
    // have to perform.
    const { container } = renderFlow()
    expect(container.querySelector('.wb-aws-code')).toBeNull()
  })

  it('says how long it has been waiting, since eleven seconds and four minutes differ', () => {
    renderFlow()
    expect(screen.getByText('11s esperando')).toBeTruthy()
  })

  it('offers cancel while live, and nothing to cancel once it landed', () => {
    const onCancel = vi.fn()
    const { rerender } = renderFlow({}, { onCancel })
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(onCancel).toHaveBeenCalled()
    rerender(
      createElement(AwsLoginFlow, {
        state: state({ phase: 'success', expiresAt: '2026-09-04T20:00:00Z' }),
        now: Date.parse('2026-09-04T14:00:00Z'),
        onOpenUrl: vi.fn(),
        onCopyUrl: vi.fn(),
        onCancel,
        onRetry: vi.fn()
      })
    )
    expect(screen.queryByRole('button', { name: 'Cancelar' })).toBeNull()
  })

  it('states the fresh session length on success, which is the receipt for the trip', () => {
    renderFlow({ phase: 'success', expiresAt: '2026-09-04T20:00:00Z' })
    // `now` is 12s past the epoch in this fixture, so "more than 6 h" is the
    // only reading that matters: it is a duration, not a timestamp.
    expect(screen.getByText(/Sessão válida por mais/)).toBeTruthy()
  })

  it('offers a retry on failure and keeps the CLI text behind a disclosure', () => {
    const onRetry = vi.fn()
    renderFlow({ phase: 'failed', message: 'Error loading SSO Token' }, { onRetry })
    expect(screen.getByText('Não deu para entrar')).toBeTruthy()
    expect(screen.queryByText('Error loading SSO Token')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Ver detalhes' }))
    expect(screen.getByText('Error loading SSO Token')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(onRetry).toHaveBeenCalled()
  })

  it('marks the authorize step as failed — not the connection', () => {
    renderFlow({ phase: 'failed', message: 'x' })
    const items = screen.getAllByRole('listitem')
    expect(items[1].getAttribute('data-status')).toBe('failed')
    expect(items[2].getAttribute('data-status')).toBe('pending')
  })
})

describe('AwsLoginBeacon', () => {
  function renderBeacon(
    over: Partial<AwsLoginView> = {},
    props: Record<string, unknown> = {}
  ): ReturnType<typeof render> {
    return render(
      createElement(AwsLoginBeacon, {
        state: state(over),
        onOpenUrl: vi.fn(),
        onCopyUrl: vi.fn(),
        onCancel: vi.fn(),
        onRetry: vi.fn(),
        ...props
      })
    )
  }

  it('appears while a login is live, as a status region rather than a dialog', () => {
    // Not a modal: the user just sent a message and the useful thing they can
    // still do is keep working while the browser does its part.
    renderBeacon()
    expect(screen.getByRole('status', { name: 'Entrada na AWS em andamento' })).toBeTruthy()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('stays out of the way when nothing is happening', () => {
    const { container } = renderBeacon({ phase: 'idle' })
    expect(container.firstChild).toBeNull()
  })

  it('disappears the moment the user cancels, rather than lingering on a cancelled state', () => {
    const onCancel = vi.fn()
    const { container } = renderBeacon({}, { onCancel })
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(onCancel).toHaveBeenCalled()
    expect(container.firstChild).toBeNull()
  })

  it('yields to a surface that is already drawing the same login', () => {
    const { container } = renderBeacon({}, { suppressed: true })
    expect(container.firstChild).toBeNull()
  })

  it('lingers on success — the receipt for a trip the user took to another window — and then lets go', () => {
    vi.useFakeTimers()
    try {
      const { container } = renderBeacon({ phase: 'success' })
      expect(container.firstChild).not.toBeNull()
      act(() => {
        vi.advanceTimersByTime(2000)
      })
      expect(container.firstChild).not.toBeNull()
      act(() => {
        vi.advanceTimersByTime(2000)
      })
      expect(container.firstChild).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })
})
