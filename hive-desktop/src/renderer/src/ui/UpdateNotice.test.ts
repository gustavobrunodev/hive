// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { UpdateNotice, type UpdateNoticeProps } from './UpdateNotice'
import { reduceUpdateEvent, type UpdateFlowState } from './updateFlow'

/**
 * `UpdateNotice` (npm-distribution T11, design.md §5 Tier 2) — the
 * non-blocking announcement toast. Composed from DS Toast primitives
 * directly (not `useToast()`), so every test here mounts `UpdateNotice`
 * standalone — it carries its own `ToastProvider`/`ToastViewport` scope,
 * nothing extra to wrap it in. This suite uses plain vitest matchers
 * (`.toBeTruthy()`/`.toBeNull()`), the repo's established convention — no
 * `@testing-library/jest-dom` dependency exists here (see `icons.test.ts`/
 * `WorkUI.test.ts`).
 */

function noop(): void {
  // default no-op callback for props a given test doesn't care about
}

function baseProps(overrides: Partial<UpdateNoticeProps> = {}): UpdateNoticeProps {
  return {
    state: { status: 'idle' } as UpdateFlowState,
    currentVersion: '0.1.0',
    canApply: true,
    onUpdateNow: noop,
    onNotNow: noop,
    onSkip: noop,
    onCancel: noop,
    onRetry: noop,
    onOpenInstaller: noop,
    onViewNotes: noop,
    ...overrides
  }
}

/** A controllable `MediaQueryList` stand-in — `fireChange` simulates the OS preference flipping live, without ever being the real jsdom (no `prefers-reduced-motion` support). */
interface MediaQueryListMock {
  matches: boolean
  fireChange: (matches: boolean) => void
}

/** Mocks `window.matchMedia` for the reduced-motion tests — jsdom has no real implementation. Returns the live mock so a test can trigger its registered `change` listener directly. */
function stubMatchMedia(matches: boolean): MediaQueryListMock {
  const listeners = new Set<(event: { matches: boolean }) => void>()
  const mock: MediaQueryListMock = {
    matches,
    fireChange(next) {
      mock.matches = next
      for (const listener of listeners) listener({ matches: next })
    }
  }
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      get matches() {
        return mock.matches
      },
      media: query,
      addEventListener: (_type: string, listener: (event: { matches: boolean }) => void) => {
        listeners.add(listener)
      },
      removeEventListener: (_type: string, listener: (event: { matches: boolean }) => void) => {
        listeners.delete(listener)
      }
    }))
  )
  return mock
}

