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
// Knobs the pdf tests turn to script the mocked document. Declared with `var`
// because `vi.mock` is hoisted above every `const`/`let` in the module.
// eslint-disable-next-line no-var
var pdfKnobs: { renderRejects: boolean; loadDelayMs: number }
vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: {} as { workerSrc?: string },
  getDocument: () => ({
    promise: new Promise((resolve) =>
      setTimeout(() => resolve(pdfDocStub()), pdfKnobs.loadDelayMs)
    ),
    destroy: () => {}
  })
}))

function pdfDocStub(): unknown {
  return {
    numPages: 2,
    getPage: () =>
      Promise.resolve({
        // Scale-aware, like the real thing: a fixed-size viewport would make
        // "did zoom actually redraw?" untestable.
        getViewport: ({ scale = 1 }: { scale?: number } = {}) => ({
          width: 612 * scale,
          height: 792 * scale
        }),
        render: () => ({
          promise: pdfKnobs.renderRejects
            ? Promise.reject(new Error('RenderingCancelledException'))
            : Promise.resolve(),
          cancel: () => {}
        })
      }),
    destroy: () => {}
  }
}

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
    this.fireOn(this.els, ratio)
  }
  /** Fire for arbitrary targets — used for the orphaned-page case. */
  fireOn(targets: Element[], ratio = 1): void {
    this.cb(targets.map((target) => ({ target, isIntersecting: true, intersectionRatio: ratio })))
  }
}

// A capturing ResizeObserver, so the image viewer's fit-to-view maths can be
// exercised: with the plain stub the stage box stays 0×0 forever and the
// `fitScale` ternary can only ever take its fallback arm.
const roInstances: CapturingRO[] = []
class CapturingRO {
  constructor(private cb: (entries: { contentRect: { width: number; height: number } }[]) => void) {
    roInstances.push(this)
  }
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
  takeRecords = vi.fn(() => [])
  resize(width: number, height: number): void {
    this.cb([{ contentRect: { width, height } }])
  }
}

// jsdom ships no PointerEvent, so testing-library falls back to a bare `Event`
// and silently drops `clientX`/`clientY` — a pan gesture would arrive with
// undefined coordinates and the handler would compute NaN offsets. This
// minimal stand-in carries the coordinates through so the pan maths can be
// asserted on real numbers.
class PointerEventStub extends MouseEvent {
  readonly pointerId: number
  constructor(type: string, init: MouseEventInit & { pointerId?: number } = {}) {
    super(type, init)
    this.pointerId = init.pointerId ?? 0
  }
}

/**
 * Makes an element report as overflowing its own box, which is the precondition
 * for the image stage's drag-to-pan path. jsdom lays nothing out, so every
 * scroll/client metric is 0 and the pan handlers can only ever take their
 * early-return arm.
 */
function makeOverflowing(el: HTMLElement): void {
  for (const [prop, value] of [
    ['scrollWidth', 400],
    ['clientWidth', 100],
    ['scrollHeight', 400],
    ['clientHeight', 100]
  ] as const) {
    Object.defineProperty(el, prop, { value, configurable: true })
  }
  let left = 0
  let top = 0
  Object.defineProperty(el, 'scrollLeft', {
    configurable: true,
    get: () => left,
    set: (v: number) => {
      left = v
    }
  })
  Object.defineProperty(el, 'scrollTop', {
    configurable: true,
    get: () => top,
    set: (v: number) => {
      top = v
    }
  })
  el.setPointerCapture = vi.fn()
  el.releasePointerCapture = vi.fn()
}

function setHive(fs: Record<string, unknown>, extra: Record<string, unknown> = {}): void {
  ;(window as unknown as { hive: unknown }).hive = { fs, ...extra }
}

