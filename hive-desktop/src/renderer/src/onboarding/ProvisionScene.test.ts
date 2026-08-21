// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { act, cleanup, render, screen } from '@testing-library/react'
import { ProvisionScene } from './ProvisionScene'
import { HiveSignal } from './HiveSignal'

vi.mock('@hive/design-system', () => ({
  Alert: ({ title, children, ...rest }: { title?: ReactNode; children?: ReactNode }) =>
    createElement(
      'div',
      { role: 'alert', ...rest },
      createElement('strong', null, title),
      children
    ),
  Progress: ({ className }: { className?: string }) =>
    createElement('div', { role: 'progressbar', className }),
  Logo: () => createElement('span', { 'data-testid': 'logo' })
}))

const MESSAGES = ['Primeira mensagem.', 'Segunda mensagem.', 'Última mensagem.']

function renderScene(overrides: Record<string, unknown> = {}): void {
  render(
    createElement(ProvisionScene, {
      title: 'Preparando seu workspace',
      messages: MESSAGES,
      caption: null,
      captionFallback: 'Instalando…',
      stage: [1, 2],
      ...overrides
    })
  )
}

/** Advances past `count` rotation intervals (4.2s each) inside `act`. */
function advanceMessages(count: number): void {
  act(() => {
    vi.advanceTimersByTime(count * 4200 + 50)
  })
}

describe('ProvisionScene', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('shows the stable title, the first reassurance line, and how much is left', () => {
    renderScene()

    expect(screen.getByRole('heading', { name: 'Preparando seu workspace' })).toBeTruthy()
    expect(screen.getByText(MESSAGES[0])).toBeTruthy()
    expect(screen.getByText('Etapa 1 de 2')).toBeTruthy()
  })

  it('falls back to the supplied caption until the stream says something', () => {
    renderScene()
    expect(screen.getByRole('status').textContent).toBe('Instalando…')

    cleanup()
    renderScene({ caption: 'npm install bmad-method' })

    // The real line always wins over the placeholder — the honest caption is
    // the whole reason the warm copy above it is allowed to be vague.
    expect(screen.getByRole('status').textContent).toBe('npm install bmad-method')
  })

  it('advances through the reassurance lines and then holds the last one', () => {
    renderScene()

    advanceMessages(1)
    expect(screen.getByText(MESSAGES[1])).toBeTruthy()

    advanceMessages(1)
    expect(screen.getByText(MESSAGES[2])).toBeTruthy()

    // A network install can outlast the copy by minutes. Looping back to
    // "getting started" after five minutes of waiting would read as a stall,
    // so the closing line — written to survive an open-ended wait — stays put.
    advanceMessages(3)
    expect(screen.getByText(MESSAGES[2])).toBeTruthy()
  })

  it('marks every step but the newest as done', () => {
    renderScene({
      steps: [
        { id: 'a', label: 'Baixando o BMAD' },
        { id: 'b', label: 'Instalando módulos' }
      ]
    })

    const states = screen.getAllByRole('listitem').map((item) => item.getAttribute('data-state'))
    expect(states).toEqual(['done', 'active'])
  })

  it('replaces the progress area with the error, and stops the copy rotating', () => {
    renderScene({ error: { title: 'Falha na instalação', message: 'npm ERR! network' } })

    expect(screen.getByRole('alert')).toBeTruthy()
    expect(screen.queryByRole('progressbar')).toBeNull()

    // A scene that keeps cheerfully cycling "quase lá" under an error message
    // is telling the user two different things at once.
    advanceMessages(3)
    expect(screen.getByText(MESSAGES[0])).toBeTruthy()
  })

  it('renders the actions it is given under either state', () => {
    renderScene({ actions: createElement('button', null, 'Tentar novamente') })

    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeTruthy()
  })
})

describe('HiveSignal', () => {
  afterEach(cleanup)

  it('draws signals that start at the mark\u2019s edge, not at its centre', () => {
    const { container } = render(createElement(HiveSignal, { running: true }))

    // A ring born at r=0 reads as the mark inflating; born at the mark's own
    // radius it reads as something leaving it, which is the whole idea.
    const radii = Array.from(container.querySelectorAll('.wb-signal-ring')).map((ring) =>
      ring.getAttribute('r')
    )
    expect(radii).toEqual(['30', '30', '30'])
  })

  it('always draws a still ring, so the emblem is complete on the first frame', () => {
    const { container } = render(createElement(HiveSignal, { running: true }))

    // A shape that exists only inside an animation ships missing wherever
    // animations don't run — a headless render, a paused tab, reduced motion.
    expect(container.querySelector('.wb-signal-ring-rest')).toBeTruthy()
  })

  it('spreads the signals evenly through one period so they read as one pulse', () => {
    const { container } = render(createElement(HiveSignal, { running: true }))

    const delays = Array.from(container.querySelectorAll<SVGCircleElement>('.wb-signal-ring')).map(
      (ring) => ring.style.getPropertyValue('--wb-ring-delay')
    )
    expect(delays).toEqual(['0.00s', '0.93s', '1.87s'])
  })

  it('holds still when the run is no longer in flight', () => {
    const { container } = render(createElement(HiveSignal, { running: false }))

    expect(container.querySelector('svg')?.getAttribute('data-state')).toBe('idle')
  })
})
