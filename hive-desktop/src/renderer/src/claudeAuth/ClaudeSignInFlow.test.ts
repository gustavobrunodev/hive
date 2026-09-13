// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ClaudeSignInFlow, type ClaudeLoginView } from './ClaudeSignInFlow'
import { ClaudeSignInBeacon } from './ClaudeSignInBeacon'

/**
 * The live sign-in to a Claude account.
 *
 * What matters here is the round trip out of the app and back: the URL is
 * always re-openable and copyable while the CLI waits, the rail says whose
 * turn it is, the code the user carries back has somewhere to land — and a
 * code the CLI rejects is a retry, with the value still in the field, rather
 * than a card that threw the sign-in away.
 */

const URL = 'https://claude.com/cai/oauth/authorize?code=true&state=abc'

function state(over: Partial<ClaudeLoginView> = {}): ClaudeLoginView {
  return {
    phase: 'browser',
    mode: 'claudeai',
    url: URL,
    codeError: null,
    message: null,
    startedAt: 1000,
    account: null,
    ...over
  }
}

function renderFlow(
  over: Partial<ClaudeLoginView> = {},
  handlers: Partial<{
    onOpenUrl: (url: string) => void
    onCopyUrl: (url: string) => void
    onSubmitCode: (code: string) => void
    onReadClipboard: () => Promise<string>
    onCancel: () => void
    onRetry: () => void
  }> = {}
): ReturnType<typeof render> {
  return render(
    createElement(ClaudeSignInFlow, {
      state: state(over),
      now: 12_000,
      onOpenUrl: handlers.onOpenUrl ?? vi.fn(),
      onCopyUrl: handlers.onCopyUrl ?? vi.fn(),
      onSubmitCode: handlers.onSubmitCode ?? vi.fn(),
      onReadClipboard: handlers.onReadClipboard ?? (() => Promise.resolve('')),
      onCancel: handlers.onCancel ?? vi.fn(),
      onRetry: handlers.onRetry ?? vi.fn()
    })
  )
}

afterEach(cleanup)

describe('ClaudeSignInFlow', () => {
  it('says where in the hand-off we are, and how long it has been', () => {
    renderFlow()
    const current = screen
      .getAllByRole('listitem')
      .find((item) => item.getAttribute('aria-current') === 'step')
    expect(current?.textContent).toContain('Autorizar o acesso')
    expect(screen.getByText('11s esperando')).toBeTruthy()
  })

  it('hints only under the live step, so the card is an instruction and not a paragraph', () => {
    renderFlow()
    expect(screen.getByText('Entre na sua conta e confirme na página que abriu')).toBeTruthy()
    expect(screen.queryByText('A página mostra um código no fim — cole aqui')).toBeNull()
  })

  it('keeps the way back into the browser from being a dead end', () => {
    const onOpenUrl = vi.fn()
    const onCopyUrl = vi.fn()
    renderFlow({}, { onOpenUrl, onCopyUrl })

    fireEvent.click(screen.getByRole('button', { name: /Abrir de novo/ }))
    expect(onOpenUrl).toHaveBeenCalledWith(URL)
    fireEvent.click(screen.getByRole('button', { name: /Copiar link/ }))
    expect(onCopyUrl).toHaveBeenCalledWith(URL)
    // The copy control confirms itself, then goes back to offering the copy.
    expect(screen.getByRole('button', { name: /Copiado/ })).toBeTruthy()
  })

  it('asks for the code only once the CLI is waiting for one', () => {
    const { unmount } = renderFlow()
    expect(screen.queryByLabelText('Código do navegador')).toBeNull()
    unmount()
    renderFlow({ phase: 'code' })
    expect(screen.getByLabelText('Código do navegador')).toBeTruthy()
  })

  it('hands one pasted code to the CLI, from the field and from the clipboard alike', async () => {
    const onSubmitCode = vi.fn()
    renderFlow(
      { phase: 'code' },
      { onSubmitCode, onReadClipboard: () => Promise.resolve('cod-do-clipboard') }
    )

    const field = screen.getByLabelText('Código do navegador')
    fireEvent.change(field, { target: { value: 'cod-digitado' } })
    fireEvent.click(screen.getByRole('button', { name: 'Conectar' }))
    expect(onSubmitCode).toHaveBeenCalledWith('cod-digitado')

    // The paste is the gesture the flow was designed around: one click fills
    // the field and commits it.
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Colar' }))
    })
    expect(onSubmitCode).toHaveBeenLastCalledWith('cod-do-clipboard')
  })

  it('treats a rejected code as a retry: the value stays, the reason is announced', () => {
    renderFlow({ phase: 'code', codeError: 'Invalid code.' })
    expect(screen.getByRole('alert').textContent).toContain('Código não aceito')
    expect(screen.getByLabelText('Código do navegador')).toBeTruthy()
  })

  it('locks the field while a code is being checked', () => {
    renderFlow({ phase: 'finishing' })
    expect((screen.getByLabelText('Código do navegador') as HTMLInputElement).disabled).toBe(true)
  })

  it('cancels the attempt the user gave up on', () => {
    const onCancel = vi.fn()
    renderFlow({}, { onCancel })
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(onCancel).toHaveBeenCalled()
  })

  it('ends with a receipt naming the account, not a bare tick', () => {
    renderFlow({
      phase: 'success',
      account: {
        loggedIn: true,
        authMethod: 'claude.ai',
        apiProvider: 'firstParty',
        apiKeySource: null,
        email: 'pessoa@exemplo.dev',
        organization: null,
        subscription: 'pro'
      }
    })
    expect(screen.getByText('pessoa@exemplo.dev · Plano Pro')).toBeTruthy()
    expect(screen.getByText('Conta conectada')).toBeTruthy()
  })

  it('still says something when a landed sign-in reported no account', () => {
    renderFlow({ phase: 'success' })
    expect(screen.getByText('Sua conta Claude')).toBeTruthy()
  })

  it('keeps the CLI’s own words behind a disclosure when it fails', () => {
    const onRetry = vi.fn()
    renderFlow(
      { phase: 'failed', url: null, message: 'Error: could not reach claude.com' },
      { onRetry }
    )

    expect(screen.queryByText('Error: could not reach claude.com')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Ver detalhes' }))
    expect(screen.getByText('Error: could not reach claude.com')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(onRetry).toHaveBeenCalled()
  })
})

