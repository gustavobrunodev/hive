/* eslint-disable react/no-children-prop --
   `WorkspaceSwitcher` takes its trigger as a *required* `children` prop, and
   `createElement`'s positional-children overload doesn't satisfy a required
   prop for TypeScript. The rule guards against a real mistake in JSX; passing
   it as a prop is the only spelling that typechecks here. */
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'

/**
 * The switcher's keyboard path, which a mouse-driven test can never reach:
 * a filter field that hands focus to the list, arrows that walk only the rows
 * that can actually be opened, and Enter that opens the first of them.
 *
 * The DS overlays are stood in for here rather than in `WorkUI.test.ts`'s big
 * factory: this suite drives the panel directly, so it only needs the handful
 * of primitives the panel itself renders.
 */
vi.mock('@hive/design-system', () => ({
  Popover: ({ children }: { children?: ReactNode }) => createElement('div', null, children),
  PopoverTrigger: ({ children }: { children?: ReactNode }) => children,
  PopoverContent: ({ children, ...rest }: { children?: ReactNode; 'aria-label'?: string }) =>
    createElement('div', { role: 'dialog', 'aria-label': rest['aria-label'] }, children),
  DropdownMenu: ({ children }: { children?: ReactNode }) => createElement('div', null, children),
  DropdownMenuTrigger: ({ children }: { children?: ReactNode }) => children,
  DropdownMenuContent: ({ children }: { children?: ReactNode }) =>
    createElement('div', { role: 'menu' }, children),
  DropdownMenuItem: ({ children, onSelect }: { children?: ReactNode; onSelect?: () => void }) =>
    createElement('button', { type: 'button', role: 'menuitem', onClick: onSelect }, children),
  DropdownMenuSeparator: () => createElement('hr'),
  AlertDialog: ({ open, children }: { open?: boolean; children?: ReactNode }) =>
    open ? createElement('div', { role: 'alertdialog' }, children) : null,
  AlertDialogContent: ({ children }: { children?: ReactNode }) =>
    createElement('div', null, children),
  AlertDialogTitle: ({ children }: { children?: ReactNode }) => createElement('h2', null, children),
  AlertDialogDescription: ({ children }: { children?: ReactNode }) =>
    createElement('p', null, children),
  AlertDialogAction: ({ children, onClick }: { children?: ReactNode; onClick?: () => void }) =>
    createElement('button', { type: 'button', onClick }, children),
  AlertDialogCancel: ({ children, onClick }: { children?: ReactNode; onClick?: () => void }) =>
    createElement('button', { type: 'button', onClick }, children),
  Dialog: ({ open, children }: { open?: boolean; children?: ReactNode }) =>
    open ? createElement('div', { role: 'dialog' }, children) : null,
  DialogContent: ({ children }: { children?: ReactNode }) => createElement('div', null, children),
  DialogTitle: ({ children }: { children?: ReactNode }) => createElement('h2', null, children),
  DialogDescription: ({ children }: { children?: ReactNode }) => createElement('p', null, children),
  Input: (props: Record<string, unknown>) => createElement('input', props),
  Button: ({ children, ...rest }: Record<string, unknown> & { children?: ReactNode }) => {
    // `cut`/`variant` are DS-only props, never valid DOM attributes — React
    // warns about every unknown attribute it sees on a `<button>`.
    const dom = Object.fromEntries(
      Object.entries(rest).filter(([key]) => key !== 'cut' && key !== 'variant')
    )
    return createElement('button', { type: 'button', ...dom }, children)
  }
}))

const { WorkspaceSwitcher } = await import('./WorkspaceSwitcher')
type WorkspaceInfo = Awaited<ReturnType<Window['hive']['workspaces']['list']>>[number]

afterEach(() => cleanup())

function entry(over: Partial<WorkspaceInfo> & { path: string }): WorkspaceInfo {
  return {
    name: null,
    displayName: over.path.split('/').filter(Boolean).pop() ?? over.path,
    kind: 'managed',
    primary: false,
    lastOpenedAt: 1,
    provisioned: true,
    missing: false,
    ...over
  }
}

const REGISTRY: WorkspaceInfo[] = [
  entry({ path: '/main', primary: true }),
  entry({ path: '/api-gateway' }),
  entry({ path: '/notes', kind: 'light', provisioned: false }),
  entry({ path: '/gone', missing: true, provisioned: false })
]

function renderPanel(over: Partial<Parameters<typeof WorkspaceSwitcher>[0]> = {}): {
  onSwitch: ReturnType<typeof vi.fn>
  onAdd: ReturnType<typeof vi.fn>
  onOpenChange: ReturnType<typeof vi.fn>
  onReload: ReturnType<typeof vi.fn>
} {
  const onSwitch = vi.fn()
  const onAdd = vi.fn()
  const onOpenChange = vi.fn()
  const onReload = vi.fn()
  render(
    createElement(WorkspaceSwitcher, {
      workspaces: REGISTRY,
      active: '/main',
      open: true,
      onOpenChange,
      onReload,
      onSwitch,
      onAdd,
      ...over,
      children: createElement('button', { type: 'button' }, 'chip')
    })
  )
  return { onSwitch, onAdd, onOpenChange, onReload }
}

/** The filter field. */
function filter(): HTMLElement {
  return screen.getByRole('textbox', { name: 'Filtrar workspaces…' })
}

