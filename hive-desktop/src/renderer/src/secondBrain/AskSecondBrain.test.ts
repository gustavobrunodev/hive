// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement, forwardRef, type ReactNode } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { AskSecondBrain } from './AskSecondBrain'
import type { BrainSetup, BrainSetupPhase } from './useBrainSetup'
import type { SecondBrainStore } from './useSecondBrain'
import type { WhisperDictation } from '../dictation/useWhisperDictation'
import type { DictationPhase } from '../dictation/phase'

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
  // The stand-in keeps Radix's *contract* where the component depends on it:
  // the root's dismissal callback and Content's Escape hook are how a take is
  // stopped when the surface goes away, so both are reachable from a test.
  Dialog: ({
    open,
    children,
    onOpenChange
  }: {
    open?: boolean
    children?: ReactNode
    onOpenChange?: (open: boolean) => void
  }) =>
    open
      ? createElement(
          'div',
          { role: 'dialog' },
          createElement(
            'button',
            { type: 'button', onClick: () => onOpenChange?.(false) },
            'fechar-dialogo'
          ),
          children
        )
      : null,
  DialogContent: ({
    children,
    onOpenAutoFocus,
    onEscapeKeyDown,
    ...rest
  }: {
    children?: ReactNode
    onOpenAutoFocus?: unknown
    onEscapeKeyDown?: (event: { preventDefault: () => void }) => void
  }) =>
    createElement(
      'div',
      {
        ...rest,
        'data-autofocus': onOpenAutoFocus === undefined ? undefined : 'true',
        onKeyDown: (event: React.KeyboardEvent) => {
          if (event.key === 'Escape') onEscapeKeyDown?.(event.nativeEvent)
        }
      },
      children
    ),
  LevelMeter: ({ label }: { label?: string }) =>
    createElement('div', { role: 'meter', 'aria-label': label }),
  DialogTitle: ({ children, ...rest }: { children?: ReactNode }) =>
    createElement('h2', rest, children),
  DialogDescription: ({ children, ...rest }: { children?: ReactNode }) =>
    createElement('p', rest, children),
  Button: ({ children, cut, ...rest }: { children?: ReactNode; cut?: boolean }) =>
    createElement('button', { ...rest, 'data-cut': cut === true ? 'true' : undefined }, children),
  // forwardRef like the real one — the caret-placement path depends on the ref
  // reaching the DOM node, so a plain function stand-in would hide a real bug.
  HighlightedTextarea: forwardRef<
    HTMLTextAreaElement,
    {
      value: string
      onSubmit?: () => void
      onKeyDown?: (event: React.KeyboardEvent) => void
      minRows?: number
      maxRows?: number
      active?: boolean
      highlight?: (value: string) => ReactNode
    }
  >(function HighlightedTextarea(
    { onSubmit, onKeyDown, minRows, maxRows, active, highlight, value, ...rest },
    ref
  ) {
    return createElement(
      'div',
      { className: 'hl', 'data-active': active === true ? 'true' : undefined },
      // The mirror, aria-hidden like the real one: the fresh-run mark is a
      // class on one of these nodes, which is what the dictation test reads.
      createElement('div', { 'aria-hidden': 'true', 'data-backdrop': 'true' }, highlight?.(value)),
      createElement('textarea', {
        ...rest,
        value,
        ref,
        rows: minRows,
        'data-max-rows': maxRows,
        onKeyDown: (event: React.KeyboardEvent) => {
          onKeyDown?.(event)
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault()
            onSubmit?.()
          }
        }
      })
    )
  })
}))

// The gate is M26's own surface with its own suite; here it only has to be
// something that renders, so the ask dialog can be asserted on its own terms.
vi.mock('../voice/VoiceModelGate', () => ({
  VoiceModelGate: ({ open }: { open?: boolean }) =>
    open ? createElement('div', null, 'baixar-modelo') : null
}))

/**
 * Dictation is injected through `useWhisperDictation`, and the fake stands in
 * for the whole of it: the microphone, Whisper, and the installed-model gate.
 * What is under test here is the *wiring* — that the field is the target, that
 * the transport replaces the hint while a take runs, that Esc and dismissal
 * stop the microphone, and that asking mid-take waits for the words.
 */
