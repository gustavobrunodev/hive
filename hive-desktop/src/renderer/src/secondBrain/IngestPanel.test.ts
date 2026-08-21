// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { IngestPanel } from './IngestPanel'
import type { BrainSetup, BrainSetupPhase } from './useBrainSetup'
import type { SecondBrainStore } from './useSecondBrain'
import { createHiveWhisperMock, whisperModelFixture } from '../testSupport/hiveWhisperMock'
import type { DictationE2EHarness } from '../dictation/e2eDictationSeam'
import type { Tick } from '../dictation/segmenter'

/** A stand-in for the vault-setup flow — the panel only reads its phase and calls back. */
function setup(phase: BrainSetupPhase = 'idle'): BrainSetup {
  return { phase, start: vi.fn(), recheck: vi.fn(), dismiss: vi.fn() }
}

// Real WebAudio doesn't exist in jsdom; the decode path has its own tests.
const decodeToWhisperPcm = vi.hoisted(() => vi.fn())
vi.mock('./whisper/audio', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./whisper/audio')>()),
  decodeToWhisperPcm
}))

// The transformers library is multi-megabyte WASM — stub the pipeline so the
// panel's own wiring (model choice → transcript → shared field) is what's tested.
vi.mock('@huggingface/transformers', () => ({
  pipeline: vi.fn(async () => async () => ({ text: 'ata da reunião' })),
  env: {
    allowRemoteModels: true,
    allowLocalModels: false,
    useBrowserCache: true,
    localModelPath: '',
    backends: { onnx: { wasm: { wasmPaths: '' } } }
  }
}))

// The DS Sheet/Popover render through Radix; stand them in with plain DOM so the
// sheet's body is assertable in jsdom (the Explorer/McpManager convention).
//
// An **async factory** with its imports inside, not a factory closing over
// module-scope values: `vi.mock` is hoisted above every import, so a top-level
// `createContext(...)` read from in here resolves fine in a plain run and
// throws "Cannot access '__vi_import_4__' before initialization" the moment
// coverage instrumentation reorders the module init. Importing inside the
// factory is the documented shape and works in both.
vi.mock('@hive/design-system', async () => {
  const { createContext, createElement, useContext } = await import('react')
  const { HighlightedTextareaMock } = await import('../testSupport/dsMocks')

  /** Radix's radio state, reimplemented in three lines so the mock stays honest. */
  const RadioCtx = createContext<{ value?: string; onValueChange?: (next: string) => void }>({})

  return {
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
    SheetDescription: ({ children }: { children?: ReactNode }) =>
      createElement('p', null, children),
    Button: ({ children, ...rest }: { children?: ReactNode }) =>
      createElement('button', rest, children),
    Textarea: (props: Record<string, unknown>) => createElement('textarea', props),
    HighlightedTextarea: HighlightedTextareaMock,
    LevelMeter: ({ label }: { label: string }) =>
      createElement('div', { role: 'meter', 'aria-label': label }),
    // The picker's popover is always rendered open: what the tests care about is
    // the options and the callbacks, not Radix's open/close machinery.
    Popover: ({ children }: { children?: ReactNode }) => createElement('div', null, children),
    PopoverTrigger: ({ children }: { children?: ReactNode }) => children,
    PopoverContent: ({ children, ...rest }: { children?: ReactNode }) =>
      createElement('div', rest, children),
    RadioGroup: ({
      value,
      onValueChange,
      children,
      ...rest
    }: {
      value?: string
      onValueChange?: (next: string) => void
      children?: ReactNode
    }) =>
      createElement(
        RadioCtx.Provider,
        { value: { value, onValueChange } },
        createElement('div', { role: 'radiogroup', ...rest }, children)
      ),
    RadioGroupItem: ({ value, children, ...rest }: { value: string; children?: ReactNode }) => {
      const ctx = useContext(RadioCtx)
      return createElement(
        'button',
        {
          role: 'radio',
          'aria-checked': ctx.value === value,
          onClick: () => ctx.onValueChange?.(value),
          ...rest
        },
        children
      )
    },
    // The embedded ModelManager (T19) renders through the DS Dialog family; it
    // has its own dedicated tests, so here it only needs to not blow up.
    Dialog: ({ open, children }: { open?: boolean; children?: ReactNode }) =>
      open ? createElement('div', null, children) : null,
    DialogContent: ({ children, ...rest }: { children?: ReactNode }) =>
      createElement('div', rest, children),
    DialogTitle: ({ children }: { children?: ReactNode }) => createElement('h2', null, children),
    DialogDescription: ({ children }: { children?: ReactNode }) =>
      createElement('p', null, children)
  }
})

