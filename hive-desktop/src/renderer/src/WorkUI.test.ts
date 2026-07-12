// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createContext,
  createElement,
  useContext,
  isValidElement,
  cloneElement,
  type ReactElement,
  type ReactNode
} from 'react'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'

/**
 * Task T11 — resizable file-area divider + persistence (design.md §7,
 * UX-R6.1/6.2/6.3).
 *
 * `WorkUI` wraps its whole body in one DS `Resizable` group (rail/chat/
 * viewer panels keyed by stable `id`s) and persists the group's layout to
 * `localStorage['hive.workLayout']` via `onLayoutChanged`, restoring it on
 * mount via `defaultLayout`. This suite proves that persistence contract in
 * isolation from the real `react-resizable-panels` drag mechanics (covered
 * by the DS's own `Resizable.test.tsx` and by the Playwright MCP pass in
 * T14): `@hive/design-system` is mocked with a trivial stand-in that
 * captures the `defaultLayout` it was given and lets the test fire
 * `onLayoutChanged` directly, and `./explorer/Explorer` / `./chat/Chat` are
 * mocked to trivial markers (same approach as `App.test.ts` mocking
 * `WorkUI` itself) since this task only touches the layout wiring, not
 * those panes' own behavior.
 */

const resizableProps: {
  defaultLayout?: unknown
  onLayoutChanged?: (layout: Record<string, number>, meta: { isUserInteraction: boolean }) => void
} = {}

/** Minimal context bridge so the mocked `DropdownMenuTrigger` can toggle its sibling `DropdownMenu`'s open state — mirrors the same pattern already used in `explorer/Explorer.test.ts` (real Radix does this internally; nothing else here needs to know about it). */
const DropdownMenuMockCtx = createContext<{ onOpenChange?: (open: boolean) => void }>({})

vi.mock('@hive/design-system', () => ({
  Resizable: ({
    children,
    defaultLayout,
    onLayoutChanged
  }: {
    children?: ReactNode
    defaultLayout?: unknown
    onLayoutChanged?: (layout: Record<string, number>, meta: { isUserInteraction: boolean }) => void
  }) => {
    resizableProps.defaultLayout = defaultLayout
    resizableProps.onLayoutChanged = onLayoutChanged
    return createElement(
      'div',
      { 'data-testid': 'resizable' },
      createElement(
        'button',
        {
          type: 'button',
          'data-testid': 'simulate-drag',
          onClick: () =>
            onLayoutChanged?.({ rail: 30, chat: 45, viewer: 25 }, { isUserInteraction: true })
        },
        'drag'
      ),
      children
    )
  },
  ResizablePanel: ({
    children,
    id,
    ...rest
  }: {
    children?: ReactNode
    id?: string
    minSize?: number
    maxSize?: number
    defaultSize?: number
  }) => {
    // minSize/maxSize/defaultSize are DS-only sizing hints, not valid DOM attributes.
    delete rest.minSize
    delete rest.maxSize
    delete rest.defaultSize
    return createElement('div', { 'data-testid': `panel-${id}`, ...rest }, children)
  },
  ResizableHandle: ({ withGrip, ...rest }: { withGrip?: boolean }) => {
    // `withGrip` is a DS-only styling prop — not a valid DOM attribute.
    void withGrip
    return createElement('div', { role: 'separator', ...rest })
  },
  Logo: () => createElement('span', { 'data-testid': 'logo' }),
  DropdownMenu: ({
    onOpenChange,
    children
  }: {
    onOpenChange?: (open: boolean) => void
    children?: ReactNode
  }) => createElement(DropdownMenuMockCtx.Provider, { value: { onOpenChange } }, children),
  DropdownMenuTrigger: ({ children }: { children?: ReactNode }) => {
    const ctx = useContext(DropdownMenuMockCtx)
    if (!isValidElement(children)) return children
    const element = children as ReactElement<{ onClick?: (event: unknown) => void }>
    return cloneElement(element, {
      onClick: (event: unknown) => {
        element.props.onClick?.(event)
        ctx.onOpenChange?.(true)
      }
    })
  },
  DropdownMenuContent: ({ children }: { children?: ReactNode }) =>
    createElement('div', { role: 'menu' }, children),
  DropdownMenuItem: ({
    children,
    onSelect,
    title
  }: {
    children?: ReactNode
    onSelect?: () => void
    title?: string
  }) =>
    createElement(
      'button',
      { type: 'button', role: 'menuitem', title, onClick: () => onSelect?.() },
      children
    ),
  DropdownMenuLabel: ({ children }: { children?: ReactNode }) =>
    createElement('div', { role: 'presentation' }, children),
  DropdownMenuSeparator: () => createElement('hr')
}))

