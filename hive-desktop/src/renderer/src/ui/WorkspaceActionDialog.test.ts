// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

/**
 * The four row actions. Each one either writes to disk or changes what the app
 * considers its main workspace, so none of them fires straight off a menu
 * item — these specs pin the confirm-then-act-then-reload sequence, and the
 * two that end by taking the user to the workspace (the install gate lives
 * there, not here).
 */
vi.mock('@hive/design-system', () => ({
  // The mocks carry a dismiss button so the Escape/backdrop path — which is
  // `onOpenChange(false)`, not the Cancelar click — is reachable from a test.
  AlertDialog: ({
    open,
    children,
    onOpenChange
  }: {
    open?: boolean
    children?: ReactNode
    onOpenChange?: (open: boolean) => void
  }) =>
    open
      ? createElement(
          'div',
          { role: 'alertdialog' },
          children,
          createElement(
            'button',
            { type: 'button', 'data-testid': 'dismiss', onClick: () => onOpenChange?.(false) },
            'dismiss'
          )
        )
      : null,
  AlertDialogContent: ({ children }: { children?: ReactNode }) =>
    createElement('div', null, children),
  AlertDialogTitle: ({ children }: { children?: ReactNode }) => createElement('h2', null, children),
  AlertDialogDescription: ({ children }: { children?: ReactNode }) =>
    createElement('p', null, children),
  AlertDialogAction: ({
    children,
    onClick,
    variant
  }: {
    children?: ReactNode
    onClick?: () => void
    variant?: string
  }) => createElement('button', { type: 'button', 'data-variant': variant, onClick }, children),
  AlertDialogCancel: ({ children, onClick }: { children?: ReactNode; onClick?: () => void }) =>
    createElement('button', { type: 'button', onClick }, children),
  Dialog: ({
    open,
    children,
    onOpenChange
  }: {
    open?: boolean
    children?: ReactNode
    onOpenChange?: (open: boolean) => void
  }) =>
    open
      ? createElement(
          'div',
          { role: 'dialog' },
          children,
          createElement(
            'button',
            { type: 'button', 'data-testid': 'dismiss', onClick: () => onOpenChange?.(false) },
            'dismiss'
          )
        )
      : null,
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

const { WorkspaceActionDialog } = await import('./WorkspaceActionDialog')
type WorkspaceInfo = Awaited<ReturnType<Window['hive']['workspaces']['list']>>[number]

const NOTES: WorkspaceInfo = {
  path: '/home/dev/notas',
  name: null,
  displayName: 'notas',
  kind: 'light',
  primary: false,
  lastOpenedAt: 1,
  provisioned: false,
  missing: false
}

let bridge: {
  rename: ReturnType<typeof vi.fn>
  adopt: ReturnType<typeof vi.fn>
  setPrimary: ReturnType<typeof vi.fn>
  forget: ReturnType<typeof vi.fn>
}

beforeEach(() => {
  bridge = {
    rename: vi.fn().mockResolvedValue(undefined),
    adopt: vi.fn().mockResolvedValue(undefined),
    setPrimary: vi.fn().mockResolvedValue(undefined),
    forget: vi.fn().mockResolvedValue(true)
  }
  ;(window as unknown as { hive: unknown }).hive = { workspaces: bridge }
})

afterEach(() => cleanup())

function renderDialog(pending: Parameters<typeof WorkspaceActionDialog>[0]['pending']): {
  onClose: ReturnType<typeof vi.fn>
  onReload: ReturnType<typeof vi.fn>
  onSwitch: ReturnType<typeof vi.fn>
} {
  const onClose = vi.fn()
  const onReload = vi.fn()
  const onSwitch = vi.fn()
  render(createElement(WorkspaceActionDialog, { pending, onClose, onReload, onSwitch }))
  return { onClose, onReload, onSwitch }
}

describe('WorkspaceActionDialog', () => {
  it('renders nothing when no action is pending', () => {
    const { container } = render(
      createElement(WorkspaceActionDialog, {
        pending: null,
        onClose: vi.fn(),
        onReload: vi.fn(),
        onSwitch: vi.fn()
      })
    )
    expect(container.innerHTML).toBe('')
  })

  it('adopt: names the folders it will create, then adopts and takes the user there', async () => {
    const { onReload, onSwitch, onClose } = renderDialog({ kind: 'adopt', entry: NOTES })

    expect(screen.getByText('Instalar o BMAD em “notas”?')).toBeTruthy()
    expect(screen.getByText(/_bmad\/, \.claude\/skills\/ e second-brain\//)).toBeTruthy()

    fireEvent.click(screen.getByText('Instalar aqui'))

    await waitFor(() => expect(bridge.adopt).toHaveBeenCalledWith('/home/dev/notas'))
    await waitFor(() => expect(onReload).toHaveBeenCalled())
    // The install gate is a surface bound to one workspace, so adopting has
    // to move the user to it.
    await waitFor(() => expect(onSwitch).toHaveBeenCalledWith('/home/dev/notas'))
    expect(onClose).toHaveBeenCalled()
  })

  it('promote: says BMAD will be installed when the target has none', async () => {
    const { onSwitch } = renderDialog({ kind: 'promote', entry: NOTES })

    expect(screen.getByText(/o BMAD será instalado nesta pasta/)).toBeTruthy()
    fireEvent.click(screen.getByText('Tornar principal'))

    await waitFor(() => expect(bridge.setPrimary).toHaveBeenCalledWith('/home/dev/notas'))
    await waitFor(() => expect(onSwitch).toHaveBeenCalledWith('/home/dev/notas'))
  })

  it('promote: says nothing new is installed when the target already has BMAD', () => {
    renderDialog({ kind: 'promote', entry: { ...NOTES, kind: 'managed', provisioned: true } })
    expect(screen.getByText(/Nada novo é instalado/)).toBeTruthy()
  })

  it('forget: promises the folder survives, and is styled as removing something', async () => {
    const { onReload, onSwitch } = renderDialog({ kind: 'forget', entry: NOTES })

    expect(screen.getByText(/continuam intactos no seu computador/)).toBeTruthy()
    const confirm = screen.getByText('Remover da lista')
    expect(confirm.getAttribute('data-variant')).toBe('danger')

    fireEvent.click(confirm)

    await waitFor(() => expect(bridge.forget).toHaveBeenCalledWith('/home/dev/notas'))
    await waitFor(() => expect(onReload).toHaveBeenCalled())
    // Forgetting a workspace never navigates anywhere.
    expect(onSwitch).not.toHaveBeenCalled()
  })

  it('cancelling closes without touching anything', () => {
    const { onClose, onReload } = renderDialog({ kind: 'forget', entry: NOTES })
    fireEvent.click(screen.getByText('Cancelar'))
    expect(onClose).toHaveBeenCalled()
    expect(bridge.forget).not.toHaveBeenCalled()
    expect(onReload).not.toHaveBeenCalled()
  })

  it('rename: offers the folder name as the placeholder and saves the typed one', async () => {
    const { onReload } = renderDialog({ kind: 'rename', entry: NOTES })

    const field = screen.getByLabelText('Nome do workspace') as HTMLInputElement
    expect(field.getAttribute('placeholder')).toBe('notas')
    expect(field.value).toBe('')

    fireEvent.change(field, { target: { value: 'Notas da Squad' } })
    fireEvent.click(screen.getByText('Salvar'))

    await waitFor(() =>
      expect(bridge.rename).toHaveBeenCalledWith('/home/dev/notas', 'Notas da Squad')
    )
    await waitFor(() => expect(onReload).toHaveBeenCalled())
  })

  it('rename: Enter saves, so the field behaves like the form it replaced', async () => {
    renderDialog({ kind: 'rename', entry: NOTES })
    const field = screen.getByLabelText('Nome do workspace')
    fireEvent.change(field, { target: { value: 'Notas' } })
    fireEvent.keyDown(field, { key: 'Enter' })

    await waitFor(() => expect(bridge.rename).toHaveBeenCalledWith('/home/dev/notas', 'Notas'))
  })

  it('rename: any other key just types', () => {
    renderDialog({ kind: 'rename', entry: NOTES })
    fireEvent.keyDown(screen.getByLabelText('Nome do workspace'), { key: 'a' })
    expect(bridge.rename).not.toHaveBeenCalled()
  })

  it('rename: seeds the field from an existing custom name, and re-seeds per workspace', () => {
    const named = { ...NOTES, name: 'Notas da Squad', displayName: 'Notas da Squad' }
    const { rerender } = render(
      createElement(WorkspaceActionDialog, {
        pending: { kind: 'rename', entry: named },
        onClose: vi.fn(),
        onReload: vi.fn(),
        onSwitch: vi.fn()
      })
    )
    expect((screen.getByLabelText('Nome do workspace') as HTMLInputElement).value).toBe(
      'Notas da Squad'
    )

    // Opening the dialog on a second row must not inherit the first's draft.
    rerender(
      createElement(WorkspaceActionDialog, {
        pending: { kind: 'rename', entry: { ...NOTES, path: '/other', displayName: 'other' } },
        onClose: vi.fn(),
        onReload: vi.fn(),
        onSwitch: vi.fn()
      })
    )
    expect((screen.getByLabelText('Nome do workspace') as HTMLInputElement).value).toBe('')
  })

  it('dismissing the rename dialog (Escape/backdrop) closes it without saving', () => {
    const { onClose } = renderDialog({ kind: 'rename', entry: NOTES })
    fireEvent.click(screen.getByTestId('dismiss'))
    expect(onClose).toHaveBeenCalled()
    expect(bridge.rename).not.toHaveBeenCalled()
  })

  it('dismissing a confirm (Escape/backdrop) aborts it, same as Cancelar', () => {
    const { onClose } = renderDialog({ kind: 'adopt', entry: NOTES })
    fireEvent.click(screen.getByTestId('dismiss'))
    expect(onClose).toHaveBeenCalled()
    expect(bridge.adopt).not.toHaveBeenCalled()
  })

  it('reopening the dialog with no pending action goes quiet again', () => {
    const { container, rerender } = render(
      createElement(WorkspaceActionDialog, {
        pending: { kind: 'adopt', entry: NOTES },
        onClose: vi.fn(),
        onReload: vi.fn(),
        onSwitch: vi.fn()
      })
    )
    expect(screen.getByRole('alertdialog')).toBeTruthy()

    rerender(
      createElement(WorkspaceActionDialog, {
        pending: null,
        onClose: vi.fn(),
        onReload: vi.fn(),
        onSwitch: vi.fn()
      })
    )
    expect(container.innerHTML).toBe('')
  })
})
