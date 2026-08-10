// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SkillFailureView, SkillProgress } from './SkillStage'

afterEach(() => {
  cleanup()
})

/**
 * design-studio T6.2 — DS-R2 and design.md §3.9/§6. The wait is covered by a
 * Skeleton *and* a live line naming what is happening, and the two failure
 * shapes read as the two different things they are (DS-R17).
 */
describe('SkillProgress (DS-R2)', () => {
  it('marks the stage busy and announces the phase in a live region', () => {
    render(createElement(SkillProgress, { phase: 'reading' }))

    const stage = screen.getByLabelText('A Skill está compondo esta Tela')
    expect(stage.getAttribute('aria-busy')).toBe('true')
    const status = screen.getByRole('status')
    expect(status.textContent).toBe('Lendo a Spec…')
    expect(status.getAttribute('aria-live')).toBe('polite')
  })

  it('says what each phase is', () => {
    const { rerender } = render(createElement(SkillProgress, { phase: 'choosing' }))
    expect(screen.getByRole('status').textContent).toBe('Escolhendo Componentes…')

    rerender(createElement(SkillProgress, { phase: 'composing' }))
    expect(screen.getByRole('status').textContent).toBe('Compondo a Tela…')
  })
})

describe('SkillFailureView (DS-R17, design §6)', () => {
  it('gives a retryable OperationError a working Tentar de novo', () => {
    const onRetry = vi.fn()
    render(
      createElement(SkillFailureView, {
        failure: {
          kind: 'operation',
          scope: 'agent',
          message: 'O agente não respondeu.',
          retryable: true
        },
        onRetry
      })
    )

    expect(screen.getByText('A Skill não conseguiu gerar a Tela')).toBeTruthy()
    expect(screen.getByText('O agente não respondeu.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('offers no retry for a failure that is not retryable', () => {
    render(
      createElement(SkillFailureView, {
        failure: { kind: 'operation', scope: 'agent', message: 'sem agente', retryable: false },
        onRetry: vi.fn()
      })
    )

    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).toBeNull()
  })

  it('reads a CapabilityViolation as a limit of the Design System, with no retry', () => {
    render(
      createElement(SkillFailureView, {
        failure: {
          kind: 'capability',
          componentId: 'n1',
          reason: 'wa-datepicker não existe no catálogo ativo'
        },
        onRetry: vi.fn()
      })
    )

    expect(screen.getByText('O Design System ativo não tem o que o pedido precisa')).toBeTruthy()
    expect(screen.getByText('wa-datepicker não existe no catálogo ativo')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).toBeNull()
  })
})
