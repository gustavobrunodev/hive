// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ModelManager } from './ModelManager'
import { recommendationCopy } from './recommendationCopy'

vi.mock('@hive/design-system', () => ({
  Dialog: ({ open, children }: { open?: boolean; children?: ReactNode }) =>
    open ? createElement('div', null, children) : null,
  DialogContent: ({ children, ...rest }: { children?: ReactNode }) =>
    createElement('div', rest, children),
  DialogTitle: ({ children }: { children?: ReactNode }) => createElement('h2', null, children),
  DialogDescription: ({ children }: { children?: ReactNode }) => createElement('p', null, children),
  Button: ({ children, ...rest }: { children?: ReactNode }) =>
    createElement('button', rest, children)
}))

const CATALOG = [
  {
    id: 'tiny',
    repo: 'Xenova/whisper-tiny',
    params: '39 M',
    sizeMB: { fp32: 144, q8: 39 },
    approxVramGB: 1,
    relativeSpeed: '~10x',
    multilingual: true,
    downloaded: false,
    downloadedVariant: null
  },
  {
    id: 'base',
    repo: 'Xenova/whisper-base',
    params: '74 M',
    sizeMB: { fp32: 278, q8: 73 },
    approxVramGB: 1,
    relativeSpeed: '~7x',
    multilingual: true,
    downloaded: true,
    downloadedVariant: 'fp32'
  },
  {
    id: 'small.en',
    repo: 'Xenova/whisper-small.en',
    params: '244 M',
    sizeMB: { fp32: 2048, q8: 238 },
    approxVramGB: 2,
    relativeSpeed: '~4x',
    multilingual: false,
    downloaded: false,
    downloadedVariant: null
  }
]

