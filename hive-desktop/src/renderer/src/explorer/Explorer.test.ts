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
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react'
import { FileTree, FileViewer } from './Explorer'

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
function ExplorerHarness({ workspace }: { workspace: string }): ReactNode {
  const [openPath, setOpenPath] = useState<string | null>(null)
  return createElement(
    'div',
    null,
    createElement(FileTree, { workspace, selectedPath: openPath, onOpenFile: setOpenPath }),
    openPath !== null
      ? createElement(FileViewer, { workspace, path: openPath, onClose: () => setOpenPath(null) })
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
        const state: MockTreeRenderState = {
          level: 1,
          expanded: true,
          selected: Boolean(selectedIds?.includes(node.id)),
          hasChildren
        }
        const content = renderLabel ? renderLabel(node, state) : node.label
        return createElement(
          'div',
          { key: node.id, role: 'treeitem', onClick: () => onSelectedIdsChange?.([node.id]) },
          content
        )
      })
    ),
  CodeBlock: ({ children }: { children?: ReactNode }) =>
    createElement('pre', { 'data-testid': 'code-viewer' }, children),
  Dialog: ({ children }: { children?: ReactNode }) =>
    createElement('div', { role: 'dialog' }, children),
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
    )
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
      ping: vi.fn().mockResolvedValue('pong'),
      chooseWorkspace: vi.fn().mockResolvedValue(null),
      getWorkspace: vi.fn().mockResolvedValue(null),
      isProvisioned: vi.fn().mockResolvedValue(false),
      listTree: vi.fn().mockResolvedValue(fixtureTree),
      readFile: vi.fn().mockResolvedValue('plain text content'),
      watchWorkspace: vi.fn((_root, onChange: WatchListener) => {
        watchListeners.push(onChange)
        return vi.fn()
      }),
      agent: {
        capabilities: vi
          .fn()
          .mockResolvedValue({ models: [], efforts: [], supportsAttachments: false }),
        start: vi.fn().mockResolvedValue(undefined),
        send: vi.fn().mockResolvedValue(undefined),
        runWorkflow: vi.fn().mockResolvedValue(undefined),
        onEvent: vi.fn().mockReturnValue(() => {})
      },
      installBmad: vi.fn().mockReturnValue(() => {}),
      updateBmad: vi.fn().mockReturnValue(() => {}),
      workflows: { list: vi.fn().mockResolvedValue([]) },
      fs: {
        statFile: vi.fn(),
        createFile: vi.fn().mockResolvedValue(undefined),
        createDirectory: vi.fn().mockResolvedValue(undefined),
        saveFile: vi.fn(),
        move: vi.fn().mockResolvedValue(undefined),
        importEntry: vi.fn().mockResolvedValue(undefined),
        exists: vi.fn().mockResolvedValue(false),
        trash: vi.fn().mockResolvedValue(undefined),
        pathForFile: vi.fn().mockReturnValue('/abs/os/path/dropped.txt')
      }
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
    expect((await screen.findByTestId('code-viewer')).textContent).toContain('plain text content')
  })

  it('renders a .md file readably (not as a raw code block)', async () => {
    mockHive({ readFile: vi.fn().mockResolvedValue('# Título\n\nUm parágrafo.') })

    render(createElement(ExplorerHarness, { workspace: '/ws' }))

    const mdButton = await screen.findByText('prd.md')
    fireEvent.click(mdButton)

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

  it('blurring the inline create input cancels it without creating anything', async () => {
    render(createElement(ExplorerHarness, { workspace: '/ws' }))
    await screen.findByText('a.txt')

    fireEvent.click(screen.getByRole('button', { name: 'Novo arquivo' }))
    const input = await screen.findByPlaceholderText('Nome do arquivo ou pasta')
    fireEvent.change(input, { target: { value: 'never.txt' } })
    fireEvent.blur(input)

    await waitFor(() => {
      expect(screen.queryByPlaceholderText('Nome do arquivo ou pasta')).toBeNull()
    })
    expect(window.hive.fs.createFile).not.toHaveBeenCalled()
  })

  it('blurring the inline rename input cancels it without moving anything', async () => {
    render(createElement(ExplorerHarness, { workspace: '/ws' }))
    await screen.findByText('a.txt')

    fireEvent.click(screen.getByLabelText(/Mais ações para a\.txt/))
    fireEvent.click(await screen.findByRole('menuitem', { name: /Renomear/ }))
    const input = await screen.findByPlaceholderText('Novo nome')
    fireEvent.change(input, { target: { value: 'renamed.txt' } })
    fireEvent.blur(input)

    await waitFor(() => {
      expect(screen.queryByPlaceholderText('Novo nome')).toBeNull()
    })
    expect(window.hive.fs.move).not.toHaveBeenCalled()
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
})
