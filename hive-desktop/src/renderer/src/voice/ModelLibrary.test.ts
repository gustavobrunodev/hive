// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ModelLibrary } from './ModelLibrary'
import type { WhisperDownloadsState } from './useWhisperDownloads'
import { whisperDownloadFixture, whisperModelFixture } from '../testSupport/hiveWhisperMock'

const HARDWARE = {
  recommendedId: 'small' as const,
  reason: 'discreteGpu' as const,
  gpu: true,
  ramGB: 32,
  cores: 12
}

const CATALOG = [
  whisperModelFixture({
    id: 'tiny',
    params: '39 M',
    relativeSpeed: '~10x',
    sizeMB: { fp32: 144, q8: 39 },
    maxFileMB: { fp32: 113, q8: 29 },
    downloaded: false,
    downloadedVariant: null
  }),
  whisperModelFixture({
    id: 'small',
    params: '244 M',
    relativeSpeed: '~4x',
    sizeMB: { fp32: 923, q8: 238 },
    maxFileMB: { fp32: 587, q8: 150 },
    downloaded: false,
    downloadedVariant: null
  }),
  whisperModelFixture({
    id: 'medium',
    params: '769 M',
    relativeSpeed: '~2x',
    sizeMB: { fp32: 2916, q8: 740 },
    maxFileMB: { fp32: 1744, q8: 441 },
    downloaded: false,
    downloadedVariant: null
  })
]

function downloadsState(over: Partial<WhisperDownloadsState> = {}): WhisperDownloadsState {
  return {
    byId: {},
    busy: false,
    start: vi.fn(),
    cancel: vi.fn(),
    dismiss: vi.fn(),
    ...over
  }
}

/** The resolved preference, as the bridge shapes it. */
type Preference = Awaited<ReturnType<Window['hive']['whisper']['preference']>>

function renderLibrary(
  over: {
    models?: typeof CATALOG
    preference?: Preference
    downloads?: WhisperDownloadsState
    ramGB?: number
  } = {}
): {
  downloads: WhisperDownloadsState
  onSelect: ReturnType<typeof vi.fn>
  onDelete: ReturnType<typeof vi.fn>
} {
  const downloads = over.downloads ?? downloadsState()
  const onSelect = vi.fn()
  const onDelete = vi.fn()
  render(
    createElement(ModelLibrary, {
      models: over.models ?? CATALOG,
      preference: over.preference ?? {
        id: null,
        auto: true,
        installed: [],
        recommendation: over.ramGB === undefined ? HARDWARE : { ...HARDWARE, ramGB: over.ramGB }
      },
      variant: 'fp32',
      downloads,
      onSelect,
      onDelete
    })
  )
  return { downloads, onSelect, onDelete }
}