let voice: WhisperDictation
let dictationOptions: { value: string; active?: boolean } | null = null

vi.mock('../dictation/useWhisperDictation', () => ({
  useWhisperDictation: (options: { value: string; active?: boolean }) => {
    dictationOptions = options
    return voice
  }
}))

function fakeVoice(
  phase: DictationPhase = { status: 'idle' },
  gate: Partial<WhisperDictation['voiceGate']> = {}
): WhisperDictation {
  return {
    dictation: {
      phase,
      levels: [],
      partial: '',
      previewRange: null,
      active: phase.status !== 'idle',
      start: vi.fn(),
      finish: vi.fn(),
      discard: vi.fn(),
      failure: null,
      retry: vi.fn(),
      prewarm: vi.fn(),
      freshRange: null,
      handleKeyDown: vi.fn()
    },
    voiceGate: {
      model: 'tiny',
      blocked: false,
      guard: (action: () => void) => action(),
      open: false,
      setOpen: vi.fn(),
      ...gate
    }
  }
}

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
  /** Re-renders with the current `voice` fake — how a take is advanced. */
  again: () => void
} {
  const onLaunch = vi.fn()
  const onOpenChange = vi.fn()
  const element = (): React.ReactElement =>
    createElement(AskSecondBrain, {
      open: true,
      onOpenChange,
      store: store(overrides),
      onLaunch,
      setup: brainSetup
    })
  const { rerender } = render(element())
  return {
    onLaunch,
    onOpenChange,
    setup: brainSetup,
    field: screen.queryByLabelText('Sua pergunta') as HTMLTextAreaElement,
    again: () => rerender(element())
  }
}

