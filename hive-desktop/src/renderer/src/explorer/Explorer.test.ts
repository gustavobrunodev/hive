// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Explorer } from './Explorer'

/**
 * Task T12 — Explorer + viewer UI (design.md §4, R5.1–R5.4).
 *
 * Same mocking approach as App.test.ts (T6): `@hive/design-system` is
 * mocked with trivial DOM stand-ins (rendering its real bundle here would
 * load a second React instance from design-system's own node_modules and
 * crash on `Invalid hook call`), and `window.hive` is mocked entirely per
 * test since there's no real main process in this environment.
 */
interface MockTreeNode {
  id: string
  label: ReactNode
  children?: MockTreeNode[]
}

function flattenTreeNodes(nodes: MockTreeNode[]): MockTreeNode[] {
  return nodes.flatMap((node) => [node, ...(node.children ? flattenTreeNodes(node.children) : [])])
}

vi.mock('@hive/design-system', () => ({
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
    onSelectedIdsChange
  }: {
    nodes: MockTreeNode[]
    onSelectedIdsChange?: (ids: string[]) => void
  }) =>
    createElement(
      'div',
      { role: 'tree' },
      flattenTreeNodes(nodes).map((node) =>
        createElement(
          'button',
          { key: node.id, onClick: () => onSelectedIdsChange?.([node.id]) },
          node.label
        )
      )
    ),
  CodeBlock: ({ children }: { children?: ReactNode }) =>
    createElement('pre', { 'data-testid': 'code-viewer' }, children)
}))

describe('Explorer (T12)', () => {
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
      }
    }
    window.hive = Object.assign(defaults, overrides)
    return { watchListeners }
  }

  beforeEach(() => {
    mockHive()
  })

  it('renders the tree fetched via listTree()', async () => {
    render(createElement(Explorer, { workspace: '/ws' }))

    expect(await screen.findByText('a.txt')).toBeTruthy()
    expect(await screen.findByText('docs')).toBeTruthy()
    expect(await screen.findByText('prd.md')).toBeTruthy()
    expect(window.hive.listTree).toHaveBeenCalledWith('/ws')
  })

  it('clicking a tree file calls readFile() and shows its content in the viewer', async () => {
    mockHive({ readFile: vi.fn().mockResolvedValue('plain text content') })

    render(createElement(Explorer, { workspace: '/ws' }))

    const fileButton = await screen.findByText('a.txt')
    fireEvent.click(fileButton)

    expect(window.hive.readFile).toHaveBeenCalledWith('/ws', 'a.txt')
    expect((await screen.findByTestId('code-viewer')).textContent).toContain('plain text content')
  })

  it('renders a .md file readably (not as a raw code block)', async () => {
    mockHive({ readFile: vi.fn().mockResolvedValue('# Título\n\nUm parágrafo.') })

    render(createElement(Explorer, { workspace: '/ws' }))

    const mdButton = await screen.findByText('prd.md')
    fireEvent.click(mdButton)

    const markdownViewer = await screen.findByTestId('markdown-viewer')
    expect(markdownViewer.querySelector('h1')?.textContent).toBe('Título')
    expect(markdownViewer.querySelector('p')?.textContent).toBe('Um parágrafo.')
    expect(screen.queryByTestId('code-viewer')).toBeNull()
  })

  it('refetches the tree when the watcher reports a change (new file visible without manual reload)', async () => {
    const { watchListeners } = mockHive()

    render(createElement(Explorer, { workspace: '/ws' }))

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

    const { unmount } = render(createElement(Explorer, { workspace: '/ws' }))
    await screen.findByText('a.txt')

    unmount()

    expect(unsubscribe).toHaveBeenCalled()
  })
})
