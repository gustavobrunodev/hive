// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement, forwardRef, type ReactNode } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { AskSecondBrain } from './AskSecondBrain'
import type { BrainSetup, BrainSetupPhase } from './useBrainSetup'
import type { SecondBrainStore } from './useSecondBrain'

/**
 * "Perguntar à base" (SB-R9) — the ask surface.
 *
 * The DS is mocked with trivial stand-ins (the repo's WorkUI/ShortcutCustomizer
 * convention): Radix's focus trap and the autosizing textarea are the DS's
 * concern and have their own suites. What this file proves is the *contract* —
 * the question rides inside `/second-brain-query`, the answer is announced as
 * arriving in the chat, recents persist per workspace, and a missing vault
 * offers setup instead of a broken query.
 */
vi.mock('@hive/design-system', () => ({
  Dialog: ({ open, children }: { open?: boolean; children?: ReactNode }) =>
    open ? createElement('div', { role: 'dialog' }, children) : null,
  DialogContent: ({
    children,
    onOpenAutoFocus,
    ...rest
  }: {
    children?: ReactNode
    onOpenAutoFocus?: unknown
  }) =>
    createElement(
      'div',
      { ...rest, 'data-autofocus': onOpenAutoFocus === undefined ? undefined : 'true' },
      children
    ),
  DialogTitle: ({ children, ...rest }: { children?: ReactNode }) =>
    createElement('h2', rest, children),
  DialogDescription: ({ children, ...rest }: { children?: ReactNode }) =>
    createElement('p', rest, children),
  Button: ({ children, cut, ...rest }: { children?: ReactNode; cut?: boolean }) =>
    createElement('button', { ...rest, 'data-cut': cut === true ? 'true' : undefined }, children),
  // forwardRef like the real one — the caret-placement path depends on the ref
  // reaching the DOM node, so a plain function stand-in would hide a real bug.
  Textarea: forwardRef<
    HTMLTextAreaElement,
    { onSubmit?: () => void; minRows?: number; maxRows?: number }
  >(function Textarea({ onSubmit, minRows, maxRows, ...rest }, ref) {
    return createElement('textarea', {
      ...rest,
      ref,
      rows: minRows,
      'data-max-rows': maxRows,
      onKeyDown: (event: React.KeyboardEvent) => {
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault()
          onSubmit?.()
        }
      }
    })
  })
}))

function store(overrides: Partial<SecondBrainStore> = {}): SecondBrainStore {
  return {
    workspace: '/ws',
    vaultPath: '/ws/second-brain',
    vaultName: 'second-brain',
    rawPending: 0,
    hasVault: true,
    health: null,
    refresh: vi.fn(),
    noteIngest: vi.fn(),
    noteLint: vi.fn(),
    snoozeHealth: vi.fn(),
    ...overrides
  }
}

/** A stand-in for the vault-setup flow — the dialog only reads its phase and calls back. */
function setup(phase: BrainSetupPhase = 'idle'): BrainSetup {
  return { phase, start: vi.fn(), recheck: vi.fn(), dismiss: vi.fn() }
}

function renderAsk(
  overrides: Partial<SecondBrainStore> = {},
  brainSetup: BrainSetup = setup()
): {
  onLaunch: ReturnType<typeof vi.fn>
  onOpenChange: ReturnType<typeof vi.fn>
  setup: BrainSetup
  field: HTMLTextAreaElement
} {
  const onLaunch = vi.fn()
  const onOpenChange = vi.fn()
  render(
    createElement(AskSecondBrain, {
      open: true,
      onOpenChange,
      store: store(overrides),
      onLaunch,
      setup: brainSetup
    })
  )
  return {
    onLaunch,
    onOpenChange,
    setup: brainSetup,
    field: screen.queryByLabelText('Sua pergunta') as HTMLTextAreaElement
  }
}

