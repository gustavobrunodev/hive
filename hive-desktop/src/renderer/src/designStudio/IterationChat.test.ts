// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { readFileSync } from 'fs'
import { join } from 'path'
import { IterationChat, type IterationChatProps } from './IterationChat'

afterEach(() => {
  cleanup()
})

/**
 * design-studio T6.5 — DS-R10 and design.md §3.7. The Chat is a strip, and the
 * context chip is the requirement made visible: "havendo seleção no envio, o
 * pedido é interpretado nesse contexto por padrão" is only true for the user if
 * they can see the context and let go of it.
 */
function renderChat(overrides: Partial<IterationChatProps> = {}): IterationChatProps {
  const props: IterationChatProps = {
    expanded: false,
    onExpandedChange: vi.fn(),
    transcript: [],
    contextTag: null,
    onReleaseContext: vi.fn(),
    phase: null,
    onSend: vi.fn(),
    ...overrides
  }
  render(createElement(IterationChat, props))
  return props
}

describe('IterationChat — the strip (§3.7)', () => {
  it('is collapsed by default: the composer is there, the transcript is not', () => {
    renderChat({ transcript: [{ id: 'm1', role: 'agent', text: 'Compus a Tela.' }] })

    expect(screen.getByPlaceholderText('Escreva o que mudar…')).toBeTruthy()
    expect(screen.queryByText('Compus a Tela.')).toBeNull()
    expect(
      screen.getByRole('button', { name: 'Abrir a conversa' }).getAttribute('aria-expanded')
    ).toBe('false')
  })

  it('shows the transcript once expanded, oldest first', () => {
    renderChat({
      expanded: true,
      transcript: [
        { id: 'm1', role: 'user', text: 'deixe o botão discreto' },
        { id: 'm2', role: 'agent', text: 'Deixei o botão neutro.' }
      ]
    })

    expect(screen.getByText('deixe o botão discreto')).toBeTruthy()
    expect(screen.getByText('Deixei o botão neutro.')).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Fechar a conversa' }).getAttribute('aria-expanded')
    ).toBe('true')
  })

  it('toggles between the two heights from the one control', () => {
    const props = renderChat()

    fireEvent.click(screen.getByRole('button', { name: 'Abrir a conversa' }))
    expect(props.onExpandedChange).toHaveBeenCalledWith(true)

    cleanup()
    const expandedProps = renderChat({ expanded: true })
    fireEvent.click(screen.getByRole('button', { name: 'Fechar a conversa' }))
    expect(expandedProps.onExpandedChange).toHaveBeenCalledWith(false)
  })
})

describe('IterationChat — the context chip (DS-R10 AC-1)', () => {
  it('names the Component the next request will be about', () => {
    renderChat({ contextTag: 'wa-button' })

    expect(screen.getByText('no contexto: wa-button')).toBeTruthy()
  })

  it('shows no chip at all when the request is about the whole Tela', () => {
    renderChat({ contextTag: null })

    expect(screen.queryByText(/no contexto/)).toBeNull()
    expect(
      screen.queryByRole('button', { name: 'Soltar o contexto e falar da Tela inteira' })
    ).toBeNull()
  })

  it('releases the context from the ✕', () => {
    const props = renderChat({ contextTag: 'wa-card' })

    fireEvent.click(
      screen.getByRole('button', { name: 'Soltar o contexto e falar da Tela inteira' })
    )
    expect(props.onReleaseContext).toHaveBeenCalledTimes(1)
  })
})

