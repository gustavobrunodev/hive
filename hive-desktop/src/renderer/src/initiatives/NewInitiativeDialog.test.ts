// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { NewInitiativeDialog } from './NewInitiativeDialog'
import { InitiativeExistsError } from './useInitiatives'

afterEach(() => {
  cleanup()
})

function dialog(props: Partial<Parameters<typeof NewInitiativeDialog>[0]> = {}): {
  onCreate: ReturnType<typeof vi.fn>
  onCreated: ReturnType<typeof vi.fn>
} {
  const onCreate = vi.fn().mockResolvedValue('docs/iniciativas/R1/portal-de-cobranca')
  const onCreated = vi.fn()
  render(
    createElement(NewInitiativeDialog, {
      open: true,
      onOpenChange: vi.fn(),
      onCreate,
      onCreated,
      ...props
    })
  )
  return { onCreate: (props.onCreate as ReturnType<typeof vi.fn>) ?? onCreate, onCreated }
}

function nameField(): HTMLElement {
  return screen.getByLabelText('Nome da demanda')
}

describe('NewInitiativeDialog', () => {
  it('shows the folder it will create, live, as the name is typed', () => {
    dialog()
    expect(screen.getByText('docs/iniciativas/R1/…')).toBeTruthy()
    fireEvent.change(nameField(), { target: { value: 'Portal de Cobrança' } })
    // The slug is a silent transformation; the first place anyone would notice
    // it went somewhere unexpected is the day they cannot find the demand.
    expect(screen.getByText('docs/iniciativas/R1/portal-de-cobranca')).toBeTruthy()
  })

  it('follows the release the user picks', () => {
    dialog()
    fireEvent.change(nameField(), { target: { value: 'Novo checkout' } })
    fireEvent.click(screen.getByRole('radio', { name: 'R3' }))
    expect(screen.getByText('docs/iniciativas/R3/novo-checkout')).toBeTruthy()
  })

  it('creates the demand with the name, the year and the release', async () => {
    const { onCreate, onCreated } = dialog()
    fireEvent.change(nameField(), { target: { value: 'Portal de Cobrança' } })
    fireEvent.click(screen.getByRole('button', { name: 'Criar iniciativa' }))
    await waitFor(() => expect(onCreate).toHaveBeenCalled())
    expect(onCreate).toHaveBeenCalledWith({
      title: 'Portal de Cobrança',
      year: new Date().getFullYear(),
      release: 'R1'
    })
    // Creating one and then having to go find it is the repair left half-done.
    await waitFor(() =>
      expect(onCreated).toHaveBeenCalledWith('docs/iniciativas/R1/portal-de-cobranca')
    )
  })

  it('finishes from the keyboard, since the name is the only field anyone types into', async () => {
    const { onCreate } = dialog()
    fireEvent.change(nameField(), { target: { value: 'Portal' } })
    fireEvent.keyDown(nameField(), { key: 'Enter' })
    await waitFor(() => expect(onCreate).toHaveBeenCalled())
  })

  it('asks for a name rather than creating a folder called nothing', () => {
    const onCreate = vi.fn()
    dialog({ onCreate })
    fireEvent.click(screen.getByRole('button', { name: 'Criar iniciativa' }))
    expect(screen.getByRole('alert').textContent).toBe('Dê um nome à demanda.')
    expect(onCreate).not.toHaveBeenCalled()
  })

  it('refuses a name that leaves no folder behind after slugging', () => {
    const onCreate = vi.fn()
    dialog({ onCreate })
    fireEvent.change(nameField(), { target: { value: '!!!' } })
    fireEvent.click(screen.getByRole('button', { name: 'Criar iniciativa' }))
    expect(screen.getByRole('alert').textContent).toBe('Use ao menos uma letra ou número no nome.')
    expect(onCreate).not.toHaveBeenCalled()
  })

  it('says so when the demand already exists, instead of adopting its artifacts', async () => {
    const onCreate = vi.fn().mockRejectedValue(new InitiativeExistsError('docs/iniciativas/R1/x'))
    const { onCreated } = dialog({ onCreate })
    fireEvent.change(nameField(), { target: { value: 'Portal' } })
    fireEvent.click(screen.getByRole('button', { name: 'Criar iniciativa' }))
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toBe(
        'Já existe uma demanda com esse nome nessa release.'
      )
    )
    expect(onCreated).not.toHaveBeenCalled()
  })

  it('separates a failed write from a name collision — they want different words', async () => {
    const onCreate = vi.fn().mockRejectedValue(new Error('EACCES'))
    dialog({ onCreate })
    fireEvent.change(nameField(), { target: { value: 'Portal' } })
    fireEvent.click(screen.getByRole('button', { name: 'Criar iniciativa' }))
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toBe(
        'Não foi possível criar a pasta da iniciativa.'
      )
    )
  })

  it('clears the complaint as soon as the name is edited', () => {
    dialog()
    fireEvent.click(screen.getByRole('button', { name: 'Criar iniciativa' }))
    expect(screen.queryByRole('alert')).toBeTruthy()
    fireEvent.change(nameField(), { target: { value: 'P' } })
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
