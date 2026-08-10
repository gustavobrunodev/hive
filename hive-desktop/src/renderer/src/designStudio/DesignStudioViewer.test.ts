// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { DesignStudioViewer } from './DesignStudioViewer'
import { resetFocusHint } from './focusHint'
import type { ScreensResponse } from './screens'
import { documentKey } from './useScreenDocument'

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
  skillRuns.length = 0
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
      redo: vi.fn().mockResolvedValue(view),
      // T6.2: the Skill's stream, captured so the test drives the turn by hand.
      runSkill: vi.fn((request: unknown, onEvent: (event: unknown) => void) => {
        skillRuns.push({ request, emit: onEvent })
        return () => {}
      })
    }
  } as unknown as typeof window.hive
  return screens
}

/** Every Skill run the tab started, with its emitter (T6.2). */
const skillRuns: { request: unknown; emit: (event: unknown) => void }[] = []

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
 * design-studio T5.5/T5.6. The Árvore's structural edits, through the real
 * wiring: one grouped step per edit, the Tela marked edited only once it lands,
 * and the selection dropped with the Component it pointed at (DS-R7 AC-2/AC-5).
 */
describe('DesignStudioViewer — editing the structure from the Árvore (T5.6)', () => {
  function rowFor(tag: string): HTMLElement {
    const row = screen
      .getAllByRole('treeitem')
      .find((item) => item.querySelector('.hds-tree-label-text')?.textContent === tag)
    if (!row) throw new Error(`no row for ${tag}`)
    return row
  }

  async function renderSelectedButton(dispatchResult?: unknown): Promise<void> {
    mockScreens(async () => oneScreen, NESTED, dispatchResult)
    renderViewer()
    await screen.findByLabelText('Palco')
    await waitFor(() => expect(screen.getAllByRole('treeitem')).toHaveLength(2))
    fireEvent.click(rowFor('wa-button'))
  }

  it('dispatches one RemoveComponent, in its own undo group', async () => {
    await renderSelectedButton()

    fireEvent.click(screen.getByRole('button', { name: 'Remover' }))

    await waitFor(() => expect(bridge().dispatch).toHaveBeenCalledTimes(1))
    const [, , , commands, groupId] = bridge().dispatch.mock.calls[0]
    expect(commands).toEqual([{ type: 'RemoveComponent', componentId: 'n2' }])
    expect(typeof groupId).toBe('string')
  })

  it('drops the selection along with the Component it pointed at (DS-R7 AC-5)', async () => {
    await renderSelectedButton()
    expect(rowFor('wa-button').getAttribute('aria-selected')).toBe('true')

    fireEvent.click(screen.getByRole('button', { name: 'Remover' }))

    await waitFor(() => expect(rowFor('wa-button').getAttribute('aria-selected')).toBe('false'))
  })

  it('marks the Tela as edited once a structural change has landed (DS-R4 AC-3)', async () => {
    await renderSelectedButton()
    expect(screen.getByText('gerada automaticamente')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Remover' }))

    await waitFor(() => expect(screen.getByText('editada nesta sessão')).toBeTruthy())
  })

  it('shows a refused structural edit and leaves the Tela unedited', async () => {
    await renderSelectedButton({
      kind: 'capability',
      componentId: 'n2',
      reason: 'O Componente "wa-button" não está nesta Tela.'
    })

    fireEvent.click(screen.getByRole('button', { name: 'Remover' }))

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toBe(
        'O Componente "wa-button" não está nesta Tela.'
      )
    )
    expect(screen.getByText('gerada automaticamente')).toBeTruthy()
    expect(rowFor('wa-button').getAttribute('aria-selected')).toBe('true')
  })
})

/**
 * design-studio T5.7. The history keystrokes, and the Tela that has nothing in
 * it yet (DS-R9, DS-R7 / §3.10).
 *
 * The load-bearing half of the shortcut requirement is the *negative* one:
 * with the focus outside the tab, the keystroke belongs to whatever does have
 * focus, and this tab must not take it.
 */