describe('AskSecondBrain (SB-R9)', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => cleanup())

  it('renders nothing while closed', () => {
    render(
      createElement(AskSecondBrain, {
        open: false,
        onOpenChange: vi.fn(),
        store: store(),
        onLaunch: vi.fn(),
        setup: setup()
      })
    )
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('launches the question inside /second-brain-query and closes (SB-R9.2)', () => {
    const { onLaunch, onOpenChange, field } = renderAsk()

    fireEvent.change(field, { target: { value: 'Como versionamos os specs?' } })
    fireEvent.click(screen.getByText('Perguntar'))

    expect(onLaunch).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'second-brain-query',
        command: {
          key: 'second-brain-query',
          prompt: '/second-brain-query Como versionamos os specs?'
        }
      })
    )
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('asks on Enter, the way the composer does', () => {
    const { onLaunch, field } = renderAsk()

    fireEvent.change(field, { target: { value: 'Quem cuida do deploy?' } })
    fireEvent.keyDown(field, { key: 'Enter' })

    expect(onLaunch.mock.calls[0][0].command.prompt).toBe(
      '/second-brain-query Quem cuida do deploy?'
    )
  })

  it('refuses an empty or whitespace-only question', () => {
    const { onLaunch, field } = renderAsk()

    expect((screen.getByText('Perguntar') as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(field, { target: { value: '   ' } })
    fireEvent.click(screen.getByText('Perguntar'))
    expect(onLaunch).not.toHaveBeenCalled()
  })

  it('teaches openers on an empty field, and one fills the field without asking (SB-R9.3)', () => {
    const { onLaunch, field } = renderAsk()

    expect(screen.getByText('Comece por')).toBeTruthy()
    fireEvent.click(screen.getByText('O que decidimos sobre…'))

    expect(field.value).toBe('O que decidimos sobre ')
    expect(onLaunch).not.toHaveBeenCalled()
  })

  it('remembers what was asked, per workspace, and offers it back instead of the openers (SB-R9.4)', () => {
    const first = renderAsk()
    fireEvent.change(first.field, { target: { value: 'O que decidimos sobre o Whisper?' } })
    fireEvent.click(screen.getByText('Perguntar'))
    cleanup()

    renderAsk()
    expect(screen.getByText('Perguntas recentes')).toBeTruthy()
    expect(screen.getByText('O que decidimos sobre o Whisper?')).toBeTruthy()
    expect(screen.queryByText('Comece por')).toBeNull()

    // Another workspace's base has its own memory.
    cleanup()
    renderAsk({ workspace: '/other' })
    expect(screen.queryByText('Perguntas recentes')).toBeNull()
  })

  it('picking a recent question fills the field rather than firing a turn', () => {
    localStorage.setItem(
      'hive.brainQuestions',
      JSON.stringify({ '/ws': ['Como funciona o gate?'] })
    )
    const { onLaunch, field } = renderAsk()

    fireEvent.click(screen.getByText('Como funciona o gate?'))
    expect(field.value).toBe('Como funciona o gate?')
    expect(onLaunch).not.toHaveBeenCalled()
  })

  it('warns that staged-but-unfiled material is not in the answer yet', () => {
    renderAsk({ rawPending: 2 })
    expect(
      screen.getByText(
        '2 itens ainda não foram organizados no wiki — a resposta pode não considerá-los.'
      )
    ).toBeTruthy()
  })

  it('offers setup instead of a field when there is no vault (SB-R3.3 parity)', () => {
    const { setup: brainSetup, onOpenChange } = renderAsk({
      hasVault: false,
      vaultPath: null,
      vaultName: null
    })

    expect(screen.queryByLabelText('Sua pergunta')).toBeNull()
    fireEvent.click(screen.getByText('Configurar base'))
    expect(brainSetup.start).toHaveBeenCalledTimes(1)
    // The chat takes over from here, so the dialog steps aside.
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('says the base is being created while the wizard runs, rather than demanding a setup (SB-R3.3 parity)', () => {
    const { setup: brainSetup } = renderAsk(
      { hasVault: false, vaultPath: null, vaultName: null },
      setup('running')
    )

    expect(screen.getByRole('status').textContent).toBe('Configurando a base…')
    expect(screen.queryByText('Configurar base')).toBeNull()

    fireEvent.click(screen.getByText('Verificar de novo'))
    expect(brainSetup.recheck).toHaveBeenCalledTimes(1)
  })
})