vi.mock('./explorer/Explorer', () => ({
  FileTree: ({ onOpenFile }: { onOpenFile?: (path: string) => void }) =>
    createElement(
      'button',
      { type: 'button', 'data-testid': 'file-tree', onClick: () => onOpenFile?.('README.md') },
      'FileTree'
    ),
  FileViewer: ({ path, onClose }: { path: string; onClose?: () => void }) =>
    createElement(
      'div',
      { 'data-testid': 'file-viewer' },
      `FileViewer: ${path}`,
      createElement(
        'button',
        { type: 'button', 'data-testid': 'close-viewer', onClick: () => onClose?.() },
        'close'
      )
    )
}))

vi.mock('./chat/Chat', () => ({
  Chat: () => createElement('div', { 'data-testid': 'chat' }, 'Chat')
}))

const STORAGE_KEY = 'hive.workLayout'

/** Minimal `Storage`-shaped mock with spy-wrapped `getItem`/`setItem` (per-test isolated, unlike jsdom's shared real localStorage). */
function createLocalStorageMock(): Storage {
  const store = new Map<string, string>()
  return {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value)
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key)
    }),
    clear: vi.fn(() => store.clear()),
    key: vi.fn((index: number) => Array.from(store.keys())[index] ?? null),
    get length() {
      return store.size
    }
  }
}

let WorkUI: typeof import('./WorkUI').WorkUI

/** Minimal `window.hive` bridge stand-in — this environment has no real main process, so `chooseWorkspace`/`getRecentWorkspaces` are spies the tests drive directly (mirrors `explorer/Explorer.test.ts`'s per-test `window.hive` mocking approach). */
function createHiveMock(): Window['hive'] {
  return {
    chooseWorkspace: vi.fn(async () => null),
    getRecentWorkspaces: vi.fn(async () => [])
  } as unknown as Window['hive']
}

beforeEach(async () => {
  vi.stubGlobal('localStorage', createLocalStorageMock())
  vi.stubGlobal('hive', createHiveMock())
  resizableProps.defaultLayout = undefined
  resizableProps.onLayoutChanged = undefined
  ;({ WorkUI } = await import('./WorkUI'))
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('WorkUI — resizable rail persistence (T11)', () => {
  it('reads no default layout when localStorage has no persisted value', () => {
    render(
      createElement(WorkUI, {
        workspace: '/home/user/my-workspace',
        theme: 'dark',
        onToggleTheme: vi.fn()
      })
    )

    expect(localStorage.getItem).toHaveBeenCalledWith(STORAGE_KEY)
    expect(resizableProps.defaultLayout).toBeUndefined()
  })

  it('restores a previously-persisted layout via defaultLayout on mount', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ rail: 18, chat: 57, viewer: 25 }))
    vi.mocked(localStorage.getItem).mockClear()

    render(
      createElement(WorkUI, {
        workspace: '/home/user/my-workspace',
        theme: 'dark',
        onToggleTheme: vi.fn()
      })
    )

    expect(localStorage.getItem).toHaveBeenCalledWith(STORAGE_KEY)
    expect(resizableProps.defaultLayout).toEqual({ rail: 18, chat: 57, viewer: 25 })
  })

  it('ignores a corrupt persisted value instead of crashing', () => {
    localStorage.setItem(STORAGE_KEY, '{not json')

    render(
      createElement(WorkUI, {
        workspace: '/home/user/my-workspace',
        theme: 'dark',
        onToggleTheme: vi.fn()
      })
    )

    expect(resizableProps.defaultLayout).toBeUndefined()
    expect(screen.getByTestId('resizable')).toBeTruthy()
  })

  it('ignores a persisted value whose shape is not a panel-id -> number map', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ rail: 'wide' }))

    render(
      createElement(WorkUI, {
        workspace: '/home/user/my-workspace',
        theme: 'dark',
        onToggleTheme: vi.fn()
      })
    )

    expect(resizableProps.defaultLayout).toBeUndefined()
  })

  it('persists the group layout to localStorage on onLayoutChanged', () => {
    render(
      createElement(WorkUI, {
        workspace: '/home/user/my-workspace',
        theme: 'dark',
        onToggleTheme: vi.fn()
      })
    )

    fireEvent.click(screen.getByTestId('simulate-drag'))

    expect(localStorage.setItem).toHaveBeenCalledWith(
      STORAGE_KEY,
      JSON.stringify({ rail: 30, chat: 45, viewer: 25 })
    )
  })

  it('renders rail and chat panels, and only mounts the viewer panel while a file is open', () => {
    render(
      createElement(WorkUI, {
        workspace: '/home/user/my-workspace',
        theme: 'dark',
        onToggleTheme: vi.fn()
      })
    )

    expect(screen.getByTestId('panel-rail')).toBeTruthy()
    expect(screen.getByTestId('panel-chat')).toBeTruthy()
    expect(screen.queryByTestId('panel-viewer')).toBeNull()

    fireEvent.click(screen.getByTestId('file-tree'))

    expect(screen.getByTestId('panel-viewer')).toBeTruthy()
    expect(screen.getByText('FileViewer: README.md')).toBeTruthy()
  })

  it('closes the viewer panel when the FileViewer reports onClose', () => {
    render(
      createElement(WorkUI, {
        workspace: '/home/user/my-workspace',
        theme: 'dark',
        onToggleTheme: vi.fn()
      })
    )

    fireEvent.click(screen.getByTestId('file-tree'))
    expect(screen.getByTestId('panel-viewer')).toBeTruthy()

    fireEvent.click(screen.getByTestId('close-viewer'))

    expect(screen.queryByTestId('panel-viewer')).toBeNull()
  })

  it('renders the light-theme toggle icon/label and forwards toggle clicks', () => {
    const onToggleTheme = vi.fn()
    render(
      createElement(WorkUI, {
        workspace: '/home/user/my-workspace',
        theme: 'light',
        onToggleTheme
      })
    )

    const toggle = screen.getByRole('button', { name: /tema/i })
    fireEvent.click(toggle)

    expect(onToggleTheme).toHaveBeenCalledTimes(1)
  })

  it('swallows a localStorage.setItem failure when persisting the layout', () => {
    render(
      createElement(WorkUI, {
        workspace: '/home/user/my-workspace',
        theme: 'dark',
        onToggleTheme: vi.fn()
      })
    )

    vi.mocked(localStorage.setItem).mockImplementation(() => {
      throw new Error('quota exceeded')
    })

    expect(() => fireEvent.click(screen.getByTestId('simulate-drag'))).not.toThrow()
  })
})