describe('DesignStudioViewer — Ctrl+Z acts only inside the tab (T5.7)', () => {
  const BUTTON = {
    screenId: 'login',
    title: 'Login',
    root: { id: 'n1', tag: 'wa-button', props: {}, children: [] }
  }

  /** A Tela with something to undo, and the focus placed where the case needs it. */
  async function renderWithHistory(): Promise<void> {
    mockScreens(async () => oneScreen, BUTTON)
    const view = { document: BUTTON, canUndo: true, canRedo: true }
    bridge().view.mockResolvedValue(view)
    bridge().undo.mockResolvedValue(view)
    bridge().redo.mockResolvedValue(view)
    renderViewer()
    await screen.findByLabelText('Palco')
    await waitFor(() =>
      expect((screen.getByRole('button', { name: 'Desfazer' }) as HTMLButtonElement).disabled).toBe(
        false
      )
    )
  }

  it('undoes on Ctrl+Z when the focus is inside the tab', async () => {
    await renderWithHistory()
    screen.getAllByRole('treeitem')[0].focus()

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true })

    await waitFor(() => expect(bridge().undo).toHaveBeenCalledTimes(1))
    expect(bridge().redo).not.toHaveBeenCalled()
  })

  it('redoes on Ctrl+Shift+Z when the focus is inside the tab', async () => {
    await renderWithHistory()
    screen.getAllByRole('treeitem')[0].focus()

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true, shiftKey: true })

    await waitFor(() => expect(bridge().redo).toHaveBeenCalledTimes(1))
    expect(bridge().undo).not.toHaveBeenCalled()
  })

  it('does nothing at all when the focus is somewhere else in the app', async () => {
    await renderWithHistory()
    const outside = document.createElement('button')
    document.body.appendChild(outside)
    outside.focus()

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true })
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true, shiftKey: true })

    expect(bridge().undo).not.toHaveBeenCalled()
    expect(bridge().redo).not.toHaveBeenCalled()
    outside.remove()
  })

  it('leaves other keystrokes to whoever else wants them', async () => {
    await renderWithHistory()
    screen.getAllByRole('treeitem')[0].focus()

    fireEvent.keyDown(window, { key: 'z' })
    fireEvent.keyDown(window, { key: 'y', ctrlKey: true })

    expect(bridge().undo).not.toHaveBeenCalled()
    expect(bridge().redo).not.toHaveBeenCalled()
  })
})

