// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { EnginePicker } from './EnginePicker'
import type { EngineCapabilities } from './engineOptions'

/**
 * The seam its sibling suite cannot see.
 *
 * `EnginePicker.test.ts` stubs `@hive/design-system` so it can read what a row
 * *says*; the design system's own `OptionPicker.test.tsx` opens the panel from
 * a plain `<button>`. Between those two suites sits the thing that actually
 * broke in production: `OptionPicker` hands its child to Radix's `asChild`,
 * which clones that element with the open handler and a ref — and the app's
 * trigger was a component that rendered a `<button>` while dropping every prop
 * it was given. Both suites stayed green; the control could not be opened.
 *
 * So this file mocks nothing. It renders the real picker over the real popover
 * and asks the only question that was never asked: does clicking it open?
 */
beforeAll(() => {
  // Radix and cmdk call these unconditionally; jsdom ships none of them.
  // `vi.fn()` rather than hand-written no-ops, matching `viewers.test.ts`.
  globalThis.ResizeObserver ??= class {
    observe = vi.fn()
    unobserve = vi.fn()
    disconnect = vi.fn()
  } as unknown as typeof ResizeObserver
  Element.prototype.scrollIntoView = vi.fn()
  Element.prototype.hasPointerCapture = vi.fn(() => false)
  Element.prototype.setPointerCapture = vi.fn()
  Element.prototype.releasePointerCapture = vi.fn()
})

const CLAUDE: EngineCapabilities = {
  models: [
    {
      id: '',
      label: 'Automático',
      descriptionKey: 'cliDefault',
      traits: ['cli-default'],
      group: 'default',
      resolvedId: 'opus'
    },
    { id: 'opus', label: 'Opus', descriptionKey: 'claude.opus', group: 'recommended' },
    { id: 'sonnet', label: 'Sonnet', descriptionKey: 'claude.sonnet', group: 'recommended' }
  ],
  efforts: [
    { id: '', label: 'Automático', descriptionKey: 'effort.cliDefault' },
    { id: 'low', label: 'Baixo', descriptionKey: 'effort.low' },
    { id: 'medium', label: 'Médio', descriptionKey: 'effort.medium' },
    { id: 'high', label: 'Alto', descriptionKey: 'effort.high' }
  ],
  supportsAttachments: true,
  modelSource: 'detected'
}

function renderPicker(overrides: Partial<Parameters<typeof EnginePicker>[0]> = {}): {
  onModelChange: ReturnType<typeof vi.fn>
  onEffortChange: ReturnType<typeof vi.fn>
} {
  const onModelChange = vi.fn()
  const onEffortChange = vi.fn()
  render(
    createElement(EnginePicker, {
      capabilities: CLAUDE,
      model: '',
      effort: '',
      onModelChange,
      onEffortChange,
      onRefresh: vi.fn(),
      refreshing: false,
      ...overrides
    })
  )
  return { onModelChange, onEffortChange }
}

/** The trigger, found the way a user finds it: by what it is called. */
function trigger(): HTMLElement {
  return screen.getByRole('button', { name: /Motor da conversa/ })
}

afterEach(cleanup)

describe('EnginePicker over the real OptionPicker', () => {
  it('opens the panel when the trigger is clicked', async () => {
    renderPicker()
    fireEvent.click(trigger())
    expect(await screen.findByRole('listbox', { name: 'Escolher modelo' })).toBeTruthy()
  })

  // The exact tell the shipped bug left behind: a trigger that never received
  // Radix's state props. Asserted separately from "the panel opened" because
  // this is the cheap, specific signal — a trigger with no `aria-expanded` is
  // a trigger that was handed nothing, whatever else happens to work.
  it('receives the popover state props on the trigger element', async () => {
    renderPicker()
    expect(trigger().getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(trigger())
    await waitFor(() => expect(trigger().getAttribute('aria-expanded')).toBe('true'))
    expect(trigger().getAttribute('data-state')).toBe('open')
  })

  it('reports the model the user picked from the open panel', async () => {
    const { onModelChange } = renderPicker()
    fireEvent.click(trigger())
    fireEvent.click(await screen.findByRole('option', { name: /Sonnet/ }))
    expect(onModelChange).toHaveBeenCalledWith('sonnet')
  })

  it('reports the effort the user picked from the panel footer', async () => {
    const { onEffortChange } = renderPicker()
    fireEvent.click(trigger())
    fireEvent.click(await screen.findByRole('radio', { name: /Alto/ }))
    expect(onEffortChange).toHaveBeenCalledWith('high')
  })

  // The closed control has to answer both halves, including the state a
  // first-time user is in — where the effort chip used to render nothing at
  // all, so the one person who most needed to learn the setting exists was the
  // one person shown no sign of it.
  /**
   * The seam the stubs cannot see, again: the row's pin is a `<button>` inside
   * a cmdk item, and cmdk *selects on click*. Without the pointer events being
   * stopped, pinning a row would also choose it and shut the panel — "keep
   * this for later" and "use this now" collapsed into one gesture.
   */
  it('pins a row from the open panel without choosing it or closing', async () => {
    const onChange = vi.fn()
    const { onModelChange } = renderPicker({
      pin: { model: null, agentName: 'Claude Code', onChange }
    })
    fireEvent.click(trigger())

    fireEvent.click(
      await screen.findByRole('button', { name: 'Fixar Sonnet como padrão deste agente' })
    )

    expect(onChange).toHaveBeenCalledWith({ model: 'sonnet', effort: '' })
    expect(onModelChange).not.toHaveBeenCalled()
    expect(screen.getByRole('listbox', { name: 'Escolher modelo' })).toBeTruthy()
  })

  /** The keyboard's way to a control that is deliberately not a tab stop. */
  it('toggles the pin on the row under the cursor with Alt+P', async () => {
    const onChange = vi.fn()
    renderPicker({ model: 'sonnet', pin: { model: null, onChange } })
    fireEvent.click(trigger())
    const list = await screen.findByRole('listbox', { name: 'Escolher modelo' })

    fireEvent.keyDown(list, { key: 'p', altKey: true })

    expect(onChange).toHaveBeenCalledWith({ model: 'sonnet', effort: '' })
  })

  it('marks the closed trigger when the model in use is the pinned default', () => {
    renderPicker({ model: 'sonnet', pin: { model: 'sonnet', onChange: vi.fn() } })
    expect(trigger().querySelector('.wb-engine-pinned')).toBeTruthy()
  })

  it('names the effort on the closed trigger even when it is delegated', () => {
    renderPicker({ effort: '' })
    expect(trigger().querySelector('.wb-engine-effort-chip')?.textContent).toContain('Auto')
  })

  it('names the chosen effort on the closed trigger', () => {
    renderPicker({ effort: 'high' })
    expect(trigger().querySelector('.wb-engine-effort-chip')?.textContent).toContain('Alto')
    // All three bars for the top rung of this agent's three: the mark reports
    // a *proportion* of whatever ladder the agent has, not an absolute index —
    // which is why the same "Alto" lights two bars on a five-rung ladder.
    expect(trigger().querySelectorAll('.wb-engine-spark i[data-on]')).toHaveLength(3)
  })

  // Asserted structurally rather than on the text, because the *model* label
  // is itself "Automático" — a substring check here passes for the wrong
  // reason and would keep passing after the chip came back.
  it('drops the effort half entirely for an agent that has no ladder', () => {
    renderPicker({ capabilities: { ...CLAUDE, efforts: [] } })
    expect(trigger().querySelector('.wb-engine-effort-chip')).toBeNull()
    expect(trigger().querySelector('.wb-engine-spark')).toBeNull()
  })
})
