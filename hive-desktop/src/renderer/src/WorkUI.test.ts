// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

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
  Logo: () => createElement('span', { 'data-testid': 'logo' })
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

beforeEach(async () => {
  vi.stubGlobal('localStorage', createLocalStorageMock())
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
