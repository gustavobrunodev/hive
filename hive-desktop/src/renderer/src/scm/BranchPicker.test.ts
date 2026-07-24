// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { BranchPicker, type BranchPickerProps } from './BranchPicker'
import type { GitBranch } from './gitStatus'

// Mock the DS Command family (cmdk needs layout/pointer APIs jsdom lacks): the
// dialog renders its content when open, items become buttons, the input drives
// onValueChange on change. AlertDialog stays real.
vi.mock('@hive/design-system', async (orig) => {
  const actual = await orig<typeof import('@hive/design-system')>()
  return {
    ...actual,
    CommandDialog: ({
      open,
      label,
      children
    }: {
      open?: boolean
      label?: string
      children?: ReactNode
    }) => (open ? createElement('div', { role: 'dialog', 'aria-label': label }, children) : null),
    CommandInput: ({
      onValueChange,
      placeholder
    }: {
      onValueChange?: (v: string) => void
      placeholder?: string
    }) =>
      createElement('input', {
        placeholder,
        onChange: (e: { target: { value: string } }) => onValueChange?.(e.target.value)
      }),
    CommandList: ({ children }: { children?: ReactNode }) => createElement('div', null, children),
    CommandEmpty: ({ children }: { children?: ReactNode }) => createElement('div', null, children),
    CommandGroup: ({ heading, children }: { heading?: ReactNode; children?: ReactNode }) =>
      createElement('div', null, createElement('div', null, heading), children),
    CommandItem: ({
      children,
      onSelect,
      value,
      ...rest
    }: {
      children?: ReactNode
      onSelect?: () => void
      value?: string
    }) => {
      void value
      return createElement(
        'div',
        { role: 'option', onClick: () => onSelect?.(), ...rest },
        children
      )
    }
  }
})

function branch(name: string, over: Partial<GitBranch> = {}): GitBranch {
  return {
    name,
    oid: 'abc',
    upstream: null,
    isRemote: false,
    isHead: false,
    ahead: 0,
    behind: 0,
    gone: false,
    ...over
  }
}

const branchesFixture = {
  branches: [
    branch('main', { isHead: true }),
    branch('feature/x'),
    branch('origin/main', { isRemote: true })
  ],
  current: 'main'
}

let branchesMock: ReturnType<typeof vi.fn>

function renderPicker(props: Partial<BranchPickerProps> = {}): BranchPickerProps {
  const full: BranchPickerProps = {
    open: true,
    onOpenChange: vi.fn(),
    workspace: '/ws',
    onCheckout: vi.fn(),
    onCreate: vi.fn(),
    onDelete: vi.fn(),
    ...props
  }
  render(createElement(BranchPicker, full))
  return full
}

beforeEach(() => {
  branchesMock = vi.fn().mockResolvedValue(branchesFixture)
  window.hive = { git: { branches: branchesMock } } as unknown as typeof window.hive
})

afterEach(() => {
  cleanup()
})

describe('BranchPicker', () => {
  it('lists local + remote branches with the current one marked', async () => {
    renderPicker()
    expect(await screen.findByText('feature/x')).toBeTruthy()
    expect(screen.getByText('Locais')).toBeTruthy()
    expect(screen.getByText('Remotos')).toBeTruthy()
    expect(screen.getByLabelText('main (branch atual)')).toBeTruthy()
  })

  it('checks out a local branch by name and closes', async () => {
    const props = renderPicker()
    fireEvent.click(await screen.findByLabelText('Trocar para feature/x'))
    expect(props.onCheckout).toHaveBeenCalledWith('feature/x')
    expect(props.onOpenChange).toHaveBeenCalledWith(false)
  })

  it('checks out a remote branch by its short (tracking) name', async () => {
    const props = renderPicker()
    fireEvent.click(await screen.findByLabelText('Trocar para origin/main'))
    expect(props.onCheckout).toHaveBeenCalledWith('main')
  })

  it('offers a create-from-query item and creates the branch', async () => {
    const props = renderPicker()
    await screen.findByText('feature/x')
    fireEvent.change(screen.getByPlaceholderText('Buscar ou criar branch…'), {
      target: { value: 'feat/new' }
    })
    fireEvent.click(screen.getByLabelText('Criar branch “feat/new”'))
    expect(props.onCreate).toHaveBeenCalledWith('feat/new')
  })

  it('does not offer to create a name that already exists', async () => {
    renderPicker()
    await screen.findByText('feature/x')
    fireEvent.change(screen.getByPlaceholderText('Buscar ou criar branch…'), {
      target: { value: 'main' }
    })
    expect(screen.queryByLabelText('Criar branch “main”')).toBeNull()
  })

  it('deletes a non-current branch only after confirmation', async () => {
    const props = renderPicker()
    await screen.findByText('feature/x')
    fireEvent.click(screen.getByLabelText('Excluir branch feature/x'))
    expect(screen.getByText('Excluir branch?')).toBeTruthy()
    expect(props.onDelete).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText('Excluir'))
    expect(props.onDelete).toHaveBeenCalledWith('feature/x')
  })

  it('offers no delete on the current branch', async () => {
    renderPicker()
    await screen.findByText('feature/x')
    expect(screen.queryByLabelText('Excluir branch main')).toBeNull()
  })
})
