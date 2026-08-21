// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { WorkspaceKindChoice } from './WorkspaceKindChoice'

/**
 * multi-workspace: the one moment the app asks what it may write into a
 * folder. The behaviours worth locking down are the ones that make it a
 * decision rather than a dialog to dismiss — nothing preselected, the disk
 * effects named, and a confirm button that states its own outcome.
 */
afterEach(() => cleanup())

const PATH = '/home/dev/Documentos/notas-da-squad'

function renderGate(): { onConfirm: ReturnType<typeof vi.fn>; onCancel: ReturnType<typeof vi.fn> } {
  const onConfirm = vi.fn()
  const onCancel = vi.fn()
  render(createElement(WorkspaceKindChoice, { path: PATH, onConfirm, onCancel }))
  return { onConfirm, onCancel }
}

describe('WorkspaceKindChoice', () => {
  it('names the folder in the question and shows its full path, unabbreviated', () => {
    renderGate()
    expect(screen.getByText('Como o Hive deve tratar “notas-da-squad”?')).toBeTruthy()
    // The user is deciding whether files may be written into this directory —
    // the path is the one thing on screen that must not be paraphrased.
    expect(screen.getByText(PATH)).toBeTruthy()
  })

  it('preselects nothing: both outcomes are legitimate and one writes to disk', () => {
    renderGate()
    for (const radio of screen.getAllByRole('radio')) {
      expect(radio.getAttribute('aria-checked')).toBe('false')
    }
  })

  it('keeps the confirm disabled, and neutral, until a choice is made', () => {
    const { onConfirm } = renderGate()
    const cta = screen.getByRole('button', { name: 'Continuar' })
    expect((cta as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText('Escolha uma das duas opções para continuar.')).toBeTruthy()

    fireEvent.click(cta)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('names the folders each option creates, so the promise is checkable', () => {
    renderGate()
    expect(
      screen.getByText('Cria _bmad/, .claude/skills/ e second-brain/ dentro da pasta.')
    ).toBeTruthy()
    expect(screen.getByText('O Hive não cria nenhuma pasta aqui.')).toBeTruthy()
  })

  it('restates the outcome on the confirm button once a choice is made', () => {
    const { onConfirm } = renderGate()

    fireEvent.click(screen.getByRole('radio', { name: /Workspace leve/ }))
    const light = screen.getByRole('button', { name: 'Abrir sem instalar' })
    expect((light as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(light)
    expect(onConfirm).toHaveBeenCalledWith('light')

    fireEvent.click(screen.getByRole('radio', { name: /Workspace completo/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Instalar e abrir' }))
    expect(onConfirm).toHaveBeenLastCalledWith('managed')
  })

  it('drops the hint once the button can speak for itself', () => {
    renderGate()
    fireEvent.click(screen.getByRole('radio', { name: /Workspace leve/ }))
    expect(screen.queryByText('Escolha uma das duas opções para continuar.')).toBeNull()
  })

  it('cancelling reports it without confirming anything', () => {
    const { onConfirm, onCancel } = renderGate()
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('is operable from the keyboard: the radiogroup arrows pick an option', () => {
    const { onConfirm } = renderGate()
    const first = screen.getAllByRole('radio')[0]
    first.focus()
    fireEvent.keyDown(first, { key: 'ArrowDown' })

    expect(screen.getAllByRole('radio')[1].getAttribute('aria-checked')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'Abrir sem instalar' }))
    expect(onConfirm).toHaveBeenCalledWith('light')
  })
})
