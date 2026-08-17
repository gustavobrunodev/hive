// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createElement,
  createContext,
  useContext,
  useState,
  isValidElement,
  cloneElement,
  type ReactElement,
  type ReactNode
} from 'react'
import { cleanup, render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { FileTree, FileViewer } from './Explorer'
import { createHiveGitMock, createHiveReviewMock } from '../testSupport/hiveGitMock'
import { createHiveSecondBrainMock } from '../testSupport/hiveSecondBrainMock'
import { createHiveWhisperMock } from '../testSupport/hiveWhisperMock'
import { createHiveMcpLogsMock } from '../testSupport/hiveMcpLogsMock'

// jsdom lacks these observers, which the rich file viewers (image/pdf) use to
// measure their stage for fit-to-view. Stub them so opening a binary/rich file
// mounts its viewer instead of crashing.
class ObserverStub {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
  takeRecords = vi.fn(() => [])
}
vi.stubGlobal('ResizeObserver', ObserverStub)
vi.stubGlobal('IntersectionObserver', ObserverStub)

/**
 * Task T12 — Explorer + viewer UI (design.md §4, R5.1–R5.4).
 * Task T8 — create/rename/delete/move/import actions (design.md §4, FM-R1/
 * R3/R4/R5/R7/R6.2).
 *
 * Same mocking approach as App.test.ts (T6): `@hive/design-system` is
 * mocked with trivial DOM stand-ins (rendering its real bundle here would
 * load a second React instance from design-system's own node_modules and
 * crash on `Invalid hook call`), and `window.hive` is mocked entirely per
 * test since there's no real main process in this environment.
 *
 * `Explorer.tsx` now exports the tree and viewer as separate panes
 * (`FileTree`/`FileViewer`) wired together by `WorkUI` — the harness below
 * mirrors that wiring (open-file state lifted to the parent, viewer only
 * mounted while a file is open) so these tests keep exercising the same
 * R5.x behaviors end to end.
 *
 * The mocked `Tree` below is a real DOM flattening of the node hierarchy
 * (ignores expand/collapse — everything is always "visible") that, unlike
 * T12's original stand-in, actually calls the `renderLabel` render-prop —
 * T8's row content (icons, kebab menu, inline create/rename inputs, drag
 * handlers) all live inside `renderLabel`, so a mock that renders
 * `node.label` directly would never exercise any of it.
 */
function ExplorerHarness({
  workspace,
  onDirtyChange
}: {
  workspace: string
  onDirtyChange?: (dirty: boolean) => void
}): ReactNode {
  const [openPath, setOpenPath] = useState<string | null>(null)
  return createElement(
    'div',
    null,
    createElement(FileTree, { workspace, selectedPath: openPath, onOpenFile: setOpenPath }),
    openPath !== null
      ? createElement(FileViewer, {
          workspace,
          path: openPath,
          onClose: () => setOpenPath(null),
          onDirtyChange
        })
      : null
  )
}
interface MockTreeNode {
  id: string
  label: ReactNode
  children?: MockTreeNode[]
}

interface MockTreeRenderState {
  level: number
  expanded: boolean
  selected: boolean
  hasChildren: boolean
}

function flattenTreeNodes(nodes: MockTreeNode[]): MockTreeNode[] {
  return nodes.flatMap((node) => [node, ...(node.children ? flattenTreeNodes(node.children) : [])])
}

/** Minimal context bridge so the mocked `DropdownMenuTrigger` can toggle its sibling `DropdownMenu`'s open state — real Radix does this internally; nothing else here needs to know about it. */
const DropdownMenuMockCtx = createContext<{ onOpenChange?: (open: boolean) => void }>({})

/** Same bridge idea for the mocked right-click `ContextMenu`: the Trigger opens it on `contextmenu`, the Content only renders while open (mirrors Radix). */
const ContextMenuMockCtx = createContext<{ open: boolean; setOpen: (open: boolean) => void }>({
  open: false,
  setOpen: () => {}
})

vi.mock('@hive/design-system', () => ({
  Button: ({ children, ...rest }: { children?: ReactNode }) =>
    createElement('button', { type: 'button', ...rest }, children),
  Spinner: ({ label }: { label?: string }) => createElement('span', { role: 'status' }, label),
  Empty: ({ title, description }: { title?: ReactNode; description?: ReactNode }) =>
    createElement(
      'div',
      null,
      createElement('h2', null, title),
      description ? createElement('p', null, description) : null
    ),
  ScrollArea: ({ children, ...rest }: { children?: ReactNode }) =>
    createElement('div', rest, children),
  Tree: ({
    nodes,
    selectedIds,
    onSelectedIdsChange,
    renderLabel
  }: {
    nodes: MockTreeNode[]
    selectedIds?: string[]
    onSelectedIdsChange?: (ids: string[]) => void
    renderLabel?: (node: MockTreeNode, state: MockTreeRenderState) => ReactNode
  }) =>
    createElement(
      'div',
      { role: 'tree' },
      flattenTreeNodes(nodes).map((node) => {
        const hasChildren = Boolean(node.children && node.children.length > 0)
        const selected = Boolean(selectedIds?.includes(node.id))
        const state: MockTreeRenderState = {
          level: 1,
          expanded: true,
          selected,
          hasChildren
        }
        const content = renderLabel ? renderLabel(node, state) : node.label
        return createElement(
          'div',
          {
            key: node.id,
            role: 'treeitem',
            className: selected ? 'hds-tree-item-selected' : undefined,
            // Stand-in for T2's modifier-aware `Tree.activate` (real toggle
            // + range logic lives in the DS package, already covered by its
            // own test suite) — just enough here (Ctrl toggles membership;
            // Shift unions in, real range math not needed for T8's app-side
            // assertions) to exercise the "never open on a modifier click"
            // gating this mock's callers depend on.
            onClick: (event: { ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean }) => {
              const current = selectedIds ?? []
              if (event.ctrlKey || event.metaKey) {
                onSelectedIdsChange?.(
                  current.includes(node.id)
                    ? current.filter((id) => id !== node.id)
                    : [...current, node.id]
                )
                return
              }
              if (event.shiftKey) {
                onSelectedIdsChange?.(current.includes(node.id) ? current : [...current, node.id])
                return
              }
              onSelectedIdsChange?.([node.id])
            }
          },
          content
        )
      })
    ),
  CodeBlock: ({ children }: { children?: ReactNode }) =>
    createElement('pre', { 'data-testid': 'code-viewer' }, children),
  // Honours `onOpenChange` (via an explicit dismiss affordance) rather than
  // dropping it: Radix fires it on Escape and backdrop-click, and Explorer
  // relies on that to cancel a delete and to cancel a name conflict. Dropping
  // the prop made those dismissal paths unreachable from a test.
  Dialog: ({
    children,
    onOpenChange
  }: {
    children?: ReactNode
    onOpenChange?: (open: boolean) => void
  }) =>
    createElement(
      'div',
      { role: 'dialog' },
      children,
      createElement(
        'button',
        {
          type: 'button',
          'data-testid': 'dialog-dismiss',
          onClick: () => onOpenChange?.(false)
        },
        'dismiss'
      )
    ),
  DialogContent: ({ children }: { children?: ReactNode }) => createElement('div', null, children),
  DialogTitle: ({ children }: { children?: ReactNode }) => createElement('h2', null, children),
  DialogDescription: ({ children }: { children?: ReactNode }) => createElement('p', null, children),
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
  DropdownMenuItem: ({ children, onSelect }: { children?: ReactNode; onSelect?: () => void }) =>
    createElement(
      'button',
      { type: 'button', role: 'menuitem', onClick: () => onSelect?.() },
      children
    ),
  ContextMenu: ({ children }: { children?: ReactNode }) => {
    const [open, setOpen] = useState(false)
    return createElement(ContextMenuMockCtx.Provider, { value: { open, setOpen } }, children)
  },
  ContextMenuTrigger: ({ children }: { children?: ReactNode }) => {
    const ctx = useContext(ContextMenuMockCtx)
    if (!isValidElement(children)) return children
    const element = children as ReactElement<{ onContextMenu?: (event: unknown) => void }>
    return cloneElement(element, {
      onContextMenu: (event: unknown) => {
        element.props.onContextMenu?.(event)
        ctx.setOpen(true)
      }
    })
  },
  ContextMenuContent: ({ children }: { children?: ReactNode }) => {
    const ctx = useContext(ContextMenuMockCtx)
    return ctx.open ? createElement('div', { role: 'menu' }, children) : null
  },
  ContextMenuItem: ({ children, onSelect }: { children?: ReactNode; onSelect?: () => void }) => {
    const ctx = useContext(ContextMenuMockCtx)
    return createElement(
      'button',
      {
        type: 'button',
        role: 'menuitem',
        onClick: () => {
          ctx.setOpen(false)
          onSelect?.()
        }
      },
      children
    )
  },
  ContextMenuSeparator: () => createElement('hr')
}))

describe('Explorer (T12/T8)', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  const fixtureTree = [
    { name: 'a.txt', path: 'a.txt', type: 'file' as const },
    {
      name: 'docs',
      path: 'docs',
      type: 'directory' as const,
      children: [{ name: 'prd.md', path: 'docs/prd.md', type: 'file' as const }]
    }
  ]

  type WatchListener = Parameters<typeof window.hive.watchWorkspace>[1]

  function mockHive(overrides: Partial<typeof window.hive> = {}): {
    watchListeners: WatchListener[]
  } {
    const watchListeners: WatchListener[] = []
    const defaults: typeof window.hive = {
      platform: 'linux',
      ping: vi.fn().mockResolvedValue('pong'),
      chooseWorkspace: vi.fn().mockResolvedValue(null),
      openExternal: vi.fn().mockResolvedValue(undefined),
      getWorkspace: vi.fn().mockResolvedValue(null),
      isProvisioned: vi.fn().mockResolvedValue(false),
      provisionState: vi.fn().mockResolvedValue(false),
      getRecentWorkspaces: vi.fn().mockResolvedValue([]),
      openWorkspace: vi.fn().mockResolvedValue({ ok: false, reason: 'missing' }),
      listTree: vi.fn().mockResolvedValue(fixtureTree),
      listFiles: vi.fn().mockResolvedValue([]),
      readFile: vi.fn().mockResolvedValue('plain text content'),
      watchWorkspace: vi.fn((_root, onChange: WatchListener) => {
        watchListeners.push(onChange)
        return vi.fn()
      }),
      agent: {
        capabilities: vi
          .fn()
          .mockResolvedValue({ models: [], efforts: [], supportsAttachments: false }),
        chooseAttachments: vi.fn().mockResolvedValue([]),
        start: vi.fn().mockResolvedValue(undefined),
        send: vi.fn().mockResolvedValue(undefined),
        runWorkflow: vi.fn().mockResolvedValue(undefined),
        stop: vi.fn().mockResolvedValue(undefined),
        interrupt: vi.fn().mockResolvedValue(undefined),
        respondApproval: vi.fn().mockResolvedValue(undefined),
        onEvent: vi.fn().mockReturnValue(() => {})
      },
      installBmad: vi.fn().mockReturnValue(() => {}),
      updateBmad: vi.fn().mockReturnValue(() => {}),
      app: {
        info: vi
          .fn()
          .mockResolvedValue({ name: 'hive-desktop', version: '0.1.0', updatesSupported: false }),
        checkForUpdates: vi.fn().mockResolvedValue(undefined),
        downloadUpdate: vi.fn().mockResolvedValue(undefined),
        installUpdate: vi.fn().mockResolvedValue(undefined),
        cancelUpdate: vi.fn().mockResolvedValue(undefined),
        revealInstaller: vi.fn().mockResolvedValue(undefined),
        skipVersion: vi.fn().mockResolvedValue(undefined),
        onUpdateEvent: vi.fn().mockReturnValue(() => {})
      },
      workflows: { list: vi.fn().mockResolvedValue([]) },
      skills: { list: vi.fn().mockResolvedValue([]) },
      studio: { list: vi.fn().mockResolvedValue([]) },
      designStudio: {
        openPreview: vi.fn().mockResolvedValue('hive-studio://preview/x/index.html'),
        closePreview: vi.fn().mockResolvedValue(undefined),
        screens: vi.fn().mockResolvedValue({ screens: [], probed: [] }),
        catalog: vi.fn().mockResolvedValue({ dsId: 'ds', version: '0', components: [] }),
        view: vi.fn().mockResolvedValue({
          document: { screenId: '', title: '', root: null },
          canUndo: false,
          canRedo: false
        }),
        dispatch: vi.fn().mockResolvedValue({
          document: { screenId: '', title: '', root: null },
          canUndo: false,
          canRedo: false
        }),
        undo: vi.fn().mockResolvedValue({
          document: { screenId: '', title: '', root: null },
          canUndo: false,
          canRedo: false
        }),
        redo: vi.fn().mockResolvedValue({
          document: { screenId: '', title: '', root: null },
          canUndo: false,
          canRedo: false
        }),
        export: vi.fn().mockResolvedValue({ canceled: true, outDir: null, outcomes: [] }),
        runSkill: vi.fn().mockReturnValue(() => {})
      },
      mcp: {
        list: vi.fn().mockResolvedValue([]),
        add: vi.fn().mockResolvedValue(undefined),
        update: vi.fn().mockResolvedValue(undefined),
        remove: vi.fn().mockResolvedValue(undefined),
        setEnabled: vi.fn().mockResolvedValue(undefined),
        probe: vi.fn().mockResolvedValue({ ok: true, tools: [], logs: '', durationMs: 0 })
      },
      mcpLogs: createHiveMcpLogsMock(),
      chatHistory: {
        list: vi.fn().mockResolvedValue([]),
        get: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({
          id: '00000000-0000-4000-8000-000000000001',
          workspace: '/ws',
          agent: null,
          title: '',
          createdAt: 0,
          updatedAt: 0,
          messages: []
        }),
        append: vi.fn().mockResolvedValue(null),
        rename: vi.fn().mockResolvedValue(null),
        setCliSession: vi.fn().mockResolvedValue(undefined),
        search: vi.fn().mockResolvedValue([]),
        delete: vi.fn().mockResolvedValue(undefined)
      },
      // agent-terminal: the terminal picker's namespace — the sheet reads it on
      // open, so every full-bridge mock has to answer.
      shell: {
        list: vi.fn().mockResolvedValue({
          shells: [],
          selectedId: null,
          resolvedId: null,
          missingSelection: false
        }),
        select: vi.fn().mockResolvedValue(undefined)
      },
      profile: {
        agents: vi.fn().mockResolvedValue([]),
        getAgent: vi.fn().mockResolvedValue(null),
        setAgent: vi.fn().mockResolvedValue(undefined),
        getAgents: vi.fn().mockResolvedValue(['claude-cli']),
        setAgents: vi.fn().mockResolvedValue(undefined),
        getRole: vi.fn().mockResolvedValue(null),
        setRole: vi.fn().mockResolvedValue(undefined),
        getUserName: vi.fn().mockResolvedValue(null),
        setUserName: vi.fn().mockResolvedValue(undefined),
        roleActions: vi.fn().mockResolvedValue([]),
        installAgent: vi.fn(() => vi.fn())
      },
      shortcuts: {
        catalog: vi.fn().mockResolvedValue([]),
        get: vi.fn().mockResolvedValue(null),
        set: vi.fn().mockResolvedValue(undefined),
        actions: vi.fn().mockResolvedValue([])
      },
      fs: {
        statFile: vi.fn().mockResolvedValue({ mtimeMs: 1000, size: 19 }),
        readBinary: vi
          .fn()
          .mockResolvedValue({ base64: '', mime: 'application/octet-stream', size: 19 }),
        readDocx: vi.fn().mockResolvedValue({ html: '', warnings: [] }),
        readSheet: vi.fn().mockResolvedValue({ sheets: [] }),
        readSlides: vi.fn().mockResolvedValue({ title: null, slides: [] }),
        createFile: vi.fn().mockResolvedValue(undefined),
        createDirectory: vi.fn().mockResolvedValue(undefined),
        saveFile: vi.fn().mockResolvedValue({ mtimeMs: 2000, size: 19 }),
        move: vi.fn().mockResolvedValue(undefined),
        importEntry: vi.fn().mockResolvedValue(undefined),
        exists: vi.fn().mockResolvedValue(false),
        trash: vi.fn().mockResolvedValue(undefined),
        pathForFile: vi.fn().mockReturnValue('/abs/os/path/dropped.txt'),
        revealPath: vi.fn().mockResolvedValue(undefined),
        absolutePath: vi.fn((_root: string, rel: string) => Promise.resolve(`/ws/${rel}`))
      },
      git: createHiveGitMock(),
      review: createHiveReviewMock(),
      secondBrain: createHiveSecondBrainMock(),
      whisper: createHiveWhisperMock()
    }
    window.hive = Object.assign(defaults, overrides)
    return { watchListeners }
  }

  beforeEach(() => {
    mockHive()
  })

  it('renders the tree fetched via listTree()', async () => {
    render(createElement(ExplorerHarness, { workspace: '/ws' }))

    expect(await screen.findByText('a.txt')).toBeTruthy()
    expect(await screen.findByText('docs')).toBeTruthy()
    expect(await screen.findByText('prd.md')).toBeTruthy()
    expect(window.hive.listTree).toHaveBeenCalledWith('/ws')
  })

  it('clicking a tree file calls readFile() and shows its content in the viewer', async () => {
    mockHive({ readFile: vi.fn().mockResolvedValue('plain text content') })

    render(createElement(ExplorerHarness, { workspace: '/ws' }))

    const fileButton = await screen.findByText('a.txt')
    fireEvent.click(fileButton)

    expect(window.hive.readFile).toHaveBeenCalledWith('/ws', 'a.txt')
    const textarea = (await screen.findByLabelText('Conteúdo do arquivo')) as HTMLTextAreaElement
    expect(textarea.value).toBe('plain text content')
  })

  it('toggling a .md file to preview renders it readably (not as a raw code block)', async () => {
    mockHive({ readFile: vi.fn().mockResolvedValue('# Título\n\nUm parágrafo.') })

    render(createElement(ExplorerHarness, { workspace: '/ws' }))

    const mdButton = await screen.findByText('prd.md')
    fireEvent.click(mdButton)
    fireEvent.click(await screen.findByRole('button', { name: 'Visualizar' }))

    const markdownViewer = await screen.findByTestId('markdown-viewer')
    expect(markdownViewer.querySelector('h1')?.textContent).toBe('Título')
    expect(markdownViewer.querySelector('p')?.textContent).toBe('Um parágrafo.')
    expect(screen.queryByTestId('code-viewer')).toBeNull()
  })

  it('refetches the tree when the watcher reports a change (new file visible without manual reload)', async () => {
    const { watchListeners } = mockHive()

    render(createElement(ExplorerHarness, { workspace: '/ws' }))

    await screen.findByText('a.txt')
    expect(window.hive.listTree).toHaveBeenCalledTimes(1)

    expect(watchListeners).toHaveLength(1)
    watchListeners[0]({ type: 'add', path: 'new-file.txt' })

    await waitFor(() => {
      expect(window.hive.listTree).toHaveBeenCalledTimes(2)
    })
  })

  it('unsubscribes the watcher on unmount', async () => {
    const unsubscribe = vi.fn()
    mockHive({ watchWorkspace: vi.fn().mockReturnValue(unsubscribe) })

    const { unmount } = render(createElement(ExplorerHarness, { workspace: '/ws' }))
    await screen.findByText('a.txt')

    unmount()

    expect(unsubscribe).toHaveBeenCalled()
  })

  // --- T8: multi-select wiring (UX-R3.2/R4.2) -------------------------------

  it('Ctrl-clicking builds a selection set without ever opening the viewer', async () => {
    mockHive()
    render(createElement(ExplorerHarness, { workspace: '/ws' }))

    const aRow = (await screen.findByText('a.txt')).closest('[role="treeitem"]') as HTMLElement
    const prdRow = (await screen.findByText('prd.md')).closest('[role="treeitem"]') as HTMLElement

    fireEvent.click(aRow, { ctrlKey: true })
    fireEvent.click(prdRow, { ctrlKey: true })

    expect(window.hive.readFile).not.toHaveBeenCalled()
    expect(aRow.className).toContain('hds-tree-item-selected')
    expect(prdRow.className).toContain('hds-tree-item-selected')
  })

  it('a plain click on a single file still opens the viewer (multi-select mode unchanged for the base case)', async () => {
    mockHive()
    render(createElement(ExplorerHarness, { workspace: '/ws' }))

    const aRow = (await screen.findByText('a.txt')).closest('[role="treeitem"]') as HTMLElement
    fireEvent.click(aRow)

    expect(window.hive.readFile).toHaveBeenCalledWith('/ws', 'a.txt')
    expect(aRow.className).toContain('hds-tree-item-selected')
  })

  it('Ctrl-clicking down to exactly one remaining file does NOT open the viewer', async () => {
    mockHive()
    render(createElement(ExplorerHarness, { workspace: '/ws' }))

    const aRow = (await screen.findByText('a.txt')).closest('[role="treeitem"]') as HTMLElement
    const prdRow = (await screen.findByText('prd.md')).closest('[role="treeitem"]') as HTMLElement

    fireEvent.click(aRow, { ctrlKey: true })
    fireEvent.click(prdRow, { ctrlKey: true })
    // Deselect a.txt again, leaving prd.md as the sole remaining selection —
    // this must never pop the viewer open, unlike a plain click landing on
    // prd.md directly.
    fireEvent.click(aRow, { ctrlKey: true })

    expect(window.hive.readFile).not.toHaveBeenCalled()
    expect(aRow.className).not.toContain('hds-tree-item-selected')
    expect(prdRow.className).toContain('hds-tree-item-selected')
  })

  // P0-011 (R-03): the delete confirmation's plural wording. Every existing
  // delete test deletes one item, so the dialog only ever rendered the
  // singular "\"nome\" será movido…" arm. On a bulk selection that copy would
  // name one file while the action trashes several — the user confirms a
  // destructive operation on the strength of a sentence that understates it.
  it('deleting a multi-selection confirms with the plural wording and trashes every item', async () => {
    mockHive()
    render(createElement(ExplorerHarness, { workspace: '/ws' }))

    const aRow = (await screen.findByText('a.txt')).closest('[role="treeitem"]') as HTMLElement
    const prdRow = (await screen.findByText('prd.md')).closest('[role="treeitem"]') as HTMLElement
    fireEvent.click(aRow, { ctrlKey: true })
    fireEvent.click(prdRow, { ctrlKey: true })

    fireEvent.contextMenu(screen.getByText('a.txt').closest('.wb-tree-row-content') as HTMLElement)
    fireEvent.click(await screen.findByRole('menuitem', { name: /Excluir/ }))

    const dialog = await screen.findByRole('dialog')
    expect(dialog.textContent).toContain('2 itens serão movidos')

    fireEvent.click(screen.getByRole('button', { name: 'Mover para a lixeira' }))
    await waitFor(() => {
      expect(window.hive.fs.trash).toHaveBeenCalledTimes(2)
    })
  })

  it('a plain click on a directory still sets activeDirPath and never opens the viewer', async () => {
    mockHive()
    render(createElement(ExplorerHarness, { workspace: '/ws' }))

    const docsRow = (await screen.findByText('docs')).closest('[role="treeitem"]') as HTMLElement
    fireEvent.click(docsRow)

    expect(window.hive.readFile).not.toHaveBeenCalled()

    // Sanity-checks the activeDirPath side effect (existing behavior,
    // unrelated to file multi-select): the toolbar's "New file" action now
    // targets the clicked directory instead of the workspace root.
    fireEvent.click(screen.getByRole('button', { name: 'Novo arquivo' }))
    const input = await screen.findByPlaceholderText('Nome do arquivo ou pasta')
    fireEvent.change(input, { target: { value: 'targeted.txt' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(window.hive.fs.createFile).toHaveBeenCalledWith('/ws', 'docs/targeted.txt', undefined)
    })
  })

  it('a tree refresh drops a since-deleted path from the selection (a later same-named file is not phantom-preselected)', async () => {
    const fixtureWithB = [
      { name: 'a.txt', path: 'a.txt', type: 'file' as const },
      { name: 'b.txt', path: 'b.txt', type: 'file' as const }
    ]
    const fixtureWithoutB = [{ name: 'a.txt', path: 'a.txt', type: 'file' as const }]
    const fixtureWithNewB = [
      { name: 'a.txt', path: 'a.txt', type: 'file' as const },
      { name: 'b.txt', path: 'b.txt', type: 'file' as const }
    ]
    const listTree = vi
      .fn()
      .mockResolvedValueOnce(fixtureWithB)
      .mockResolvedValueOnce(fixtureWithoutB)
      .mockResolvedValueOnce(fixtureWithNewB)
    const { watchListeners } = mockHive({ listTree })

    render(createElement(ExplorerHarness, { workspace: '/ws' }))

    const bRow = (await screen.findByText('b.txt')).closest('[role="treeitem"]') as HTMLElement
    fireEvent.click(bRow, { ctrlKey: true })
    expect(bRow.className).toContain('hds-tree-item-selected')

    // b.txt is deleted — the watcher fires and the tree refetches without it.
    watchListeners[0]({ type: 'unlink', path: 'b.txt' })
    await waitFor(() => {
      expect(screen.queryByText('b.txt')).toBeNull()
    })

    // A new file happens to be created with the exact same path — the
    // watcher fires again and it reappears. If the earlier selection wasn't
    // reconciled, the stale 'b.txt' id would still linger in the set and
    // this brand-new row would render pre-selected without ever being
    // clicked.
    watchListeners[0]({ type: 'add', path: 'b.txt' })
    const newBRow = (await screen.findByText('b.txt')).closest('[role="treeitem"]') as HTMLElement
    expect(newBRow.className).not.toContain('hds-tree-item-selected')
  })

  // --- T8: create -----------------------------------------------------------

  it('"New file" creates an item at the workspace root via createFile', async () => {
    render(createElement(ExplorerHarness, { workspace: '/ws' }))
    await screen.findByText('a.txt')

    fireEvent.click(screen.getByRole('button', { name: 'Novo arquivo' }))
    const input = await screen.findByPlaceholderText('Nome do arquivo ou pasta')
    fireEvent.change(input, { target: { value: 'notes.txt' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(window.hive.fs.createFile).toHaveBeenCalledWith('/ws', 'notes.txt', undefined)
    })
  })

  it('"New folder" creates a directory at the workspace root via createDirectory', async () => {
    render(createElement(ExplorerHarness, { workspace: '/ws' }))
    await screen.findByText('a.txt')

    fireEvent.click(screen.getByRole('button', { name: 'Nova pasta' }))
    const input = await screen.findByPlaceholderText('Nome do arquivo ou pasta')
    fireEvent.change(input, { target: { value: 'assets' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(window.hive.fs.createDirectory).toHaveBeenCalledWith('/ws', 'assets')
    })
  })

  it('Esc cancels the inline create input without calling createFile', async () => {
    render(createElement(ExplorerHarness, { workspace: '/ws' }))
    await screen.findByText('a.txt')

    fireEvent.click(screen.getByRole('button', { name: 'Novo arquivo' }))
    const input = await screen.findByPlaceholderText('Nome do arquivo ou pasta')
    fireEvent.change(input, { target: { value: 'discarded.txt' } })
    fireEvent.keyDown(input, { key: 'Escape' })

    await waitFor(() => {
      expect(screen.queryByPlaceholderText('Nome do arquivo ou pasta')).toBeNull()
    })
    expect(window.hive.fs.createFile).not.toHaveBeenCalled()
  })

  // --- T8: rename -------------------------------------------------------------

  it('renaming a row via the row menu calls fs.move(root, old, newInSameDir)', async () => {
    render(createElement(ExplorerHarness, { workspace: '/ws' }))
    await screen.findByText('a.txt')

    fireEvent.click(screen.getByLabelText(/Mais ações para a\.txt/))
    fireEvent.click(await screen.findByRole('menuitem', { name: /Renomear/ }))

    const input = await screen.findByPlaceholderText('Novo nome')
    expect((input as HTMLInputElement).value).toBe('a.txt')
    fireEvent.change(input, { target: { value: 'b.txt' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(window.hive.fs.move).toHaveBeenCalledWith('/ws', 'a.txt', 'b.txt')
    })
  })

  // --- T8: delete ---------------------------------------------------------

  it('deleting a row opens a confirm dialog and only calls fs.trash on confirm', async () => {
    render(createElement(ExplorerHarness, { workspace: '/ws' }))
    await screen.findByText('a.txt')

    fireEvent.click(screen.getByLabelText(/Mais ações para a\.txt/))
    fireEvent.click(await screen.findByRole('menuitem', { name: /Excluir/ }))

    const dialog = await screen.findByRole('dialog')
    expect(dialog.textContent).toContain('Mover para a Lixeira?')
    expect(window.hive.fs.trash).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Mover para a lixeira' }))

    await waitFor(() => {
      expect(window.hive.fs.trash).toHaveBeenCalledWith('/ws', 'a.txt')
    })
  })

  // --- T9: bulk delete (design.md §4 "Bulk delete", UX-R5.1/R5.3, context.md C3) --

  it('deleting from a 3-item selection shows one dialog naming the count and trashes all 3 on confirm', async () => {
    render(createElement(ExplorerHarness, { workspace: '/ws' }))
    await screen.findByText('a.txt')

    const aRow = (await screen.findByText('a.txt')).closest('[role="treeitem"]') as HTMLElement
    const docsRow = (await screen.findByText('docs')).closest('[role="treeitem"]') as HTMLElement
    const prdRow = (await screen.findByText('prd.md')).closest('[role="treeitem"]') as HTMLElement

    fireEvent.click(aRow, { ctrlKey: true })
    fireEvent.click(docsRow, { ctrlKey: true })
    fireEvent.click(prdRow, { ctrlKey: true })

    fireEvent.click(screen.getByLabelText(/Mais ações para a\.txt/))
    fireEvent.click(await screen.findByRole('menuitem', { name: /Excluir/ }))

    // Exactly one confirm dialog, naming the count.
    const dialog = await screen.findByRole('dialog')
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    expect(dialog.textContent).toContain('3')
    expect(window.hive.fs.trash).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Mover para a lixeira' }))

    await waitFor(() => {
      expect(window.hive.fs.trash).toHaveBeenCalledTimes(3)
    })
    expect(window.hive.fs.trash).toHaveBeenCalledWith('/ws', 'a.txt')
    expect(window.hive.fs.trash).toHaveBeenCalledWith('/ws', 'docs')
    expect(window.hive.fs.trash).toHaveBeenCalledWith('/ws', 'docs/prd.md')

    // Selection is cleared after the bulk op completes — the previously
    // multi-selected rows no longer carry the DS Tree's selected styling.
    await waitFor(() => {
      expect(aRow.className).not.toContain('hds-tree-item-selected')
      expect(docsRow.className).not.toContain('hds-tree-item-selected')
      expect(prdRow.className).not.toContain('hds-tree-item-selected')
    })
  })

  it('one failing item in a bulk delete does not abort the other trash calls', async () => {
    window.hive.fs.trash = vi
      .fn()
      .mockImplementation((_root: string, target: string) =>
        target === 'docs'
          ? Promise.reject(new Error('cannot trash docs'))
          : Promise.resolve(undefined)
      )

    render(createElement(ExplorerHarness, { workspace: '/ws' }))
    await screen.findByText('a.txt')

    const aRow = (await screen.findByText('a.txt')).closest('[role="treeitem"]') as HTMLElement
    const docsRow = (await screen.findByText('docs')).closest('[role="treeitem"]') as HTMLElement
    const prdRow = (await screen.findByText('prd.md')).closest('[role="treeitem"]') as HTMLElement

    fireEvent.click(aRow, { ctrlKey: true })
    fireEvent.click(docsRow, { ctrlKey: true })
    fireEvent.click(prdRow, { ctrlKey: true })

    fireEvent.click(screen.getByLabelText(/Mais ações para a\.txt/))
    fireEvent.click(await screen.findByRole('menuitem', { name: /Excluir/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Mover para a lixeira' }))

    // All 3 items still get a trash call — the 'docs' rejection doesn't
    // short-circuit the batch.
    await waitFor(() => {
      expect(window.hive.fs.trash).toHaveBeenCalledTimes(3)
    })
    expect(window.hive.fs.trash).toHaveBeenCalledWith('/ws', 'a.txt')
    expect(window.hive.fs.trash).toHaveBeenCalledWith('/ws', 'docs')
    expect(window.hive.fs.trash).toHaveBeenCalledWith('/ws', 'docs/prd.md')

    // The per-item failure still surfaces the generic action-error banner.
    await screen.findByText('Não foi possível concluir a ação. Tente novamente.')

    // ...but the bulk op still completes: refresh fires and selection clears.
    await waitFor(() => {
      expect(aRow.className).not.toContain('hds-tree-item-selected')
    })
  })

  it('a single-selection delete (<=1) keeps the old single-item confirm wording and behavior', async () => {
    render(createElement(ExplorerHarness, { workspace: '/ws' }))
    await screen.findByText('a.txt')

    fireEvent.click(screen.getByLabelText(/Mais ações para a\.txt/))
    fireEvent.click(await screen.findByRole('menuitem', { name: /Excluir/ }))

    const dialog = await screen.findByRole('dialog')
    expect(dialog.textContent).toContain(
      '"a.txt" será movido para a lixeira do sistema. Você pode recuperá-lo por lá.'
    )

    fireEvent.click(screen.getByRole('button', { name: 'Mover para a lixeira' }))

    await waitFor(() => {
      expect(window.hive.fs.trash).toHaveBeenCalledTimes(1)
    })
    expect(window.hive.fs.trash).toHaveBeenCalledWith('/ws', 'a.txt')
  })

  // --- T8: internal drag-and-drop move (FM-R4.2) ---------------------------

  it('dragging a file row onto a folder row calls fs.move into that folder', async () => {
    render(createElement(ExplorerHarness, { workspace: '/ws' }))
    await screen.findByText('a.txt')

    const sourceRow = screen.getByText('a.txt').closest('.wb-tree-row-content') as HTMLElement
    const targetRow = screen.getByText('docs').closest('.wb-tree-row-content') as HTMLElement
    const dataTransfer = { setData: vi.fn(), effectAllowed: '', files: [] as File[] }

    fireEvent.dragStart(sourceRow, { dataTransfer })
    fireEvent.dragOver(targetRow, { dataTransfer })
    fireEvent.drop(targetRow, { dataTransfer })

    await waitFor(() => {
      expect(window.hive.fs.move).toHaveBeenCalledWith('/ws', 'a.txt', 'docs/a.txt')
    })
  })

  // --- T10: bulk drag-move (design.md §4 "Bulk move", UX-R5.2/R5.3) --------

  const bulkDragTree = [
    { name: 'a.txt', path: 'a.txt', type: 'file' as const },
    { name: 'b.txt', path: 'b.txt', type: 'file' as const },
    {
      name: 'docs',
      path: 'docs',
      type: 'directory' as const,
      children: [{ name: 'prd.md', path: 'docs/prd.md', type: 'file' as const }]
    },
    { name: 'other', path: 'other', type: 'directory' as const, children: [] }
  ]

  it('dragging one row out of a 3-item selection moves the whole selection (one fs.move call per item)', async () => {
    mockHive({ listTree: vi.fn().mockResolvedValue(bulkDragTree) })
    render(createElement(ExplorerHarness, { workspace: '/ws' }))
    await screen.findByText('a.txt')

    const aRow = (await screen.findByText('a.txt')).closest('[role="treeitem"]') as HTMLElement
    const bRow = (await screen.findByText('b.txt')).closest('[role="treeitem"]') as HTMLElement
    const prdRow = (await screen.findByText('prd.md')).closest('[role="treeitem"]') as HTMLElement
    fireEvent.click(aRow, { ctrlKey: true })
    fireEvent.click(bRow, { ctrlKey: true })
    fireEvent.click(prdRow, { ctrlKey: true })

    const sourceRow = screen.getByText('a.txt').closest('.wb-tree-row-content') as HTMLElement
    const targetRow = screen.getByText('other').closest('.wb-tree-row-content') as HTMLElement
    const dataTransfer = { setData: vi.fn(), effectAllowed: '', files: [] as File[] }

    fireEvent.dragStart(sourceRow, { dataTransfer })
    fireEvent.dragOver(targetRow, { dataTransfer })
    fireEvent.drop(targetRow, { dataTransfer })

    await waitFor(() => {
      expect(window.hive.fs.move).toHaveBeenCalledTimes(3)
    })
    expect(window.hive.fs.move).toHaveBeenCalledWith('/ws', 'a.txt', 'other/a.txt')
    expect(window.hive.fs.move).toHaveBeenCalledWith('/ws', 'b.txt', 'other/b.txt')
    expect(window.hive.fs.move).toHaveBeenCalledWith('/ws', 'docs/prd.md', 'other/prd.md')
  })

  // chat-attachments: a tree drag also carries the workspace-file MIME so the
  // chat composer can accept the row as a context file — files only.
  it('dragStart writes the workspace-file drag payload with files only (directories filtered out)', async () => {
    mockHive({ listTree: vi.fn().mockResolvedValue(bulkDragTree) })
    render(createElement(ExplorerHarness, { workspace: '/ws' }))
    await screen.findByText('a.txt')

    const aRow = (await screen.findByText('a.txt')).closest('[role="treeitem"]') as HTMLElement
    const docsRow = (await screen.findByText('docs')).closest('[role="treeitem"]') as HTMLElement
    fireEvent.click(aRow, { ctrlKey: true })
    fireEvent.click(docsRow, { ctrlKey: true })

    const sourceRow = screen.getByText('a.txt').closest('.wb-tree-row-content') as HTMLElement
    const dataTransfer = { setData: vi.fn(), effectAllowed: '', files: [] as File[] }
    fireEvent.dragStart(sourceRow, { dataTransfer })

    expect(dataTransfer.setData).toHaveBeenCalledWith(
      'application/x-hive-workspace-file',
      JSON.stringify(['a.txt'])
    )
  })

  it('dragging a row NOT in the current selection moves only that row and resets the selection to it', async () => {
    mockHive({ listTree: vi.fn().mockResolvedValue(bulkDragTree) })
    render(createElement(ExplorerHarness, { workspace: '/ws' }))
    await screen.findByText('a.txt')

    const aRow = (await screen.findByText('a.txt')).closest('[role="treeitem"]') as HTMLElement
    const bRow = (await screen.findByText('b.txt')).closest('[role="treeitem"]') as HTMLElement
    const prdRow = (await screen.findByText('prd.md')).closest('[role="treeitem"]') as HTMLElement
    fireEvent.click(aRow, { ctrlKey: true })
    fireEvent.click(bRow, { ctrlKey: true })

    const sourceRow = screen.getByText('prd.md').closest('.wb-tree-row-content') as HTMLElement
    const targetRow = screen.getByText('other').closest('.wb-tree-row-content') as HTMLElement
    const dataTransfer = { setData: vi.fn(), effectAllowed: '', files: [] as File[] }

    fireEvent.dragStart(sourceRow, { dataTransfer })

    // Dragging an unselected row resets the selection to just it — the
    // stale a.txt/b.txt selection must not ride along.
    expect(aRow.className).not.toContain('hds-tree-item-selected')
    expect(bRow.className).not.toContain('hds-tree-item-selected')
    expect(prdRow.className).toContain('hds-tree-item-selected')

    fireEvent.dragOver(targetRow, { dataTransfer })
    fireEvent.drop(targetRow, { dataTransfer })

    await waitFor(() => {
      expect(window.hive.fs.move).toHaveBeenCalledTimes(1)
    })
    expect(window.hive.fs.move).toHaveBeenCalledWith('/ws', 'docs/prd.md', 'other/prd.md')
  })

  it('a self/descendant drop target is skipped for that item only — the rest of the batch still moves', async () => {
    mockHive({ listTree: vi.fn().mockResolvedValue(bulkDragTree) })
    render(createElement(ExplorerHarness, { workspace: '/ws' }))
    await screen.findByText('a.txt')

    const aRow = (await screen.findByText('a.txt')).closest('[role="treeitem"]') as HTMLElement
    const docsRow = (await screen.findByText('docs')).closest('[role="treeitem"]') as HTMLElement
    fireEvent.click(aRow, { ctrlKey: true })
    fireEvent.click(docsRow, { ctrlKey: true })

    // Drop target is a row *inside* docs (docs/prd.md) — its containing
    // folder is 'docs' itself, a self/descendant hit for the 'docs' item in
    // the batch (but not for 'a.txt').
    const sourceRow = screen.getByText('a.txt').closest('.wb-tree-row-content') as HTMLElement
    const targetRow = screen.getByText('prd.md').closest('.wb-tree-row-content') as HTMLElement
    const dataTransfer = { setData: vi.fn(), effectAllowed: '', files: [] as File[] }

    fireEvent.dragStart(sourceRow, { dataTransfer })
    fireEvent.dragOver(targetRow, { dataTransfer })
    fireEvent.drop(targetRow, { dataTransfer })

    await waitFor(() => {
      expect(window.hive.fs.move).toHaveBeenCalledWith('/ws', 'a.txt', 'docs/a.txt')
    })
    expect(window.hive.fs.move).toHaveBeenCalledTimes(1)
    expect(window.hive.fs.move).not.toHaveBeenCalledWith('/ws', 'docs', expect.anything())
  })

  it('a same-parent (no-op) drop target is skipped for that item only — the rest of the batch still moves', async () => {
    mockHive({ listTree: vi.fn().mockResolvedValue(bulkDragTree) })
    render(createElement(ExplorerHarness, { workspace: '/ws' }))
    await screen.findByText('a.txt')

    const aRow = (await screen.findByText('a.txt')).closest('[role="treeitem"]') as HTMLElement
    const prdRow = (await screen.findByText('prd.md')).closest('[role="treeitem"]') as HTMLElement
    fireEvent.click(aRow, { ctrlKey: true })
    fireEvent.click(prdRow, { ctrlKey: true })

    // Dropping on the rail background moves to the workspace root: a.txt is
    // already there (no-op, skipped), docs/prd.md is not (proceeds).
    const sourceRow = screen.getByText('a.txt').closest('.wb-tree-row-content') as HTMLElement
    const rail = document.querySelector('.wb-rail-scroll') as HTMLElement
    const dataTransfer = { setData: vi.fn(), effectAllowed: '', files: [] as File[] }

    fireEvent.dragStart(sourceRow, { dataTransfer })
    fireEvent.dragOver(rail, { dataTransfer })
    fireEvent.drop(rail, { dataTransfer })

    await waitFor(() => {
      expect(window.hive.fs.move).toHaveBeenCalledWith('/ws', 'docs/prd.md', 'prd.md')
    })
    expect(window.hive.fs.move).toHaveBeenCalledTimes(1)
    expect(window.hive.fs.move).not.toHaveBeenCalledWith('/ws', 'a.txt', 'a.txt')
  })

  // --- T8: external OS drop / import (FM-R5) --------------------------------

  it('dropping an OS file onto a folder row resolves its abs path and calls importEntry', async () => {
    const pathForFile = vi.fn().mockReturnValue('/abs/os/path/dropped.txt')
    window.hive.fs.pathForFile = pathForFile

    render(createElement(ExplorerHarness, { workspace: '/ws' }))
    await screen.findByText('a.txt')

    const targetRow = screen.getByText('docs').closest('.wb-tree-row-content') as HTMLElement
    const fakeFile = { name: 'dropped.txt' } as unknown as File
    const dataTransfer = { files: [fakeFile] }

    fireEvent.dragOver(targetRow, { dataTransfer })
    fireEvent.drop(targetRow, { dataTransfer })

    await waitFor(() => {
      expect(pathForFile).toHaveBeenCalledWith(fakeFile)
      expect(window.hive.fs.importEntry).toHaveBeenCalledWith(
        '/ws',
        '/abs/os/path/dropped.txt',
        'docs/dropped.txt',
        undefined
      )
    })
  })

  // --- FM-R5: panel-wide OS-import drop overlay -----------------------------

  it('an OS file drag over the tree shows the panel-wide import overlay, aimed at the workspace root', async () => {
    render(createElement(ExplorerHarness, { workspace: '/ws' }))
    await screen.findByText('a.txt')

    const body = screen.getByText('a.txt').closest('.wb-tree-body') as HTMLElement
    // An OS file drag advertises `Files` in `dataTransfer.types` during
    // dragover (the file list itself is only readable on drop).
    const dataTransfer = { types: ['Files'], files: [] as File[], dropEffect: '' }

    fireEvent.dragEnter(body, { dataTransfer })
    fireEvent.dragOver(body, { dataTransfer })

    expect(screen.getByText('Solte para importar')).toBeTruthy()
    // basename('/ws') === 'ws' — the root destination label.
    expect(screen.getByText('para ws')).toBeTruthy()
    // The over handler opts the whole body into the drop.
    expect(dataTransfer.dropEffect).toBe('copy')
  })

  it('hovering a folder during an OS import re-aims the overlay at that folder', async () => {
    render(createElement(ExplorerHarness, { workspace: '/ws' }))
    await screen.findByText('a.txt')

    const body = screen.getByText('a.txt').closest('.wb-tree-body') as HTMLElement
    const dataTransfer = { types: ['Files'], files: [] as File[], dropEffect: '' }

    fireEvent.dragEnter(body, { dataTransfer })
    const folderRow = screen.getByText('docs').closest('.wb-tree-row-content') as HTMLElement
    fireEvent.dragOver(folderRow, { dataTransfer })

    expect(screen.getByText('para a pasta docs')).toBeTruthy()
  })

  it('the import overlay clears once the drag leaves the tree', async () => {
    render(createElement(ExplorerHarness, { workspace: '/ws' }))
    await screen.findByText('a.txt')

    const body = screen.getByText('a.txt').closest('.wb-tree-body') as HTMLElement
    const dataTransfer = { types: ['Files'], files: [] as File[], dropEffect: '' }

    fireEvent.dragEnter(body, { dataTransfer })
    expect(screen.getByText('Solte para importar')).toBeTruthy()

    fireEvent.dragLeave(body, { dataTransfer })
    await waitFor(() => expect(screen.queryByText('Solte para importar')).toBeNull())
  })

  it('an internal row move never lights up the OS-import overlay', async () => {
    render(createElement(ExplorerHarness, { workspace: '/ws' }))
    await screen.findByText('a.txt')

    const body = screen.getByText('a.txt').closest('.wb-tree-body') as HTMLElement
    // A tree-to-tree move carries `text/plain`, not `Files`.
    const dataTransfer = { types: ['text/plain'], files: [] as File[], dropEffect: '' }

    fireEvent.dragEnter(body, { dataTransfer })
    fireEvent.dragOver(body, { dataTransfer })

    expect(screen.queryByText('Solte para importar')).toBeNull()
  })

  // --- T8: conflict dialog (FM-R7), all three branches ----------------------

  it('conflict dialog "Substituir" re-creates the file with overwrite:true', async () => {
    window.hive.fs.exists = vi.fn().mockResolvedValue(true)

    render(createElement(ExplorerHarness, { workspace: '/ws' }))
    await screen.findByText('a.txt')

    fireEvent.click(screen.getByRole('button', { name: 'Novo arquivo' }))
    const input = await screen.findByPlaceholderText('Nome do arquivo ou pasta')
    fireEvent.change(input, { target: { value: 'a.txt' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    const dialog = await screen.findByRole('dialog')
    expect(dialog.textContent).toContain('Já existe um item com esse nome')

    fireEvent.click(screen.getByRole('button', { name: 'Substituir' }))

    await waitFor(() => {
      expect(window.hive.fs.createFile).toHaveBeenCalledWith('/ws', 'a.txt', { overwrite: true })
    })
  })

  it('conflict dialog "Renomear" keeps the inline input open for a new name', async () => {
    window.hive.fs.exists = vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false)

    render(createElement(ExplorerHarness, { workspace: '/ws' }))
    await screen.findByText('a.txt')

    fireEvent.click(screen.getByRole('button', { name: 'Novo arquivo' }))
    const input = await screen.findByPlaceholderText('Nome do arquivo ou pasta')
    fireEvent.change(input, { target: { value: 'a.txt' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await screen.findByRole('dialog')
    fireEvent.click(screen.getByRole('button', { name: 'Renomear' }))

    // the same inline input is still open — retype and resubmit
    const retryInput = await screen.findByPlaceholderText('Nome do arquivo ou pasta')
    fireEvent.change(retryInput, { target: { value: 'a-2.txt' } })
    fireEvent.keyDown(retryInput, { key: 'Enter' })

    await waitFor(() => {
      expect(window.hive.fs.createFile).toHaveBeenCalledWith('/ws', 'a-2.txt', undefined)
    })
  })

  it('conflict dialog "Cancelar" discards the operation without calling createFile', async () => {
    window.hive.fs.exists = vi.fn().mockResolvedValue(true)

    render(createElement(ExplorerHarness, { workspace: '/ws' }))
    await screen.findByText('a.txt')

    fireEvent.click(screen.getByRole('button', { name: 'Novo arquivo' }))
    const input = await screen.findByPlaceholderText('Nome do arquivo ou pasta')
    fireEvent.change(input, { target: { value: 'a.txt' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await screen.findByRole('dialog')
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull()
    })
    expect(window.hive.fs.createFile).not.toHaveBeenCalled()
  })

  it('a race-condition CONFLICT rejection from createFile (exists() said no, create() disagreed) still opens the conflict dialog', async () => {
    window.hive.fs.exists = vi.fn().mockResolvedValue(false)
    window.hive.fs.createFile = vi
      .fn()
      .mockRejectedValueOnce({
        name: 'FsConflictError',
        code: 'CONFLICT',
        message: 'a.txt already exists'
      })
      .mockResolvedValueOnce(undefined)

    render(createElement(ExplorerHarness, { workspace: '/ws' }))
    await screen.findByText('a.txt')

    fireEvent.click(screen.getByRole('button', { name: 'Novo arquivo' }))
    const input = await screen.findByPlaceholderText('Nome do arquivo ou pasta')
    fireEvent.change(input, { target: { value: 'a.txt' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await screen.findByRole('dialog')
    fireEvent.click(screen.getByRole('button', { name: 'Substituir' }))

    await waitFor(() => {
      expect(window.hive.fs.createFile).toHaveBeenLastCalledWith('/ws', 'a.txt', {
        overwrite: true
      })
    })
  })

  it('renaming into an existing name opens the conflict dialog; "Substituir" retries move with overwrite:true', async () => {
    window.hive.fs.exists = vi.fn().mockResolvedValue(true)

    render(createElement(ExplorerHarness, { workspace: '/ws' }))
    await screen.findByText('a.txt')

    fireEvent.click(screen.getByLabelText(/Mais ações para a\.txt/))
    fireEvent.click(await screen.findByRole('menuitem', { name: /Renomear/ }))
    const input = await screen.findByPlaceholderText('Novo nome')
    fireEvent.change(input, { target: { value: 'taken.txt' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    const dialog = await screen.findByRole('dialog')
    expect(dialog.textContent).toContain('taken.txt')
    fireEvent.click(screen.getByRole('button', { name: 'Substituir' }))

    await waitFor(() => {
      expect(window.hive.fs.move).toHaveBeenCalledWith('/ws', 'a.txt', 'taken.txt', {
        overwrite: true
      })
    })
  })

  it('renaming into an existing name, then "Cancelar", never calls move', async () => {
    window.hive.fs.exists = vi.fn().mockResolvedValue(true)

    render(createElement(ExplorerHarness, { workspace: '/ws' }))
    await screen.findByText('a.txt')

    fireEvent.click(screen.getByLabelText(/Mais ações para a\.txt/))
    fireEvent.click(await screen.findByRole('menuitem', { name: /Renomear/ }))
    const input = await screen.findByPlaceholderText('Novo nome')
    fireEvent.change(input, { target: { value: 'taken.txt' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await screen.findByRole('dialog')
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull()
    })
    expect(window.hive.fs.move).not.toHaveBeenCalled()
  })

  it('a race-condition CONFLICT rejection from move() still opens the conflict dialog and retries with overwrite:true', async () => {
    window.hive.fs.exists = vi.fn().mockResolvedValue(false)
    window.hive.fs.move = vi
      .fn()
      .mockRejectedValueOnce({
        name: 'FsConflictError',
        code: 'CONFLICT',
        message: 'b.txt already exists'
      })
      .mockResolvedValueOnce(undefined)

    render(createElement(ExplorerHarness, { workspace: '/ws' }))
    await screen.findByText('a.txt')

    fireEvent.click(screen.getByLabelText(/Mais ações para a\.txt/))
    fireEvent.click(await screen.findByRole('menuitem', { name: /Renomear/ }))
    const input = await screen.findByPlaceholderText('Novo nome')
    fireEvent.change(input, { target: { value: 'b.txt' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await screen.findByRole('dialog')
    fireEvent.click(screen.getByRole('button', { name: 'Substituir' }))

    await waitFor(() => {
      expect(window.hive.fs.move).toHaveBeenLastCalledWith('/ws', 'a.txt', 'b.txt', {
        overwrite: true
      })
    })
  })

  it('dragging a folder onto one of its own descendants is a no-op (FM-R4.2 guard) — no move call', async () => {
    render(createElement(ExplorerHarness, { workspace: '/ws' }))
    await screen.findByText('a.txt')

    const folderRow = screen.getByText('docs').closest('.wb-tree-row-content') as HTMLElement
    const descendantRow = screen.getByText('prd.md').closest('.wb-tree-row-content') as HTMLElement
    const dataTransfer = { setData: vi.fn(), effectAllowed: '', files: [] as File[] }

    fireEvent.dragStart(folderRow, { dataTransfer })
    fireEvent.dragOver(descendantRow, { dataTransfer })
    fireEvent.drop(descendantRow, { dataTransfer })

    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(window.hive.fs.move).not.toHaveBeenCalled()
  })

  it('a multi-item OS drop resolves each item independently — cancelling one does not abort the rest of the batch', async () => {
    window.hive.fs.exists = vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false)

    render(createElement(ExplorerHarness, { workspace: '/ws' }))
    await screen.findByText('a.txt')

    const targetRow = screen.getByText('docs').closest('.wb-tree-row-content') as HTMLElement
    const fileOne = { name: 'one.txt' } as unknown as File
    const fileTwo = { name: 'two.txt' } as unknown as File
    const dataTransfer = { files: [fileOne, fileTwo] }

    fireEvent.dragOver(targetRow, { dataTransfer })
    fireEvent.drop(targetRow, { dataTransfer })

    const dialog = await screen.findByRole('dialog')
    expect(dialog.textContent).toContain('one.txt')
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    await waitFor(() => {
      expect(window.hive.fs.importEntry).toHaveBeenCalledTimes(1)
      expect(window.hive.fs.importEntry).toHaveBeenCalledWith(
        '/ws',
        '/abs/os/path/dropped.txt',
        'docs/two.txt',
        undefined
      )
    })
  })

  it('the row context menu\'s "Novo arquivo" creates inside that row\'s folder', async () => {
    render(createElement(ExplorerHarness, { workspace: '/ws' }))
    await screen.findByText('a.txt')

    fireEvent.click(screen.getByLabelText(/Mais ações para docs/))
    fireEvent.click(await screen.findByRole('menuitem', { name: /Novo arquivo/ }))

    const input = await screen.findByPlaceholderText('Nome do arquivo ou pasta')
    fireEvent.change(input, { target: { value: 'inside.txt' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(window.hive.fs.createFile).toHaveBeenCalledWith('/ws', 'docs/inside.txt', undefined)
    })
  })

  it('the row context menu\'s "Nova pasta" creates a directory inside that row\'s folder', async () => {
    render(createElement(ExplorerHarness, { workspace: '/ws' }))
    await screen.findByText('a.txt')

    fireEvent.click(screen.getByLabelText(/Mais ações para docs/))
    fireEvent.click(await screen.findByRole('menuitem', { name: /Nova pasta/ }))

    const input = await screen.findByPlaceholderText('Nome do arquivo ou pasta')
    fireEvent.change(input, { target: { value: 'nested' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(window.hive.fs.createDirectory).toHaveBeenCalledWith('/ws', 'docs/nested')
    })
  })

  it('right-clicking a row opens its context menu (not just the kebab)', async () => {
    render(createElement(ExplorerHarness, { workspace: '/ws' }))
    await screen.findByText('a.txt')

    const row = screen.getByText('a.txt').closest('.wb-tree-row-content') as HTMLElement
    fireEvent.contextMenu(row)

    expect(await screen.findByRole('menuitem', { name: /Excluir/ })).toBeTruthy()
  })

  it('right-clicking a folder row and picking "Novo arquivo" creates inside that folder', async () => {
    render(createElement(ExplorerHarness, { workspace: '/ws' }))
    await screen.findByText('a.txt')

    const row = screen.getByText('docs').closest('.wb-tree-row-content') as HTMLElement
    fireEvent.contextMenu(row)
    fireEvent.click(await screen.findByRole('menuitem', { name: /Novo arquivo/ }))

    const input = await screen.findByPlaceholderText('Nome do arquivo ou pasta')
    fireEvent.change(input, { target: { value: 'via-ctx.md' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(window.hive.fs.createFile).toHaveBeenCalledWith('/ws', 'docs/via-ctx.md', undefined)
    })
  })

  it('right-clicking the empty tree area offers create actions scoped to the workspace root (VS Code)', async () => {
    render(createElement(ExplorerHarness, { workspace: '/ws' }))
    await screen.findByText('a.txt')

    const area = document.querySelector('.wb-tree-body') as HTMLElement
    fireEvent.contextMenu(area)

    // Area scope: only the create pair, no row actions.
    expect(screen.queryByRole('menuitem', { name: /Excluir/ })).toBeNull()
    fireEvent.click(await screen.findByRole('menuitem', { name: /Nova pasta/ }))

    const input = await screen.findByPlaceholderText('Nome do arquivo ou pasta')
    fireEvent.change(input, { target: { value: 'raiz' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(window.hive.fs.createDirectory).toHaveBeenCalledWith('/ws', 'raiz')
    })
  })

  // P0-011 (R-03): the context menu was half-tested — "Novo arquivo" only from
  // a row, "Nova pasta" only from the empty area, and neither Renomear nor
  // Excluir at all. Each item is its own callback with its own scoping rule,
  // and the row/area split is exactly where a wrong scope hides.
  it('right-clicking a row and picking "Nova pasta" creates inside that row\'s folder', async () => {
    render(createElement(ExplorerHarness, { workspace: '/ws' }))
    await screen.findByText('a.txt')

    const row = screen.getByText('docs').closest('.wb-tree-row-content') as HTMLElement
    fireEvent.contextMenu(row)
    fireEvent.click(await screen.findByRole('menuitem', { name: /Nova pasta/ }))

    const input = await screen.findByPlaceholderText('Nome do arquivo ou pasta')
    fireEvent.change(input, { target: { value: 'sub' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(window.hive.fs.createDirectory).toHaveBeenCalledWith('/ws', 'docs/sub')
    })
  })

  it('right-clicking the empty area and picking "Novo arquivo" creates at the workspace root', async () => {
    render(createElement(ExplorerHarness, { workspace: '/ws' }))
    await screen.findByText('a.txt')

    const area = document.querySelector('.wb-tree-body') as HTMLElement
    fireEvent.contextMenu(area)
    fireEvent.click(await screen.findByRole('menuitem', { name: /Novo arquivo/ }))

    const input = await screen.findByPlaceholderText('Nome do arquivo ou pasta')
    fireEvent.change(input, { target: { value: 'raiz.md' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(window.hive.fs.createFile).toHaveBeenCalledWith('/ws', 'raiz.md', undefined)
    })
  })

  it('right-clicking a FILE row scopes create actions to its parent folder, not to the file', async () => {
    // The row actions branch on whether the row is a directory. Only the
    // directory arm was tested; on a file the target has to fall back to the
    // parent, or the app tries to create a child of a file.
    render(createElement(ExplorerHarness, { workspace: '/ws' }))
    await screen.findByText('prd.md')

    const row = screen.getByText('prd.md').closest('.wb-tree-row-content') as HTMLElement
    fireEvent.contextMenu(row)
    fireEvent.click(await screen.findByRole('menuitem', { name: /Nova pasta/ }))

    const input = await screen.findByPlaceholderText('Nome do arquivo ou pasta')
    fireEvent.change(input, { target: { value: 'ao-lado' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    // Sibling of prd.md (inside docs/), not docs/prd.md/ao-lado.
    await waitFor(() => {
      expect(window.hive.fs.createDirectory).toHaveBeenCalledWith('/ws', 'docs/ao-lado')
    })
  })

  it('right-clicking a FILE row and picking "Novo arquivo" also targets the parent folder', async () => {
    render(createElement(ExplorerHarness, { workspace: '/ws' }))
    await screen.findByText('prd.md')

    const row = screen.getByText('prd.md').closest('.wb-tree-row-content') as HTMLElement
    fireEvent.contextMenu(row)
    fireEvent.click(await screen.findByRole('menuitem', { name: /Novo arquivo/ }))

    const input = await screen.findByPlaceholderText('Nome do arquivo ou pasta')
    fireEvent.change(input, { target: { value: 'irmao.md' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(window.hive.fs.createFile).toHaveBeenCalledWith('/ws', 'docs/irmao.md', undefined)
    })
  })

  it('the kebab menu on a FOLDER row creates inside that folder', async () => {
    // The kebab carries its own copy of the is-this-a-directory scoping rule,
    // separate from the context menu's. It was only ever driven from a file
    // row, so the directory arm went unexercised.
    render(createElement(ExplorerHarness, { workspace: '/ws' }))
    await screen.findByText('docs')

    fireEvent.click(screen.getByLabelText(/Mais ações para docs/))
    fireEvent.click(await screen.findByRole('menuitem', { name: /Nova pasta/ }))

    const input = await screen.findByPlaceholderText('Nome do arquivo ou pasta')
    fireEvent.change(input, { target: { value: 'dentro' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(window.hive.fs.createDirectory).toHaveBeenCalledWith('/ws', 'docs/dentro')
    })
  })

  it('right-clicking a row and picking "Renomear" opens the inline rename on that row', async () => {
    render(createElement(ExplorerHarness, { workspace: '/ws' }))
    await screen.findByText('a.txt')

    const row = screen.getByText('a.txt').closest('.wb-tree-row-content') as HTMLElement
    fireEvent.contextMenu(row)
    fireEvent.click(await screen.findByRole('menuitem', { name: /Renomear/ }))

    const input = (await screen.findByPlaceholderText('Novo nome')) as HTMLInputElement
    // Pre-filled with the current name — renaming starts from what is there.
    expect(input.value).toBe('a.txt')
    fireEvent.change(input, { target: { value: 'b.txt' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(window.hive.fs.move).toHaveBeenCalledWith('/ws', 'a.txt', 'b.txt')
    })
  })

  it('right-clicking a row and picking "Excluir" asks for confirmation, and dismissing aborts it', async () => {
    render(createElement(ExplorerHarness, { workspace: '/ws' }))
    await screen.findByText('a.txt')

    const row = screen.getByText('a.txt').closest('.wb-tree-row-content') as HTMLElement
    fireEvent.contextMenu(row)
    fireEvent.click(await screen.findByRole('menuitem', { name: /Excluir/ }))
    expect(await screen.findByRole('dialog')).toBeTruthy()

    // Dismissing (Escape / backdrop, not the Cancelar button) must abort —
    // this is a destructive action, so a dismissal that deletes anyway is the
    // worst possible failure.
    fireEvent.click(screen.getByTestId('dialog-dismiss'))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(window.hive.fs.trash).not.toHaveBeenCalled()
  })

  // explorer-os-actions: copy path + open in the host file manager. Each item
  // has its own scoping rule (row vs empty area, single vs multi-selection,
  // file vs directory), and the scope is exactly where these go wrong.
  describe('OS-parity actions (copy path, reveal)', () => {
    /** Right-clicks `label`'s row and returns once the menu is up. */
    async function openRowMenu(label: string): Promise<void> {
      const row = screen.getByText(label).closest('.wb-tree-row-content') as HTMLElement
      fireEvent.contextMenu(row)
      await screen.findByRole('menuitem', { name: /Excluir/ })
    }

    function stubClipboard(): ReturnType<typeof vi.fn> {
      const writeText = vi.fn().mockResolvedValue(undefined)
      Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
      return writeText
    }

    it("copies a file's workspace-relative path", async () => {
      const writeText = stubClipboard()
      render(createElement(ExplorerHarness, { workspace: '/ws' }))
      await screen.findByText('a.txt')

      await openRowMenu('a.txt')
      fireEvent.click(screen.getByRole('menuitem', { name: /Copiar caminho relativo/ }))

      await waitFor(() => expect(writeText).toHaveBeenCalledWith('a.txt'))
      // Relative is the tree's own key — it must NOT round-trip to main.
      expect(window.hive.fs.absolutePath).not.toHaveBeenCalled()
    })

    it("copies a folder's relative path too (not just files)", async () => {
      const writeText = stubClipboard()
      render(createElement(ExplorerHarness, { workspace: '/ws' }))
      await screen.findByText('docs')

      await openRowMenu('docs')
      fireEvent.click(screen.getByRole('menuitem', { name: /Copiar caminho relativo/ }))

      await waitFor(() => expect(writeText).toHaveBeenCalledWith('docs'))
    })

    it('resolves the absolute path through main rather than composing one in the renderer', async () => {
      const writeText = stubClipboard()
      render(createElement(ExplorerHarness, { workspace: '/ws' }))
      await screen.findByText('a.txt')

      await openRowMenu('a.txt')
      fireEvent.click(screen.getByRole('menuitem', { name: /^Copiar caminho$/ }))

      await waitFor(() => {
        expect(window.hive.fs.absolutePath).toHaveBeenCalledWith('/ws', 'a.txt')
      })
      expect(writeText).toHaveBeenCalledWith('/ws/a.txt')
    })

    it('copies every selected path, one per line, when the row is part of a multi-selection', async () => {
      const writeText = stubClipboard()
      mockHive({ listTree: vi.fn().mockResolvedValue(bulkDragTree) })
      render(createElement(ExplorerHarness, { workspace: '/ws' }))
      await screen.findByText('a.txt')

      fireEvent.click(screen.getByText('a.txt'))
      fireEvent.click(screen.getByText('b.txt'), { ctrlKey: true })

      await openRowMenu('b.txt')
      fireEvent.click(screen.getByRole('menuitem', { name: /Copiar caminho relativo/ }))

      await waitFor(() => expect(writeText).toHaveBeenCalledWith('a.txt\nb.txt'))
    })

    it('ignores the selection when the right-clicked row is not part of it', async () => {
      const writeText = stubClipboard()
      mockHive({ listTree: vi.fn().mockResolvedValue(bulkDragTree) })
      render(createElement(ExplorerHarness, { workspace: '/ws' }))
      await screen.findByText('a.txt')

      fireEvent.click(screen.getByText('a.txt'))
      fireEvent.click(screen.getByText('b.txt'), { ctrlKey: true })

      await openRowMenu('other')
      fireEvent.click(screen.getByRole('menuitem', { name: /Copiar caminho relativo/ }))

      await waitFor(() => expect(writeText).toHaveBeenCalledWith('other'))
    })

    it('confirms the copy in a live region, and the wording counts the paths', async () => {
      stubClipboard()
      mockHive({ listTree: vi.fn().mockResolvedValue(bulkDragTree) })
      render(createElement(ExplorerHarness, { workspace: '/ws' }))
      await screen.findByText('a.txt')

      await openRowMenu('a.txt')
      fireEvent.click(screen.getByRole('menuitem', { name: /Copiar caminho relativo/ }))
      expect(await screen.findByText('Caminho copiado')).toBeTruthy()

      fireEvent.click(screen.getByText('a.txt'))
      fireEvent.click(screen.getByText('b.txt'), { ctrlKey: true })
      await openRowMenu('b.txt')
      fireEvent.click(screen.getByRole('menuitem', { name: /Copiar caminho relativo/ }))
      expect(await screen.findByText('2 caminhos copiados')).toBeTruthy()
    })

    it('reveals a FILE with isDir=false so main highlights it inside its parent', async () => {
      render(createElement(ExplorerHarness, { workspace: '/ws' }))
      await screen.findByText('a.txt')

      await openRowMenu('a.txt')
      fireEvent.click(screen.getByRole('menuitem', { name: /gerenciador de arquivos/ }))

      await waitFor(() => {
        expect(window.hive.fs.revealPath).toHaveBeenCalledWith('/ws', 'a.txt', false)
      })
    })

    it('opens a FOLDER with isDir=true — revealing it would show its parent instead', async () => {
      render(createElement(ExplorerHarness, { workspace: '/ws' }))
      await screen.findByText('docs')

      await openRowMenu('docs')
      fireEvent.click(screen.getByRole('menuitem', { name: /gerenciador de arquivos/ }))

      await waitFor(() => {
        expect(window.hive.fs.revealPath).toHaveBeenCalledWith('/ws', 'docs', true)
      })
    })

    it('right-clicking the empty area opens the workspace root itself', async () => {
      render(createElement(ExplorerHarness, { workspace: '/ws' }))
      await screen.findByText('a.txt')

      const area = document.querySelector('.wb-tree-body') as HTMLElement
      fireEvent.contextMenu(area)
      fireEvent.click(
        await screen.findByRole('menuitem', {
          name: /Abrir o workspace no gerenciador de arquivos/
        })
      )

      await waitFor(() => expect(window.hive.fs.revealPath).toHaveBeenCalledWith('/ws', '', true))
    })

    it('surfaces a reveal failure with its own message, not the generic retry advice', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      mockHive({
        fs: {
          ...window.hive.fs,
          revealPath: vi.fn().mockRejectedValue(new Error('no file manager'))
        } as unknown as typeof window.hive.fs
      })
      render(createElement(ExplorerHarness, { workspace: '/ws' }))
      await screen.findByText('a.txt')

      await openRowMenu('a.txt')
      fireEvent.click(screen.getByRole('menuitem', { name: /gerenciador de arquivos/ }))

      expect(
        await screen.findByText('Não foi possível abrir no gerenciador de arquivos do sistema.')
      ).toBeTruthy()
    })

    it("right-clicking the empty area copies the workspace root's own absolute path", async () => {
      const writeText = stubClipboard()
      render(createElement(ExplorerHarness, { workspace: '/ws' }))
      await screen.findByText('a.txt')

      const area = document.querySelector('.wb-tree-body') as HTMLElement
      fireEvent.contextMenu(area)
      fireEvent.click(await screen.findByRole('menuitem', { name: /^Copiar caminho$/ }))

      await waitFor(() => expect(window.hive.fs.absolutePath).toHaveBeenCalledWith('/ws', ''))
      expect(writeText).toHaveBeenCalledWith('/ws/')
    })

    // The kebab is a second opening of the same menu, and each item there is a
    // separate callback — one wired to the wrong path would be invisible to
    // every test that only ever right-clicks.
    it('offers the same actions from the row kebab as from the right-click menu', async () => {
      const writeText = stubClipboard()
      render(createElement(ExplorerHarness, { workspace: '/ws' }))
      await screen.findByText('a.txt')

      fireEvent.click(screen.getByRole('button', { name: 'Mais ações para a.txt' }))
      fireEvent.click(await screen.findByRole('menuitem', { name: /Copiar caminho relativo/ }))

      await waitFor(() => expect(writeText).toHaveBeenCalledWith('a.txt'))
    })

    it('copies the absolute path from the kebab too', async () => {
      const writeText = stubClipboard()
      render(createElement(ExplorerHarness, { workspace: '/ws' }))
      await screen.findByText('a.txt')

      fireEvent.click(screen.getByRole('button', { name: 'Mais ações para a.txt' }))
      fireEvent.click(await screen.findByRole('menuitem', { name: /^Copiar caminho$/ }))

      await waitFor(() => expect(writeText).toHaveBeenCalledWith('/ws/a.txt'))
    })

    it("reveals from the kebab, carrying the row's own file/folder verb", async () => {
      render(createElement(ExplorerHarness, { workspace: '/ws' }))
      await screen.findByText('docs')

      fireEvent.click(screen.getByRole('button', { name: 'Mais ações para docs' }))
      fireEvent.click(await screen.findByRole('menuitem', { name: /gerenciador de arquivos/ }))

      await waitFor(() => {
        expect(window.hive.fs.revealPath).toHaveBeenCalledWith('/ws', 'docs', true)
      })
    })
  })

  it('typing inside the inline create input never bubbles keys to the tree (no typeahead exit)', async () => {
    const outerKeys = vi.fn()
    render(
      createElement(
        'div',
        { onKeyDown: outerKeys },
        createElement(FileTree, { workspace: '/ws', selectedPath: null, onOpenFile: vi.fn() })
      )
    )
    await screen.findByText('a.txt')

    fireEvent.click(screen.getByRole('button', { name: 'Novo arquivo' }))
    const input = await screen.findByPlaceholderText('Nome do arquivo ou pasta')
    fireEvent.keyDown(input, { key: 'd' })
    fireEvent.keyDown(input, { key: '.' })
    fireEvent.keyDown(input, { key: 'ArrowDown' })

    // The DS Tree's typeahead lives above this input — nothing may reach it.
    expect(outerKeys).not.toHaveBeenCalled()
    // And the input session is still alive (editing only ends on Enter/Esc/blur).
    expect(screen.getByPlaceholderText('Nome do arquivo ou pasta')).toBeTruthy()
  })

  it('double-clicking a file row opens it pinned (VS Code pin-on-double-click)', async () => {
    const onOpenFile = vi.fn()
    render(createElement(FileTree, { workspace: '/ws', selectedPath: null, onOpenFile }))
    await screen.findByText('a.txt')

    const row = screen.getByText('a.txt').closest('.wb-tree-row-content') as HTMLElement
    fireEvent.doubleClick(row)

    expect(onOpenFile).toHaveBeenCalledWith('a.txt', { pin: true })
  })

  it('decorates changed files with a status badge + color and rolls a dot up to folders (GIT-R11)', async () => {
    const decorations = new Map([
      ['a.txt', { kind: 'modified', letter: 'M', staged: false, conflict: false }],
      ['docs/prd.md', { kind: 'added', letter: 'A', staged: true, conflict: false }]
    ]) as unknown as Parameters<typeof FileTree>[0]['decorations']
    render(
      createElement(FileTree, {
        workspace: '/ws',
        selectedPath: null,
        onOpenFile: vi.fn(),
        decorations
      })
    )
    await screen.findByText('a.txt')

    // a.txt carries an 'M' badge with the modified color.
    const aRow = screen.getByText('a.txt').closest('.wb-tree-row-content') as HTMLElement
    const badge = aRow.querySelector('.wb-tree-git-badge') as HTMLElement
    expect(badge?.textContent).toBe('M')
    expect(badge.getAttribute('style')).toContain('--wb-git-modified')

    // The docs folder (containing a changed file) shows the rollup dot.
    const docsRow = screen.getByText('docs').closest('.wb-tree-row-content') as HTMLElement
    expect(docsRow.querySelector('.wb-tree-git-dot')).not.toBeNull()
  })

  it('dims an ignored file and shows no badge color (GIT-R11)', async () => {
    const decorations = new Map([
      ['a.txt', { kind: 'ignored', letter: '!', staged: false, conflict: false }]
    ]) as unknown as Parameters<typeof FileTree>[0]['decorations']
    render(
      createElement(FileTree, {
        workspace: '/ws',
        selectedPath: null,
        onOpenFile: vi.fn(),
        decorations
      })
    )
    const label = await screen.findByText('a.txt')
    expect(label.getAttribute('data-git-ignored')).toBe('true')
    // Ignored labels are not tinted with a status color.
    expect(label.getAttribute('style')).toBeNull()
  })

  it('an empty folder renders the folder icon (not the generic file icon)', async () => {
    mockHive({
      listTree: vi.fn().mockResolvedValue([
        { name: 'vazia', path: 'vazia', type: 'directory', children: [] },
        { name: 'a.txt', path: 'a.txt', type: 'file' }
      ]) as unknown as typeof window.hive.listTree
    })
    render(createElement(ExplorerHarness, { workspace: '/ws' }))
    await screen.findByText('vazia')

    const emptyDirRow = screen.getByText('vazia').closest('.wb-tree-row-content') as HTMLElement
    expect(emptyDirRow.querySelector('.wb-tree-icon')).toBeTruthy()
    expect(emptyDirRow.querySelector('.wb-file-icon')).toBeNull()

    // Files carry the per-type icon wrapper instead.
    const fileRow = screen.getByText('a.txt').closest('.wb-tree-row-content') as HTMLElement
    expect(fileRow.querySelector('.wb-file-icon')).toBeTruthy()
  })

  it('every row (folder and file) renders the fixed caret slot so names align in one column', async () => {
    render(createElement(ExplorerHarness, { workspace: '/ws' }))
    await screen.findByText('a.txt')

    const fileRow = screen.getByText('a.txt').closest('.wb-tree-row-content') as HTMLElement
    const dirRow = screen.getByText('docs').closest('.wb-tree-row-content') as HTMLElement
    expect(fileRow.querySelector('.wb-tree-caret')).toBeTruthy()
    expect(dirRow.querySelector('.wb-tree-caret')).toBeTruthy()
  })

  // --- T7: rename/create blur auto-commit -----------------------------------

  it('blurring the inline create input with a valid name commits it (same path as Enter)', async () => {
    render(createElement(ExplorerHarness, { workspace: '/ws' }))
    await screen.findByText('a.txt')

    fireEvent.click(screen.getByRole('button', { name: 'Novo arquivo' }))
    const input = await screen.findByPlaceholderText('Nome do arquivo ou pasta')
    fireEvent.change(input, { target: { value: 'blurred.txt' } })
    fireEvent.blur(input)

    await waitFor(() => {
      expect(window.hive.fs.createFile).toHaveBeenCalledWith('/ws', 'blurred.txt', undefined)
    })
    await waitFor(() => {
      expect(screen.queryByPlaceholderText('Nome do arquivo ou pasta')).toBeNull()
    })
  })

  it('blurring the inline rename input with a valid name commits the move (same path as Enter)', async () => {
    render(createElement(ExplorerHarness, { workspace: '/ws' }))
    await screen.findByText('a.txt')

    fireEvent.click(screen.getByLabelText(/Mais ações para a\.txt/))
    fireEvent.click(await screen.findByRole('menuitem', { name: /Renomear/ }))
    const input = await screen.findByPlaceholderText('Novo nome')
    fireEvent.change(input, { target: { value: 'renamed.txt' } })
    fireEvent.blur(input)

    await waitFor(() => {
      expect(window.hive.fs.move).toHaveBeenCalledWith('/ws', 'a.txt', 'renamed.txt')
    })
    await waitFor(() => {
      expect(screen.queryByPlaceholderText('Novo nome')).toBeNull()
    })
  })

  it('blurring the inline create input with an empty value cancels instead of committing', async () => {
    render(createElement(ExplorerHarness, { workspace: '/ws' }))
    await screen.findByText('a.txt')

    fireEvent.click(screen.getByRole('button', { name: 'Novo arquivo' }))
    const input = await screen.findByPlaceholderText('Nome do arquivo ou pasta')
    fireEvent.change(input, { target: { value: '   ' } })
    fireEvent.blur(input)

    await waitFor(() => {
      expect(screen.queryByPlaceholderText('Nome do arquivo ou pasta')).toBeNull()
    })
    expect(window.hive.fs.createFile).not.toHaveBeenCalled()
  })

  it('blurring the inline rename input with an invalid value (path separator) cancels instead of committing', async () => {
    render(createElement(ExplorerHarness, { workspace: '/ws' }))
    await screen.findByText('a.txt')

    fireEvent.click(screen.getByLabelText(/Mais ações para a\.txt/))
    fireEvent.click(await screen.findByRole('menuitem', { name: /Renomear/ }))
    const input = await screen.findByPlaceholderText('Novo nome')
    fireEvent.change(input, { target: { value: 'a/b' } })
    fireEvent.blur(input)

    await waitFor(() => {
      expect(screen.queryByPlaceholderText('Novo nome')).toBeNull()
    })
    expect(window.hive.fs.move).not.toHaveBeenCalled()
  })

  it('Escape still cancels the inline rename input without moving anything', async () => {
    render(createElement(ExplorerHarness, { workspace: '/ws' }))
    await screen.findByText('a.txt')

    fireEvent.click(screen.getByLabelText(/Mais ações para a\.txt/))
    fireEvent.click(await screen.findByRole('menuitem', { name: /Renomear/ }))
    const input = await screen.findByPlaceholderText('Novo nome')
    fireEvent.change(input, { target: { value: 'renamed.txt' } })
    fireEvent.keyDown(input, { key: 'Escape' })

    await waitFor(() => {
      expect(screen.queryByPlaceholderText('Novo nome')).toBeNull()
    })
    expect(window.hive.fs.move).not.toHaveBeenCalled()
  })

  it('Enter then a follow-up blur on the create input commits exactly once', async () => {
    render(createElement(ExplorerHarness, { workspace: '/ws' }))
    await screen.findByText('a.txt')

    fireEvent.click(screen.getByRole('button', { name: 'Novo arquivo' }))
    const input = await screen.findByPlaceholderText('Nome do arquivo ou pasta')
    fireEvent.change(input, { target: { value: 'once.txt' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    // Simulate the blur that follows Enter (focus naturally moving, or the
    // input unmounting) before the async createFile has settled.
    fireEvent.blur(input)

    await waitFor(() => {
      expect(window.hive.fs.createFile).toHaveBeenCalledTimes(1)
    })
    expect(window.hive.fs.createFile).toHaveBeenCalledWith('/ws', 'once.txt', undefined)
  })

  it('Enter then a follow-up blur on the rename input commits exactly once', async () => {
    render(createElement(ExplorerHarness, { workspace: '/ws' }))
    await screen.findByText('a.txt')

    fireEvent.click(screen.getByLabelText(/Mais ações para a\.txt/))
    fireEvent.click(await screen.findByRole('menuitem', { name: /Renomear/ }))
    const input = await screen.findByPlaceholderText('Novo nome')
    fireEvent.change(input, { target: { value: 'once.txt' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    fireEvent.blur(input)

    await waitFor(() => {
      expect(window.hive.fs.move).toHaveBeenCalledTimes(1)
    })
    expect(window.hive.fs.move).toHaveBeenCalledWith('/ws', 'a.txt', 'once.txt')
  })

  it('a blur fired while the create-conflict dialog is open does not double-commit', async () => {
    window.hive.fs.exists = vi.fn().mockResolvedValue(true)

    render(createElement(ExplorerHarness, { workspace: '/ws' }))
    await screen.findByText('a.txt')

    fireEvent.click(screen.getByRole('button', { name: 'Novo arquivo' }))
    const input = await screen.findByPlaceholderText('Nome do arquivo ou pasta')
    fireEvent.change(input, { target: { value: 'a.txt' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await screen.findByRole('dialog')
    // The conflict dialog stealing focus fires another blur on the
    // still-mounted inline input — must not trigger a second createFile.
    fireEvent.blur(input)

    fireEvent.click(screen.getByRole('button', { name: 'Substituir' }))

    await waitFor(() => {
      expect(window.hive.fs.createFile).toHaveBeenCalledWith('/ws', 'a.txt', { overwrite: true })
    })
    expect(window.hive.fs.createFile).toHaveBeenCalledTimes(1)
  })

  it('a blur fired while the rename-conflict dialog is open does not double-commit', async () => {
    window.hive.fs.exists = vi.fn().mockResolvedValue(true)

    render(createElement(ExplorerHarness, { workspace: '/ws' }))
    await screen.findByText('a.txt')

    fireEvent.click(screen.getByLabelText(/Mais ações para a\.txt/))
    fireEvent.click(await screen.findByRole('menuitem', { name: /Renomear/ }))
    const input = await screen.findByPlaceholderText('Novo nome')
    fireEvent.change(input, { target: { value: 'docs' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await screen.findByRole('dialog')
    fireEvent.blur(input)

    fireEvent.click(screen.getByRole('button', { name: 'Substituir' }))

    await waitFor(() => {
      expect(window.hive.fs.move).toHaveBeenCalledWith('/ws', 'a.txt', 'docs', { overwrite: true })
    })
    expect(window.hive.fs.move).toHaveBeenCalledTimes(1)
  })

  it('dragging over then leaving a folder row clears the drop-target highlight', async () => {
    render(createElement(ExplorerHarness, { workspace: '/ws' }))
    await screen.findByText('a.txt')

    const targetRow = screen.getByText('docs').closest('.wb-tree-row-content') as HTMLElement
    const dataTransfer = { setData: vi.fn(), effectAllowed: '', files: [] as File[] }
    fireEvent.dragOver(targetRow, { dataTransfer })
    expect(targetRow.className).toContain('wb-tree-row-dropover')

    fireEvent.dragLeave(targetRow)
    expect(targetRow.className).not.toContain('wb-tree-row-dropover')
  })

  it('an OS drop conflict resolved with "Substituir" imports with overwrite:true then continues the queue', async () => {
    window.hive.fs.exists = vi.fn().mockResolvedValue(true)

    render(createElement(ExplorerHarness, { workspace: '/ws' }))
    await screen.findByText('a.txt')

    const targetRow = screen.getByText('docs').closest('.wb-tree-row-content') as HTMLElement
    const fakeFile = { name: 'a.txt' } as unknown as File
    fireEvent.drop(targetRow, { dataTransfer: { files: [fakeFile] } })

    await screen.findByRole('dialog')
    fireEvent.click(screen.getByRole('button', { name: 'Substituir' }))

    await waitFor(() => {
      expect(window.hive.fs.importEntry).toHaveBeenCalledWith(
        '/ws',
        '/abs/os/path/dropped.txt',
        'docs/a.txt',
        { overwrite: true }
      )
    })
  })

  it('an OS drop conflict resolved with "Renomear" reopens the inline input prefilled with the dropped name', async () => {
    window.hive.fs.exists = vi.fn().mockResolvedValue(true)

    render(createElement(ExplorerHarness, { workspace: '/ws' }))
    await screen.findByText('a.txt')

    const targetRow = screen.getByText('docs').closest('.wb-tree-row-content') as HTMLElement
    const fakeFile = { name: 'a.txt' } as unknown as File
    fireEvent.drop(targetRow, { dataTransfer: { files: [fakeFile] } })

    await screen.findByRole('dialog')
    fireEvent.click(screen.getByRole('button', { name: 'Renomear' }))

    const input = await screen.findByPlaceholderText('Nome do arquivo ou pasta')
    expect((input as HTMLInputElement).value).toBe('a.txt')
    fireEvent.change(input, { target: { value: 'a-renamed.txt' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(window.hive.fs.importEntry).toHaveBeenCalledWith(
        '/ws',
        '/abs/os/path/dropped.txt',
        'docs/a-renamed.txt',
        undefined
      )
    })
  })

  it('a race-condition CONFLICT rejection from importEntry (exists() said no) still opens the conflict dialog', async () => {
    window.hive.fs.exists = vi.fn().mockResolvedValue(false)
    window.hive.fs.importEntry = vi
      .fn()
      .mockRejectedValueOnce({
        name: 'FsConflictError',
        code: 'CONFLICT',
        message: 'a.txt already exists'
      })
      .mockResolvedValueOnce(undefined)

    render(createElement(ExplorerHarness, { workspace: '/ws' }))
    await screen.findByText('a.txt')

    const targetRow = screen.getByText('docs').closest('.wb-tree-row-content') as HTMLElement
    const fakeFile = { name: 'a.txt' } as unknown as File
    fireEvent.drop(targetRow, { dataTransfer: { files: [fakeFile] } })

    await screen.findByRole('dialog')
    fireEvent.click(screen.getByRole('button', { name: 'Substituir' }))

    await waitFor(() => {
      expect(window.hive.fs.importEntry).toHaveBeenLastCalledWith(
        '/ws',
        '/abs/os/path/dropped.txt',
        'docs/a.txt',
        { overwrite: true }
      )
    })
  })

  it('dropping onto the rail background (not a specific row) imports/moves to the workspace root', async () => {
    render(createElement(ExplorerHarness, { workspace: '/ws' }))
    await screen.findByText('a.txt')

    const rail = document.querySelector('.wb-rail-scroll') as HTMLElement
    const fakeFile = { name: 'root-drop.txt' } as unknown as File
    fireEvent.drop(rail, { dataTransfer: { files: [fakeFile] } })

    await waitFor(() => {
      expect(window.hive.fs.importEntry).toHaveBeenCalledWith(
        '/ws',
        '/abs/os/path/dropped.txt',
        'root-drop.txt',
        undefined
      )
    })
  })

  it('clicking a folder row targets the toolbar "New file" action at that folder', async () => {
    render(createElement(ExplorerHarness, { workspace: '/ws' }))
    await screen.findByText('a.txt')

    fireEvent.click(screen.getByText('docs'))
    fireEvent.click(screen.getByRole('button', { name: 'Novo arquivo' }))
    const input = await screen.findByPlaceholderText('Nome do arquivo ou pasta')
    fireEvent.change(input, { target: { value: 'targeted.txt' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(window.hive.fs.createFile).toHaveBeenCalledWith('/ws', 'docs/targeted.txt', undefined)
    })
  })

  it('a non-conflict createFile failure shows the generic action-error banner instead of crashing', async () => {
    window.hive.fs.createFile = vi.fn().mockRejectedValue(new Error('disk full'))

    render(createElement(ExplorerHarness, { workspace: '/ws' }))
    await screen.findByText('a.txt')

    fireEvent.click(screen.getByRole('button', { name: 'Novo arquivo' }))
    const input = await screen.findByPlaceholderText('Nome do arquivo ou pasta')
    fireEvent.change(input, { target: { value: 'oops.txt' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(
      await screen.findByText('Não foi possível concluir a ação. Tente novamente.')
    ).toBeTruthy()
  })

  it('a non-conflict move failure during rename shows the action-error banner', async () => {
    window.hive.fs.move = vi.fn().mockRejectedValue(new Error('permission denied'))

    render(createElement(ExplorerHarness, { workspace: '/ws' }))
    await screen.findByText('a.txt')

    fireEvent.click(screen.getByLabelText(/Mais ações para a\.txt/))
    fireEvent.click(await screen.findByRole('menuitem', { name: /Renomear/ }))
    const input = await screen.findByPlaceholderText('Novo nome')
    fireEvent.change(input, { target: { value: 'b.txt' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(
      await screen.findByText('Não foi possível concluir a ação. Tente novamente.')
    ).toBeTruthy()
  })

  it('renaming to the exact same name is a no-op (closes without calling move)', async () => {
    render(createElement(ExplorerHarness, { workspace: '/ws' }))
    await screen.findByText('a.txt')

    fireEvent.click(screen.getByLabelText(/Mais ações para a\.txt/))
    fireEvent.click(await screen.findByRole('menuitem', { name: /Renomear/ }))
    const input = await screen.findByPlaceholderText('Novo nome')
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(screen.queryByPlaceholderText('Novo nome')).toBeNull()
    })
    expect(window.hive.fs.move).not.toHaveBeenCalled()
  })

  it('if retrying with overwrite itself fails, the action-error banner shows', async () => {
    window.hive.fs.exists = vi.fn().mockResolvedValue(true)
    window.hive.fs.move = vi.fn().mockRejectedValue(new Error('locked'))

    render(createElement(ExplorerHarness, { workspace: '/ws' }))
    await screen.findByText('a.txt')

    fireEvent.click(screen.getByLabelText(/Mais ações para a\.txt/))
    fireEvent.click(await screen.findByRole('menuitem', { name: /Renomear/ }))
    const input = await screen.findByPlaceholderText('Novo nome')
    fireEvent.change(input, { target: { value: 'taken.txt' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await screen.findByRole('dialog')
    fireEvent.click(screen.getByRole('button', { name: 'Substituir' }))

    expect(
      await screen.findByText('Não foi possível concluir a ação. Tente novamente.')
    ).toBeTruthy()
  })

  it('an OS-drop conflict resolved via the race-condition path (not the pre-check) still supports "Renomear" and "Cancelar"', async () => {
    window.hive.fs.exists = vi.fn().mockResolvedValue(false)
    window.hive.fs.importEntry = vi
      .fn()
      .mockRejectedValueOnce({ name: 'FsConflictError', code: 'CONFLICT', message: 'taken' })
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce({ name: 'FsConflictError', code: 'CONFLICT', message: 'taken again' })

    render(createElement(ExplorerHarness, { workspace: '/ws' }))
    await screen.findByText('a.txt')

    const targetRow = screen.getByText('docs').closest('.wb-tree-row-content') as HTMLElement
    fireEvent.drop(targetRow, { dataTransfer: { files: [{ name: 'one.txt' } as unknown as File] } })

    await screen.findByRole('dialog')
    // "Renomear" on the race-path conflict just skips to the next queued item (single item here, so it settles).
    fireEvent.click(screen.getByRole('button', { name: 'Renomear' }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull()
    })
  })

  it('dragging a row and dropping it on the rail background (no target row) moves it to the workspace root', async () => {
    render(createElement(ExplorerHarness, { workspace: '/ws' }))
    await screen.findByText('a.txt')

    const sourceRow = screen.getByText('prd.md').closest('.wb-tree-row-content') as HTMLElement
    const rail = document.querySelector('.wb-rail-scroll') as HTMLElement
    const dataTransfer = { setData: vi.fn(), effectAllowed: '', files: [] as File[] }

    fireEvent.dragStart(sourceRow, { dataTransfer })
    fireEvent.dragOver(rail, { dataTransfer })
    fireEvent.drop(rail, { dataTransfer })

    await waitFor(() => {
      expect(window.hive.fs.move).toHaveBeenCalledWith('/ws', 'docs/prd.md', 'prd.md')
    })
  })

  it('a trash() rejection shows the generic action-error banner', async () => {
    window.hive.fs.trash = vi.fn().mockRejectedValue(new Error('cannot trash'))

    render(createElement(ExplorerHarness, { workspace: '/ws' }))
    await screen.findByText('a.txt')

    fireEvent.click(screen.getByLabelText(/Mais ações para a\.txt/))
    fireEvent.click(await screen.findByRole('menuitem', { name: /Excluir/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Mover para a lixeira' }))

    expect(
      await screen.findByText('Não foi possível concluir a ação. Tente novamente.')
    ).toBeTruthy()
  })

  it('a directory-create conflict only offers Rename/Cancel (createDirectory has no overwrite option)', async () => {
    window.hive.fs.exists = vi.fn().mockResolvedValue(true)

    render(createElement(ExplorerHarness, { workspace: '/ws' }))
    await screen.findByText('a.txt')

    fireEvent.click(screen.getByRole('button', { name: 'Nova pasta' }))
    const input = await screen.findByPlaceholderText('Nome do arquivo ou pasta')
    fireEvent.change(input, { target: { value: 'docs' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await screen.findByRole('dialog')
    expect(screen.queryByRole('button', { name: 'Substituir' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Renomear' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeTruthy()
  })

  it('the delete dialog\'s "Cancelar" closes it without calling trash', async () => {
    render(createElement(ExplorerHarness, { workspace: '/ws' }))
    await screen.findByText('a.txt')

    fireEvent.click(screen.getByLabelText(/Mais ações para a\.txt/))
    fireEvent.click(await screen.findByRole('menuitem', { name: /Excluir/ }))
    await screen.findByRole('dialog')
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull()
    })
    expect(window.hive.fs.trash).not.toHaveBeenCalled()
  })

  it('clicking directly inside the inline create/rename inputs does not bubble to row selection', async () => {
    render(createElement(ExplorerHarness, { workspace: '/ws' }))
    await screen.findByText('a.txt')

    fireEvent.click(screen.getByRole('button', { name: 'Novo arquivo' }))
    const createInput = await screen.findByPlaceholderText('Nome do arquivo ou pasta')
    fireEvent.click(createInput)
    fireEvent.keyDown(createInput, { key: 'Escape' })

    fireEvent.click(screen.getByLabelText(/Mais ações para a\.txt/))
    fireEvent.click(await screen.findByRole('menuitem', { name: /Renomear/ }))
    const renameInput = await screen.findByPlaceholderText('Novo nome')
    fireEvent.click(renameInput)
    fireEvent.keyDown(renameInput, { key: 'Escape' })

    expect(screen.queryByPlaceholderText('Novo nome')).toBeNull()
  })

  it('"Renomear" on a pre-checked rename conflict keeps the same inline rename input open', async () => {
    window.hive.fs.exists = vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false)

    render(createElement(ExplorerHarness, { workspace: '/ws' }))
    await screen.findByText('a.txt')

    fireEvent.click(screen.getByLabelText(/Mais ações para a\.txt/))
    fireEvent.click(await screen.findByRole('menuitem', { name: /Renomear/ }))
    const input = await screen.findByPlaceholderText('Novo nome')
    fireEvent.change(input, { target: { value: 'taken.txt' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await screen.findByRole('dialog')
    fireEvent.click(screen.getByRole('button', { name: 'Renomear' }))

    const retryInput = await screen.findByPlaceholderText('Novo nome')
    fireEvent.change(retryInput, { target: { value: 'free.txt' } })
    fireEvent.keyDown(retryInput, { key: 'Enter' })

    await waitFor(() => {
      expect(window.hive.fs.move).toHaveBeenCalledWith('/ws', 'a.txt', 'free.txt')
    })
  })

  it('a race-condition create conflict supports "Renomear" (keeps input open) and "Cancelar" (discards)', async () => {
    window.hive.fs.exists = vi.fn().mockResolvedValue(false)
    window.hive.fs.createFile = vi
      .fn()
      .mockRejectedValueOnce({ name: 'FsConflictError', code: 'CONFLICT', message: 'x' })

    render(createElement(ExplorerHarness, { workspace: '/ws' }))
    await screen.findByText('a.txt')

    fireEvent.click(screen.getByRole('button', { name: 'Novo arquivo' }))
    const input = await screen.findByPlaceholderText('Nome do arquivo ou pasta')
    fireEvent.change(input, { target: { value: 'a.txt' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await screen.findByRole('dialog')
    fireEvent.click(screen.getByRole('button', { name: 'Renomear' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(screen.getByPlaceholderText('Nome do arquivo ou pasta')).toBeTruthy()

    fireEvent.keyDown(screen.getByPlaceholderText('Nome do arquivo ou pasta'), { key: 'Escape' })
    expect(screen.queryByPlaceholderText('Nome do arquivo ou pasta')).toBeNull()
  })

  it('a race-condition move conflict supports "Renomear" (keeps input open) and "Cancelar" (discards)', async () => {
    window.hive.fs.exists = vi.fn().mockResolvedValue(false)
    window.hive.fs.move = vi
      .fn()
      .mockRejectedValueOnce({ name: 'FsConflictError', code: 'CONFLICT', message: 'x' })

    render(createElement(ExplorerHarness, { workspace: '/ws' }))
    await screen.findByText('a.txt')

    fireEvent.click(screen.getByLabelText(/Mais ações para a\.txt/))
    fireEvent.click(await screen.findByRole('menuitem', { name: /Renomear/ }))
    const input = await screen.findByPlaceholderText('Novo nome')
    fireEvent.change(input, { target: { value: 'b.txt' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await screen.findByRole('dialog')
    fireEvent.click(screen.getByRole('button', { name: 'Renomear' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(screen.getByPlaceholderText('Novo nome')).toBeTruthy()

    fireEvent.keyDown(screen.getByPlaceholderText('Novo nome'), { key: 'Escape' })
    expect(screen.queryByPlaceholderText('Novo nome')).toBeNull()
    expect(window.hive.fs.move).toHaveBeenCalledTimes(1)
  })

  it('a race-condition import conflict "Cancelar" skips the item and settles the queue', async () => {
    window.hive.fs.exists = vi.fn().mockResolvedValue(false)
    window.hive.fs.importEntry = vi
      .fn()
      .mockRejectedValueOnce({ name: 'FsConflictError', code: 'CONFLICT', message: 'x' })

    render(createElement(ExplorerHarness, { workspace: '/ws' }))
    await screen.findByText('a.txt')

    const targetRow = screen.getByText('docs').closest('.wb-tree-row-content') as HTMLElement
    fireEvent.drop(targetRow, { dataTransfer: { files: [{ name: 'one.txt' } as unknown as File] } })

    await screen.findByRole('dialog')
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull()
    })
    expect(window.hive.fs.importEntry).toHaveBeenCalledTimes(1)
  })

  it('a code file (e.g. .ts) renders with the code icon in the tree', async () => {
    const codeTree = [{ name: 'index.ts', path: 'index.ts', type: 'file' as const }]
    mockHive({ listTree: vi.fn().mockResolvedValue(codeTree) })

    render(createElement(ExplorerHarness, { workspace: '/ws' }))

    expect(await screen.findByText('index.ts')).toBeTruthy()
  })

  // --- T9: editor edit/save/dirty/STALE (FM-R2) ------------------------------

  // --- T5: edit-by-default + mode toggle + draft-preview (UX-R1.1/R1.4) -----

  it('opening a .txt file lands directly in the editable textarea, no click needed', async () => {
    render(createElement(ExplorerHarness, { workspace: '/ws' }))
    fireEvent.click(await screen.findByText('a.txt'))

    const textarea = (await screen.findByLabelText('Conteúdo do arquivo')) as HTMLTextAreaElement
    expect(textarea.value).toBe('plain text content')
    expect(screen.queryByTestId('code-viewer')).toBeNull()
  })

  it('a plain .txt file has no preview toggle button (edit-only)', async () => {
    render(createElement(ExplorerHarness, { workspace: '/ws' }))
    fireEvent.click(await screen.findByText('a.txt'))
    await screen.findByLabelText('Conteúdo do arquivo')

    expect(screen.queryByRole('button', { name: 'Visualizar' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Editar' })).toBeNull()
  })

  it('opening a .md file also lands in edit mode by default', async () => {
    mockHive({ readFile: vi.fn().mockResolvedValue('# Título\n\nUm parágrafo.') })

    render(createElement(ExplorerHarness, { workspace: '/ws' }))
    fireEvent.click(await screen.findByText('prd.md'))

    const textarea = (await screen.findByLabelText('Conteúdo do arquivo')) as HTMLTextAreaElement
    expect(textarea.value).toBe('# Título\n\nUm parágrafo.')
    expect(screen.queryByTestId('markdown-viewer')).toBeNull()
  })

  it('toggling a .md file to preview shows the unsaved draft, not the last-saved content', async () => {
    mockHive({ readFile: vi.fn().mockResolvedValue('# Original') })

    render(createElement(ExplorerHarness, { workspace: '/ws' }))
    fireEvent.click(await screen.findByText('prd.md'))

    const textarea = await screen.findByLabelText('Conteúdo do arquivo')
    fireEvent.change(textarea, { target: { value: '# Edited draft' } })

    fireEvent.click(await screen.findByRole('button', { name: 'Visualizar' }))

    const markdownViewer = await screen.findByTestId('markdown-viewer')
    expect(markdownViewer.querySelector('h1')?.textContent).toBe('Edited draft')
    expect(markdownViewer.textContent).not.toContain('Original')
  })

  it('toggling an .html file to preview renders HtmlPreview seeded with the current draft', async () => {
    const htmlTree = [{ name: 'page.html', path: 'page.html', type: 'file' as const }]
    mockHive({
      listTree: vi.fn().mockResolvedValue(htmlTree),
      readFile: vi.fn().mockResolvedValue('<p>original</p>')
    })

    render(createElement(ExplorerHarness, { workspace: '/ws' }))
    fireEvent.click(await screen.findByText('page.html'))

    const textarea = await screen.findByLabelText('Conteúdo do arquivo')
    fireEvent.change(textarea, { target: { value: '<p>edited</p>' } })

    fireEvent.click(await screen.findByRole('button', { name: 'Visualizar' }))

    const preview = await screen.findByTestId('html-preview-pane')
    const iframe = preview.querySelector('iframe') as HTMLIFrameElement
    expect(iframe).toBeTruthy()
    expect(iframe.getAttribute('srcdoc')).toBe('<p>edited</p>')
    expect(screen.queryByLabelText('Conteúdo do arquivo')).toBeNull()
  })

  it('image files open in the rich viewer, read-only with no Edit toggle (FM-R2.1)', async () => {
    const binaryTree = [{ name: 'logo.png', path: 'logo.png', type: 'file' as const }]
    mockHive({
      listTree: vi.fn().mockResolvedValue(binaryTree),
      readFile: vi.fn().mockResolvedValue('')
    })

    render(createElement(ExplorerHarness, { workspace: '/ws' }))
    fireEvent.click(await screen.findByText('logo.png'))

    // The image viewer renders the file as an <img> (data: URL), not a text
    // editor or the raw-bytes CodeBlock.
    await screen.findByAltText('logo.png')
    expect(screen.queryByTestId('code-viewer')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Editar' })).toBeNull()
    expect(screen.queryByLabelText('Conteúdo do arquivo')).toBeNull()
  })

  it('a non-previewable binary opens the graceful unsupported card, not the editor', async () => {
    const binaryTree = [{ name: 'bundle.zip', path: 'bundle.zip', type: 'file' as const }]
    mockHive({ listTree: vi.fn().mockResolvedValue(binaryTree) })

    render(createElement(ExplorerHarness, { workspace: '/ws' }))
    fireEvent.click(await screen.findByText('bundle.zip'))

    expect(await screen.findByText('Pré-visualização indisponível')).toBeTruthy()
    expect(screen.queryByLabelText('Conteúdo do arquivo')).toBeNull()
    expect(screen.queryByTestId('code-viewer')).toBeNull()
  })

  it('editing the textarea marks the file dirty (shows the dot, Save and Discard)', async () => {
    render(createElement(ExplorerHarness, { workspace: '/ws' }))
    fireEvent.click(await screen.findByText('a.txt'))

    const textarea = await screen.findByLabelText('Conteúdo do arquivo')
    fireEvent.change(textarea, { target: { value: 'edited content' } })

    expect(await screen.findByRole('button', { name: 'Salvar' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Descartar' })).toBeTruthy()
    expect(document.querySelector('.wb-dirty-dot')).toBeTruthy()
  })

  // --- WS-R5.1 enablement: FileViewer.onDirtyChange (T6, workspace-switching) ---

  it('shows the change gutter when gitEnabled and the file differs from HEAD (GIT-R11.2)', async () => {
    mockHive({ readFile: vi.fn().mockResolvedValue('a\nb\nc') })
    window.hive.git.fileAtHead = vi.fn().mockResolvedValue('a\nX\nc')
    render(
      createElement(FileViewer, {
        workspace: '/ws',
        path: 'a.txt',
        onClose: vi.fn(),
        gitEnabled: true
      })
    )
    await screen.findByLabelText('Conteúdo do arquivo')
    await waitFor(() =>
      expect(document.querySelector('.wb-editor-gutter-mark[data-mark="modified"]')).not.toBeNull()
    )
  })

  it('shows no gutter when gitEnabled is false', async () => {
    mockHive({ readFile: vi.fn().mockResolvedValue('a\nb') })
    render(createElement(FileViewer, { workspace: '/ws', path: 'a.txt', onClose: vi.fn() }))
    await screen.findByLabelText('Conteúdo do arquivo')
    await new Promise((r) => setTimeout(r, 160))
    expect(document.querySelector('.wb-editor-gutter')).toBeNull()
  })

  it('onDirtyChange(true) fires when the draft diverges from the saved content', async () => {
    const onDirtyChange = vi.fn()
    render(createElement(ExplorerHarness, { workspace: '/ws', onDirtyChange }))
    fireEvent.click(await screen.findByText('a.txt'))
    await screen.findByLabelText('Conteúdo do arquivo')

    onDirtyChange.mockClear()
    fireEvent.change(await screen.findByLabelText('Conteúdo do arquivo'), {
      target: { value: 'edited content' }
    })

    await waitFor(() => {
      expect(onDirtyChange).toHaveBeenCalledWith(true)
    })
  })

  it('onDirtyChange(false) fires after Save clears the dirty draft', async () => {
    window.hive.fs.statFile = vi.fn().mockResolvedValue({ mtimeMs: 4242, size: 19 })
    const onDirtyChange = vi.fn()
    render(createElement(ExplorerHarness, { workspace: '/ws', onDirtyChange }))
    fireEvent.click(await screen.findByText('a.txt'))
    fireEvent.change(await screen.findByLabelText('Conteúdo do arquivo'), {
      target: { value: 'edited content' }
    })
    await waitFor(() => expect(onDirtyChange).toHaveBeenCalledWith(true))

    fireEvent.click(await screen.findByRole('button', { name: 'Salvar' }))

    await waitFor(() => {
      expect(onDirtyChange).toHaveBeenLastCalledWith(false)
    })
  })

  it('onDirtyChange(false) fires after Discard reverts the draft', async () => {
    const onDirtyChange = vi.fn()
    render(createElement(ExplorerHarness, { workspace: '/ws', onDirtyChange }))
    fireEvent.click(await screen.findByText('a.txt'))
    fireEvent.change(await screen.findByLabelText('Conteúdo do arquivo'), {
      target: { value: 'edited content' }
    })
    await waitFor(() => expect(onDirtyChange).toHaveBeenCalledWith(true))

    fireEvent.click(await screen.findByRole('button', { name: 'Descartar' }))

    await waitFor(() => {
      expect(onDirtyChange).toHaveBeenLastCalledWith(false)
    })
  })

  it('Save calls saveFile with the draft content and the statFile baseline mtimeMs, then clears dirty', async () => {
    window.hive.fs.statFile = vi.fn().mockResolvedValue({ mtimeMs: 4242, size: 19 })

    render(createElement(ExplorerHarness, { workspace: '/ws' }))
    fireEvent.click(await screen.findByText('a.txt'))
    fireEvent.change(await screen.findByLabelText('Conteúdo do arquivo'), {
      target: { value: 'edited content' }
    })

    fireEvent.click(await screen.findByRole('button', { name: 'Salvar' }))

    await waitFor(() => {
      expect(window.hive.fs.saveFile).toHaveBeenCalledWith('/ws', 'a.txt', 'edited content', {
        expectedMtimeMs: 4242
      })
    })
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Salvar' })).toBeNull()
    })
  })

  it('a STALE save rejection opens "O arquivo mudou no disco"', async () => {
    window.hive.fs.saveFile = vi
      .fn()
      .mockRejectedValue({ name: 'FsConflictError', code: 'STALE', message: 'changed on disk' })

    render(createElement(ExplorerHarness, { workspace: '/ws' }))
    fireEvent.click(await screen.findByText('a.txt'))
    fireEvent.change(await screen.findByLabelText('Conteúdo do arquivo'), {
      target: { value: 'edited content' }
    })
    fireEvent.click(await screen.findByRole('button', { name: 'Salvar' }))

    const dialog = await screen.findByRole('dialog')
    expect(dialog.textContent).toContain('O arquivo mudou no disco')
  })

  it('STALE dialog "Recarregar" discards local edits, re-reads the file and resets the baseline', async () => {
    window.hive.fs.saveFile = vi
      .fn()
      .mockRejectedValue({ name: 'FsConflictError', code: 'STALE', message: 'x' })
    window.hive.readFile = vi
      .fn()
      .mockResolvedValueOnce('plain text content')
      .mockResolvedValueOnce('content changed on disk')
    window.hive.fs.statFile = vi
      .fn()
      .mockResolvedValueOnce({ mtimeMs: 1000, size: 19 })
      .mockResolvedValueOnce({ mtimeMs: 5000, size: 24 })

    render(createElement(ExplorerHarness, { workspace: '/ws' }))
    fireEvent.click(await screen.findByText('a.txt'))
    fireEvent.change(await screen.findByLabelText('Conteúdo do arquivo'), {
      target: { value: 'edited content' }
    })
    fireEvent.click(await screen.findByRole('button', { name: 'Salvar' }))

    await screen.findByRole('dialog')
    fireEvent.click(screen.getByRole('button', { name: 'Recarregar' }))

    await waitFor(() => {
      expect((screen.getByLabelText('Conteúdo do arquivo') as HTMLTextAreaElement).value).toBe(
        'content changed on disk'
      )
    })
    expect(screen.queryByRole('dialog')).toBeNull()

    // the fresh statFile's mtimeMs (5000) is now the baseline for the next save.
    fireEvent.change(screen.getByLabelText('Conteúdo do arquivo'), {
      target: { value: 'more edits' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    await waitFor(() => {
      expect(window.hive.fs.saveFile).toHaveBeenLastCalledWith('/ws', 'a.txt', 'more edits', {
        expectedMtimeMs: 5000
      })
    })
  })

  it('STALE dialog "Sobrescrever" retries saveFile WITHOUT expectedMtimeMs and refreshes the baseline', async () => {
    window.hive.fs.saveFile = vi
      .fn()
      .mockRejectedValueOnce({ name: 'FsConflictError', code: 'STALE', message: 'x' })
      .mockResolvedValueOnce({ mtimeMs: 9000, size: 30 })

    render(createElement(ExplorerHarness, { workspace: '/ws' }))
    fireEvent.click(await screen.findByText('a.txt'))
    fireEvent.change(await screen.findByLabelText('Conteúdo do arquivo'), {
      target: { value: 'edited content' }
    })
    fireEvent.click(await screen.findByRole('button', { name: 'Salvar' }))

    await screen.findByRole('dialog')
    fireEvent.click(screen.getByRole('button', { name: 'Sobrescrever' }))

    await waitFor(() => {
      expect(window.hive.fs.saveFile).toHaveBeenLastCalledWith('/ws', 'a.txt', 'edited content')
    })
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull()
    })
  })

  it('if retrying "Sobrescrever" itself fails, the action-error banner shows', async () => {
    window.hive.fs.saveFile = vi
      .fn()
      .mockRejectedValueOnce({ name: 'FsConflictError', code: 'STALE', message: 'x' })
      .mockRejectedValueOnce(new Error('disk full'))

    render(createElement(ExplorerHarness, { workspace: '/ws' }))
    fireEvent.click(await screen.findByText('a.txt'))
    fireEvent.change(await screen.findByLabelText('Conteúdo do arquivo'), {
      target: { value: 'edited content' }
    })
    fireEvent.click(await screen.findByRole('button', { name: 'Salvar' }))

    await screen.findByRole('dialog')
    fireEvent.click(screen.getByRole('button', { name: 'Sobrescrever' }))

    expect(
      await screen.findByText('Não foi possível concluir a ação. Tente novamente.')
    ).toBeTruthy()
  })

  it('Discard reverts the textarea to the last-saved content and clears dirty', async () => {
    render(createElement(ExplorerHarness, { workspace: '/ws' }))
    fireEvent.click(await screen.findByText('a.txt'))
    fireEvent.change(await screen.findByLabelText('Conteúdo do arquivo'), {
      target: { value: 'edited content' }
    })
    expect(await screen.findByRole('button', { name: 'Descartar' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Descartar' }))

    await waitFor(() => {
      expect((screen.getByLabelText('Conteúdo do arquivo') as HTMLTextAreaElement).value).toBe(
        'plain text content'
      )
    })
    expect(screen.queryByRole('button', { name: 'Salvar' })).toBeNull()
  })

  it('the unsaved-changes guard blocks switching files while dirty until confirmed', async () => {
    render(createElement(ExplorerHarness, { workspace: '/ws' }))
    fireEvent.click(await screen.findByText('a.txt'))
    fireEvent.change(await screen.findByLabelText('Conteúdo do arquivo'), {
      target: { value: 'edited content' }
    })

    fireEvent.click(screen.getByText('prd.md'))

    const dialog = await screen.findByRole('dialog')
    expect(dialog.textContent).toContain('Alterações não salvas')
    expect(window.hive.readFile).not.toHaveBeenCalledWith('/ws', 'docs/prd.md')

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(window.hive.readFile).not.toHaveBeenCalledWith('/ws', 'docs/prd.md')
    expect((screen.getByLabelText('Conteúdo do arquivo') as HTMLTextAreaElement).value).toBe(
      'edited content'
    )
  })

  // P0-011 (R-03). Both guards below were only ever tested by clicking one of
  // their buttons. Radix also closes on Escape and backdrop-click, and that
  // path runs different code — for two dialogs whose whole job is to stop the
  // user losing work, "dismissed" resolving to the destructive answer is the
  // failure that matters.
  it('dismissing the STALE dialog keeps the local edits and does not overwrite the disk', async () => {
    window.hive.fs.saveFile = vi
      .fn()
      .mockRejectedValue({ name: 'FsConflictError', code: 'STALE', message: 'x' })

    render(createElement(ExplorerHarness, { workspace: '/ws' }))
    fireEvent.click(await screen.findByText('a.txt'))
    fireEvent.change(await screen.findByLabelText('Conteúdo do arquivo'), {
      target: { value: 'edited content' }
    })
    fireEvent.click(await screen.findByRole('button', { name: 'Salvar' }))
    await screen.findByRole('dialog')

    const savesBefore = vi.mocked(window.hive.fs.saveFile).mock.calls.length
    fireEvent.click(screen.getByTestId('dialog-dismiss'))

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    // Edits survive, and no second save was attempted behind the user's back.
    expect((screen.getByLabelText('Conteúdo do arquivo') as HTMLTextAreaElement).value).toBe(
      'edited content'
    )
    expect(vi.mocked(window.hive.fs.saveFile).mock.calls).toHaveLength(savesBefore)
  })

  it('dismissing the unsaved-changes guard aborts the switch and keeps the edits', async () => {
    render(createElement(ExplorerHarness, { workspace: '/ws' }))
    fireEvent.click(await screen.findByText('a.txt'))
    fireEvent.change(await screen.findByLabelText('Conteúdo do arquivo'), {
      target: { value: 'edited content' }
    })

    fireEvent.click(screen.getByText('prd.md'))
    await screen.findByRole('dialog')
    fireEvent.click(screen.getByTestId('dialog-dismiss'))

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(window.hive.readFile).not.toHaveBeenCalledWith('/ws', 'docs/prd.md')
    expect((screen.getByLabelText('Conteúdo do arquivo') as HTMLTextAreaElement).value).toBe(
      'edited content'
    )
  })

  it('confirming the unsaved-changes guard discards edits and opens the new file', async () => {
    render(createElement(ExplorerHarness, { workspace: '/ws' }))
    fireEvent.click(await screen.findByText('a.txt'))
    fireEvent.change(await screen.findByLabelText('Conteúdo do arquivo'), {
      target: { value: 'edited content' }
    })

    fireEvent.click(screen.getByText('prd.md'))
    await screen.findByRole('dialog')
    fireEvent.click(screen.getByRole('button', { name: 'Descartar alterações' }))

    await waitFor(() => {
      expect(window.hive.readFile).toHaveBeenCalledWith('/ws', 'docs/prd.md')
    })
  })

  it('closing the viewer while dirty asks for confirmation before closing', async () => {
    render(createElement(ExplorerHarness, { workspace: '/ws' }))
    fireEvent.click(await screen.findByText('a.txt'))
    fireEvent.change(await screen.findByLabelText('Conteúdo do arquivo'), {
      target: { value: 'edited content' }
    })

    fireEvent.click(screen.getByLabelText('Fechar arquivo'))

    const dialog = await screen.findByRole('dialog')
    expect(dialog.textContent).toContain('Alterações não salvas')

    fireEvent.click(screen.getByRole('button', { name: 'Descartar alterações' }))
    await waitFor(() => {
      expect(screen.queryByLabelText('Conteúdo do arquivo')).toBeNull()
    })
  })

  it('closing the viewer when not dirty closes immediately without a confirm dialog', async () => {
    render(createElement(ExplorerHarness, { workspace: '/ws' }))
    fireEvent.click(await screen.findByText('a.txt'))
    await screen.findByLabelText('Conteúdo do arquivo')

    fireEvent.click(screen.getByLabelText('Fechar arquivo'))

    await waitFor(() => {
      expect(screen.queryByLabelText('Conteúdo do arquivo')).toBeNull()
    })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('switching to a different file while not dirty opens it directly (no guard dialog)', async () => {
    render(createElement(ExplorerHarness, { workspace: '/ws' }))
    fireEvent.click(await screen.findByText('a.txt'))
    await screen.findByLabelText('Conteúdo do arquivo')

    fireEvent.click(screen.getByText('prd.md'))

    await waitFor(() => {
      expect(window.hive.readFile).toHaveBeenCalledWith('/ws', 'docs/prd.md')
    })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  // --- T6: Ctrl+S + three-way save-on-close (UX-R1.2/R1.3) ------------------

  it('Ctrl+S saves the file while dirty', async () => {
    window.hive.fs.statFile = vi.fn().mockResolvedValue({ mtimeMs: 4242, size: 19 })

    render(createElement(ExplorerHarness, { workspace: '/ws' }))
    fireEvent.click(await screen.findByText('a.txt'))
    fireEvent.change(await screen.findByLabelText('Conteúdo do arquivo'), {
      target: { value: 'edited content' }
    })

    fireEvent.keyDown(window, { key: 's', ctrlKey: true })

    await waitFor(() => {
      expect(window.hive.fs.saveFile).toHaveBeenCalledWith('/ws', 'a.txt', 'edited content', {
        expectedMtimeMs: 4242
      })
    })
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Salvar' })).toBeNull()
    })
  })

  it('Ctrl+S is a no-op when the file is not dirty (no spurious save)', async () => {
    render(createElement(ExplorerHarness, { workspace: '/ws' }))
    fireEvent.click(await screen.findByText('a.txt'))
    await screen.findByLabelText('Conteúdo do arquivo')

    fireEvent.keyDown(window, { key: 's', ctrlKey: true })

    expect(window.hive.fs.saveFile).not.toHaveBeenCalled()
  })

  it('the unsaved-changes guard is a three-way dialog: Salvar, Descartar, Cancelar', async () => {
    render(createElement(ExplorerHarness, { workspace: '/ws' }))
    fireEvent.click(await screen.findByText('a.txt'))
    fireEvent.change(await screen.findByLabelText('Conteúdo do arquivo'), {
      target: { value: 'edited content' }
    })

    fireEvent.click(screen.getByLabelText('Fechar arquivo'))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('button', { name: 'Salvar' })).toBeTruthy()
    expect(within(dialog).getByRole('button', { name: 'Descartar alterações' })).toBeTruthy()
    expect(within(dialog).getByRole('button', { name: 'Cancelar' })).toBeTruthy()
  })

  it('clicking Salvar in the close-guard persists the draft then closes the viewer', async () => {
    window.hive.fs.statFile = vi.fn().mockResolvedValue({ mtimeMs: 4242, size: 19 })

    render(createElement(ExplorerHarness, { workspace: '/ws' }))
    fireEvent.click(await screen.findByText('a.txt'))
    fireEvent.change(await screen.findByLabelText('Conteúdo do arquivo'), {
      target: { value: 'edited content' }
    })

    fireEvent.click(screen.getByLabelText('Fechar arquivo'))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }))

    await waitFor(() => {
      expect(window.hive.fs.saveFile).toHaveBeenCalledWith('/ws', 'a.txt', 'edited content', {
        expectedMtimeMs: 4242
      })
    })
    await waitFor(() => {
      expect(screen.queryByLabelText('Conteúdo do arquivo')).toBeNull()
    })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('clicking Salvar in the switch-file guard persists the draft then opens the new file', async () => {
    window.hive.fs.statFile = vi.fn().mockResolvedValue({ mtimeMs: 4242, size: 19 })

    render(createElement(ExplorerHarness, { workspace: '/ws' }))
    fireEvent.click(await screen.findByText('a.txt'))
    fireEvent.change(await screen.findByLabelText('Conteúdo do arquivo'), {
      target: { value: 'edited content' }
    })

    fireEvent.click(screen.getByText('prd.md'))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }))

    await waitFor(() => {
      expect(window.hive.fs.saveFile).toHaveBeenCalledWith('/ws', 'a.txt', 'edited content', {
        expectedMtimeMs: 4242
      })
    })
    await waitFor(() => {
      expect(window.hive.readFile).toHaveBeenCalledWith('/ws', 'docs/prd.md')
    })
  })

  it('clicking Cancelar keeps the viewer open with the draft still dirty (no close/switch, no save)', async () => {
    render(createElement(ExplorerHarness, { workspace: '/ws' }))
    fireEvent.click(await screen.findByText('a.txt'))
    fireEvent.change(await screen.findByLabelText('Conteúdo do arquivo'), {
      target: { value: 'edited content' }
    })

    fireEvent.click(screen.getByLabelText('Fechar arquivo'))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(window.hive.fs.saveFile).not.toHaveBeenCalled()
    expect((screen.getByLabelText('Conteúdo do arquivo') as HTMLTextAreaElement).value).toBe(
      'edited content'
    )
  })

  it('a STALE conflict during Salvar surfaces the STALE dialog and does not close/switch', async () => {
    window.hive.fs.saveFile = vi
      .fn()
      .mockRejectedValue({ name: 'FsConflictError', code: 'STALE', message: 'changed on disk' })

    render(createElement(ExplorerHarness, { workspace: '/ws' }))
    fireEvent.click(await screen.findByText('a.txt'))
    fireEvent.change(await screen.findByLabelText('Conteúdo do arquivo'), {
      target: { value: 'edited content' }
    })

    fireEvent.click(screen.getByLabelText('Fechar arquivo'))
    const guardDialog = await screen.findByRole('dialog')
    fireEvent.click(within(guardDialog).getByRole('button', { name: 'Salvar' }))

    await waitFor(() => {
      expect(screen.getByRole('dialog').textContent).toContain('O arquivo mudou no disco')
    })
    // the close never happened — the editor is still on screen, still dirty.
    expect(screen.queryByLabelText('Conteúdo do arquivo')).toBeTruthy()
  })

  it('Descartar in the switch-file guard still discards and opens the new file (unchanged behavior)', async () => {
    render(createElement(ExplorerHarness, { workspace: '/ws' }))
    fireEvent.click(await screen.findByText('a.txt'))
    fireEvent.change(await screen.findByLabelText('Conteúdo do arquivo'), {
      target: { value: 'edited content' }
    })

    fireEvent.click(screen.getByText('prd.md'))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Descartar alterações' }))

    await waitFor(() => {
      expect(window.hive.readFile).toHaveBeenCalledWith('/ws', 'docs/prd.md')
    })
    expect(window.hive.fs.saveFile).not.toHaveBeenCalled()
  })

  it('the Copy button writes the file content to the clipboard and shows "Copiado"', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true
    })

    render(createElement(ExplorerHarness, { workspace: '/ws' }))
    fireEvent.click(await screen.findByText('a.txt'))
    await screen.findByLabelText('Conteúdo do arquivo')

    fireEvent.click(screen.getByRole('button', { name: 'Copiar conteúdo' }))

    expect(writeText).toHaveBeenCalledWith('plain text content')
    expect(await screen.findByRole('button', { name: 'Copiado' })).toBeTruthy()
  })

  it('a readFile failure on open shows the viewer error state', async () => {
    mockHive({ readFile: vi.fn().mockRejectedValue(new Error('cannot read')) })

    render(createElement(ExplorerHarness, { workspace: '/ws' }))
    fireEvent.click(await screen.findByText('a.txt'))

    expect(await screen.findByText('Não foi possível abrir o arquivo')).toBeTruthy()
  })

  it('the Copy button is a no-op while the file is still loading (disabled-state guard)', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true
    })
    let resolveRead: (value: string) => void = () => {}
    mockHive({
      readFile: vi.fn(
        () =>
          new Promise<string>((resolve) => {
            resolveRead = resolve
          })
      )
    })

    render(createElement(ExplorerHarness, { workspace: '/ws' }))
    fireEvent.click(await screen.findByText('a.txt'))
    await screen.findByRole('status')

    fireEvent.click(screen.getByRole('button', { name: 'Copiar conteúdo' }))

    expect(writeText).not.toHaveBeenCalled()
    expect(screen.queryByLabelText('Conteúdo do arquivo')).toBeNull()

    resolveRead('plain text content')
    await screen.findByLabelText('Conteúdo do arquivo')
  })

  it('the preview toggle button is disabled (a no-op) while the file is still loading', async () => {
    let resolveRead: (value: string) => void = () => {}
    mockHive({
      readFile: vi.fn(
        () =>
          new Promise<string>((resolve) => {
            resolveRead = resolve
          })
      )
    })

    render(createElement(ExplorerHarness, { workspace: '/ws' }))
    fireEvent.click(await screen.findByText('prd.md'))
    await screen.findByRole('status')

    fireEvent.click(screen.getByRole('button', { name: 'Visualizar' }))

    expect(screen.queryByTestId('markdown-viewer')).toBeNull()
    expect(screen.queryByLabelText('Conteúdo do arquivo')).toBeNull()

    resolveRead('# Título')
    // Still lands in edit mode by default — the disabled click above never
    // flipped the mode.
    await screen.findByLabelText('Conteúdo do arquivo')
  })

  it('unmounting while the initial fetch is in flight does not throw when it later settles (race guard)', async () => {
    let resolveRead: (value: string) => void = () => {}
    mockHive({
      readFile: vi.fn(
        () =>
          new Promise<string>((resolve) => {
            resolveRead = resolve
          })
      )
    })

    const { unmount } = render(createElement(ExplorerHarness, { workspace: '/ws' }))
    fireEvent.click(await screen.findByText('a.txt'))
    await screen.findByRole('status')

    unmount()
    resolveRead('late content')
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
  /**
   * design-studio (DS-R1 AC-1) — the Explorer is one of the two entry points
   * into the Studio ("quem abre a aba é a superfície que já tem o arquivo em
   * mãos", design.md §2). The action is Markdown-only, so the two tests that
   * matter are: it is there on a `.md`, and it is NOT there on anything else.
   */
  describe('FileTree — "Abrir no Design Studio" (design-studio DS-R1)', () => {
    beforeEach(() => {
      mockHive()
    })

    function renderTree(onOpenDesignStudio?: (path: string) => void): void {
      render(
        createElement(FileTree, {
          workspace: '/ws',
          selectedPath: null,
          onOpenFile: () => {},
          onOpenDesignStudio
        })
      )
    }

    it('opens the Studio for the right-clicked Markdown file', async () => {
      const onOpenDesignStudio = vi.fn()
      renderTree(onOpenDesignStudio)
      await screen.findByText('prd.md')

      const row = screen.getByText('prd.md').closest('.wb-tree-row-content') as HTMLElement
      fireEvent.contextMenu(row)
      fireEvent.click(await screen.findByRole('menuitem', { name: /Abrir no Design Studio/ }))

      expect(onOpenDesignStudio).toHaveBeenCalledWith('docs/prd.md')
    })

    it('does not offer the Studio on a non-Markdown file', async () => {
      renderTree(vi.fn())
      await screen.findByText('a.txt')

      const row = screen.getByText('a.txt').closest('.wb-tree-row-content') as HTMLElement
      fireEvent.contextMenu(row)

      await screen.findByRole('menuitem', { name: /Excluir/ })
      expect(screen.queryByRole('menuitem', { name: /Abrir no Design Studio/ })).toBeNull()
    })

    it('does not offer the Studio on a folder', async () => {
      renderTree(vi.fn())
      await screen.findByText('docs')

      const row = screen.getByText('docs').closest('.wb-tree-row-content') as HTMLElement
      fireEvent.contextMenu(row)

      await screen.findByRole('menuitem', { name: /Excluir/ })
      expect(screen.queryByRole('menuitem', { name: /Abrir no Design Studio/ })).toBeNull()
    })

    it('omits the action entirely when no handler is wired', async () => {
      renderTree(undefined)
      await screen.findByText('prd.md')

      const row = screen.getByText('prd.md').closest('.wb-tree-row-content') as HTMLElement
      fireEvent.contextMenu(row)

      await screen.findByRole('menuitem', { name: /Excluir/ })
      expect(screen.queryByRole('menuitem', { name: /Abrir no Design Studio/ })).toBeNull()
    })
  })
})
