// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createContext, createElement, useContext, useState, type ReactNode } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { EditorTabs, type EditorTabActions } from './EditorTabs'
import type { EditorTab } from './useEditorTabs'

/**
 * A stand-in for Radix's right-click menu: the Trigger opens it on
 * `contextmenu`, the Content only renders while open. Enough of the real
 * contract for these tests (which are about *what the menu offers and what it
 * calls*), and it keeps the DS's own bundle — and its second React — out of
 * this suite, the same way `Explorer.test.ts` does.
 */
const MenuCtx = createContext<{ open: boolean; setOpen: (open: boolean) => void }>({
  open: false,
  setOpen: () => {}
})

vi.mock('@hive/design-system', () => ({
  ContextMenu: ({ children }: { children?: ReactNode }) => {
    const [open, setOpen] = useState(false)
    return createElement(MenuCtx.Provider, { value: { open, setOpen } }, children)
  },
  ContextMenuTrigger: ({ children }: { children?: ReactNode }) => {
    const { setOpen } = useContext(MenuCtx)
    return createElement('div', { onContextMenu: () => setOpen(true) }, children)
  },
  ContextMenuContent: ({ children }: { children?: ReactNode }) => {
    const { open } = useContext(MenuCtx)
    return open ? createElement('div', { role: 'menu' }, children) : null
  },
  ContextMenuItem: ({
    children,
    onSelect,
    disabled
  }: {
    children?: ReactNode
    onSelect?: () => void
    disabled?: boolean
  }) =>
    createElement(
      'button',
      {
        type: 'button',
        role: 'menuitem',
        disabled,
        'aria-disabled': disabled || undefined,
        onClick: () => !disabled && onSelect?.()
      },
      children
    ),
  ContextMenuSeparator: () => createElement('hr')
}))

afterEach(() => {
  cleanup()
})

beforeEach(() => {
  window.hive = { platform: 'linux' } as unknown as typeof window.hive
})

function fileTab(path: string, pinned = true): EditorTab {
  return { path, pinned, kind: 'file' }
}

function actions(): EditorTabActions {
  return {
    closeOthers: vi.fn(),
    closeToTheRight: vi.fn(),
    closeSaved: vi.fn(),
    closeAll: vi.fn(),
    keepOpen: vi.fn(),
    copyPath: vi.fn(),
    revealInTree: vi.fn(),
    revealInOs: vi.fn()
  }
}

function renderStrip(
  tabs: EditorTab[],
  overrides: {
    dirtyPaths?: ReadonlySet<string>
    onClose?: (path: string) => void
    actions?: EditorTabActions
  } = {}
): EditorTabActions {
  const menuActions = overrides.actions ?? actions()
  render(
    createElement(EditorTabs, {
      tabs,
      activePath: tabs[0]?.path ?? null,
      dirtyPaths: overrides.dirtyPaths ?? new Set<string>(),
      onSelect: vi.fn(),
      onPin: vi.fn(),
      onClose: overrides.onClose ?? vi.fn(),
      actions: menuActions
    })
  )
  return menuActions
}

/** Right-clicks the named tab and returns the menu that opened. */
function openMenuOn(name: string): HTMLElement {
  const tab = screen.getByTitle(name)
  fireEvent.contextMenu(tab)
  return screen.getByRole('menu')
}

const item = (name: string): HTMLElement => screen.getByRole('menuitem', { name })

