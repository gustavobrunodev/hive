// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { DesignStudioViewer } from './DesignStudioViewer'
import { resetFocusHint } from './focusHint'
import type { ScreensResponse } from './screens'

/**
 * jsdom lays nothing out, so the tab's width is whatever the observer is told —
 * which is also how the component learns it. Capturing the callbacks lets the
 * three width bands of §3.8 be driven with real numbers.
 */
const observers: { callback: ResizeObserverCallback; targets: Element[] }[] = []

class ObserverStub {
  private readonly entry: { callback: ResizeObserverCallback; targets: Element[] }
  constructor(callback: ResizeObserverCallback) {
    this.entry = { callback, targets: [] }
    observers.push(this.entry)
  }
  observe = (target: Element): void => {
    this.entry.targets.push(target)
  }
  unobserve = vi.fn()
  disconnect = vi.fn()
  takeRecords = vi.fn(() => [])
}
vi.stubGlobal('ResizeObserver', ObserverStub)

/**
 * Only the Studio's own observers are driven: `react-resizable-panels` also
 * observes the group, and feeding its callback a synthetic entry crashes it on
 * fields it legitimately expects.
 */
function resizeTab(width: number): void {
  act(() => {
    for (const { callback, targets } of observers) {
      if (!targets.some((target) => target.classList.contains('wb-dstudio'))) continue
      callback([{ contentRect: { width } } as unknown as ResizeObserverEntry], {} as ResizeObserver)
    }
  })
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  observers.length = 0
  resetFocusHint()
})

function mockScreens(impl: () => Promise<ScreensResponse>): ReturnType<typeof vi.fn> {
  const screens = vi.fn(impl)
  window.hive = {
    ...window.hive,
    designStudio: {
      screens,
      openPreview: vi.fn().mockResolvedValue('hive-studio://preview/abc/index.html'),
      closePreview: vi.fn().mockResolvedValue(undefined)
    }
  } as unknown as typeof window.hive
  return screens
}

function renderViewer(
  overrides: { onOpenSpec?: ReturnType<typeof vi.fn>; focusMode?: boolean } = {}
): { onOpenSpec: ReturnType<typeof vi.fn>; onRequestFocusMode: ReturnType<typeof vi.fn> } {
  const onOpenSpec = overrides.onOpenSpec ?? vi.fn()
  const onRequestFocusMode = vi.fn()
  render(
    createElement(DesignStudioViewer, {
      workspace: '/ws',
      specPath: 'docs/ux.md',
      onOpenSpec,
      focusMode: overrides.focusMode ?? false,
      onRequestFocusMode
    })
  )
  return { onOpenSpec, onRequestFocusMode }
}

const oneScreen: ScreensResponse = {
  screens: [{ screenId: 'login', title: 'Login', probe: 'screenHeading' }],
  probed: ['screenHeading', 'iaTable']
}

describe('DesignStudioViewer — the Bancada shell (T4.3, DS-R16)', () => {
  it('mounts the three columns of the Bancada inside the tab', async () => {
    mockScreens(async () => oneScreen)
    renderViewer()

    await screen.findByLabelText('Palco')
    expect(screen.getByRole('region', { name: 'Design Studio — docs/ux.md' })).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Telas' })).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Árvore' })).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Inspetor' })).toBeTruthy()
  })

  it('puts a resize handle between every pair of columns', async () => {
    mockScreens(async () => oneScreen)
    renderViewer()
    await screen.findByLabelText('Palco')

    expect(
      screen.getAllByRole('separator', { name: 'Redimensionar colunas do Design Studio' })
    ).toHaveLength(2)
  })

  it('covers the read with a Skeleton on the stage, not a blank panel', () => {
    mockScreens(() => new Promise<ScreensResponse>(() => {}))
    renderViewer()

    expect(screen.getByLabelText('Lendo a Spec…').getAttribute('aria-busy')).toBe('true')
  })

  it('teaches instead of showing a blank stage when the Spec names no Tela (DS-R1 AC-3)', async () => {
    mockScreens(async () => ({ screens: [], probed: ['screenHeading', 'iaTable'] }))
    const { onOpenSpec } = renderViewer()

    await screen.findByText('Nenhuma Tela reconhecida nesta Spec')
    expect(screen.queryByLabelText('Palco')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Abrir a Spec no editor' }))
    expect(onOpenSpec).toHaveBeenCalledWith('docs/ux.md')
  })

  it('renders an unreadable Spec as a retryable failure whose retry re-reads (DS-R1 AC-5)', async () => {
    let response: ScreensResponse = {
      kind: 'operation',
      scope: 'io',
      message: 'ENOENT',
      retryable: true
    }
    const screens = mockScreens(async () => response)
    renderViewer()

    await screen.findByText('Não foi possível ler a Spec')
    response = oneScreen
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))

    await waitFor(() => expect(screen.getByLabelText('Palco')).toBeTruthy())
    expect(screens).toHaveBeenCalledTimes(2)
  })
})

