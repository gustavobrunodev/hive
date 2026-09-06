// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AddContextMenu } from './AddContextMenu'

/**
 * The seam a stubbed design system cannot see.
 *
 * `Chat.test.ts` mocks `@hive/design-system` to read what a row *says*; the
 * DS's own suite opens the menu from a plain `<button>`. Between them sits the
 * failure this app has already shipped once (`EnginePicker.open.test.ts`): a
 * custom trigger handed to Radix's `asChild` that renders a `<button>` while
 * dropping the props it was cloned with. Both suites stay green; the control
 * cannot be opened.
 *
 * So this file mocks nothing. It renders the real menu over the real Radix
 * primitive and asks the only question neither of the others asks: does the
 * `+` open, and do the rows do their two different jobs?
 */
/**
 * jsdom ships no `PointerEvent`, so testing-library falls back to a bare
 * `Event` and drops `button`/`ctrlKey` — Radix's trigger reads exactly those
 * two to decide a primary-button press, so without this the menu never opens
 * and every assertion below fails for the wrong reason. Same stand-in the
 * image viewer's suite uses for its pan coordinates.
 */
class PointerEventStub extends MouseEvent {
  readonly pointerId: number
  readonly pointerType: string
  constructor(
    type: string,
    init: MouseEventInit & { pointerId?: number; pointerType?: string } = {}
  ) {
    super(type, init)
    this.pointerId = init.pointerId ?? 0
    this.pointerType = init.pointerType ?? 'mouse'
  }
}

beforeAll(() => {
  vi.stubGlobal('PointerEvent', PointerEventStub)
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

afterEach(cleanup)

function renderMenu(canUpload = true): {
  onMention: ReturnType<typeof vi.fn>
  onUpload: ReturnType<typeof vi.fn>
  onCloseFocus: ReturnType<typeof vi.fn>
} {
  const handlers = { onMention: vi.fn(), onUpload: vi.fn(), onCloseFocus: vi.fn() }
  render(createElement(AddContextMenu, { canUpload, ...handlers }))
  return handlers
}

/** Radix opens on pointerdown, not click — the gesture a real pointer makes. */
function open(): HTMLElement {
  const trigger = screen.getByRole('button', { name: 'Adicionar contexto' })
  fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false, pointerType: 'mouse' })
  return trigger
}

describe('AddContextMenu', () => {
  it('opens from the + and marks the trigger open, so the glyph can turn', async () => {
    renderMenu()
    const trigger = open()
    expect(await screen.findByRole('menu')).toBeTruthy()
    // The `+` → `×` rotation hangs off this attribute; without it the trigger
    // has no way to say it is also the way out.
    expect(trigger.getAttribute('data-state')).toBe('open')
  })

  it('names the two sources, with the @ hint printed on the row that uses it', async () => {
    renderMenu()
    open()
    const items = await screen.findAllByRole('menuitem')
    expect(items.map((item) => item.textContent)).toEqual([
      'Arquivos do workspaceCite um arquivo do projeto na mensagem@',
      'Arquivos do computador…Anexe arquivos de fora do projeto'
    ])
    // The hint is a reminder of a binding, never part of the row's name.
    expect(items[0].querySelector('.hds-dropdown-menu-shortcut')).toHaveProperty(
      'ariaHidden',
      'true'
    )
  })

  it('runs the mention route from the first row', async () => {
    const { onMention, onUpload } = renderMenu()
    open()
    fireEvent.click(await screen.findByRole('menuitem', { name: /Arquivos do workspace/ }))
    await waitFor(() => expect(onMention).toHaveBeenCalledTimes(1))
    expect(onUpload).not.toHaveBeenCalled()
  })

  it('runs the OS picker from the second row', async () => {
    const { onMention, onUpload } = renderMenu()
    open()
    fireEvent.click(await screen.findByRole('menuitem', { name: /Arquivos do computador/ }))
    await waitFor(() => expect(onUpload).toHaveBeenCalledTimes(1))
    expect(onMention).not.toHaveBeenCalled()
  })

  it('hands focus to the composer after a row is chosen, not back to the +', async () => {
    const { onCloseFocus } = renderMenu()
    open()
    fireEvent.click(await screen.findByRole('menuitem', { name: /Arquivos do workspace/ }))
    await waitFor(() => expect(onCloseFocus).toHaveBeenCalled())
  })

  /**
   * The other half of that rule, and the one a keyboard pass caught: escaping
   * is "never mind", and a cancel that drops the caret into the composer loses
   * the place of whoever was tabbing through the toolbar. Dismissal keeps the
   * platform behaviour — back to the control that was opened.
   */
  it('leaves a dismissal alone, so Escape goes back to the + like any menu', async () => {
    const { onCloseFocus, onMention, onUpload } = renderMenu()
    const trigger = open()
    await screen.findByRole('menu')

    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
    expect(onCloseFocus).not.toHaveBeenCalled()
    expect(onMention).not.toHaveBeenCalled()
    expect(onUpload).not.toHaveBeenCalled()
    await waitFor(() => expect(document.activeElement).toBe(trigger))
  })

  /**
   * An agent that cannot take file paths gets the row removed, not disabled: a
   * permanently dead row in a two-row menu is a worse answer than a menu that
   * only offers what works here.
   */
  it('drops the computer row for an agent that takes no attachments', async () => {
    renderMenu(false)
    open()
    expect(await screen.findByRole('menuitem', { name: /Arquivos do workspace/ })).toBeTruthy()
    expect(screen.queryByRole('menuitem', { name: /computador/ })).toBeNull()
  })
})