function makeStore(overrides: Partial<SecondBrainStore> = {}): SecondBrainStore {
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

/** Mounts the panel with the boilerplate every test repeats. */
function open(
  mode: 'text' | 'audioFile' | 'record',
  overrides: {
    onClose?: ReturnType<typeof vi.fn>
    onLaunch?: ReturnType<typeof vi.fn>
    store?: SecondBrainStore
    setup?: BrainSetup
    onOpenVoiceSettings?: ReturnType<typeof vi.fn>
  } = {}
): {
  onClose: ReturnType<typeof vi.fn>
  onLaunch: ReturnType<typeof vi.fn>
  store: SecondBrainStore
} {
  const onClose = overrides.onClose ?? vi.fn()
  const onLaunch = overrides.onLaunch ?? vi.fn()
  const store = overrides.store ?? makeStore()
  render(
    createElement(IngestPanel, {
      mode,
      onClose,
      onLaunch,
      store,
      setup: overrides.setup ?? setup(),
      onOpenVoiceSettings: overrides.onOpenVoiceSettings
    })
  )
  return { onClose, onLaunch, store }
}

/** Stages a file through the picker; transcription still waits for the button. */
function stageFile(name = 'reuniao.wav'): void {
  const input = screen.getByLabelText('Escolher arquivo de áudio') as HTMLInputElement
  Object.defineProperty(input, 'files', {
    value: [new File(['x'], name)],
    configurable: true
  })
  fireEvent.change(input)
}

/** One tick of PCM at the given loudness. 1000 ms each, so takes stay short. */
function tick(rms: number): Tick {
  return { rms, samples: new Float32Array(16_000) }
}

describe('IngestPanel (T10)', () => {
  let stageRaw: ReturnType<typeof vi.fn>

  beforeEach(() => {
    stageRaw = vi.fn().mockResolvedValue({ relPath: 'second-brain/raw/ingest-x.md' })
    const whisper = createHiveWhisperMock()
    whisper.listModels.mockResolvedValue([
      whisperModelFixture({ id: 'tiny', params: '39 M', sizeMB: { fp32: 144, q8: 39 } }),
      whisperModelFixture({ id: 'base' }),
      whisperModelFixture({
        id: 'small',
        params: '244 M',
        sizeMB: { fp32: 923, q8: 238 },
        downloaded: false,
        downloadedVariant: null,
        bundled: false
      })
    ])
    whisper.modelStatus.mockResolvedValue({ downloaded: true, variant: 'fp32', bundled: true })
    const recommendation = {
      recommendedId: 'base',
      reason: 'noGpu',
      gpu: false,
      ramGB: 16,
      cores: 8
    }
    whisper.recommend.mockResolvedValue(recommendation)
    whisper.preference.mockResolvedValue({ id: 'base', auto: true, recommendation })
    whisper.setPreferredModel.mockImplementation(async (id: string | null) => ({
      id: id ?? 'base',
      auto: id === null,
      recommendation
    }))

    window.hive = {
      ...window.hive,
      secondBrain: { ...window.hive?.secondBrain, stageRaw },
      whisper
    } as unknown as typeof window.hive
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    delete (globalThis as { __hiveDictationE2E?: DictationE2EHarness }).__hiveDictationE2E
  })

  it('renders nothing while closed (mode null)', () => {
    render(
      createElement(IngestPanel, {
        mode: null,
        onClose: vi.fn(),
        store: makeStore(),
        onLaunch: vi.fn(),
        setup: setup()
      })
    )
    expect(screen.queryByText('Ingerir conhecimento')).toBeNull()
  })

  it('opens on the source the FAB picked', () => {
    open('record')
    expect(screen.getByRole('tab', { name: 'Ditar ao vivo' }).getAttribute('aria-selected')).toBe(
      'true'
    )
  })

  it('disables the confirm while the field is empty or whitespace (SB-R3.4)', () => {
    open('text')
    const confirm = screen.getByText('Ingerir') as HTMLButtonElement
    expect(confirm.disabled).toBe(true)

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '   ' } })
    expect((screen.getByText('Ingerir') as HTMLButtonElement).disabled).toBe(true)

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'conhecimento' } })
    expect((screen.getByText('Ingerir') as HTMLButtonElement).disabled).toBe(false)
  })

  it('Ingerir stages the raw file, launches /second-brain-ingest, refreshes and closes (SB-R3.2)', async () => {
    const { onLaunch, onClose, store } = open('text')

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'decisão da squad' } })
    fireEvent.click(screen.getByText('Ingerir'))

    await waitFor(() => expect(stageRaw).toHaveBeenCalledWith('/ws', 'decisão da squad'))
    // The staged path pins the skill to this file, and the text rides along so
    // the transcript shows what was actually sent rather than a bare command.
    await waitFor(() =>
      expect(onLaunch).toHaveBeenCalledWith(
        expect.objectContaining({
          command: expect.objectContaining({
            prompt: '/second-brain-ingest second-brain/raw/ingest-x.md\n\ndecisão da squad'
          })
        })
      )
    )
    expect(store.refresh).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it('surfaces a staging failure without closing, keeping the text recoverable', async () => {
    stageRaw.mockRejectedValueOnce(new Error('disk full'))
    const { onClose } = open('text')

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'algo' } })
    fireEvent.click(screen.getByText('Ingerir'))

    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())
    expect(onClose).not.toHaveBeenCalled()
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('algo')
  })

  it('offers "Configurar base" instead of writing when there is no vault (SB-R3.3)', () => {
    const brainSetup = setup()
    const { onClose } = open('text', {
      store: makeStore({ hasVault: false, vaultPath: null, vaultName: null }),
      setup: brainSetup
    })

    expect(screen.getByText('Configure a base primeiro')).toBeTruthy()
    expect(screen.queryByRole('textbox')).toBeNull()

    fireEvent.click(screen.getByText('Configurar base'))
    expect(brainSetup.start).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalled()
    expect(stageRaw).not.toHaveBeenCalled()
  })

  it('waits on a setup already in flight instead of demanding one (the "Configure a base primeiro" bug)', () => {
    const brainSetup = setup('running')
    open('text', {
      store: makeStore({ hasVault: false, vaultPath: null, vaultName: null }),
      setup: brainSetup
    })

    expect(screen.getByRole('status').textContent).toBe('Configurando a base…')
    expect(screen.queryByText('Configure a base primeiro')).toBeNull()

    fireEvent.click(screen.getByText('Verificar de novo'))
    expect(brainSetup.recheck).toHaveBeenCalledTimes(1)
  })

  it('the document is SHARED — every source writes into and ingests the same text', () => {
    open('text')
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'digitado' } })

    // Switching source keeps the field (and its content) in place, so a
    // transcript fills the very same box the user then edits.
    fireEvent.click(screen.getByRole('tab', { name: 'Enviar áudio' }))
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('digitado')
    expect(screen.getByText('Escolher arquivo de áudio')).toBeTruthy()

    fireEvent.click(screen.getByRole('tab', { name: 'Ditar ao vivo' }))
    expect(screen.getByText('Fale e o texto aparece embaixo')).toBeTruthy()
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('digitado')
  })

  /**
   * SB-R4.7 — the staging step. Choosing a file must NOT start minutes of CPU
   * work; the user asks for the pass, after seeing what is queued and which
   * model will run.
   */
  describe('enviar áudio: stage, then transcribe on request', () => {
    it('stages a chosen file without transcribing anything yet', async () => {
      open('audioFile')
      stageFile()

      expect(await screen.findByText('1 áudio pronto')).toBeTruthy()
      expect(screen.getByText('reuniao.wav')).toBeTruthy()
      expect(screen.getByText('Transcrever 1 áudio')).toBeTruthy()
      // Nothing has been decoded or transcribed: no pass was asked for.
      expect(decodeToWhisperPcm).not.toHaveBeenCalled()
    })

    it('drops a staged file before the pass, and clears the whole batch', async () => {
      open('audioFile')
      stageFile('a.wav')
      fireEvent.click(await screen.findByLabelText('Remover a.wav'))
      expect(screen.queryByText('a.wav')).toBeNull()

      stageFile('b.wav')
      fireEvent.click(await screen.findByText('Limpar'))
      expect(screen.queryByText('b.wav')).toBeNull()
      expect(screen.getByText('Arraste seus áudios aqui')).toBeTruthy()
    })

    it('ignores the same file staged twice — a duplicated pass costs minutes', async () => {
      open('audioFile')
      stageFile('a.wav')
      await screen.findByText('1 áudio pronto')
      stageFile('a.wav')
      expect(screen.getByText('1 áudio pronto')).toBeTruthy()
    })

    it('transcribes on request, lands the text in the shared field, and ingests it (SB-R4.3/4.5)', async () => {
      decodeToWhisperPcm.mockResolvedValue(new Float32Array([0.1, 0.2]))
      const { onLaunch } = open('audioFile')
      stageFile()

      fireEvent.click(await screen.findByText('Transcrever 1 áudio'))

      const field = (await screen.findByRole('textbox')) as HTMLTextAreaElement
      await waitFor(() => expect(field.value).toBe('ata da reunião'))

      // …the user corrects it…
      fireEvent.change(field, { target: { value: 'ata da reunião (revisada)' } })

      // …and Ingerir takes the exact same path as typed text.
      fireEvent.click(screen.getByText('Ingerir'))
      await waitFor(() => expect(stageRaw).toHaveBeenCalledWith('/ws', 'ata da reunião (revisada)'))
      expect(onLaunch).toHaveBeenCalledWith(
        expect.objectContaining({
          command: expect.objectContaining({
            prompt: '/second-brain-ingest second-brain/raw/ingest-x.md\n\nata da reunião (revisada)'
          })
        })
      )
    })

    it('uses the model the preference resolved to', async () => {
      decodeToWhisperPcm.mockResolvedValue(new Float32Array([0.1]))
      open('audioFile')
      stageFile('a.wav')
      fireEvent.click(await screen.findByText('Transcrever 1 áudio'))
      await waitFor(() => expect(window.hive.whisper.modelStatus).toHaveBeenCalledWith('base'))
    })
  })

  /**
   * SB-R5.6 — live dictation. The words have to appear **while** the take is
   * running, which is the whole difference from the recorder this replaced.
   * Capture and the engine come from the E2E seam: real audio cannot flow in
   * jsdom, and everything above them is production code.
   */
  describe('ditar ao vivo: text appears while speaking', () => {
    function armHarness(transcript = 'primeira frase'): DictationE2EHarness {
      const harness: DictationE2EHarness = { transcript, ticks: [], levels: [] }
      ;(globalThis as { __hiveDictationE2E?: DictationE2EHarness }).__hiveDictationE2E = harness
      return harness
    }

    /** A quiet tick seeds the noise floor, then speech, then the silence that cuts. */
    async function speakOnePhrase(harness: DictationE2EHarness): Promise<void> {
      await act(async () => {
        for (const rms of [0.001, 0.5, 0.5, 0.001]) {
          harness.ticks?.forEach((push) => push(tick(rms)))
        }
      })
    }

    it('writes each finished phrase into the document mid-take', async () => {
      const harness = armHarness('primeira frase')
      open('record')

      fireEvent.click(screen.getByText('Começar a ditar'))
      await waitFor(() => expect(harness.ticks?.length).toBeGreaterThan(0))

      await speakOnePhrase(harness)

      // Still capturing — the text arrived without the take being over.
      await waitFor(() =>
        expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('Primeira frase')
      )
      expect(screen.getByText('Concluir o ditado')).toBeTruthy()
    })

    it('appends the next phrase to the same document, then ingests it', async () => {
      const harness = armHarness('primeira frase')
      const { onLaunch } = open('record')

      fireEvent.click(screen.getByText('Começar a ditar'))
      await waitFor(() => expect(harness.ticks?.length).toBeGreaterThan(0))
      await speakOnePhrase(harness)
      await waitFor(() =>
        expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('Primeira frase')
      )

      harness.transcript = 'e a segunda'
      await speakOnePhrase(harness)
      await waitFor(() =>
        expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(
          'Primeira frase e a segunda'
        )
      )

      fireEvent.click(screen.getByText('Concluir o ditado'))
      await waitFor(() => expect(screen.getByText('Começar a ditar')).toBeTruthy())

      fireEvent.click(screen.getByText('Ingerir'))
      await waitFor(() =>
        expect(stageRaw).toHaveBeenCalledWith('/ws', 'Primeira frase e a segunda')
      )
      expect(onLaunch).toHaveBeenCalled()
    })

    it('Descartar rewinds the document to what it was before the take (VP-R1.5)', async () => {
      const harness = armHarness('não queria isso')
      open('record')
      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'rascunho' } })

      fireEvent.click(screen.getByText('Começar a ditar'))
      await waitFor(() => expect(harness.ticks?.length).toBeGreaterThan(0))
      await speakOnePhrase(harness)
      await waitFor(() =>
        expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).not.toBe('rascunho')
      )

      fireEvent.click(screen.getByText('Descartar'))
      expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('rascunho')
    })

    it('releases the microphone when the sheet is dismissed mid-take (VP-R4.6)', async () => {
      const harness = armHarness()
      const { onClose } = open('record')
      fireEvent.click(screen.getByText('Começar a ditar'))
      await waitFor(() => expect(harness.ticks?.length).toBeGreaterThan(0))

      fireEvent.click(screen.getByTestId('sheet-dismiss'))
      expect(onClose).toHaveBeenCalled()
      expect(harness.stops ?? 0).toBeGreaterThan(0)
    })

    it('blocks Ingerir while a take is live — the transcript is not finished yet', async () => {
      const harness = armHarness()
      open('record')
      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'algo' } })
      expect((screen.getByText('Ingerir') as HTMLButtonElement).disabled).toBe(false)

      fireEvent.click(screen.getByText('Começar a ditar'))
      await waitFor(() => expect(harness.ticks?.length).toBeGreaterThan(0))
      expect((screen.getByText('Ingerir') as HTMLButtonElement).disabled).toBe(true)
      expect(screen.getByText('Aguarde a transcrição terminar.')).toBeTruthy()
    })

    it('locks the other sources mid-take, so a running microphone is never stranded', async () => {
      const harness = armHarness()
      open('record')
      fireEvent.click(screen.getByText('Começar a ditar'))
      await waitFor(() => expect(harness.ticks?.length).toBeGreaterThan(0))

      expect((screen.getByRole('tab', { name: 'Escrever' }) as HTMLButtonElement).disabled).toBe(
        true
      )
      expect(
        (screen.getByRole('tab', { name: 'Ditar ao vivo' }) as HTMLButtonElement).disabled
      ).toBe(false)
    })
  })

  /** SB-R7.4 — the model is chosen for the user, and the choice is theirs to take back. */
  /**
   * voice-settings (M25): the chooser moved to Perfil › Voz e transcrição —
   * one model, both surfaces that transcribe. What this sheet still owes the
   * reader is which model is about to run, and a way to reach the setting.
   */
  describe('which model is about to run', () => {
    it('states the model on audio sources only, and says the app chose it', async () => {
      open('text')
      expect(screen.queryByText(/Transcrevendo com/)).toBeNull()

      fireEvent.click(screen.getByRole('tab', { name: 'Enviar áudio' }))
      expect(
        await screen.findByText('Transcrevendo com base, escolhido para este computador')
      ).toBeTruthy()
    })

    it('names a pinned model without claiming the app chose it', async () => {
      vi.mocked(window.hive.whisper.preference).mockResolvedValue({
        id: 'small',
        auto: false,
        recommendation: { recommendedId: 'tiny', reason: 'noGpu', gpu: false, ramGB: 16, cores: 8 }
      })
      open('audioFile')
      expect(await screen.findByText('Transcrevendo com small')).toBeTruthy()
      expect(screen.queryByText(/escolhido para este computador/)).toBeNull()
    })

    it('offers no control at all — the readout is a statement, not a picker', async () => {
      open('audioFile')
      await screen.findByText(/Transcrevendo com/)
      expect(screen.queryByRole('radio')).toBeNull()
    })

    it('sends the user to the profile, closing this sheet on the way', async () => {
      const onOpenVoiceSettings = vi.fn()
      open('audioFile', { onOpenVoiceSettings })
      fireEvent.click(await screen.findByLabelText('Alterar o modelo de transcrição no perfil'))
      expect(onOpenVoiceSettings).toHaveBeenCalledTimes(1)
    })

    it('says nothing while main is still resolving the preference', () => {
      // A line that said `base` and then changed to `small` under the reader is
      // worse than a line that arrives — `null` is "not asked yet", not "none".
      vi.mocked(window.hive.whisper.preference).mockReturnValue(new Promise(() => {}))
      open('audioFile')
      expect(screen.queryByText(/Transcrevendo com/)).toBeNull()
    })
  })

  it('dismissing the sheet (overlay/Escape) closes it; an open-change to true is a no-op', () => {
    const { onClose } = open('text')

    fireEvent.click(screen.getByTestId('sheet-open-noop'))
    expect(onClose).not.toHaveBeenCalled()

    fireEvent.click(screen.getByTestId('sheet-dismiss'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('re-opening after a close resyncs the active source to the newly picked mode', () => {
    const props = {
      onClose: vi.fn(),
      store: makeStore(),
      onLaunch: vi.fn(),
      setup: setup()
    }
    const { rerender } = render(createElement(IngestPanel, { ...props, mode: 'text' as const }))
    expect(screen.getByRole('tab', { name: 'Escrever' }).getAttribute('aria-selected')).toBe('true')

    // Closed…
    rerender(createElement(IngestPanel, { ...props, mode: null }))
    expect(screen.queryByRole('tab')).toBeNull()

    // …then reopened on a different source.
    rerender(createElement(IngestPanel, { ...props, mode: 'audioFile' as const }))
    expect(screen.getByRole('tab', { name: 'Enviar áudio' }).getAttribute('aria-selected')).toBe(
      'true'
    )
  })

  it('Cancelar clears the draft and closes', () => {
    const { onClose } = open('text')
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'rascunho' } })
    fireEvent.click(screen.getByText('Cancelar'))
    expect(onClose).toHaveBeenCalled()
  })
})