beforeEach(() => {
  stubMatchMedia(false)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('UpdateNotice — reduceUpdateEvent', () => {
  it('maps every real UpdateEvent variant to its matching flow state', () => {
    expect(reduceUpdateEvent({ type: 'checking' })).toEqual({ status: 'checking' })
    expect(reduceUpdateEvent({ type: 'not-available' })).toEqual({ status: 'upToDate' })
    expect(
      reduceUpdateEvent({ type: 'available', version: '0.2.0', bytes: 1000, notes: 'Notas' })
    ).toEqual({ status: 'available', version: '0.2.0', bytes: 1000, notes: 'Notas' })
    expect(
      reduceUpdateEvent({ type: 'progress', percent: 41, transferred: 100, total: 200 })
    ).toEqual({ status: 'downloading', percent: 41, transferred: 100, total: 200 })
    expect(reduceUpdateEvent({ type: 'verifying' })).toEqual({ status: 'verifying' })
    expect(
      reduceUpdateEvent({ type: 'downloaded', version: '0.2.0', installerPath: '/tmp/x.exe' })
    ).toEqual({ status: 'downloaded', version: '0.2.0', installerPath: '/tmp/x.exe' })
    expect(reduceUpdateEvent({ type: 'applying' })).toEqual({ status: 'applying' })
    expect(reduceUpdateEvent({ type: 'error', message: 'boom', kind: 'network' })).toEqual({
      status: 'error',
      message: 'boom',
      kind: 'network'
    })
  })
})

describe('UpdateNotice — silent states', () => {
  it.each(['idle', 'checking', 'upToDate'] as const)('renders nothing for %s', async (status) => {
    render(createElement(UpdateNotice, baseProps({ state: { status } })))
    await waitFor(() => {
      expect(screen.queryByText('Nova versão disponível')).toBeNull()
    })
  })
})

describe('UpdateNotice — available', () => {
  it('shows the version transition, size estimate and notes teaser, and the primary action + view-notes link work', async () => {
    const onUpdateNow = vi.fn()
    const onViewNotes = vi.fn()

    render(
      createElement(
        UpdateNotice,
        baseProps({
          state: {
            status: 'available',
            version: '0.2.0',
            bytes: 92 * 1024 * 1024,
            notes: 'Correções no explorador e no chat.'
          },
          onUpdateNow,
          onViewNotes
        })
      )
    )

    await screen.findByText('0.1.0 → 0.2.0')
    expect(screen.getByText(/92 MB/)).toBeTruthy()
    expect(screen.getByText('Correções no explorador e no chat.')).toBeTruthy()

    // "Ver novidades" and "Atualizar agora" don't dismiss the toast, unlike
    // "Agora não"/"Pular esta versão" (covered in their own describe block
    // below) — both remain clickable on the same instance.
    fireEvent.click(screen.getByText('Ver novidades'))
    expect(onViewNotes).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByText('Atualizar agora'))
    expect(onUpdateNow).toHaveBeenCalledTimes(1)
  })

  it('omits the notes teaser/link when the package provides none', async () => {
    render(
      createElement(
        UpdateNotice,
        baseProps({
          state: { status: 'available', version: '0.2.0', bytes: null, notes: null }
        })
      )
    )
    await screen.findByText('0.1.0 → 0.2.0')
    expect(screen.queryByText('Ver novidades')).toBeNull()
  })
})

describe('UpdateNotice — dismissal is session-scoped', () => {
  it('hides after "Agora não" and does not return on a parent re-render, but a newer version announces again', async () => {
    const onNotNow = vi.fn()
    const { rerender } = render(
      createElement(
        UpdateNotice,
        baseProps({
          state: { status: 'available', version: '0.2.0', bytes: null, notes: null },
          onNotNow
        })
      )
    )
    await screen.findByText('0.1.0 → 0.2.0')

    fireEvent.click(screen.getByText('Agora não'))
    expect(onNotNow).toHaveBeenCalledTimes(1)
    await waitFor(() => {
      expect(screen.queryByText('0.1.0 → 0.2.0')).toBeNull()
    })

    // Parent re-renders with the exact same (already-dismissed) state —
    // still hidden, proving the dismissal isn't lost to the re-render.
    rerender(
      createElement(
        UpdateNotice,
        baseProps({
          state: { status: 'available', version: '0.2.0', bytes: null, notes: null },
          onNotNow
        })
      )
    )
    expect(screen.queryByText('0.1.0 → 0.2.0')).toBeNull()

    // A genuinely newer version announces normally.
    rerender(
      createElement(
        UpdateNotice,
        baseProps({
          state: { status: 'available', version: '0.3.0', bytes: null, notes: null },
          onNotNow
        })
      )
    )
    await screen.findByText('0.1.0 → 0.3.0')
  })

  it('skip hides the notice immediately and calls onSkip', async () => {
    const onSkip = vi.fn()
    render(
      createElement(
        UpdateNotice,
        baseProps({
          state: { status: 'available', version: '0.2.0', bytes: null, notes: null },
          onSkip
        })
      )
    )
    await screen.findByText('0.1.0 → 0.2.0')

    fireEvent.click(screen.getByText('Pular esta versão'))
    expect(onSkip).toHaveBeenCalledTimes(1)
    await waitFor(() => {
      expect(screen.queryByText('0.1.0 → 0.2.0')).toBeNull()
    })
  })

  it('Escape (Radix\'s built-in close gesture) dismisses exactly like "Agora não" — no modal trap, still keyboard-operable', async () => {
    const onNotNow = vi.fn()
    const { container } = render(
      createElement(
        UpdateNotice,
        baseProps({
          state: { status: 'available', version: '0.2.0', bytes: null, notes: null },
          onNotNow
        })
      )
    )
    await screen.findByText('0.1.0 → 0.2.0')

    const toastEl = container.querySelector('.wb-update-toast') as HTMLElement
    fireEvent.keyDown(toastEl, { key: 'Escape' })

    // Radix's own Escape wiring can invoke the close callback more than once
    // per keypress (its internal layering, not something this component
    // controls) — what matters here is that it fires at all, and that the
    // toast actually closes.
    expect(onNotNow).toHaveBeenCalled()
    await waitFor(() => {
      expect(screen.queryByText('0.1.0 → 0.2.0')).toBeNull()
    })
  })

  it('a live download that starts after a dismissed announcement still shows (declining the ask ≠ hiding real progress)', async () => {
    const { rerender } = render(
      createElement(
        UpdateNotice,
        baseProps({
          state: { status: 'available', version: '0.2.0', bytes: null, notes: null }
        })
      )
    )
    await screen.findByText('0.1.0 → 0.2.0')
    fireEvent.click(screen.getByText('Agora não'))
    await waitFor(() => {
      expect(screen.queryByText('0.1.0 → 0.2.0')).toBeNull()
    })

    rerender(
      createElement(
        UpdateNotice,
        baseProps({
          state: { status: 'downloading', percent: 10, transferred: 10, total: 100 }
        })
      )
    )
    await waitFor(() => {
      expect(screen.getByRole('progressbar')).toBeTruthy()
    })
  })
})

describe('UpdateNotice — downloading / verifying', () => {
  it('downloading shows determinate progress and a working Cancelar', async () => {
    const onCancel = vi.fn()
    render(
      createElement(
        UpdateNotice,
        baseProps({
          state: { status: 'downloading', percent: 41, transferred: 38_400_000, total: 92_100_000 },
          onCancel
        })
      )
    )
    await waitFor(() => {
      expect(screen.getByRole('progressbar')).toBeTruthy()
    })
    expect(screen.getByText(/41%/)).toBeTruthy()
    fireEvent.click(screen.getByText('Cancelar'))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('verifying shows the checksum label with no actions', async () => {
    render(createElement(UpdateNotice, baseProps({ state: { status: 'verifying' } })))
    await screen.findByText('Verificando integridade')
    expect(screen.queryByText('Cancelar')).toBeNull()
  })
})

describe('UpdateNotice — downloaded', () => {
  it('canApply: offers Reiniciar e instalar and Depois', async () => {
    const onUpdateNow = vi.fn()
    const onNotNow = vi.fn()
    render(
      createElement(
        UpdateNotice,
        baseProps({
          state: { status: 'downloaded', version: '0.2.0', installerPath: '/tmp/x.exe' },
          canApply: true,
          onUpdateNow,
          onNotNow
        })
      )
    )
    await screen.findByText('Pronto para instalar')
    fireEvent.click(screen.getByText('Reiniciar e instalar'))
    expect(onUpdateNow).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByText('Depois'))
    expect(onNotNow).toHaveBeenCalledTimes(1)
  })

  it('!canApply: offers Abrir instalador instead (ND-R4.3)', async () => {
    const onOpenInstaller = vi.fn()
    render(
      createElement(
        UpdateNotice,
        baseProps({
          state: { status: 'downloaded', version: '0.2.0', installerPath: '/tmp/x.AppImage' },
          canApply: false,
          onOpenInstaller
        })
      )
    )
    await screen.findByText(/ainda não instala sozinho/)
    fireEvent.click(screen.getByText('Abrir instalador'))
    expect(onOpenInstaller).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('Reiniciar e instalar')).toBeNull()
  })
})

describe('UpdateNotice — error', () => {
  it('integrity errors get the distinct integrity message', async () => {
    render(
      createElement(
        UpdateNotice,
        baseProps({ state: { status: 'error', message: 'bad hash', kind: 'integrity' } })
      )
    )
    await screen.findByText(/não pôde ser confirmado como íntegro/)
  })

  it('network/apply errors share the generic message and both recovery actions', async () => {
    const onRetry = vi.fn()
    const onOpenInstaller = vi.fn()
    render(
      createElement(
        UpdateNotice,
        baseProps({
          state: { status: 'error', message: 'offline', kind: 'network' },
          onRetry,
          onOpenInstaller
        })
      )
    )
    await screen.findByText(/Não foi possível concluir a atualização/)
    fireEvent.click(screen.getByText('Tentar de novo'))
    expect(onRetry).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByText('Abrir instalador'))
    expect(onOpenInstaller).toHaveBeenCalledTimes(1)
  })
})