/**
 * design-studio T4.8 / §3.8. The requirement is not "it responds to width" —
 * it is that **nothing becomes unreachable** in any band. Each case below asks
 * for all three surfaces by name and expects to find every one of them,
 * whether as a column or behind its drawer.
 */
describe('DesignStudioViewer — the width degradation chain (T4.8, DS-R16)', () => {
  async function renderAt(width: number): Promise<void> {
    mockScreens(async () => oneScreen)
    renderViewer()
    await screen.findByLabelText('Palco')
    resizeTab(width)
  }

  it('≥1100px: the full Bancada, three columns, no drawer needed', async () => {
    await renderAt(1400)

    expect(screen.getByRole('region', { name: 'Telas' })).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Árvore' })).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Inspetor' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Abrir o Inspetor' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Abrir a Árvore' })).toBeNull()
  })

  it('820–1100px: the Inspetor loses its column and keeps a drawer', async () => {
    await renderAt(950)

    expect(screen.getByRole('region', { name: 'Telas' })).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Árvore' })).toBeTruthy()
    expect(screen.queryByRole('region', { name: 'Inspetor' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Abrir o Inspetor' }))
    expect(screen.getByRole('complementary', { name: 'Inspetor' })).toBeTruthy()
  })

  it('<820px: the left column folds too, and both surfaces stay reachable', async () => {
    await renderAt(700)

    expect(screen.queryByRole('region', { name: 'Telas' })).toBeNull()
    expect(screen.queryByRole('region', { name: 'Árvore' })).toBeNull()

    // The Telas never leave the toolbar, in any band — that is what keeps
    // "switch Tela" reachable once the list has no column.
    expect(screen.getByLabelText('Trocar de Tela')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Abrir a Árvore' }))
    expect(screen.getByRole('complementary', { name: 'Árvore' })).toBeTruthy()
  })

  it('closes a drawer on Escape, the key anyone tries on a panel that slid in', async () => {
    await renderAt(700)
    fireEvent.click(screen.getByRole('button', { name: 'Abrir a Árvore' }))

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('complementary', { name: 'Árvore' })).toBeNull()
  })

  it('closes a drawer from its own close button', async () => {
    await renderAt(700)
    fireEvent.click(screen.getByRole('button', { name: 'Abrir o Inspetor' }))
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))

    expect(screen.queryByRole('complementary', { name: 'Inspetor' })).toBeNull()
  })

  it('offers the Focus Mode hint below 900px, and only once per session', async () => {
    await renderAt(700)
    expect(screen.getByRole('note')).toBeTruthy()

    cleanup()
    await renderAt(700)
    expect(screen.queryByRole('note')).toBeNull()
  })

  it('does not nag with the hint on a stage wide enough to work in', async () => {
    await renderAt(1400)
    expect(screen.queryByRole('note')).toBeNull()
  })

  it('asks the app shell for Focus Mode rather than collapsing panes itself', async () => {
    mockScreens(async () => oneScreen)
    const { onRequestFocusMode } = renderViewer()
    await screen.findByLabelText('Palco')

    fireEvent.click(screen.getByRole('button', { name: 'Modo Foco' }))
    expect(onRequestFocusMode).toHaveBeenCalledWith(true)
  })

  it('asks to leave Focus Mode when it is already on', async () => {
    mockScreens(async () => oneScreen)
    const { onRequestFocusMode } = renderViewer({ focusMode: true })
    await screen.findByLabelText('Palco')

    fireEvent.click(screen.getByRole('button', { name: 'Sair do Modo Foco' }))
    expect(onRequestFocusMode).toHaveBeenCalledWith(false)
  })
})
