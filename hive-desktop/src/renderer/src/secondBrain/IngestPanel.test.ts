// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { IngestPanel } from './IngestPanel'
import type { SecondBrainStore } from './useSecondBrain'

// The DS Sheet renders through Radix; stand it in with plain DOM so the sheet's
// body is assertable in jsdom (the Explorer/McpManager convention).
vi.mock('@hive/design-system', () => ({
  // Exposes Radix's dismiss path (overlay click / Escape) as a real button so
  // the sheet's own `onOpenChange` wiring is exercised, not just mocked away.
  Sheet: ({
    open,
    children,
    onOpenChange
  }: {
    open?: boolean
    children?: ReactNode
    onOpenChange?: (next: boolean) => void
  }) =>
    open
      ? createElement(
          'div',
          null,
          createElement(
            'button',
            { 'data-testid': 'sheet-dismiss', onClick: () => onOpenChange?.(false) },
            'dismiss'
          ),
          // A no-op `true` also passes through the guard (only `false` closes).
          createElement(
            'button',
            { 'data-testid': 'sheet-open-noop', onClick: () => onOpenChange?.(true) },
            'noop'
          ),
          children
        )
      : null,
  SheetContent: ({ children, ...rest }: { children?: ReactNode }) =>
    createElement('div', rest, children),
  SheetTitle: ({ children }: { children?: ReactNode }) => createElement('h2', null, children),
  SheetDescription: ({ children }: { children?: ReactNode }) => createElement('p', null, children),
  Button: ({ children, ...rest }: { children?: ReactNode }) =>
    createElement('button', rest, children),
  Textarea: (props: Record<string, unknown>) => createElement('textarea', props)
}))

function makeStore(overrides: Partial<SecondBrainStore> = {}): SecondBrainStore {
  return {
    workspace: '/ws',
    vaultPath: '/ws/second-brain',
    vaultName: 'second-brain',
    rawPending: 0,
    hasVault: true,
    refresh: vi.fn(),
    ...overrides
  }
}

