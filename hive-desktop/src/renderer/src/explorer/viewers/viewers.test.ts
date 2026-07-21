// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

/**
 * Render tests for the rich file viewers. `@hive/design-system` is mocked with
 * trivial stand-ins (same reason as Explorer.test.ts — its real bundle pulls a
 * second React instance), `pdfjs-dist` is mocked so the pdf viewer mounts
 * without the browser-only `DOMMatrix`, and `window.hive.fs.*` is stubbed per
 * test.
 */
vi.mock('@hive/design-system', () => ({
  // title/description wrapped in their own elements so testing-library can
  // match each as its own text (they'd otherwise concatenate into one node).
  Empty: ({ title, description }: { title?: ReactNode; description?: ReactNode }) =>
    createElement(
      'div',
      { 'data-testid': 'empty' },
      createElement('div', null, title),
      createElement('div', null, description)
    ),
  Spinner: ({ label }: { label?: ReactNode }) => createElement('div', { role: 'status' }, label)
}))

vi.mock('pdfjs-dist/build/pdf.worker.min.mjs?url', () => ({ default: 'worker-stub.js' }))
vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: {} as { workerSrc?: string },
  getDocument: () => ({
    promise: Promise.resolve({
      numPages: 2,
      getPage: () =>
        Promise.resolve({
          getViewport: () => ({ width: 612, height: 792 }),
          render: () => ({ promise: Promise.resolve(), cancel: () => {} })
        }),
      destroy: () => {}
    }),
    destroy: () => {}
  })
}))

import { ImageViewer } from './ImageViewer'
import { DocxViewer } from './DocxViewer'
import { SheetViewer } from './SheetViewer'
import { SlidesViewer } from './SlidesViewer'
import { PdfViewer } from './PdfViewer'
import { DocumentViewer } from '../DocumentViewer'

class ObserverStub {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
  takeRecords = vi.fn(() => [])
}

// A capturing IntersectionObserver so the pdf viewer's lazy-render path can be
// driven: the test fires the observed page elements as intersecting.
type IoEntry = { target: Element; isIntersecting: boolean; intersectionRatio: number }
const ioInstances: CapturingIO[] = []
class CapturingIO {
  private els: Element[] = []
  constructor(private cb: (entries: IoEntry[]) => void) {
    ioInstances.push(this)
  }
  observe = (el: Element): void => {
    this.els.push(el)
  }
  unobserve = vi.fn()
  disconnect = vi.fn()
  takeRecords = vi.fn(() => [])
  fire(ratio = 1): void {
    this.cb(this.els.map((target) => ({ target, isIntersecting: true, intersectionRatio: ratio })))
  }
}

function setHive(fs: Record<string, unknown>, extra: Record<string, unknown> = {}): void {
  ;(window as unknown as { hive: unknown }).hive = { fs, ...extra }
}

