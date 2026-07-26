// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { IngestPanel } from './IngestPanel'
import type { SecondBrainStore } from './useSecondBrain'

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
      secondBrain: { ...window.hive?.secondBrain, stageRaw },
      whisper: {
        ...window.hive?.whisper,
        listModels: vi.fn().mockResolvedValue([
          { id: 'base', params: '74 M', downloaded: true },
          { id: 'small', params: '244 M', downloaded: false }
        ]),
        modelStatus: vi.fn().mockResolvedValue({ downloaded: true, variant: 'fp32' }),
        downloadModel: vi.fn().mockReturnValue(() => {})
      }
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

  it('the transcript field is SHARED — every mode edits and ingests the same text', async () => {
    render(
      createElement(IngestPanel, {
        mode: 'text',
        onClose: vi.fn(),
        store: makeStore(),
        onLaunch: vi.fn()
      })
    )
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'digitado' } })

    // Switching to the audio tab keeps the field (and its content) in place, so
    // a transcript can fill the very same box the user then edits.
    fireEvent.click(screen.getByRole('tab', { name: 'Áudio (arquivo)' }))
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('digitado')
    expect(screen.getByText('Escolher arquivo de áudio')).toBeTruthy()

    // The recorder tab is still an honest placeholder until Phase 5.
    fireEvent.click(screen.getByRole('tab', { name: 'Gravar áudio' }))
    expect(screen.getByText('O gravador chega já já.')).toBeTruthy()
  })

  it('a transcription lands in the shared field, is editable, and ingests like typed text (SB-R4.3/4.5)', async () => {
    decodeToWhisperPcm.mockResolvedValue(new Float32Array([0.1, 0.2]))
    const onLaunch = vi.fn()
    const store = makeStore()
    render(createElement(IngestPanel, { mode: 'audioFile', onClose: vi.fn(), store, onLaunch }))

    const input = screen.getByLabelText('Escolher arquivo de áudio') as HTMLInputElement
    Object.defineProperty(input, 'files', {
      value: [new File(['x'], 'reuniao.wav')],
      configurable: true
    })
    fireEvent.change(input)

    // The transcript fills the shared textarea…
    const field = (await screen.findByRole('textbox')) as HTMLTextAreaElement
    await waitFor(() => expect(field.value).toBe('ata da reunião'))

    // …the user corrects it…
    fireEvent.change(field, { target: { value: 'ata da reunião (revisada)' } })

    // …and Ingerir takes the exact same path as typed text.
    fireEvent.click(screen.getByText('Ingerir'))
    await waitFor(() => expect(stageRaw).toHaveBeenCalledWith('/ws', 'ata da reunião (revisada)'))
    expect(onLaunch).toHaveBeenCalledWith(
      expect.objectContaining({
        command: expect.objectContaining({ prompt: '/second-brain-ingest' })
      })
    )
  })

  it('uses the selected model for the transcription', async () => {
    decodeToWhisperPcm.mockResolvedValue(new Float32Array([0.1]))
    render(
      createElement(IngestPanel, {
        mode: 'audioFile',
        onClose: vi.fn(),
        store: makeStore(),
        onLaunch: vi.fn()
      })
    )

    fireEvent.change(await screen.findByLabelText('Modelo'), { target: { value: 'small' } })
    const input = screen.getByLabelText('Escolher arquivo de áudio') as HTMLInputElement
    Object.defineProperty(input, 'files', { value: [new File(['x'], 'a.wav')], configurable: true })
    fireEvent.change(input)

    await waitFor(() => expect(window.hive.whisper.modelStatus).toHaveBeenCalledWith('small'))
  })

  it('offers the model picker on audio modes only, defaulting to base (SB-R4.4)', async () => {
    render(
      createElement(IngestPanel, {
        mode: 'text',
        onClose: vi.fn(),
        store: makeStore(),
        onLaunch: vi.fn()
      })
    )
    // Typed text needs no model.
    expect(screen.queryByLabelText('Modelo')).toBeNull()

    fireEvent.click(screen.getByRole('tab', { name: 'Áudio (arquivo)' }))
    const select = (await screen.findByLabelText('Modelo')) as HTMLSelectElement
    expect(select.value).toBe('base')
    await waitFor(() => expect(screen.getByRole('option', { name: /small/ })).toBeTruthy())

    fireEvent.change(select, { target: { value: 'small' } })
    expect(select.value).toBe('small')
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