describe('ModelLibrary', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  describe('with nothing installed', () => {
    it('leads with the model this machine should run and its real size', () => {
      renderLibrary()
      expect(screen.getByText('Nenhum modelo de voz ainda')).toBeTruthy()
      expect(screen.getByText('Recomendado para este computador')).toBeTruthy()
      expect(screen.getByRole('button', { name: 'Baixar · 923 MB' })).toBeTruthy()
    })

    it('starts the recommended download from the lead', () => {
      const { downloads } = renderLibrary()
      fireEvent.click(screen.getByRole('button', { name: 'Baixar · 923 MB' }))
      expect(downloads.start).toHaveBeenCalledWith('small', 'fp32')
    })

    it('shows the lead download in flight, and cancels it by id', () => {
      const downloads = downloadsState({
        byId: { small: whisperDownloadFixture({ id: 'small' }) }
      })
      renderLibrary({ downloads })

      expect(screen.getByText('512 MB de 3,0 GB')).toBeTruthy()
      fireEvent.click(screen.getByLabelText('Cancelar o download de small'))
      expect(downloads.cancel).toHaveBeenCalledWith('small')
    })

    it('shows a failed lead download with its cause, and dismisses it', () => {
      const downloads = downloadsState({
        byId: {
          small: whisperDownloadFixture({
            id: 'small',
            status: 'error',
            loaded: 0,
            failure: { kind: 'disk', detail: 'ENOSPC' }
          })
        }
      })
      renderLibrary({ downloads })

      expect(screen.getByRole('alert').textContent).toContain('espaço em disco')
      fireEvent.click(screen.getByLabelText('Dispensar o aviso de falha de small'))
      expect(downloads.dismiss).toHaveBeenCalledWith('small')
    })

    it('falls back to the first row when the probe recommends something absent', () => {
      renderLibrary({
        preference: {
          id: null,
          auto: true,
          installed: [],
          recommendation: { ...HARDWARE, recommendedId: 'large-v3' }
        }
      })
      // `tiny` is the lightest multilingual row in this catalog.
      expect(screen.getByRole('button', { name: 'Baixar · 144 MB' })).toBeTruthy()
    })

    it('renders no lead at all when the catalog is empty', () => {
      renderLibrary({ models: [] })
      expect(screen.getByText('Nenhum modelo de voz ainda')).toBeTruthy()
      expect(screen.queryByRole('button', { name: /Baixar/ })).toBeNull()
    })
  })

  describe('with models installed', () => {
    const installed = [
      { ...CATALOG[0], downloaded: true, downloadedVariant: 'fp32' as const },
      { ...CATALOG[1], downloaded: true, downloadedVariant: 'fp32' as const },
      CATALOG[2]
    ]
    const preference: Preference = {
      id: 'tiny',
      auto: false,
      installed: ['tiny', 'small'],
      recommendation: HARDWARE
    }

    it('splits the chosen from the acquirable, and offers automatic first', () => {
      renderLibrary({ models: installed, preference })
      expect(screen.getByText('Seus modelos')).toBeTruthy()
      expect(screen.getByText('Biblioteca')).toBeTruthy()
      expect(screen.getAllByRole('radio')[0].getAttribute('value')).toBe('auto')
    })

    it('pins a model, and hands the choice back through the automatic row', () => {
      const { onSelect } = renderLibrary({ models: installed, preference })
      // Radix fires no change for a row that is already checked, so the
      // assertion has to move the selection somewhere it is not.
      fireEvent.click(screen.getByRole('radio', { name: /Usar o modelo small/ }))
      expect(onSelect).toHaveBeenCalledWith('small')

      fireEvent.click(screen.getAllByRole('radio')[0])
      expect(onSelect).toHaveBeenCalledWith(null)
    })

    it('names what automatic would resolve to right now', () => {
      renderLibrary({
        models: installed,
        preference: { ...preference, id: 'tiny', auto: true }
      })
      expect(screen.getByText(/hoje seria tiny/)).toBeTruthy()
    })

    it('deletes an installed model from its own row', () => {
      const { onDelete } = renderLibrary({ models: installed, preference })
      fireEvent.click(screen.getByLabelText('Excluir o modelo tiny'))
      expect(onDelete).toHaveBeenCalledWith('tiny')
    })

    it('quotes the on-disk precision for an installed model, not the download size', () => {
      renderLibrary({
        models: [{ ...CATALOG[1], downloaded: true, downloadedVariant: 'q8' as const }],
        preference: { ...preference, id: 'small', installed: ['small'] } as Preference
      })
      expect(screen.getByText('244 M · 238 MB')).toBeTruthy()
    })

    it('says so when there is genuinely nothing left to download', () => {
      renderLibrary({
        models: [{ ...CATALOG[0], downloaded: true, downloadedVariant: 'fp32' as const }],
        preference
      })
      expect(screen.getByText(/você já tem todos os modelos/i)).toBeTruthy()
    })

    it('marks an English-only build so nobody picks it for a pt-BR squad by accident', () => {
      renderLibrary({
        models: [{ ...CATALOG[1], id: 'small.en', multilingual: false }],
        preference: { id: null, auto: true, installed: [], recommendation: HARDWARE }
      })
      expect(screen.getAllByText('só inglês').length).toBeGreaterThan(0)
    })

    it('shows a library row download in flight, and cancels it by id', () => {
      const downloads = downloadsState({
        byId: { medium: whisperDownloadFixture({ id: 'medium' }) }
      })
      renderLibrary({ models: installed, preference, downloads })

      expect(screen.getByText('512 MB de 3,0 GB')).toBeTruthy()
      // The row's own download button is gone while it is transferring —
      // "Baixar" beside a live progress bar is a click that can only confuse.
      expect(screen.queryByLabelText('Baixar o modelo medium')).toBeNull()

      fireEvent.click(screen.getByLabelText('Cancelar o download de medium'))
      expect(downloads.cancel).toHaveBeenCalledWith('medium')
    })

    it('dismisses a failed library row without retrying it', () => {
      const downloads = downloadsState({
        byId: {
          medium: whisperDownloadFixture({
            id: 'medium',
            status: 'error',
            loaded: 0,
            failure: { kind: 'server', detail: 'HTTP 503' }
          })
        }
      })
      renderLibrary({ models: installed, preference, downloads })

      fireEvent.click(screen.getByLabelText('Dispensar o aviso de falha de medium'))
      expect(downloads.dismiss).toHaveBeenCalledWith('medium')
      expect(downloads.start).not.toHaveBeenCalled()
    })

    it('starts and retries a library row download by id', () => {
      const downloads = downloadsState({
        byId: {
          medium: whisperDownloadFixture({
            id: 'medium',
            status: 'error',
            loaded: 10,
            failure: { kind: 'offline', detail: 'fetch failed' }
          })
        }
      })
      renderLibrary({ models: installed, preference, downloads })

      // The row's own "Baixar" is gone while the failure banner is up: two
      // buttons doing the same thing 60 px apart is a duplicated affordance,
      // and the banner is the one that also explains what went wrong.
      expect(screen.queryByLabelText('Baixar o modelo medium')).toBeNull()

      fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
      expect(downloads.start).toHaveBeenCalledWith('medium', 'fp32')
    })
  })

  /**
   * The library used to offer every model on every machine. Two of them cannot
   * be loaded by this renderer at all (a single weight file past V8's 2 GiB
   * `ArrayBuffer` ceiling), and a third does not fit in a small machine's
   * memory — which is how a user spent 2.8 GB of download on a model that then
   * failed with "Array buffer allocation failed".
   */
  describe('what this computer cannot run', () => {
    const turbo = whisperModelFixture({
      id: 'large-v3-turbo',
      params: '809 M',
      relativeSpeed: '~8x',
      sizeMB: { fp32: 3086, q8: 1035 },
      maxFileMB: { fp32: 2430, q8: 615 },
      downloaded: false,
      downloadedVariant: null
    })

    it('takes the download away and says why, for a model no machine can load', () => {
      renderLibrary({ models: [...CATALOG, turbo], ramGB: 64 })

      expect(screen.queryByLabelText('Baixar o modelo large-v3-turbo')).toBeNull()
      const note = screen.getByText(/Não roda neste computador/)
      expect(note).toBeTruthy()
      expect(note.parentElement?.textContent).toContain('2,4 GB')
    })

    it('names memory as the reason when memory is the reason', () => {
      renderLibrary({ models: [...CATALOG, turbo], ramGB: 8 })

      expect(screen.queryByLabelText('Baixar o modelo medium')).toBeNull()
      expect(screen.getByText(/Pesado demais para esta memória/)).toBeTruthy()
      // Still offers what does fit — this is a filter, not a shutdown.
      expect(screen.getByRole('button', { name: /Baixar · 923 MB/ })).toBeTruthy()
    })

    it('never leads the empty state with a model it would then refuse', () => {
      // The probe recommends `small`; the only rows are ones this machine
      // cannot run, so the lead has to fall through to one that fits.
      renderLibrary({ models: [CATALOG[0], turbo], ramGB: 64 })
      expect(screen.getByRole('button', { name: 'Baixar · 144 MB' })).toBeTruthy()
    })
  })
})