describe('IterationChat — a turn in flight (DS-R2)', () => {
  it('says what the Skill is doing, in a live region, while it works', () => {
    renderChat({ phase: 'choosing' })

    const phase = screen.getByText('Escolhendo Componentes…')
    expect(phase.getAttribute('aria-live')).toBe('polite')
    // The typing indicator carries the same status for a screen reader.
    expect(screen.getAllByRole('status').length).toBeGreaterThan(0)
  })

  it('shows nothing about a turn when none is running', () => {
    renderChat({ phase: null })

    expect(screen.queryByText('Escolhendo Componentes…')).toBeNull()
    expect(screen.queryByText('Lendo a Spec…')).toBeNull()
  })

  it('sends the typed request', () => {
    const props = renderChat()

    const input = screen.getByPlaceholderText('Escreva o que mudar…')
    fireEvent.change(input, { target: { value: 'aumente o botão' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(props.onSend).toHaveBeenCalledWith('aumente o botão')
  })
})

/**
 * §3.9 / DS-R18: the strip's expand/collapse is a 200 ms height change, and
 * every animation in the app has an alternative under
 * `prefers-reduced-motion: reduce`. Asserted against the stylesheet because
 * jsdom computes no transitions — and because the requirement is about the
 * rule existing, not about a frame being painted.
 */
describe('the Chat strip animates only its height, with a reduced-motion alternative', () => {
  const STYLESHEET = readFileSync(join(__dirname, '../assets/workbench.css'), 'utf-8')

  it('grows and shrinks over 200 ms, and only in height', () => {
    const rule = /\.wb-dstudio-chat\s*\{([^}]*)\}/.exec(STYLESHEET)
    expect(rule).toBeTruthy()
    expect(rule![1]).toContain('transition: max-height 200ms')
  })

  it('turns the transition off under prefers-reduced-motion', () => {
    const reduced = STYLESHEET.slice(STYLESHEET.indexOf('.wb-dstudio-chat {'))
    expect(reduced).toMatch(
      /@media \(prefers-reduced-motion: reduce\) \{\s*\.wb-dstudio-chat \{\s*transition: none;/
    )
  })
})

/**
 * design-studio T6.6 — DS-R9 AC-5 / §3.7. A turn says what it did and offers to
 * take all of it back at once.
 */
describe('IterationChat — one turn, one undo (T6.6)', () => {
  const TURN = {
    id: 'm1',
    role: 'agent' as const,
    text: 'Deixei o botão neutro.',
    groupId: 'turn-1',
    changes: 3
  }

  it('says how many changes the turn applied', () => {
    renderChat({ expanded: true, transcript: [TURN], undoableGroupId: 'turn-1' })

    expect(screen.getByText('3 mudanças')).toBeTruthy()
  })

  it('says it in the singular for a turn of one', () => {
    renderChat({
      expanded: true,
      transcript: [{ ...TURN, changes: 1 }],
      undoableGroupId: 'turn-1'
    })

    expect(screen.getByText('1 mudança')).toBeTruthy()
  })

  it('undoes the whole turn from the turn itself', () => {
    const props = renderChat({
      expanded: true,
      transcript: [TURN],
      undoableGroupId: 'turn-1',
      onUndoTurn: vi.fn()
    })

    fireEvent.click(screen.getByRole('button', { name: /Desfazer este turno/ }))
    expect(props.onUndoTurn).toHaveBeenCalledTimes(1)
  })

  it('offers the undo only on the turn a single undo would actually revert', () => {
    renderChat({
      expanded: true,
      transcript: [TURN, { ...TURN, id: 'm2', groupId: 'turn-2' }],
      // A manual edit landed after both turns: neither is the top of the stack.
      undoableGroupId: 'manual-9'
    })

    expect(screen.queryByRole('button', { name: /Desfazer este turno/ })).toBeNull()
    // It still says what it did — only the affordance is gone, not the record.
    expect(screen.getAllByText('3 mudanças')).toHaveLength(2)
  })

  it('offers nothing to undo on a turn that applied no Commands (DS-R11 AC-5)', () => {
    renderChat({
      expanded: true,
      transcript: [{ id: 'm1', role: 'agent', text: 'O DS ativo não tem um seletor de data.' }],
      undoableGroupId: 'turn-1'
    })

    expect(screen.getByText('O DS ativo não tem um seletor de data.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Desfazer este turno/ })).toBeNull()
    expect(screen.queryByText(/mudanç/)).toBeNull()
  })
})