describe('DesignStudioViewer — a Tela with no Components (T5.7, §3.10)', () => {
  it('teaches both ways to fill it instead of showing an empty device', async () => {
    mockScreens(async () => oneScreen)
    renderViewer()

    await screen.findByText('Esta Tela ainda não tem Componentes')
    expect(screen.getByRole('button', { name: 'Gerar com a Skill' })).toBeTruthy()
    expect(screen.queryByTitle('Preview da Tela')).toBeNull()
  })

  it('opens the Árvore’s own add picker from the stage’s action', async () => {
    mockScreens(async () => oneScreen)
    renderViewer()
    await screen.findByText('Esta Tela ainda não tem Componentes')
    resizeTab(1400)

    // Two "Adicionar Componente" buttons exist — the stage's and the Árvore's;
    // the stage's is the one inside the empty state.
    const stageAction = screen
      .getAllByRole('button', { name: 'Adicionar Componente' })
      .find((button) => button.closest('.wb-dstudio-empty') !== null)
    fireEvent.click(stageAction as HTMLElement)

    await waitFor(() => expect(screen.getByLabelText('Componente')).toBeTruthy())
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

/**
 * design-studio T6.2 — DS-R2. Generating a Tela from the Spec: the wait is
 * covered from the click, the result becomes ONE grouped step, and the failure
 * is a retry the user can actually press.
 */
describe('DesignStudioViewer — generating with the Skill (T6.2, DS-R2)', () => {
  async function startGeneration(): Promise<void> {
    mockScreens(async () => oneScreen)
    renderViewer()
    await screen.findByLabelText('Palco')
    fireEvent.click(screen.getByRole('button', { name: 'Gerar com a Skill' }))
  }

  it('asks for the active Tela of this Spec, and covers the wait immediately', async () => {
    await startGeneration()

    expect(skillRuns).toHaveLength(1)
    expect(skillRuns[0].request).toEqual({
      kind: 'generate',
      workspace: '/ws',
      specPath: 'docs/ux.md',
      screenTitle: 'Login'
    })
    expect(screen.getByRole('status').textContent).toBe('Lendo a Spec…')
    expect(screen.getByLabelText('A Skill está compondo esta Tela').getAttribute('aria-busy')).toBe(
      'true'
    )
  })

  it('follows the turn with a live status line rather than a silent gap', async () => {
    await startGeneration()

    act(() => skillRuns[0].emit({ type: 'status', phase: 'choosing' }))
    expect(screen.getByRole('status').textContent).toBe('Escolhendo Componentes…')
  })

  it('dispatches the whole batch as one grouped step and marks the Tela edited', async () => {
    await startGeneration()

    const commands = [
      {
        type: 'AddComponent',
        parentId: null,
        index: 0,
        node: { id: 'n1', tag: 'wa-card', props: {}, children: [] }
      },
      {
        type: 'AddComponent',
        parentId: 'n1',
        index: 0,
        node: { id: 'n2', tag: 'wa-button', props: {}, children: [] }
      }
    ]
    act(() => skillRuns[0].emit({ type: 'result', batch: { commands, message: 'pronto' } }))

    await waitFor(() => expect(bridge().dispatch).toHaveBeenCalledTimes(1))
    const call = bridge().dispatch.mock.calls[0]
    expect(call[3]).toEqual(commands)
    // One groupId for the whole turn — that is what makes it one undo step.
    expect(typeof call[4]).toBe('string')
    await waitFor(() => expect(screen.getByText('editada nesta sessão')).toBeTruthy())
  })

  it('stacks no undo step for a turn that emitted no Commands', async () => {
    await startGeneration()

    act(() =>
      skillRuns[0].emit({
        type: 'result',
        batch: { commands: [], message: 'O DS ativo não tem esse Componente.' }
      })
    )

    await waitFor(() => expect(screen.queryByRole('status')).toBeNull())
    expect(bridge().dispatch).not.toHaveBeenCalled()
  })

  it('shows a failed turn with a retry that actually re-runs it (DS-R17)', async () => {
    await startGeneration()

    act(() =>
      skillRuns[0].emit({
        type: 'failed',
        error: {
          kind: 'operation',
          scope: 'agent',
          message: 'O agente não está instalado.',
          retryable: true
        }
      })
    )

    expect(screen.getByText('A Skill não conseguiu gerar a Tela')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(skillRuns).toHaveLength(2)
    expect(skillRuns[1].request).toEqual(skillRuns[0].request)
  })
})

/**
 * design-studio T6.5 — DS-R10 and §3.7. The Chat strip inside the Bancada: the
 * selection becomes visible context, the ✕ releases it *without* dropping the
 * selection, and the request that goes out carries whichever of the two the
 * user left standing.
 */
describe('DesignStudioViewer — the Chat de Iteração (T6.5, DS-R10)', () => {
  async function renderWithChat(): Promise<void> {
    mockScreens(async () => oneScreen, NESTED)
    renderViewer()
    await screen.findByLabelText('Palco')
    await waitFor(() => expect(screen.getAllByRole('treeitem')).toHaveLength(2))
  }

  function selectButton(): void {
    const row = screen
      .getAllByRole('treeitem')
      .find((item) => item.querySelector('.hds-tree-label-text')?.textContent === 'wa-button')
    fireEvent.click(row!)
  }

  function ask(text: string): void {
    const input = screen.getByPlaceholderText('Escreva o que mudar…')
    fireEvent.change(input, { target: { value: text } })
    fireEvent.keyDown(input, { key: 'Enter' })
  }

  it('puts the Chat strip at the bottom of the Bancada, collapsed', async () => {
    await renderWithChat()

    expect(screen.getByRole('region', { name: 'Chat de Iteração desta Tela' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Abrir a conversa' })).toBeTruthy()
  })

  it('shows the selected Component as the request’s context', async () => {
    await renderWithChat()
    selectButton()

    expect(screen.getByText('no contexto: wa-button')).toBeTruthy()
  })

  it('sends the selected Component with the request (DS-R10 AC-1)', async () => {
    await renderWithChat()
    selectButton()

    ask('deixe mais discreto')

    expect(skillRuns).toHaveLength(1)
    expect(skillRuns[0].request).toEqual({
      kind: 'iterate',
      key: documentKey('/ws', 'docs/ux.md', 'login'),
      screenId: 'login',
      title: 'Login',
      message: 'deixe mais discreto',
      selectedComponentId: 'n2'
    })
  })

  it('sends no context when nothing is selected — the scope is the Tela', async () => {
    await renderWithChat()

    ask('acrescente um rodapé')

    expect(
      (skillRuns[0].request as { selectedComponentId: string | null }).selectedComponentId
    ).toBeNull()
  })

  it('the ✕ releases the context without dropping the selection', async () => {
    await renderWithChat()
    selectButton()

    fireEvent.click(
      screen.getByRole('button', { name: 'Soltar o contexto e falar da Tela inteira' })
    )
    ask('acrescente um rodapé')

    expect(screen.queryByText('no contexto: wa-button')).toBeNull()
    expect(
      (skillRuns[0].request as { selectedComponentId: string | null }).selectedComponentId
    ).toBeNull()
    // The Inspetor is still looking at the same Component: releasing the chat's
    // context is not a deselection.
    expect(
      screen.getAllByRole('treeitem').find((item) => item.getAttribute('aria-selected') === 'true')
    ).toBeTruthy()
  })

  it('shows the user’s own words immediately, before the agent answers', async () => {
    await renderWithChat()
    ask('acrescente um rodapé')
    fireEvent.click(screen.getByRole('button', { name: 'Abrir a conversa' }))

    expect(screen.getByText('acrescente um rodapé')).toBeTruthy()
  })

  it('adds the Skill’s answer to the transcript when the turn lands', async () => {
    await renderWithChat()
    ask('deixe mais discreto')

    act(() =>
      skillRuns[0].emit({
        type: 'result',
        batch: {
          commands: [{ type: 'SetProp', componentId: 'n2', key: 'variant', value: 'neutral' }],
          message: 'Deixei o botão neutro.'
        }
      })
    )
    fireEvent.click(screen.getByRole('button', { name: 'Abrir a conversa' }))

    await waitFor(() => expect(screen.getByText('Deixei o botão neutro.')).toBeTruthy())
  })
})

/**
 * design-studio T6.6 — DS-R9 AC-5/AC-6 and DS-R11 AC-4. A chat turn is ONE step
 * in the history: undoing it takes all N Commands back together, and the manual
 * edit that came before it is still there afterwards.
 *
 * The grouping is Phase 1's `groupId` mechanism, reused rather than rebuilt —
 * so what these tests prove is the *wiring*: one group id for the whole turn,
 * one step recorded, one undo offered on it.
 */
describe('DesignStudioViewer — a chat turn is one undo step (T6.6)', () => {
  const TURN = [
    { type: 'SetProp', componentId: 'n2', key: 'variant', value: 'neutral' },
    { type: 'SetProp', componentId: 'n2', key: 'disabled', value: true },
    {
      type: 'AddComponent',
      parentId: 'n1',
      index: 1,
      node: { id: 'n3', tag: 'wa-button', props: {}, children: [] }
    }
  ]

  async function landTurn(): Promise<void> {
    mockScreens(async () => oneScreen, NESTED)
    renderViewer()
    await screen.findByLabelText('Palco')
    await waitFor(() => expect(screen.getAllByRole('treeitem')).toHaveLength(2))

    const input = screen.getByPlaceholderText('Escreva o que mudar…')
    fireEvent.change(input, { target: { value: 'deixe o botão discreto' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    act(() =>
      skillRuns[0].emit({
        type: 'result',
        batch: { commands: TURN, message: 'Ajustei o botão.' }
      })
    )
    await waitFor(() => expect(bridge().dispatch).toHaveBeenCalled())
  }

  it('dispatches the three Commands under ONE group id', async () => {
    await landTurn()

    expect(bridge().dispatch).toHaveBeenCalledTimes(1)
    const [, , , commands, groupId] = bridge().dispatch.mock.calls[0]
    expect(commands).toEqual(TURN)
    expect(typeof groupId).toBe('string')
  })

  it('offers the whole turn back as one undo, and takes it', async () => {
    await landTurn()
    fireEvent.click(screen.getByRole('button', { name: 'Abrir a conversa' }))

    await waitFor(() => expect(screen.getByText('3 mudanças')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: /Desfazer este turno/ }))

    // One undo for the whole turn — never one per Command.
    await waitFor(() => expect(bridge().undo).toHaveBeenCalledTimes(1))
  })

  it('stops offering the turn undo once a manual edit lands on top of it', async () => {
    await landTurn()
    fireEvent.click(screen.getByRole('button', { name: 'Abrir a conversa' }))
    await waitFor(() => expect(screen.getByText('3 mudanças')).toBeTruthy())

    // A manual edit after the turn is a newer step: undoing "this turn" would
    // silently take that edit with it, so the affordance goes away (DS-R9 AC-6).
    const row = screen
      .getAllByRole('treeitem')
      .find((item) => item.querySelector('.hds-tree-label-text')?.textContent === 'wa-button')
    fireEvent.click(row!)
    fireEvent.click(screen.getByRole('button', { name: 'Remover' }))

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /Desfazer este turno/ })).toBeNull()
    )
    expect(screen.getByText('3 mudanças')).toBeTruthy()
  })

  it('outlines the nodes the turn changed, and never the one it removed', async () => {
    mockScreens(async () => oneScreen, NESTED)
    renderViewer()
    await screen.findByLabelText('Palco')
    await waitFor(() => expect(screen.getAllByRole('treeitem')).toHaveLength(2))

    const frame = (await screen.findByTitle('Preview da Tela')) as HTMLIFrameElement
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

    const input = screen.getByPlaceholderText('Escreva o que mudar…')
    fireEvent.change(input, { target: { value: 'troque o botão' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    act(() =>
      skillRuns[0].emit({
        type: 'result',
        batch: {
          commands: [
            { type: 'RemoveComponent', componentId: 'n2' },
            {
              type: 'AddComponent',
              parentId: 'n1',
              index: 0,
              node: { id: 'n9', tag: 'wa-button', props: {}, children: [] }
            }
          ],
          message: 'Troquei o botão.'
        }
      })
    )

    await waitFor(() =>
      expect(posted).toContainEqual(
        expect.objectContaining({ type: 'pulse', componentIds: ['n9'] })
      )
    )
  })
})

/**
 * design-studio T6.7 — DS-R10 AC-6/AC-7 and DS-R17. Two claims: a Tela keeps
 * its own conversation and gets it back, and a failed turn is reported where it
 * was asked for, with a retry that actually retries.
 */
describe('DesignStudioViewer — the transcript and the failed turn (T6.7)', () => {
  const TWO_SCREENS: ScreensResponse = {
    screens: [
      { screenId: 'login', title: 'Login', probe: 'screenHeading' },
      { screenId: 'cadastro', title: 'Cadastro', probe: 'screenHeading' }
    ],
    probed: ['screenHeading', 'iaTable']
  }

  function ask(text: string): void {
    const input = screen.getByPlaceholderText('Escreva o que mudar…')
    fireEvent.change(input, { target: { value: text } })
    fireEvent.keyDown(input, { key: 'Enter' })
  }

  /** Switches Tela from the list in the left column — the surface DS-R4 is about. */
  async function switchTo(title: string): Promise<void> {
    const list = screen.getByLabelText('Telas desta Spec')
    const entry = [...list.querySelectorAll('button')].find((button) =>
      button.textContent?.includes(title)
    )
    fireEvent.click(entry as Element)
    await waitFor(() => expect(entry?.getAttribute('aria-current')).toBe('true'))
  }

  it('keeps each Tela’s conversation to itself and gives it back on return (AC-7)', async () => {
    mockScreens(async () => TWO_SCREENS)
    renderViewer()
    await screen.findByLabelText('Palco')

    ask('deixe o botão discreto')
    fireEvent.click(screen.getByRole('button', { name: 'Abrir a conversa' }))
    expect(screen.getByText('deixe o botão discreto')).toBeTruthy()

    await switchTo('Cadastro')
    // Cadastro's conversation is its own — empty, not Login's.
    expect(screen.queryByText('deixe o botão discreto')).toBeNull()

    await switchTo('Login')
    await waitFor(() => expect(screen.getByText('deixe o botão discreto')).toBeTruthy())
  })

  it('reports a failed turn in the chat, not over the Preview (DS-R10 AC-6)', async () => {
    mockScreens(async () => oneScreen, NESTED)
    renderViewer()
    await screen.findByLabelText('Palco')
    ask('deixe o botão discreto')

    act(() =>
      skillRuns[0].emit({
        type: 'failed',
        error: {
          kind: 'operation',
          scope: 'agent',
          message: 'O agente não está instalado.',
          retryable: true
        }
      })
    )

    expect(screen.getByRole('alert').textContent).toContain('O agente não está instalado.')
    // The Preview is still on the stage: an iteration that failed does not take
    // the Tela away from the user.
    expect(screen.getByTitle('Preview da Tela')).toBeTruthy()
  })

  it('retries the very same request from the chat (DS-R17)', async () => {
    mockScreens(async () => oneScreen, NESTED)
    renderViewer()
    await screen.findByLabelText('Palco')
    ask('deixe o botão discreto')
    act(() =>
      skillRuns[0].emit({
        type: 'failed',
        error: { kind: 'operation', scope: 'agent', message: 'timeout', retryable: true }
      })
    )

    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))

    expect(skillRuns).toHaveLength(2)
    expect(skillRuns[1].request).toEqual(skillRuns[0].request)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('reports a refused batch in the chat as a capability limit, with no retry', async () => {
    mockScreens(async () => oneScreen, NESTED, {
      kind: 'capability',
      componentId: 'n2',
      reason: 'O valor "roxo" não existe em variant.'
    })
    renderViewer()
    await screen.findByLabelText('Palco')
    ask('deixe o botão roxo')

    act(() =>
      skillRuns[0].emit({
        type: 'result',
        batch: {
          commands: [{ type: 'SetProp', componentId: 'n2', key: 'variant', value: 'roxo' }],
          message: 'Pintei de roxo.'
        }
      })
    )

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain(
        'O valor "roxo" não existe em variant.'
      )
    )
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).toBeNull()
  })
})