describe('IngestPanel (T10)', () => {
  let stageRaw: ReturnType<typeof vi.fn>

  beforeEach(() => {
    stageRaw = vi.fn().mockResolvedValue({ relPath: 'second-brain/raw/ingest-x.md' })
    window.hive = {
      ...window.hive,
      secondBrain: { ...window.hive?.secondBrain, stageRaw }
    } as typeof window.hive
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('renders nothing while closed (mode null)', () => {
    render(
      createElement(IngestPanel, {
        mode: null,
        onClose: vi.fn(),
        store: makeStore(),
        onLaunch: vi.fn()
      })
    )
    expect(screen.queryByText('Ingerir conhecimento')).toBeNull()
  })

  it('opens on the mode the FAB picked', () => {
    render(
      createElement(IngestPanel, {
        mode: 'record',
        onClose: vi.fn(),
        store: makeStore(),
        onLaunch: vi.fn()
      })
    )
    const recordTab = screen.getByRole('tab', { name: 'Gravar áudio' })
    expect(recordTab.getAttribute('aria-selected')).toBe('true')
  })

  it('disables the confirm while the field is empty or whitespace (SB-R3.4)', () => {
    render(
      createElement(IngestPanel, {
        mode: 'text',
        onClose: vi.fn(),
        store: makeStore(),
        onLaunch: vi.fn()
      })
    )
    const confirm = screen.getByText('Ingerir') as HTMLButtonElement
    expect(confirm.disabled).toBe(true)

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '   ' } })
    expect((screen.getByText('Ingerir') as HTMLButtonElement).disabled).toBe(true)

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'conhecimento' } })
    expect((screen.getByText('Ingerir') as HTMLButtonElement).disabled).toBe(false)
  })

  it('Ingerir stages the raw file, launches /second-brain-ingest, refreshes and closes (SB-R3.2)', async () => {
    const onLaunch = vi.fn()
    const onClose = vi.fn()
    const store = makeStore()
    render(createElement(IngestPanel, { mode: 'text', onClose, store, onLaunch }))

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'decisão da squad' } })
    fireEvent.click(screen.getByText('Ingerir'))

    await waitFor(() => expect(stageRaw).toHaveBeenCalledWith('/ws', 'decisão da squad'))
    await waitFor(() =>
      expect(onLaunch).toHaveBeenCalledWith(
        expect.objectContaining({
          command: expect.objectContaining({ prompt: '/second-brain-ingest' })
        })
      )
    )
    expect(store.refresh).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it('surfaces a staging failure without closing, keeping the text recoverable', async () => {
    stageRaw.mockRejectedValueOnce(new Error('disk full'))
    const onClose = vi.fn()
    render(
      createElement(IngestPanel, {
        mode: 'text',
        onClose,
        store: makeStore(),
        onLaunch: vi.fn()
      })
    )

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'algo' } })
    fireEvent.click(screen.getByText('Ingerir'))

    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())
    expect(onClose).not.toHaveBeenCalled()
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('algo')
  })

  it('offers "Configurar base" instead of writing when there is no vault (SB-R3.3)', () => {
    const onLaunch = vi.fn()
    const onClose = vi.fn()
    render(
      createElement(IngestPanel, {
        mode: 'text',
        onClose,
        store: makeStore({ hasVault: false, vaultPath: null, vaultName: null }),
        onLaunch
      })
    )

    expect(screen.getByText('Configure a base primeiro')).toBeTruthy()
    expect(screen.queryByRole('textbox')).toBeNull()

    fireEvent.click(screen.getByText('Configurar base'))
    expect(onLaunch).toHaveBeenCalledWith(
      expect.objectContaining({ command: expect.objectContaining({ prompt: '/second-brain' }) })
    )
    expect(onClose).toHaveBeenCalled()
    expect(stageRaw).not.toHaveBeenCalled()
  })

  it('switching tabs shows the audio placeholder until Phase 4/5 fills them', () => {
    render(
      createElement(IngestPanel, {
        mode: 'text',
        onClose: vi.fn(),
        store: makeStore(),
        onLaunch: vi.fn()
      })
    )
    fireEvent.click(screen.getByRole('tab', { name: 'Áudio (arquivo)' }))
    expect(screen.getByText('A transcrição de áudio chega já já.')).toBeTruthy()
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('dismissing the sheet (overlay/Escape) closes it; an open-change to true is a no-op', () => {
    const onClose = vi.fn()
    render(
      createElement(IngestPanel, {
        mode: 'text',
        onClose,
        store: makeStore(),
        onLaunch: vi.fn()
      })
    )

    fireEvent.click(screen.getByTestId('sheet-open-noop'))
    expect(onClose).not.toHaveBeenCalled()

    fireEvent.click(screen.getByTestId('sheet-dismiss'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('re-opening after a close resyncs the active tab to the newly picked mode', () => {
    const props = {
      onClose: vi.fn(),
      store: makeStore(),
      onLaunch: vi.fn()
    }
    const { rerender } = render(createElement(IngestPanel, { ...props, mode: 'text' as const }))
    expect(screen.getByRole('tab', { name: 'Colar texto' }).getAttribute('aria-selected')).toBe(
      'true'
    )

    // Closed…
    rerender(createElement(IngestPanel, { ...props, mode: null }))
    expect(screen.queryByRole('tab')).toBeNull()

    // …then reopened on a different mode.
    rerender(createElement(IngestPanel, { ...props, mode: 'audioFile' as const }))
    expect(screen.getByRole('tab', { name: 'Áudio (arquivo)' }).getAttribute('aria-selected')).toBe(
      'true'
    )
  })

  it('Cancelar clears the draft and closes', () => {
    const onClose = vi.fn()
    render(
      createElement(IngestPanel, {
        mode: 'text',
        onClose,
        store: makeStore(),
        onLaunch: vi.fn()
      })
    )
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'rascunho' } })
    fireEvent.click(screen.getByText('Cancelar'))
    expect(onClose).toHaveBeenCalled()
  })
})