beforeEach(() => {
  pdfKnobs = { renderRejects: false, loadDelayMs: 0 }
  ioInstances.length = 0
  roInstances.length = 0
  vi.stubGlobal('ResizeObserver', ObserverStub)
  vi.stubGlobal('IntersectionObserver', CapturingIO)
  vi.stubGlobal('PointerEvent', PointerEventStub)
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

  // P0-011 (R-03): the file's uncovered branches were all on the paths jsdom
  // never reaches on its own — it lays nothing out, so the stage box is 0×0 and
  // nothing can overflow. Each test below installs the specific layout fact its
  // path needs, rather than asserting around the gap.
  it('fit-to-view reports a real scale once the stage reports a box', async () => {
    vi.stubGlobal('ResizeObserver', CapturingRO)
    setHive({
      readBinary: vi.fn().mockResolvedValue({ base64: 'AAAA', mime: 'image/png', size: 10 })
    })
    render(createElement(ImageViewer, { workspace: '/ws', path: 'a.png' }))
    const img = (await screen.findByAltText('a.png')) as HTMLImageElement

    // A 800×600 image in a 400×300 stage fits at exactly 50%.
    Object.defineProperty(img, 'naturalWidth', { value: 800, configurable: true })
    Object.defineProperty(img, 'naturalHeight', { value: 600, configurable: true })
    fireEvent.load(img)
    await waitFor(() => expect(roInstances.length).toBeGreaterThan(0))
    roInstances[roInstances.length - 1].resize(400, 300)

    await waitFor(() => expect(screen.getByText('50%')).toBeTruthy())
  })

  it('double-click toggles actual size on and back off again', async () => {
    setHive({
      readBinary: vi.fn().mockResolvedValue({ base64: 'AAAA', mime: 'image/png', size: 10 })
    })
    render(createElement(ImageViewer, { workspace: '/ws', path: 'a.png' }))
    const stage = (await screen.findByAltText('a.png')).parentElement as HTMLElement

    fireEvent.doubleClick(stage)
    expect(screen.getByText('100%')).toBeTruthy()
    // Second double-click returns to fit — the arm of the toggle that was
    // never exercised, and the one a user hits every time they zoom back out.
    fireEvent.doubleClick(stage)
    await waitFor(() => expect(stage.className).not.toContain('is-panning'))
  })

  it('drag-to-pan scrolls the stage while overflowing and marks it as panning', async () => {
    setHive({
      readBinary: vi.fn().mockResolvedValue({ base64: 'AAAA', mime: 'image/png', size: 10 })
    })
    render(createElement(ImageViewer, { workspace: '/ws', path: 'a.png' }))
    const stage = (await screen.findByAltText('a.png')).parentElement as HTMLElement
    makeOverflowing(stage)

    fireEvent.pointerDown(stage, { clientX: 100, clientY: 100, pointerId: 7 })
    await waitFor(() => expect(stage.className).toContain('is-panning'))
    // jsdom's PointerEvent drops `pointerId` from the init dict, so assert the
    // capture happened rather than which pointer it captured.
    expect(stage.setPointerCapture).toHaveBeenCalled()

    // Dragging left/up by 30px scrolls the content the opposite way.
    fireEvent.pointerMove(stage, { clientX: 70, clientY: 60, pointerId: 7 })
    expect(stage.scrollLeft).toBe(30)
    expect(stage.scrollTop).toBe(40)

    fireEvent.pointerUp(stage, { pointerId: 7 })
    await waitFor(() => expect(stage.className).not.toContain('is-panning'))
    expect(stage.releasePointerCapture).toHaveBeenCalled()
  })

  it('zoom-out steps the scale down', async () => {
    // The shared ZoomControls cluster had its "−" button wired but never
    // clicked by any test — the one uncovered function in docViewerShared.tsx.
    setHive({
      readBinary: vi.fn().mockResolvedValue({ base64: 'AAAA', mime: 'image/png', size: 10 })
    })
    render(createElement(ImageViewer, { workspace: '/ws', path: 'a.png' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Aumentar zoom' }))
    expect(screen.getByText('125%')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Diminuir zoom' }))
    expect(screen.getByText('100%')).toBeTruthy()
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

  // P0-011: a resolved-but-empty payload is a distinct failure from a rejected
  // read, and the one the viewers guard against with `|| !data`. A main-side
  // parser that returns nothing must land on the retry card, not a blank pane.
  it('falls back to the error card when the read resolves with no document', async () => {
    setHive({ readDocx: vi.fn().mockResolvedValue(null) })
    render(createElement(DocxViewer, { workspace: '/ws', path: 'd.docx' }))
    expect(await screen.findByRole('button', { name: 'Tentar de novo' })).toBeTruthy()
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
      readSheet: vi.fn().mockResolvedValue({
        sheets: [{ name: 'x', rowCount: 0, colCount: 0, truncated: false, rows: [] }]
      })
    })
    render(createElement(SheetViewer, { workspace: '/ws', path: 's.csv' }))
    expect(await screen.findByText('Esta planilha está vazia.')).toBeTruthy()
  })

  it('renders ragged rows and blank cells without gaps or stray tooltips', async () => {
    // Real spreadsheets are ragged: rows shorter than the widest row, and
    // empty cells inside them. Both arms (`row[c] ?? ''` for the missing cell,
    // `row[c] || undefined` for the blank one) were unexercised, and both are
    // ordinary content, not edge cases.
    setHive({
      readSheet: vi.fn().mockResolvedValue({
        sheets: [
          {
            name: 'Ragged',
            rowCount: 2,
            colCount: 3,
            truncated: false,
            rows: [['a', '', 'c'], ['solo']]
          }
        ]
      })
    })
    render(createElement(SheetViewer, { workspace: '/ws', path: 's.xlsx' }))

    await screen.findByText('a')
    const bodyRows = document.querySelectorAll('tbody tr')
    // Both rows are padded out to the widest row's 3 columns.
    expect(bodyRows[1].querySelectorAll('.wb-sheet-cell')).toHaveLength(3)
    // A blank cell carries no tooltip; a filled one does.
    const firstRowCells = bodyRows[0].querySelectorAll('.wb-sheet-cell')
    expect(firstRowCells[1].getAttribute('title')).toBeNull()
    expect(firstRowCells[2].getAttribute('title')).toBe('c')
  })

  it('falls back to the error card when the workbook has no sheets at all', async () => {
    setHive({ readSheet: vi.fn().mockResolvedValue({ sheets: [] }) })
    render(createElement(SheetViewer, { workspace: '/ws', path: 's.xlsx' }))
    expect(await screen.findByRole('button', { name: 'Tentar de novo' })).toBeTruthy()
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

  it('navigates with the vertical arrow keys and the previous-slide button', async () => {
    // Only ArrowRight/ArrowLeft were driven; ArrowDown/ArrowUp share the
    // handler but not the branch, and the "previous" button was never clicked
    // at all — its onClick was the file's one uncovered function.
    setHive({
      readSlides: vi.fn().mockResolvedValue({
        title: 'D',
        slides: [
          { index: 1, title: 'Um', bullets: [], images: [] },
          { index: 2, title: 'Dois', bullets: [], images: [] }
        ]
      })
    })
    render(createElement(SlidesViewer, { workspace: '/ws', path: 'd.pptx' }))
    const stage = (await screen.findByRole('heading', { name: 'Um' })).closest(
      '.wb-slides-viewer'
    ) as HTMLElement

    fireEvent.keyDown(stage, { key: 'ArrowDown' })
    expect(await screen.findByRole('heading', { name: 'Dois' })).toBeTruthy()
    fireEvent.keyDown(stage, { key: 'ArrowUp' })
    expect(await screen.findByRole('heading', { name: 'Um' })).toBeTruthy()

    // An unhandled key must not move the deck.
    fireEvent.keyDown(stage, { key: 'Enter' })
    expect(screen.getByText('Slide 1 de 2')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Próximo slide' }))
    expect(await screen.findByRole('heading', { name: 'Dois' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Slide anterior' }))
    expect(await screen.findByRole('heading', { name: 'Um' })).toBeTruthy()
  })

  it('labels an untitled thumbnail with its first bullet', async () => {
    setHive({
      readSlides: vi.fn().mockResolvedValue({
        title: 'D',
        slides: [
          { index: 1, title: null, bullets: [{ text: 'Primeiro tópico', level: 0 }], images: [] }
        ]
      })
    })
    render(createElement(SlidesViewer, { workspace: '/ws', path: 'd.pptx' }))
    const thumb = await screen.findByRole('tab')
    expect(thumb.textContent).toContain('Primeiro tópico')
  })

  it('falls back to the error card when the read resolves with no deck', async () => {
    setHive({ readSlides: vi.fn().mockResolvedValue(null) })
    render(createElement(SlidesViewer, { workspace: '/ws', path: 'd.pptx' }))
    expect(await screen.findByRole('button', { name: 'Tentar de novo' })).toBeTruthy()
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

  it('pages forward with the next button and returns to fit', async () => {
    // The next-page button and the fit control were both wired but never
    // clicked — the file's two uncovered functions.
    setHive({
      readBinary: vi.fn().mockResolvedValue({ base64: 'AAAA', mime: 'application/pdf', size: 100 })
    })
    render(createElement(PdfViewer, { workspace: '/ws', path: 'r.pdf' }))
    expect(await screen.findByText('Página 1 de 2')).toBeTruthy()

    // Paging scrolls the target page into view; the indicator itself is driven
    // by the IntersectionObserver, not by the click.
    fireEvent.click(screen.getByRole('button', { name: 'Próxima página' }))
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Aumentar zoom' }))
    expect(screen.getByText('125%')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Ajustar à tela' }))
    // Back to fit: with no laid-out scroll box, fit resolves to 100%.
    await waitFor(() => expect(screen.getByText('100%')).toBeTruthy())
  })

  it('draws pages onto a real canvas context and redraws them when the scale changes', async () => {
    // With `getContext` stubbed to null the renderer bailed before ever
    // sizing a canvas, so the whole draw path — the part that actually puts
    // pixels on screen — was untested.
    const context = {} as CanvasRenderingContext2D
    HTMLCanvasElement.prototype.getContext = vi.fn(() => context) as never
    setHive({
      readBinary: vi.fn().mockResolvedValue({ base64: 'AAAA', mime: 'application/pdf', size: 100 })
    })
    render(createElement(PdfViewer, { workspace: '/ws', path: 'r.pdf' }))
    await screen.findByText('Página 1 de 2')

    await waitFor(() => expect(ioInstances.length).toBeGreaterThan(0))
    ioInstances[ioInstances.length - 1].fire(1)

    const canvas = document.querySelector('.wb-pdf-canvas') as HTMLCanvasElement
    // The mocked page reports a 612×792 viewport, so a drawn canvas is sized.
    await waitFor(() => expect(canvas.width).toBeGreaterThan(0))
    const atFit = canvas.width

    // Zooming redraws every already-drawn page at the new scale, so the
    // backing store grows rather than a bitmap being stretched.
    fireEvent.click(screen.getByRole('button', { name: 'Aumentar zoom' }))
    await waitFor(() => expect(canvas.width).toBeGreaterThan(atFit))

    // Re-firing the observer at the unchanged scale must not resize anything —
    // the memo that keeps scrolling cheap.
    const atZoom = canvas.width
    ioInstances[ioInstances.length - 1].fire(1)
    await waitFor(() => expect(canvas.width).toBe(atZoom))
  })

  it('fit-to-view derives its scale from the scroll box once it reports a width', async () => {
    vi.stubGlobal('ResizeObserver', CapturingRO)
    setHive({
      readBinary: vi.fn().mockResolvedValue({ base64: 'AAAA', mime: 'application/pdf', size: 100 })
    })
    render(createElement(PdfViewer, { workspace: '/ws', path: 'r.pdf' }))
    await screen.findByText('Página 1 de 2')

    await waitFor(() => expect(roInstances.length).toBeGreaterThan(0))
    // A 660px-wide scroll area minus the 48px gutter fits a 612pt page at 100%.
    roInstances[roInstances.length - 1].resize(660, 800)
    await waitFor(() => expect(screen.getByText('100%')).toBeTruthy())

    // Halve it and the page fits at half scale.
    roInstances[roInstances.length - 1].resize(354, 800)
    await waitFor(() => expect(screen.getByText('50%')).toBeTruthy())
  })

  it('a failed page render clears the cached scale so the page can be drawn again', async () => {
    // pdf.js rejects the in-flight render whenever one is cancelled (a scale
    // change, or unmount). If the cached scale survived that rejection the page
    // would stay permanently blank — the reason the catch resets it.
    pdfKnobs.renderRejects = true
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({}) as CanvasRenderingContext2D) as never
    setHive({
      readBinary: vi.fn().mockResolvedValue({ base64: 'AAAA', mime: 'application/pdf', size: 100 })
    })
    render(createElement(PdfViewer, { workspace: '/ws', path: 'r.pdf' }))
    await screen.findByText('Página 1 de 2')

    await waitFor(() => expect(ioInstances.length).toBeGreaterThan(0))
    ioInstances[ioInstances.length - 1].fire(1)

    // The render rejected, but the viewer stays alive and re-attempts on the
    // next intersection instead of leaving a dead pane.
    pdfKnobs.renderRejects = false
    ioInstances[ioInstances.length - 1].fire(1)
    const canvas = document.querySelector('.wb-pdf-canvas') as HTMLCanvasElement
    await waitFor(() => expect(canvas.width).toBeGreaterThan(0))
  })

  // Two distinct abandonment points, and the viewer guards both: after the
  // bytes arrive but before pdf.js has parsed them, and after parsing. Getting
  // either wrong sets state on a dead tree (React warning) or leaks the parsed
  // document. Both are ordinary — the user clicks another file mid-load.
  it.each([
    ['while the bytes are still in flight', { slowRead: true, slowParse: false }],
    ['while pdf.js is still parsing', { slowRead: false, slowParse: true }]
  ])('unmounting %s abandons the load cleanly', async (_label, { slowRead, slowParse }) => {
    if (slowParse) pdfKnobs.loadDelayMs = 30
    setHive({
      readBinary: slowRead
        ? vi.fn(
            () =>
              new Promise((resolve) =>
                setTimeout(
                  () => resolve({ base64: 'AAAA', mime: 'application/pdf', size: 100 }),
                  30
                )
              )
          )
        : vi.fn().mockResolvedValue({ base64: 'AAAA', mime: 'application/pdf', size: 100 })
    })
    const { unmount } = render(createElement(PdfViewer, { workspace: '/ws', path: 'r.pdf' }))
    expect(screen.getByRole('status')).toBeTruthy()
    unmount()

    await new Promise((resolve) => setTimeout(resolve, 80))
    expect(document.querySelector('.wb-pdf-viewer')).toBeNull()
  })

  it('falls back to 1× when the environment reports no devicePixelRatio', async () => {
    // The backing-store scale is captured once at module load. An environment
    // that reports `devicePixelRatio` as 0 (some headless/embedded WebViews do)
    // would otherwise size every canvas to zero — a blank document, no error.
    vi.stubGlobal('devicePixelRatio', 0)
    vi.resetModules()
    const { PdfViewer: FreshPdfViewer } = await import('./PdfViewer')

    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({}) as CanvasRenderingContext2D) as never
    setHive({
      readBinary: vi.fn().mockResolvedValue({ base64: 'AAAA', mime: 'application/pdf', size: 100 })
    })
    render(createElement(FreshPdfViewer, { workspace: '/ws', path: 'r.pdf' }))
    await screen.findByText('Página 1 de 2')
    await waitFor(() => expect(ioInstances.length).toBeGreaterThan(0))
    ioInstances[ioInstances.length - 1].fire(1)

    const canvas = document.querySelector('.wb-pdf-canvas') as HTMLCanvasElement
    // 612pt at fit (1.0) × a 1× fallback — not zero.
    await waitFor(() => expect(canvas.width).toBe(612))
  })

  it('an intersection for a page with no canvas is ignored rather than throwing', async () => {
    // The observer can outlive a page element by a tick (unmount races, a file
    // swapped under the viewer). Drawing into a canvas that is gone would throw
    // inside the observer callback, where nothing catches it.
    setHive({
      readBinary: vi.fn().mockResolvedValue({ base64: 'AAAA', mime: 'application/pdf', size: 100 })
    })
    render(createElement(PdfViewer, { workspace: '/ws', path: 'r.pdf' }))
    await screen.findByText('Página 1 de 2')
    await waitFor(() => expect(ioInstances.length).toBeGreaterThan(0))

    const orphan = document.createElement('div')
    orphan.dataset.page = '99'
    expect(() => ioInstances[ioInstances.length - 1].fireOn([orphan], 1)).not.toThrow()
    // The pager is untouched by the phantom page.
    expect(screen.getByText('Página 1 de 2')).toBeTruthy()
  })
})

describe('DocumentViewer routing', () => {
  it('routes each kind to its viewer', async () => {
    setHive({
      readSheet: vi.fn().mockResolvedValue({
        sheets: [{ name: 'S', rowCount: 1, colCount: 1, truncated: false, rows: [['x']] }]
      })
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