/** A row's main (switch) button, by workspace name. */
function row(name: string): HTMLElement {
  return within(screen.getByRole('dialog')).getByRole('button', {
    name: new RegExp(`^${name}\\.`)
  })
}

describe('WorkspaceSwitcher — keyboard', () => {
  it('ArrowDown from the filter field hands focus to the first openable row', () => {
    renderPanel()
    fireEvent.keyDown(filter(), { key: 'ArrowDown' })
    // Not `/main`: you are already there, so it is readable but not a target.
    expect(document.activeElement).toBe(row('api-gateway'))
  })

  it('arrows walk only the rows that can be opened, skipping the active and the missing', () => {
    renderPanel()
    const first = row('api-gateway')
    first.focus()

    fireEvent.keyDown(first, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(row('notes'))

    // `/gone` is next in the list and is skipped — stepping onto it would
    // strand the arrows on a row that does nothing.
    fireEvent.keyDown(row('notes'), { key: 'ArrowDown' })
    expect(document.activeElement).toBe(row('notes'))
  })

  it('ArrowUp past the first row returns to the filter field rather than trapping focus', () => {
    renderPanel()
    const first = row('api-gateway')
    first.focus()
    fireEvent.keyDown(first, { key: 'ArrowUp' })
    expect(document.activeElement).toBe(filter())
  })

  it('Home and End jump to the ends of the openable list', () => {
    renderPanel()
    const first = row('api-gateway')
    first.focus()

    fireEvent.keyDown(first, { key: 'End' })
    expect(document.activeElement).toBe(row('notes'))

    fireEvent.keyDown(row('notes'), { key: 'Home' })
    expect(document.activeElement).toBe(row('api-gateway'))
  })

  it('Enter in the filter field opens the first match and closes the panel', () => {
    const { onSwitch, onOpenChange } = renderPanel()
    fireEvent.change(filter(), { target: { value: 'notes' } })
    fireEvent.keyDown(filter(), { key: 'Enter' })

    expect(onSwitch).toHaveBeenCalledWith('/notes')
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('Enter with nothing openable is a no-op rather than a mis-fire', () => {
    const { onSwitch } = renderPanel()
    fireEvent.change(filter(), { target: { value: 'gone' } })
    fireEvent.keyDown(filter(), { key: 'Enter' })
    expect(onSwitch).not.toHaveBeenCalled()
  })

  it('an unrelated key in the filter field does nothing special', () => {
    const { onSwitch } = renderPanel()
    fireEvent.keyDown(filter(), { key: 'a' })
    expect(onSwitch).not.toHaveBeenCalled()
  })
})

describe('WorkspaceSwitcher — panel', () => {
  it('clears the filter each time it opens: last visit is never what you want next', () => {
    const chip = createElement('button', { type: 'button' }, 'chip')
    const { rerender } = render(
      createElement(WorkspaceSwitcher, {
        workspaces: REGISTRY,
        active: '/main',
        open: true,
        onOpenChange: vi.fn(),
        onReload: vi.fn(),
        onSwitch: vi.fn(),
        onAdd: vi.fn(),
        children: chip
      })
    )
    fireEvent.change(filter(), { target: { value: 'notes' } })
    expect((filter() as HTMLInputElement).value).toBe('notes')

    const props = {
      workspaces: REGISTRY,
      active: '/main',
      onOpenChange: vi.fn(),
      onReload: vi.fn(),
      onSwitch: vi.fn(),
      onAdd: vi.fn(),
      children: chip
    }
    rerender(createElement(WorkspaceSwitcher, { ...props, open: false }))
    rerender(createElement(WorkspaceSwitcher, { ...props, open: true }))

    expect((filter() as HTMLInputElement).value).toBe('')
  })

  it('renders an empty state instead of a blank panel when nothing matches', () => {
    renderPanel()
    fireEvent.change(filter(), { target: { value: 'zzz' } })
    expect(screen.getByText('Nenhum workspace com esse nome.')).toBeTruthy()
    expect(screen.queryByText('Principal')).toBeNull()
  })

  it('drops the "Principal" heading when the primary is filtered out, keeping the rest', () => {
    renderPanel()
    fireEvent.change(filter(), { target: { value: 'notes' } })
    expect(screen.queryByText('Principal')).toBeNull()
    expect(screen.getByText('Outros workspaces')).toBeTruthy()
  })

  it('clicking a row closes the panel and reports the switch', () => {
    const { onSwitch, onOpenChange } = renderPanel()
    fireEvent.click(row('api-gateway'))
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(onSwitch).toHaveBeenCalledWith('/api-gateway')
  })

  it('clicking the active or a missing row does nothing', () => {
    const { onSwitch } = renderPanel()
    fireEvent.click(row('main'))
    fireEvent.click(row('gone'))
    expect(onSwitch).not.toHaveBeenCalled()
  })

  it('"Adicionar workspace…" closes the panel before opening the native picker', () => {
    const { onAdd, onOpenChange } = renderPanel()
    fireEvent.click(screen.getByText('Adicionar workspace…'))
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(onAdd).toHaveBeenCalledTimes(1)
  })

  it('a row action closes the panel and raises its dialog', async () => {
    renderPanel()
    const notesRow = row('notes').closest('li') as HTMLElement
    fireEvent.click(within(notesRow).getByRole('menuitem', { name: 'Instalar o BMAD aqui' }))

    expect(await screen.findByRole('alertdialog')).toBeTruthy()
  })
})