describe('ModelManager (T19)', () => {
  let listModels: ReturnType<typeof vi.fn>
  let recommend: ReturnType<typeof vi.fn>
  let downloadModel: ReturnType<typeof vi.fn>
  let deleteModel: ReturnType<typeof vi.fn>

  beforeEach(() => {
    listModels = vi.fn().mockResolvedValue(CATALOG)
    recommend = vi
      .fn()
      .mockResolvedValue({ recommendedId: 'base', reason: 'noGpu', gpu: false, ramGB: 16 })
    downloadModel = vi.fn().mockReturnValue(() => {})
    deleteModel = vi.fn().mockResolvedValue(undefined)
    window.hive = {
      ...window.hive,
      whisper: { ...window.hive?.whisper, listModels, recommend, downloadModel, deleteModel }
    } as typeof window.hive
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  function open(variant: 'fp32' | 'q8' = 'fp32'): { onOpenChange: ReturnType<typeof vi.fn> } {
    const onOpenChange = vi.fn()
    render(createElement(ModelManager, { open: true, onOpenChange, variant }))
    return { onOpenChange }
  }

  it('renders nothing while closed, and loads nothing', () => {
    render(createElement(ModelManager, { open: false, onOpenChange: vi.fn(), variant: 'fp32' }))
    expect(screen.queryByText('Modelos de transcrição')).toBeNull()
    expect(listModels).not.toHaveBeenCalled()
  })

  it('renders the catalog as a table with the published facts (SB-R7.1)', async () => {
    open()
    await waitFor(() => expect(screen.getByText('tiny')).toBeTruthy())

    expect(screen.getByRole('table')).toBeTruthy()
    expect(screen.getByText('39 M')).toBeTruthy()
    expect(screen.getByText('~10x')).toBeTruthy()
    // The .en model is flagged as English-only.
    expect(screen.getByText('só inglês')).toBeTruthy()
  })

  it('shows the size of the variant THIS machine will download', async () => {
    open('fp32')
    await waitFor(() => expect(screen.getByText('144 MB')).toBeTruthy())
    // 2048 MB renders as GB, not a four-digit MB figure.
    expect(screen.getByText('2.0 GB')).toBeTruthy()

    cleanup()
    open('q8')
    await waitFor(() => expect(screen.getByText('39 MB')).toBeTruthy())
  })

  it('marks the recommended row and explains why (SB-R7.1)', async () => {
    open()
    await waitFor(() => expect(screen.getByText('Recomendado')).toBeTruthy())
    expect(
      screen.getByText('Recomendado: sem GPU dedicada, um modelo leve responde melhor.')
    ).toBeTruthy()
  })

  it('marks what is already downloaded, offering delete instead of download', async () => {
    open()
    await waitFor(() => expect(screen.getByText('Baixado')).toBeTruthy())
    expect(screen.getByLabelText('Excluir o modelo base')).toBeTruthy()
    expect(screen.queryByLabelText('Baixar o modelo base')).toBeNull()
    expect(screen.getByLabelText('Baixar o modelo tiny')).toBeTruthy()
  })

  it('downloads a model with live progress, then refreshes the catalog (SB-R7.2)', async () => {
    let emit: ((e: unknown) => void) | undefined
    downloadModel.mockImplementation((_id, _v, onEvent) => {
      emit = onEvent
      return () => {}
    })
    open('fp32')
    await waitFor(() => expect(screen.getByLabelText('Baixar o modelo tiny')).toBeTruthy())

    fireEvent.click(screen.getByLabelText('Baixar o modelo tiny'))
    expect(downloadModel).toHaveBeenCalledWith('tiny', 'fp32', expect.any(Function))

    emit?.({ type: 'progress', id: 'tiny', loaded: 36, total: 144, file: 'onnx/x.onnx' })
    await waitFor(() => expect(screen.getByText('Baixando… 25%')).toBeTruthy())

    listModels.mockResolvedValue(
      CATALOG.map((m) => (m.id === 'tiny' ? { ...m, downloaded: true } : m))
    )
    emit?.({ type: 'done', id: 'tiny' })
    await waitFor(() => expect(screen.getByLabelText('Excluir o modelo tiny')).toBeTruthy())
  })

  it('clears the progress row when a download fails, so it can be retried', async () => {
    let emit: ((e: unknown) => void) | undefined
    downloadModel.mockImplementation((_id, _v, onEvent) => {
      emit = onEvent
      return () => {}
    })
    open()
    await waitFor(() => expect(screen.getByLabelText('Baixar o modelo tiny')).toBeTruthy())

    fireEvent.click(screen.getByLabelText('Baixar o modelo tiny'))
    emit?.({ type: 'error', id: 'tiny', message: 'sem conexão' })

    await waitFor(() => expect(screen.getByLabelText('Baixar o modelo tiny')).toBeTruthy())
  })

  it('reports 0% rather than NaN when the total is unknown', async () => {
    let emit: ((e: unknown) => void) | undefined
    downloadModel.mockImplementation((_id, _v, onEvent) => {
      emit = onEvent
      return () => {}
    })
    open()
    await waitFor(() => expect(screen.getByLabelText('Baixar o modelo tiny')).toBeTruthy())
    fireEvent.click(screen.getByLabelText('Baixar o modelo tiny'))
    emit?.({ type: 'progress', id: 'tiny', loaded: 5, total: 0, file: 'x' })
    await waitFor(() => expect(screen.getByText('Baixando… 0%')).toBeTruthy())
  })

  it('deletes a downloaded model and refreshes', async () => {
    open()
    await waitFor(() => expect(screen.getByLabelText('Excluir o modelo base')).toBeTruthy())

    listModels.mockResolvedValue(
      CATALOG.map((m) => (m.id === 'base' ? { ...m, downloaded: false } : m))
    )
    fireEvent.click(screen.getByLabelText('Excluir o modelo base'))

    expect(deleteModel).toHaveBeenCalledWith('base')
    await waitFor(() => expect(screen.getByLabelText('Baixar o modelo base')).toBeTruthy())
  })

  it('closes on the close button', async () => {
    const { onOpenChange } = open()
    await waitFor(() => expect(screen.getByText('Fechar')).toBeTruthy())
    fireEvent.click(screen.getByText('Fechar'))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  describe('recommendationCopy', () => {
    it('renders a sentence per reason, folding in the measured RAM', () => {
      const base = { recommendedId: 'base' as const, gpu: false, ramGB: 8 }
      expect(recommendationCopy({ ...base, reason: 'lowMemory', ramGB: 4 })).toContain('4 GB')
      expect(recommendationCopy({ ...base, reason: 'noGpu' })).toContain('sem GPU dedicada')
      expect(recommendationCopy({ ...base, reason: 'discreteGpu', ramGB: 32 })).toContain('32 GB')
      expect(recommendationCopy({ ...base, reason: 'balanced' })).toContain('equilíbrio')
      expect(recommendationCopy({ ...base, reason: 'unknown' })).toContain('avaliar seu hardware')
      expect(recommendationCopy(null)).toBeNull()
    })
  })
})