describe('EditorTabs — the tab context menu', () => {
  it('offers VS Code’s close family, in VS Code’s order', () => {
    renderStrip([fileTab('a.txt'), fileTab('b.txt')])
    openMenuOn('a.txt')

    expect(screen.getAllByRole('menuitem').map((entry) => entry.textContent)).toEqual([
      'Fechar',
      'Fechar as outras',
      'Fechar as da direita',
      'Fechar as salvas',
      'Fechar todas',
      'Manter aberta',
      'Copiar caminho relativo',
      'Copiar caminho',
      'Revelar no explorador',
      'Abrir no gerenciador de arquivos'
    ])
  })

  it('"Fechar" runs the same guarded close as the tab’s own ×', () => {
    const onClose = vi.fn()
    renderStrip([fileTab('a.txt'), fileTab('b.txt')], { onClose })

    openMenuOn('b.txt')
    fireEvent.click(item('Fechar'))
    expect(onClose).toHaveBeenCalledWith('b.txt')
  })

  it('scopes every close to the tab that was right-clicked, not the active one', () => {
    const menu = renderStrip([fileTab('a.txt'), fileTab('b.txt'), fileTab('c.txt')])

    openMenuOn('b.txt')
    fireEvent.click(item('Fechar as outras'))
    expect(menu.closeOthers).toHaveBeenCalledWith('b.txt')

    openMenuOn('b.txt')
    fireEvent.click(item('Fechar as da direita'))
    expect(menu.closeToTheRight).toHaveBeenCalledWith('b.txt')
  })

  it('disables "Fechar as da direita" on the last tab instead of hiding it', () => {
    renderStrip([fileTab('a.txt'), fileTab('b.txt')])

    openMenuOn('b.txt')
    // Present, so the menu keeps its shape from tab to tab — just inert.
    expect(item('Fechar as da direita').hasAttribute('disabled')).toBe(true)
  })

  it('disables "Fechar as salvas" when every open tab has unsaved changes', () => {
    renderStrip([fileTab('a.txt'), fileTab('b.txt')], {
      dirtyPaths: new Set(['a.txt', 'b.txt'])
    })

    openMenuOn('a.txt')
    expect(item('Fechar as salvas').hasAttribute('disabled')).toBe(true)
  })

  it('offers "Manter aberta" only for a preview tab', () => {
    const menu = renderStrip([fileTab('a.txt', false), fileTab('b.txt', true)])

    openMenuOn('a.txt')
    fireEvent.click(item('Manter aberta'))
    expect(menu.keepOpen).toHaveBeenCalledWith('a.txt')

    openMenuOn('b.txt')
    expect(item('Manter aberta').hasAttribute('disabled')).toBe(true)
  })

  it('hands the file’s path to the clipboard, the tree and the OS', () => {
    const menu = renderStrip([fileTab('docs/prd.md')])

    openMenuOn('docs/prd.md')
    fireEvent.click(item('Copiar caminho relativo'))
    expect(menu.copyPath).toHaveBeenCalledWith('docs/prd.md', 'relative')

    openMenuOn('docs/prd.md')
    fireEvent.click(item('Copiar caminho'))
    expect(menu.copyPath).toHaveBeenCalledWith('docs/prd.md', 'absolute')

    openMenuOn('docs/prd.md')
    fireEvent.click(item('Revelar no explorador'))
    expect(menu.revealInTree).toHaveBeenCalledWith('docs/prd.md')

    openMenuOn('docs/prd.md')
    fireEvent.click(item('Abrir no gerenciador de arquivos'))
    expect(menu.revealInOs).toHaveBeenCalledWith('docs/prd.md')
  })

  it('resolves a diff tab to the file behind it, not to its synthetic key', () => {
    const menu = renderStrip([
      {
        path: '⟨diff⟩src/a.txt?working',
        pinned: true,
        kind: 'diff',
        git: { path: 'src/a.txt', side: 'working' },
        label: 'a.txt'
      }
    ])

    openMenuOn('src/a.txt')
    fireEvent.click(item('Copiar caminho relativo'))
    expect(menu.copyPath).toHaveBeenCalledWith('src/a.txt', 'relative')
  })

  it('greys out the path actions on a tab with no file behind it (a commit’s diff)', () => {
    renderStrip([
      { path: '⟨commit⟩abc1234', pinned: true, kind: 'commit', git: { hash: 'abc1234' } }
    ])

    openMenuOn('⟨commit⟩abc1234')
    expect(item('Copiar caminho').hasAttribute('disabled')).toBe(true)
    expect(item('Revelar no explorador').hasAttribute('disabled')).toBe(true)
    // The close family still applies — a commit tab closes like any other.
    expect(item('Fechar todas').hasAttribute('disabled')).toBe(false)
  })

  it('opens no menu for a right-click on the empty strip beside the tabs', () => {
    renderStrip([fileTab('a.txt')])

    fireEvent.contextMenu(screen.getByRole('tablist'))
    expect(screen.queryByRole('menuitem')).toBeNull()
  })
})