/**
 * Task T7 — workspace chip menu (design.md §5.1, WS-R1.1–R1.4/R7).
 *
 * The `wb-workspace-chip` becomes a DS `DropdownMenu` trigger: opening it
 * loads the MRU via `window.hive.getRecentWorkspaces()`, excludes the
 * active workspace (WS-R1.4), and omits the whole Recentes section when
 * nothing else is left (WS-R1.3). "Abrir pasta…" resolves a candidate via
 * `window.hive.chooseWorkspace()`; a recents entry resolves its own path.
 * Either way the candidate is only ever handed off via `onCandidateWorkspace`
 * — WorkUI does not perform the switch itself (that's T8's guard/pipeline).
 */
describe('WorkUI — workspace chip menu (T7)', () => {
  it('opens the menu on click and loads recents, excluding the active workspace', async () => {
    vi.mocked(window.hive.getRecentWorkspaces).mockResolvedValue([
      '/home/user/my-workspace',
      '/home/user/other-project',
      '/home/user/third-project'
    ])

    render(
      createElement(WorkUI, {
        workspace: '/home/user/my-workspace',
        theme: 'dark',
        onToggleTheme: vi.fn()
      })
    )

    fireEvent.click(screen.getByRole('button', { name: /workspace ativo/i }))

    expect(window.hive.getRecentWorkspaces).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.getByText('other-project')).toBeTruthy())
    const menu = within(screen.getByRole('menu'))
    expect(menu.getByText('other-project')).toBeTruthy()
    expect(menu.getByText('third-project')).toBeTruthy()
    // The active workspace's own name is only the chip's label — never
    // repeated inside the menu (WS-R1.4: never "switch" to where you are).
    expect(menu.queryByText('my-workspace')).toBeNull()
    expect(menu.getByText('Abrir pasta…')).toBeTruthy()
  })

  it('is a native <button> trigger, so it is keyboard-operable (Enter/Space) without bespoke key handling', async () => {
    vi.mocked(window.hive.getRecentWorkspaces).mockResolvedValue(['/home/user/other-project'])

    render(
      createElement(WorkUI, {
        workspace: '/home/user/my-workspace',
        theme: 'dark',
        onToggleTheme: vi.fn()
      })
    )

    const trigger = screen.getByRole('button', { name: /workspace ativo/i })
    // A real <button type="button"> gets Enter/Space activation for free from
    // the browser (jsdom doesn't simulate that dispatch, so this asserts the
    // semantics that make it true rather than re-simulating the browser):
    expect(trigger.tagName).toBe('BUTTON')
    expect(trigger.getAttribute('type')).toBe('button')

    trigger.focus()
    expect(document.activeElement).toBe(trigger)

    // Activating it (click — what a native button's Enter/Space collapses to)
    // opens the menu, same as a mouse click.
    fireEvent.click(trigger)
    await waitFor(() => expect(window.hive.getRecentWorkspaces).toHaveBeenCalled())
  })

  it('omits the Recentes section entirely when there are no other recent workspaces', async () => {
    vi.mocked(window.hive.getRecentWorkspaces).mockResolvedValue(['/home/user/my-workspace'])

    render(
      createElement(WorkUI, {
        workspace: '/home/user/my-workspace',
        theme: 'dark',
        onToggleTheme: vi.fn()
      })
    )

    fireEvent.click(screen.getByRole('button', { name: /workspace ativo/i }))

    await waitFor(() => expect(window.hive.getRecentWorkspaces).toHaveBeenCalled())
    expect(screen.getByText('Abrir pasta…')).toBeTruthy()
    expect(screen.queryByText('Recentes')).toBeNull()
  })

  it('"Abrir pasta…" invokes window.hive.chooseWorkspace and reports a picked candidate', async () => {
    vi.mocked(window.hive.getRecentWorkspaces).mockResolvedValue([])
    vi.mocked(window.hive.chooseWorkspace).mockResolvedValue('/home/user/picked-workspace')
    const onCandidateWorkspace = vi.fn()

    render(
      createElement(WorkUI, {
        workspace: '/home/user/my-workspace',
        theme: 'dark',
        onToggleTheme: vi.fn(),
        onCandidateWorkspace
      })
    )

    fireEvent.click(screen.getByRole('button', { name: /workspace ativo/i }))
    await waitFor(() => expect(window.hive.getRecentWorkspaces).toHaveBeenCalled())

    fireEvent.click(screen.getByText('Abrir pasta…'))

    expect(window.hive.chooseWorkspace).toHaveBeenCalledTimes(1)
    await waitFor(() =>
      expect(onCandidateWorkspace).toHaveBeenCalledWith('/home/user/picked-workspace')
    )
  })

  it('does not report a candidate when the native picker is cancelled', async () => {
    vi.mocked(window.hive.getRecentWorkspaces).mockResolvedValue([])
    vi.mocked(window.hive.chooseWorkspace).mockResolvedValue(null)
    const onCandidateWorkspace = vi.fn()

    render(
      createElement(WorkUI, {
        workspace: '/home/user/my-workspace',
        theme: 'dark',
        onToggleTheme: vi.fn(),
        onCandidateWorkspace
      })
    )

    fireEvent.click(screen.getByRole('button', { name: /workspace ativo/i }))
    await waitFor(() => expect(window.hive.getRecentWorkspaces).toHaveBeenCalled())
    fireEvent.click(screen.getByText('Abrir pasta…'))

    await waitFor(() => expect(window.hive.chooseWorkspace).toHaveBeenCalledTimes(1))
    expect(onCandidateWorkspace).not.toHaveBeenCalled()
  })

  it('selecting a recent entry invokes onCandidateWorkspace with its path', async () => {
    vi.mocked(window.hive.getRecentWorkspaces).mockResolvedValue([
      '/home/user/my-workspace',
      '/home/user/other-project'
    ])
    const onCandidateWorkspace = vi.fn()

    render(
      createElement(WorkUI, {
        workspace: '/home/user/my-workspace',
        theme: 'dark',
        onToggleTheme: vi.fn(),
        onCandidateWorkspace
      })
    )

    fireEvent.click(screen.getByRole('button', { name: /workspace ativo/i }))
    await waitFor(() => expect(screen.getByText('other-project')).toBeTruthy())

    fireEvent.click(screen.getByText('other-project'))

    expect(onCandidateWorkspace).toHaveBeenCalledWith('/home/user/other-project')
  })

  it('shows the full path as a tooltip on each recent entry', async () => {
    vi.mocked(window.hive.getRecentWorkspaces).mockResolvedValue([
      '/home/user/my-workspace',
      '/home/user/other-project'
    ])

    render(
      createElement(WorkUI, {
        workspace: '/home/user/my-workspace',
        theme: 'dark',
        onToggleTheme: vi.fn()
      })
    )

    fireEvent.click(screen.getByRole('button', { name: /workspace ativo/i }))

    const entry = await screen.findByText('other-project')
    expect(entry.closest('[title]')?.getAttribute('title')).toBe('/home/user/other-project')
  })

  it('tolerates a getRecentWorkspaces rejection by rendering an empty Recentes-less menu', async () => {
    vi.mocked(window.hive.getRecentWorkspaces).mockRejectedValue(new Error('ipc failure'))

    render(
      createElement(WorkUI, {
        workspace: '/home/user/my-workspace',
        theme: 'dark',
        onToggleTheme: vi.fn()
      })
    )

    fireEvent.click(screen.getByRole('button', { name: /workspace ativo/i }))

    await waitFor(() => expect(window.hive.getRecentWorkspaces).toHaveBeenCalled())
    expect(screen.getByText('Abrir pasta…')).toBeTruthy()
    expect(screen.queryByText('Recentes')).toBeNull()
  })
})