describe('ClaudeSignInBeacon', () => {
  function renderBeacon(over: Partial<ClaudeLoginView> = {}): ReturnType<typeof render> {
    return render(
      createElement(ClaudeSignInBeacon, {
        state: state(over),
        onOpenUrl: vi.fn(),
        onCopyUrl: vi.fn(),
        onSubmitCode: vi.fn(),
        onReadClipboard: () => Promise.resolve(''),
        onCancel: vi.fn(),
        onRetry: vi.fn()
      })
    )
  }

  it('stays out of the way until there is a sign-in to show', () => {
    renderBeacon({ phase: 'idle' })
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('appears mid-sign-in, from anywhere in the app', () => {
    renderBeacon()
    expect(
      screen.getByRole('status', { name: 'Conexão da conta Claude em andamento' })
    ).toBeTruthy()
  })

  it('is not drawn twice when a panel is already drawing the same sign-in', () => {
    render(
      createElement(ClaudeSignInBeacon, {
        state: state(),
        suppressed: true,
        onOpenUrl: vi.fn(),
        onCopyUrl: vi.fn(),
        onSubmitCode: vi.fn(),
        onReadClipboard: () => Promise.resolve(''),
        onCancel: vi.fn(),
        onRetry: vi.fn()
      })
    )
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('lets go of a landed sign-in after the receipt has been seen', () => {
    vi.useFakeTimers()
    try {
      renderBeacon({ phase: 'success' })
      expect(screen.getByRole('status')).toBeTruthy()
      act(() => {
        vi.advanceTimersByTime(4000)
      })
      expect(screen.queryByRole('status')).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('closes itself when the user cancels — the beacon is per sign-in', () => {
    const onCancel = vi.fn()
    render(
      createElement(ClaudeSignInBeacon, {
        state: state(),
        onOpenUrl: vi.fn(),
        onCopyUrl: vi.fn(),
        onSubmitCode: vi.fn(),
        onReadClipboard: () => Promise.resolve(''),
        onCancel,
        onRetry: vi.fn()
      })
    )
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(onCancel).toHaveBeenCalled()
    expect(screen.queryByRole('status')).toBeNull()
  })
})
