// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { AwsTurnNotice } from './AwsTurnNotice'
import { appendTurnAuth, type TurnBlock } from './turnTimeline'

afterEach(cleanup)

describe('AwsTurnNotice', () => {
  it('explains the pause, and says whose turn it is', () => {
    render(createElement(AwsTurnNotice, { phase: 'waiting' }))
    expect(screen.getByText('Renovando a conexão com a AWS…')).toBeTruthy()
    expect(screen.getByText('Confirme no navegador para a resposta continuar.')).toBeTruthy()
  })

  it('carries no controls of its own — those live in the beacon', () => {
    // Two sets of buttons saying the same thing two panels apart is what makes
    // a user wonder which one is real.
    render(createElement(AwsTurnNotice, { phase: 'waiting' }))
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('becomes a way into the AWS panel when the host offers one', () => {
    const onOpenPanel = vi.fn()
    render(createElement(AwsTurnNotice, { phase: 'waiting', onOpenPanel }))
    fireEvent.click(screen.getByRole('button'))
    expect(onOpenPanel).toHaveBeenCalled()
  })

  it('settles into a record of what happened rather than disappearing', () => {
    // A transcript that erases the reason for a forty-second gap cannot be
    // read back the next day.
    render(createElement(AwsTurnNotice, { phase: 'cleared' }))
    expect(screen.getByText('Conexão com a AWS renovada')).toBeTruthy()
    expect(screen.queryByText(/Confirme no navegador/)).toBeNull()
  })
})

describe('appendTurnAuth', () => {
  const blocks: TurnBlock[] = [{ kind: 'text', id: 'text-0', text: 'oi' }]

  it('opens one block at the point the turn stopped', () => {
    const next = appendTurnAuth(blocks, 'waiting')
    expect(next).toHaveLength(2)
    expect(next[1]).toMatchObject({ kind: 'auth', provider: 'aws', phase: 'waiting' })
  })

  it('flips in place when the session clears — two rows would read as two interruptions', () => {
    const waiting = appendTurnAuth(blocks, 'waiting')
    const cleared = appendTurnAuth(waiting, 'cleared')
    expect(cleared).toHaveLength(2)
    expect(cleared[1]).toMatchObject({ kind: 'auth', phase: 'cleared' })
    expect(cleared[1].id).toBe(waiting[1].id)
  })

  it('is a no-op when the phase has not changed, so React keeps the same list', () => {
    const waiting = appendTurnAuth(blocks, 'waiting')
    expect(appendTurnAuth(waiting, 'waiting')).toBe(waiting)
  })
})