beforeEach(() => {
  ioInstances.length = 0
  vi.stubGlobal('ResizeObserver', ObserverStub)
  vi.stubGlobal('IntersectionObserver', CapturingIO)
  // jsdom doesn't implement these; the viewers call them for navigation and
  // (in the pdf viewer) canvas rendering.
  Element.prototype.scrollIntoView = vi.fn()
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as never
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('ImageViewer', () => {
  it('renders the image from a data URL and shows dimensions after load', async () => {
    setHive({
      readBinary: vi.fn().mockResolvedValue({ base64: 'AAAA', mime: 'image/png', size: 2048 })
    })
    render(createElement(ImageViewer, { workspace: '/ws', path: 'a.png' }))

    const img = (await screen.findByAltText('a.png')) as HTMLImageElement
    expect(img.getAttribute('src')).toBe('data:image/png;base64,AAAA')
    // The meta line mixes text nodes and a dot element, so read its textContent.
    const meta = (): string => document.querySelector('.wb-doc-meta')?.textContent ?? ''
    expect(meta()).toContain('2.0 KB')

    Object.defineProperty(img, 'naturalWidth', { value: 800, configurable: true })
    Object.defineProperty(img, 'naturalHeight', { value: 600, configurable: true })
    fireEvent.load(img)
    await waitFor(() => expect(meta()).toContain('800 × 600'))
  })

  it('zoom controls switch off fit mode and change the reported scale', async () => {
    setHive({
      readBinary: vi.fn().mockResolvedValue({ base64: 'AAAA', mime: 'image/png', size: 10 })
    })
    render(createElement(ImageViewer, { workspace: '/ws', path: 'a.png' }))
    const zoomIn = await screen.findByRole('button', { name: 'Aumentar zoom' })
    fireEvent.click(zoomIn)
    expect(screen.getByText('125%')).toBeTruthy()
  })

  it('fit, double-click-to-actual-size and pan handlers stay stable', async () => {
    setHive({
      readBinary: vi.fn().mockResolvedValue({ base64: 'AAAA', mime: 'image/svg+xml', size: 10 })
    })
    render(createElement(ImageViewer, { workspace: '/ws', path: 'a.svg' }))
    const img = await screen.findByAltText('a.svg')
    const stage = img.parentElement as HTMLElement

    // Zoom in, then Fit resets back to fit mode.
    fireEvent.click(screen.getByRole('button', { name: 'Aumentar zoom' }))
    fireEvent.click(screen.getByRole('button', { name: 'Ajustar à tela' }))
    // Double-click toggles to actual size (100%).
    fireEvent.doubleClick(stage)
    expect(screen.getByText('100%')).toBeTruthy()
    // Pointer sequence on the (non-overflowing) stage is a no-op but must not throw.
    fireEvent.pointerDown(stage, { clientX: 5, clientY: 5, pointerId: 1 })
    fireEvent.pointerMove(stage, { clientX: 9, clientY: 9, pointerId: 1 })
    fireEvent.pointerUp(stage, { pointerId: 1 })
  })

  it('shows the error state with retry when the read fails, and retry refetches', async () => {
    const readBinary = vi
      .fn()
      .mockRejectedValueOnce(new Error('nope'))
      .mockResolvedValue({ base64: 'AAAA', mime: 'image/png', size: 10 })
    setHive({ readBinary })
    render(createElement(ImageViewer, { workspace: '/ws', path: 'a.png' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Tentar de novo' }))
    expect(await screen.findByAltText('a.png')).toBeTruthy()
    expect(readBinary).toHaveBeenCalledTimes(2)
  })
})

describe('DocxViewer', () => {
  it('renders converted HTML and the simplification warning', async () => {
    setHive({
      readDocx: vi.fn().mockResolvedValue({ html: '<h1>Título</h1><p>Corpo</p>', warnings: ['x'] })
    })
    render(createElement(DocxViewer, { workspace: '/ws', path: 'd.docx' }))
    expect(await screen.findByText('Título')).toBeTruthy()
    expect(screen.getByText('Corpo')).toBeTruthy()
    expect(screen.getByText('1 detalhe de formatação foi simplificado.')).toBeTruthy()
  })

  it('omits the warning line when there are no conversion warnings', async () => {
    setHive({ readDocx: vi.fn().mockResolvedValue({ html: '<p>Limpo</p>', warnings: [] }) })
    render(createElement(DocxViewer, { workspace: '/ws', path: 'd.docx' }))
    expect(await screen.findByText('Limpo')).toBeTruthy()
    expect(document.querySelector('.wb-docx-warning')).toBeNull()
  })
})

describe('SheetViewer', () => {
  const twoSheets = {
    sheets: [
      {
        name: 'Dados',
        rowCount: 3,
        colCount: 2,
        truncated: true,
        rows: [
          ['Item', 'Custo'],
          ['A', '10']
        ]
      },
      { name: 'Resumo', rowCount: 1, colCount: 1, truncated: false, rows: [['Total']] }
    ]
  }

  it('renders a grid with column letters, sheet tabs and a truncation notice', async () => {
    setHive({ readSheet: vi.fn().mockResolvedValue(twoSheets) })
    render(createElement(SheetViewer, { workspace: '/ws', path: 's.xlsx' }))

    expect(await screen.findByText('Item')).toBeTruthy()
    expect(screen.getByRole('columnheader', { name: 'A' })).toBeTruthy()
    expect(screen.getByRole('columnheader', { name: 'B' })).toBeTruthy()
    expect(screen.getByText('Mostrando as primeiras 2 de 3 linhas')).toBeTruthy()

    // Switch to the second sheet via its tab.
    fireEvent.click(screen.getByRole('tab', { name: 'Resumo' }))
    expect(await screen.findByText('Total')).toBeTruthy()
  })

  it('shows an empty state for a sheet with no rows', async () => {
    setHive({
      readSheet: vi
        .fn()
        .mockResolvedValue({ sheets: [{ name: 'x', rowCount: 0, colCount: 0, truncated: false, rows: [] }] })
    })
    render(createElement(SheetViewer, { workspace: '/ws', path: 's.csv' }))
    expect(await screen.findByText('Esta planilha está vazia.')).toBeTruthy()
  })
})

describe('SlidesViewer', () => {
  const deck = {
    title: 'Deck',
    slides: [
      { index: 1, title: 'Um', bullets: [{ text: 'a', level: 0 }], images: [] },
      { index: 2, title: 'Dois', bullets: [], images: [] }
    ]
  }

  it('renders the current slide, navigates, and lists thumbnails', async () => {
    setHive({ readSlides: vi.fn().mockResolvedValue(deck) })
    render(createElement(SlidesViewer, { workspace: '/ws', path: 'd.pptx' }))

    expect(await screen.findByRole('heading', { name: 'Um' })).toBeTruthy()
    expect(screen.getByText('Slide 1 de 2')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Próximo slide' }))
    expect(await screen.findByRole('heading', { name: 'Dois' })).toBeTruthy()
    expect(screen.getByText('Slide 2 de 2')).toBeTruthy()

    // Jump back via a filmstrip thumbnail.
    fireEvent.click(screen.getAllByRole('tab')[0])
    expect(await screen.findByRole('heading', { name: 'Um' })).toBeTruthy()
  })

  it('navigates with the arrow keys and renders slide images', async () => {
    setHive({
      readSlides: vi.fn().mockResolvedValue({
        title: 'D',
        slides: [
          { index: 1, title: 'Um', bullets: [], images: ['data:image/png;base64,AAAA'] },
          { index: 2, title: null, bullets: [], images: [] }
        ]
      })
    })
    render(createElement(SlidesViewer, { workspace: '/ws', path: 'd.pptx' }))
    const stage = (await screen.findByRole('heading', { name: 'Um' })).closest(
      '.wb-slides-viewer'
    ) as HTMLElement
    expect(document.querySelector('.wb-slide-image')).toBeTruthy()

    fireEvent.keyDown(stage, { key: 'ArrowRight' })
    // Slide 2 has no title/bullets/images → the "slide sem texto" placeholder
    // on the stage (the same string also labels its filmstrip thumbnail).
    await waitFor(() =>
      expect(document.querySelector('.wb-slide-empty')?.textContent).toBe('Slide sem texto')
    )
    fireEvent.keyDown(stage, { key: 'ArrowLeft' })
    expect(await screen.findByRole('heading', { name: 'Um' })).toBeTruthy()
  })

  it('shows an empty state for a deck with no slides', async () => {
    setHive({ readSlides: vi.fn().mockResolvedValue({ title: null, slides: [] }) })
    render(createElement(SlidesViewer, { workspace: '/ws', path: 'd.pptx' }))
    expect(await screen.findByText('Nenhum slide encontrado nesta apresentação.')).toBeTruthy()
  })
})

describe('PdfViewer', () => {
  it('renders the page count, lazily renders on intersect, zooms and pages', async () => {
    setHive({
      readBinary: vi.fn().mockResolvedValue({ base64: 'AAAA', mime: 'application/pdf', size: 100 })
    })
    render(createElement(PdfViewer, { workspace: '/ws', path: 'r.pdf' }))
    expect(await screen.findByText('Página 1 de 2')).toBeTruthy()

    // Drive the lazy render: fire the observed page elements as intersecting.
    await waitFor(() => expect(ioInstances.length).toBeGreaterThan(0))
    ioInstances[ioInstances.length - 1].fire(1)

    // Firing both pages as intersecting advances the indicator to the last one.
    expect(await screen.findByText('Página 2 de 2')).toBeTruthy()
    // Zoom in (re-renders drawn pages) and page back (scrollIntoView is stubbed).
    fireEvent.click(screen.getByRole('button', { name: 'Aumentar zoom' }))
    fireEvent.click(screen.getByRole('button', { name: 'Página anterior' }))
    expect(screen.getByText(/de 2$/)).toBeTruthy()
  })

  it('shows the error state when the pdf bytes fail to load', async () => {
    setHive({ readBinary: vi.fn().mockRejectedValue(new Error('boom')) })
    render(createElement(PdfViewer, { workspace: '/ws', path: 'r.pdf' }))
    expect(await screen.findByRole('button', { name: 'Tentar de novo' })).toBeTruthy()
  })
})

describe('DocumentViewer routing', () => {
  it('routes each kind to its viewer', async () => {
    setHive({
      readSheet: vi
        .fn()
        .mockResolvedValue({ sheets: [{ name: 'S', rowCount: 1, colCount: 1, truncated: false, rows: [['x']] }] })
    })
    render(createElement(DocumentViewer, { workspace: '/ws', path: 'a.xlsx' }))
    // The sheet viewer renders a spreadsheet grid (A column header + the cell).
    expect(await screen.findByRole('columnheader', { name: 'A' })).toBeTruthy()
    expect(screen.getByText('x')).toBeTruthy()
  })

  it('routes image, docx, pdf and pptx kinds to their viewers', async () => {
    setHive({
      readBinary: vi.fn().mockResolvedValue({ base64: 'AAAA', mime: 'image/png', size: 1 }),
      readDocx: vi.fn().mockResolvedValue({ html: '<p>D</p>', warnings: [] }),
      readSlides: vi.fn().mockResolvedValue({
        title: 'T',
        slides: [{ index: 1, title: 'S', bullets: [], images: [] }]
      })
    })
    const { rerender } = render(createElement(DocumentViewer, { workspace: '/ws', path: 'a.png' }))
    expect(await screen.findByAltText('a.png')).toBeTruthy()

    rerender(createElement(DocumentViewer, { workspace: '/ws', path: 'a.docx' }))
    expect(await screen.findByText('D')).toBeTruthy()

    rerender(createElement(DocumentViewer, { workspace: '/ws', path: 'a.pptx' }))
    expect(await screen.findByRole('heading', { name: 'S' })).toBeTruthy()

    rerender(createElement(DocumentViewer, { workspace: '/ws', path: 'a.pdf' }))
    expect(await screen.findByText('Página 1 de 2')).toBeTruthy()
  })

  it('shows the unsupported card with an open-externally action for other binaries', async () => {
    const openExternal = vi.fn().mockResolvedValue(undefined)
    setHive({}, { openExternal })
    render(createElement(DocumentViewer, { workspace: '/ws', path: 'archive.zip' }))

    expect(screen.getByText('Pré-visualização indisponível')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Abrir no app padrão' }))
    expect(openExternal).toHaveBeenCalledWith('file:///ws/archive.zip')
  })
})