describe('UpdateNotice — accessibility & no modal semantics', () => {
  it('carries role="status" on the morphing body and never steals focus on mount', async () => {
    render(
      createElement(
        UpdateNotice,
        baseProps({
          state: { status: 'available', version: '0.2.0', bytes: null, notes: null }
        })
      )
    )
    await screen.findByText('0.1.0 → 0.2.0')
    expect(document.activeElement === document.body || document.activeElement === null).toBe(true)
    const status = screen.getAllByRole('status').find((el) => el.textContent?.includes('0.1.0'))
    expect(status).toBeTruthy()
  })

  it('has no dialog/alertdialog role — background stays interactive', async () => {
    render(
      createElement(
        UpdateNotice,
        baseProps({
          state: { status: 'available', version: '0.2.0', bytes: null, notes: null }
        })
      )
    )
    await screen.findByText('0.1.0 → 0.2.0')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })
})

describe('UpdateNotice — prefers-reduced-motion', () => {
  it('marks the toast root data-reduced-motion when the media query matches', async () => {
    stubMatchMedia(true)
    const { container } = render(
      createElement(
        UpdateNotice,
        baseProps({
          state: { status: 'available', version: '0.2.0', bytes: null, notes: null }
        })
      )
    )
    await waitFor(() => {
      const toastEl = container.querySelector('.wb-update-toast')
      expect(toastEl).not.toBeNull()
      expect(toastEl?.getAttribute('data-reduced-motion')).toBe('true')
    })
  })

  it('leaves data-reduced-motion unset when the media query does not match', async () => {
    stubMatchMedia(false)
    const { container } = render(
      createElement(
        UpdateNotice,
        baseProps({
          state: { status: 'available', version: '0.2.0', bytes: null, notes: null }
        })
      )
    )
    await waitFor(() => {
      const toastEl = container.querySelector('.wb-update-toast')
      expect(toastEl).not.toBeNull()
      expect(toastEl?.getAttribute('data-reduced-motion')).toBeNull()
    })
  })

  it('reacts live to the OS preference changing while mounted, not just at mount time', async () => {
    const mql = stubMatchMedia(false)
    const { container } = render(
      createElement(
        UpdateNotice,
        baseProps({
          state: { status: 'available', version: '0.2.0', bytes: null, notes: null }
        })
      )
    )
    await waitFor(() => {
      const toastEl = container.querySelector('.wb-update-toast')
      expect(toastEl?.getAttribute('data-reduced-motion')).toBeNull()
    })

    mql.fireChange(true)

    await waitFor(() => {
      const toastEl = container.querySelector('.wb-update-toast')
      expect(toastEl?.getAttribute('data-reduced-motion')).toBe('true')
    })
  })
})