describe('AskSecondBrain (SB-R9)', () => {
  beforeEach(() => {
    localStorage.clear()
    voice = fakeVoice()
    dictationOptions = null
  })
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

/**
 * Voice reaches the ask surface (M13's VP-R5.1 cashed in): the same microphone,
 * transport and gate the chat composer uses, on the question field.
 */
describe('AskSecondBrain — ditado', () => {
  beforeEach(() => {
    localStorage.clear()
    voice = fakeVoice()
    dictationOptions = null
  })
  afterEach(() => cleanup())

  it('dictates into the question field itself, and only while the dialog is open', () => {
    const { field } = renderAsk()
    fireEvent.change(field, { target: { value: 'Como versionamos os specs?' } })

    expect(dictationOptions?.value).toBe('Como versionamos os specs?')
    expect(dictationOptions?.active).toBe(true)
  })

  it('the microphone starts a take through the model gate (M26)', () => {
    renderAsk()

    fireEvent.click(screen.getByLabelText('Ditar'))
    expect(voice.dictation.start).toHaveBeenCalledTimes(1)
  })

  it('with no model installed the press opens the gate instead of the microphone', () => {
    const gateOpens = vi.fn()
    voice = fakeVoice({ status: 'idle' }, { model: null, blocked: true, guard: gateOpens })
    renderAsk()

    const mic = screen.getByLabelText('Ditar')
    // Nothing is preheated for a model that is not there.
    fireEvent.focus(mic)
    fireEvent.click(mic)

    expect(voice.dictation.prewarm).not.toHaveBeenCalled()
    expect(gateOpens).toHaveBeenCalledTimes(1)
    expect(voice.dictation.start).not.toHaveBeenCalled()
  })

  it('hovering the microphone warms the engine before it is needed (D-VP-6)', () => {
    renderAsk()

    fireEvent.focus(screen.getByLabelText('Ditar'))
    expect(voice.dictation.prewarm).toHaveBeenCalledTimes(1)
  })

  it('a live take replaces the submit hint with the transport (VP-R1.3)', () => {
    voice = fakeVoice({ status: 'listening', seconds: 3, silentMs: 0, pending: 0 })
    renderAsk()

    expect(screen.getByText('Ouvindo…')).toBeTruthy()
    expect(screen.getByText('Concluir')).toBeTruthy()
    expect(screen.getByText('Descartar')).toBeTruthy()
    // The mic control and the keyboard hint step aside for it — the row keeps
    // its one ask button and does not grow.
    expect(screen.queryByLabelText('Ditar')).toBeNull()
    expect(screen.queryByText('Enter para perguntar · Shift+Enter para quebrar linha')).toBeNull()
    expect(screen.getByText('Perguntar')).toBeTruthy()
  })

  it('marks the run a segment just landed, in the field itself (VP-R2.3)', () => {
    voice = fakeVoice({ status: 'listening', seconds: 1, silentMs: 0, pending: 0 })
    voice.dictation.freshRange = [5, 10]
    const { field } = renderAsk()
    fireEvent.change(field, { target: { value: 'Quem cuida do deploy?' } })

    expect(document.querySelector('.wb-composer-fresh')?.textContent).toBe('cuida')
  })

  it('asking mid-take finalizes first and only then sends the question (VP-R1.6)', () => {
    voice = fakeVoice({ status: 'listening', seconds: 4, silentMs: 0, pending: 0 })
    const { field, onLaunch, again } = renderAsk()
    fireEvent.change(field, { target: { value: 'O que decidimos sobre o Whisper?' } })

    fireEvent.click(screen.getByText('Perguntar'))
    expect(voice.dictation.finish).toHaveBeenCalledTimes(1)
    expect(onLaunch).not.toHaveBeenCalled()

    // Still draining: the last phrases have not been written yet.
    voice = {
      ...voice,
      dictation: { ...voice.dictation, phase: { status: 'finalizing', pending: 1 }, active: true }
    }
    again()
    expect(onLaunch).not.toHaveBeenCalled()

    voice = {
      ...voice,
      dictation: { ...voice.dictation, phase: { status: 'idle' }, active: false }
    }
    again()
    expect(onLaunch.mock.calls[0][0].command.prompt).toBe(
      '/second-brain-query O que decidimos sobre o Whisper?'
    )
  })

  it('a take that ended in an error is never sent half-transcribed (VP-R1.6)', () => {
    voice = fakeVoice({ status: 'listening', seconds: 4, silentMs: 0, pending: 0 })
    const { field, onLaunch, again } = renderAsk()
    fireEvent.change(field, { target: { value: 'Quem cuida do deploy?' } })
    fireEvent.click(screen.getByText('Perguntar'))

    voice = {
      ...voice,
      dictation: {
        ...voice.dictation,
        phase: { status: 'error', kind: 'engine', message: 'falhou' },
        active: true
      }
    }
    again()

    expect(onLaunch).not.toHaveBeenCalled()
  })

  it('Esc discards the take instead of closing the surface being spoken into (VP-R1.5)', () => {
    voice = fakeVoice({ status: 'listening', seconds: 2, silentMs: 0, pending: 0 })
    const { onOpenChange } = renderAsk()

    fireEvent.keyDown(screen.getByRole('dialog').querySelector('.wb-brain-ask-dialog') as Element, {
      key: 'Escape'
    })

    expect(voice.dictation.discard).toHaveBeenCalledTimes(1)
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it('dismissing the dialog mid-take closes the microphone with it (VP-R4.6)', () => {
    voice = fakeVoice({ status: 'listening', seconds: 2, silentMs: 0, pending: 0 })
    const { onOpenChange } = renderAsk()

    fireEvent.click(screen.getByText('fechar-dialogo'))

    expect(voice.dictation.discard).toHaveBeenCalledTimes(1)
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('offers the model gate without losing the question already typed', () => {
    voice = fakeVoice({ status: 'idle' }, { model: null, blocked: true, open: true })
    const { field } = renderAsk()
    fireEvent.change(field, { target: { value: 'Como funciona o gate?' } })

    expect(screen.getByText('baixar-modelo')).toBeTruthy()
    expect((screen.getByLabelText('Sua pergunta') as HTMLTextAreaElement).value).toBe(
      'Como funciona o gate?'
    )
  })
})
