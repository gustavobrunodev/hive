// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { InitiativeSettingsDialog } from './InitiativeSettingsDialog'
import { INITIATIVES_ROOT, type Initiative } from './initiatives'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const DEMAND: Initiative = {
  path: `${INITIATIVES_ROOT}/R2/portal`,
  slug: 'portal',
  title: 'Portal de Cobrança',
  release: 'R2',
  year: 2026,
  color: 'violet',
  files: []
}

function open(overrides: Partial<Parameters<typeof InitiativeSettingsDialog>[0]> = {}): {
  onSave: ReturnType<typeof vi.fn>
  onSaved: ReturnType<typeof vi.fn>
  onDelete: ReturnType<typeof vi.fn>
  onDeleted: ReturnType<typeof vi.fn>
  onOpenChange: ReturnType<typeof vi.fn>
} {
  const spies = {
    onSave: vi.fn().mockResolvedValue(`${INITIATIVES_ROOT}/R2/portal`),
    onSaved: vi.fn(),
    onDelete: vi.fn().mockResolvedValue(undefined),
    onDeleted: vi.fn(),
    onOpenChange: vi.fn()
  }
  render(createElement(InitiativeSettingsDialog, { initiative: DEMAND, ...spies, ...overrides }))
  return spies
}

describe('InitiativeSettingsDialog', () => {
  it('stays unmounted when no demand is being edited', () => {
    const { container } = render(
      createElement(InitiativeSettingsDialog, {
        initiative: null,
        onOpenChange: vi.fn(),
        onSave: vi.fn(),
        onSaved: vi.fn(),
        onDelete: vi.fn(),
        onDeleted: vi.fn()
      })
    )
    expect(container.querySelector('.wb-initedit')).toBeNull()
  })

  it('opens on the demand’s current name, hue, year and release', () => {
    open()
    expect(screen.getByDisplayValue('Portal de Cobrança')).toBeTruthy()
    expect(screen.getByRole('radio', { name: 'Violeta' }).getAttribute('aria-checked')).toBe('true')
    expect(screen.getByRole('radio', { name: '2026' }).getAttribute('aria-checked')).toBe('true')
    expect(screen.getByRole('radio', { name: 'R2' }).getAttribute('aria-checked')).toBe('true')
  })

  it('saves the edited name and hue together', async () => {
    const { onSave, onSaved } = open()
    fireEvent.change(screen.getByDisplayValue('Portal de Cobrança'), {
      target: { value: 'Portal novo' }
    })
    fireEvent.click(screen.getByRole('radio', { name: 'Âmbar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        DEMAND,
        expect.objectContaining({ title: 'Portal novo', color: 'amber' })
      )
    )
    // The post-edit path travels back, because a release change moves the folder.
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(`${INITIATIVES_ROOT}/R2/portal`))
  })

  it('warns that changing the release moves the folder, before it happens', () => {
    open()
    expect(screen.queryByText(/A pasta será movida/)).toBeNull()
    fireEvent.click(screen.getByRole('radio', { name: 'R3' }))
    expect(
      screen.getByText(
        `A pasta será movida de ${INITIATIVES_ROOT}/R2/portal para ${INITIATIVES_ROOT}/R3/portal.`
      )
    ).toBeTruthy()
  })

  it('refuses an empty name rather than saving one', async () => {
    const { onSave } = open()
    fireEvent.change(screen.getByDisplayValue('Portal de Cobrança'), { target: { value: '  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Dê um nome à demanda.')
    expect(onSave).not.toHaveBeenCalled()
  })

  it('names the duplicate it refused to move onto', async () => {
    const exists = Object.assign(new Error('exists'), { name: 'InitiativeExistsError' })
    const { onSaved } = open({ onSave: vi.fn().mockRejectedValue(exists) })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Já existe uma demanda com esse nome nessa release.'
    )
    expect(onSaved).not.toHaveBeenCalled()
  })

  it('asks before deleting, and names what goes', () => {
    const { onDelete } = open()
    fireEvent.click(screen.getByRole('button', { name: 'Excluir iniciativa' }))
    expect(screen.getByRole('alertdialog', { name: 'Excluir esta iniciativa?' })).toBeTruthy()
    expect(screen.getByText(/Portal de Cobrança/)).toBeTruthy()
    // Nothing has happened yet — the first press only arms the question.
    expect(onDelete).not.toHaveBeenCalled()
  })

  it('deletes only on the confirmation, and closes the demand afterwards', async () => {
    const { onDelete, onDeleted } = open()
    fireEvent.click(screen.getByRole('button', { name: 'Excluir iniciativa' }))
    fireEvent.click(screen.getByRole('button', { name: 'Excluir' }))
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith(DEMAND))
    await waitFor(() => expect(onDeleted).toHaveBeenCalled())
  })

  it('backs out of the confirmation without deleting', () => {
    const { onDelete } = open()
    fireEvent.click(screen.getByRole('button', { name: 'Excluir iniciativa' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(onDelete).not.toHaveBeenCalled()
  })

  it('offers a demand filed outside the standard sets its own year and release', () => {
    cleanup()
    open({ initiative: { ...DEMAND, release: 'hotfix', year: 1999 } })
    // A folder somebody made by hand must stay editable without being silently
    // refiled into R1 / this year.
    expect(screen.getByRole('radio', { name: 'hotfix' }).getAttribute('aria-checked')).toBe('true')
    expect(screen.getByRole('radio', { name: '1999' }).getAttribute('aria-checked')).toBe('true')
  })
})
