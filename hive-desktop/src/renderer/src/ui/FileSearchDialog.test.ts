// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react'
import { FileSearchDialog } from './FileSearchDialog'

/**
 * P1-024 (R-15) — the Ctrl+P quick-open palette was the only feature file in
 * the project with **no test at all**: it did not even appear in the coverage
 * report, because nothing loaded it. Its contract is small and entirely about
 * freshness and hand-off: re-read the file list on every open (agents create
 * artifacts constantly, and a stale palette silently hides them), survive a
 * failed read, and close as it opens the picked file.
 *
 * The DS `CommandDialog` (cmdk + Dialog) is stood in for: this test is about
 * this component's own logic, not about cmdk's fuzzy filter.
 */
vi.mock('@hive/design-system', () => ({
  CommandDialog: ({
    open,
    children,
    label
  }: {
    open?: boolean
    children?: ReactNode
    label?: string
  }) => (open ? createElement('div', { role: 'dialog', 'aria-label': label }, children) : null),
  CommandInput: ({ placeholder }: { placeholder?: string }) =>
    createElement('input', { placeholder }),
  CommandList: ({ children }: { children?: ReactNode }) => createElement('div', null, children),
  CommandEmpty: ({ children }: { children?: ReactNode }) => createElement('p', null, children),
  CommandGroup: ({ children, heading }: { children?: ReactNode; heading?: ReactNode }) =>
    createElement('section', { 'aria-label': heading }, children),
  CommandItem: ({
    children,
    onSelect,
    'aria-label': ariaLabel
  }: {
    children?: ReactNode
    onSelect?: () => void
    'aria-label'?: string
  }) => createElement('button', { onClick: onSelect, 'aria-label': ariaLabel }, children)
}))

function mockListFiles(impl: () => Promise<string[]>): ReturnType<typeof vi.fn> {
  const listFiles = vi.fn(impl)
  window.hive = { ...window.hive, listFiles } as typeof window.hive
  return listFiles
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('FileSearchDialog (P1-024)', () => {
  it('renders nothing and reads nothing while closed', () => {
    const listFiles = mockListFiles(async () => ['a.md'])
    render(
      createElement(FileSearchDialog, {
        open: false,
        onOpenChange: vi.fn(),
        workspace: '/ws',
        onOpenFile: vi.fn()
      })
    )

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(listFiles).not.toHaveBeenCalled()
  })

  it('lists the workspace files, name over folder', async () => {
    mockListFiles(async () => ['docs/PRD.md', 'raiz.md'])
    render(
      createElement(FileSearchDialog, {
        open: true,
        onOpenChange: vi.fn(),
        workspace: '/ws',
        onOpenFile: vi.fn()
      })
    )

    await waitFor(() => expect(screen.getByText('PRD.md')).toBeTruthy())
    expect(screen.getByText('docs')).toBeTruthy()
    // A root-level file has no folder line at all — not an empty one, which
    // would render as a stray blank under the name.
    const rootRow = screen.getByLabelText('Abrir arquivo raiz.md')
    expect(rootRow.querySelector('.wb-filesearch-dir')).toBeNull()
    expect(
      screen.getByLabelText('Abrir arquivo docs/PRD.md').querySelector('.wb-filesearch-dir')
        ?.textContent
    ).toBe('docs')
  })

  it('opens the picked file and closes itself', async () => {
    const onOpenFile = vi.fn()
    const onOpenChange = vi.fn()
    mockListFiles(async () => ['docs/PRD.md'])
    render(
      createElement(FileSearchDialog, {
        open: true,
        onOpenChange,
        workspace: '/ws',
        onOpenFile
      })
    )

    await waitFor(() => expect(screen.getByLabelText('Abrir arquivo docs/PRD.md')).toBeTruthy())
    fireEvent.click(screen.getByLabelText('Abrir arquivo docs/PRD.md'))

    // The workspace-relative path, unchanged — the editor pane resolves it.
    expect(onOpenFile).toHaveBeenCalledWith('docs/PRD.md')
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('re-reads on every open, so an artifact written meanwhile is findable', async () => {
    let listing = ['antigo.md']
    const listFiles = mockListFiles(async () => listing)
    const { rerender } = render(
      createElement(FileSearchDialog, {
        open: true,
        onOpenChange: vi.fn(),
        workspace: '/ws',
        onOpenFile: vi.fn()
      })
    )
    await waitFor(() => expect(screen.getByText('antigo.md')).toBeTruthy())

    // Close, the agent writes a file, reopen.
    rerender(
      createElement(FileSearchDialog, {
        open: false,
        onOpenChange: vi.fn(),
        workspace: '/ws',
        onOpenFile: vi.fn()
      })
    )
    listing = ['antigo.md', 'PRD.md']
    rerender(
      createElement(FileSearchDialog, {
        open: true,
        onOpenChange: vi.fn(),
        workspace: '/ws',
        onOpenFile: vi.fn()
      })
    )

    await waitFor(() => expect(screen.getByText('PRD.md')).toBeTruthy())
    expect(listFiles).toHaveBeenCalledTimes(2)
  })

  it('a failed read degrades to the empty state instead of breaking the palette', async () => {
    mockListFiles(async () => {
      throw new Error('EACCES')
    })
    render(
      createElement(FileSearchDialog, {
        open: true,
        onOpenChange: vi.fn(),
        workspace: '/ws',
        onOpenFile: vi.fn()
      })
    )

    await waitFor(() =>
      expect(screen.getByText('Nenhum arquivo corresponde à busca.')).toBeTruthy()
    )
    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  it('re-reads when the workspace changes under an open palette', async () => {
    const listFiles = mockListFiles(async () => ['a.md'])
    const { rerender } = render(
      createElement(FileSearchDialog, {
        open: true,
        onOpenChange: vi.fn(),
        workspace: '/ws-a',
        onOpenFile: vi.fn()
      })
    )
    await waitFor(() => expect(listFiles).toHaveBeenCalledWith('/ws-a'))

    rerender(
      createElement(FileSearchDialog, {
        open: true,
        onOpenChange: vi.fn(),
        workspace: '/ws-b',
        onOpenFile: vi.fn()
      })
    )

    await waitFor(() => expect(listFiles).toHaveBeenCalledWith('/ws-b'))
  })
})
