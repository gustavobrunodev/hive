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

/** A Tela holding a card with a button inside it — enough to have something to select. */
const NESTED = {
  screenId: 'login',
  title: 'Login',
  root: {
    id: 'n1',
    tag: 'wa-card',
    props: {},
    children: [{ id: 'n2', tag: 'wa-button', props: {}, children: [] }]
  }
}

/** A catalog with one enum prop — enough to make the Inspector offer a control. */
const CATALOG = {
  dsId: 'ds',
  version: '1',
  components: [
    {
      tag: 'wa-button',
      slots: [''],
      props: [
        { name: 'variant', kind: 'enum', values: ['neutral', 'brand'], group: 'appearance' },
        { name: 'disabled', kind: 'boolean', group: 'state' }
      ]
    },
    { tag: 'wa-card', slots: [''], props: [] }
  ]
}

function mockScreens(
  impl: () => Promise<ScreensResponse>,
  document: unknown = { screenId: 'login', title: 'Login', root: null },
  dispatchResult?: unknown
): ReturnType<typeof vi.fn> {
  const screens = vi.fn(impl)
  const view = { document, canUndo: false, canRedo: false }
  window.hive = {
    ...window.hive,
    designStudio: {
      screens,
      openPreview: vi.fn().mockResolvedValue('hive-studio://preview/abc/index.html'),
      closePreview: vi.fn().mockResolvedValue(undefined),
      catalog: vi.fn().mockResolvedValue(CATALOG),
      view: vi.fn().mockResolvedValue(view),
      dispatch: vi.fn().mockResolvedValue(dispatchResult ?? view),
      undo: vi.fn().mockResolvedValue(view),
      redo: vi.fn().mockResolvedValue(view)
    }
  } as unknown as typeof window.hive
  return screens
}

/** The bridge as the tab sees it, for asserting what was dispatched. */
function bridge(): Record<string, ReturnType<typeof vi.fn>> {
  return window.hive.designStudio as unknown as Record<string, ReturnType<typeof vi.fn>>
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
 * design-studio T5.1 / DS-R5 AC-4/AC-5. Selection is one fact with two
 * surfaces. Both directions are asserted on the Árvore's `aria-selected`,
 * because that is what a user actually sees change.
 */
describe('DesignStudioViewer — selection runs both ways (T5.1)', () => {
  /** The tree row for a tag, ignoring the tags of rows nested inside it. */
  function rowFor(tag: string): HTMLElement {
    const row = screen
      .getAllByRole('treeitem')
      .find((item) => item.querySelector('.hds-tree-label-text')?.textContent === tag)
    if (!row) throw new Error(`no row for ${tag}`)
    return row
  }

  async function renderWithTree(): Promise<HTMLIFrameElement> {
    mockScreens(async () => oneScreen, NESTED)
    renderViewer()
    await screen.findByLabelText('Palco')
    const frame = (await screen.findByTitle('Preview da Tela')) as HTMLIFrameElement
    await waitFor(() => expect(screen.getAllByRole('treeitem')).toHaveLength(2))
    return frame
  }

  it('lists the Tela’s Components in the Árvore, nested ones included', async () => {
    await renderWithTree()
    expect(rowFor('wa-card')).toBeTruthy()
    expect(rowFor('wa-button')).toBeTruthy()
  })

  it('highlights the row for the Component clicked on the palco', async () => {
    const frame = await renderWithTree()
    await waitFor(() => expect(frame.getAttribute('src')).toBeTruthy())
    const source = { postMessage: vi.fn() }
    Object.defineProperty(frame, 'contentWindow', { configurable: true, value: source })

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { type: 'selected', nonce: 'abc', componentId: 'n2' },
          source: source as unknown as Window
        })
      )
    })

    expect(rowFor('wa-button').getAttribute('aria-selected')).toBe('true')
    expect(rowFor('wa-card').getAttribute('aria-selected')).toBe('false')
  })

  it('sends the Árvore’s selection out to the palco, so the outline follows', async () => {
    const frame = await renderWithTree()
    await waitFor(() => expect(frame.getAttribute('src')).toBeTruthy())
    const posted: Record<string, unknown>[] = []
    Object.defineProperty(frame, 'contentWindow', {
      configurable: true,
      value: { postMessage: (message: Record<string, unknown>) => posted.push(message) }
    })
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { type: 'ready', nonce: 'abc' },
          source: frame.contentWindow as unknown as Window
        })
      )
    })

    fireEvent.click(rowFor('wa-button'))

    expect(rowFor('wa-button').getAttribute('aria-selected')).toBe('true')
    expect(posted).toContainEqual({ type: 'select', componentId: 'n2', nonce: 'abc' })
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

/**
 * design-studio T5.3 (DS-R6 AC-3/AC-4). The wiring between a control and the
 * document: one `SetProp` per change, in its own undo group, and a refusal that
 * changes nothing at all.
 *
 * The control driven here is the boolean Switch: it dispatches without a
 * debounce (R-6) and renders as a plain button, so what the test exercises is
 * the Studio's wiring rather than Radix's portal behaviour under jsdom.
 */
describe('DesignStudioViewer — editing a prop (T5.3)', () => {
  const BUTTON = {
    screenId: 'login',
    title: 'Login',
    root: { id: 'n1', tag: 'wa-button', props: { variant: 'neutral' }, children: [] }
  }

  async function renderSelected(dispatchResult?: unknown): Promise<void> {
    mockScreens(async () => oneScreen, BUTTON, dispatchResult)
    renderViewer()
    await screen.findByLabelText('Palco')
    await waitFor(() => expect(screen.getAllByRole('treeitem')).toHaveLength(1))
    fireEvent.click(screen.getAllByRole('treeitem')[0])
    await waitFor(() => expect(screen.getByRole('switch', { name: 'disabled' })).toBeTruthy())
  }

  it('dispatches exactly one SetProp, carrying one field, in its own group', async () => {
    await renderSelected()

    fireEvent.click(screen.getByRole('switch', { name: 'disabled' }))

    await waitFor(() => expect(bridge().dispatch).toHaveBeenCalledTimes(1))
    const [, screenId, , commands, groupId] = bridge().dispatch.mock.calls[0]
    expect(screenId).toBe('login')
    expect(commands).toEqual([{ type: 'SetProp', componentId: 'n1', key: 'disabled', value: true }])
    expect(typeof groupId).toBe('string')
  })

  it('offers the Inspetor only once a Component is selected', async () => {
    mockScreens(async () => oneScreen, BUTTON)
    renderViewer()
    await screen.findByLabelText('Palco')

    expect(screen.queryByRole('switch', { name: 'disabled' })).toBeNull()
    // T5.4: and says so, rather than leaving the column blank (DS-R6 AC-5).
    expect(screen.getByText('Nada selecionado')).toBeTruthy()
  })

  // T5.4 / §3.8: the empty state's way to the Árvore has to work in the bands
  // where the Árvore has no column — there it opens the drawer instead.
  it('sends the empty state to the Árvore drawer when the tree has no column', async () => {
    mockScreens(async () => oneScreen, BUTTON)
    renderViewer()
    await screen.findByLabelText('Palco')
    resizeTab(700)
    // Below 820px the Inspetor is a drawer too — that is where its empty state
    // is read, and where its way out to the Árvore has to work.
    fireEvent.click(screen.getByRole('button', { name: 'Abrir o Inspetor' }))

    fireEvent.click(screen.getByRole('button', { name: 'Escolher na Árvore' }))
    expect(screen.getByRole('complementary', { name: 'Árvore' })).toBeTruthy()
  })

  it('moves focus into the Árvore when it does have a column', async () => {
    mockScreens(async () => oneScreen, BUTTON)
    renderViewer()
    await screen.findByLabelText('Palco')
    resizeTab(1400)
    await waitFor(() => expect(screen.getAllByRole('treeitem')).toHaveLength(1))

    fireEvent.click(screen.getByRole('button', { name: 'Escolher na Árvore' }))
    expect(document.activeElement).toBe(screen.getAllByRole('treeitem')[0])
  })

  it('marks the Tela as edited only once the change has landed (DS-R4 AC-3)', async () => {
    await renderSelected()
    expect(screen.getByText('gerada automaticamente')).toBeTruthy()

    fireEvent.click(screen.getByRole('switch', { name: 'disabled' }))

    await waitFor(() => expect(screen.getByText('editada nesta sessão')).toBeTruthy())
  })

  it('renders a refusal in the Field and leaves the Tela unedited and unchanged', async () => {
    await renderSelected({
      kind: 'capability',
      componentId: 'n1',
      reason: '"disabled" espera um booleano.',
      attemptedValue: true
    })

    fireEvent.click(screen.getByRole('switch', { name: 'disabled' }))

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toBe('"disabled" espera um booleano.')
    )
    // Nothing landed: the Tela is still auto-generated and undo is still empty.
    expect(screen.getByText('gerada automaticamente')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Desfazer' }) as HTMLButtonElement).disabled).toBe(
      true
    )
  })
})
