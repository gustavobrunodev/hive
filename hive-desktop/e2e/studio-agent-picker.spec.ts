import {
  test,
  expect,
  launchSeededApp,
  patchSeededConfig,
  waitForWorkUI
} from './fixtures/workspace'
import { openSidebar } from './fixtures/sidebar'

// A menu opened from inside a dialog must not take the dialog with it.
//
// The reported failure: open "Nova skill" in the Estúdio, click the agent
// selector twice, and the whole modal closes — with the briefing being typed.
// Four facts compose into it, and the account is in the design system's
// `useSurfaceDismissGuard`. What matters here is that **only a real gesture
// reaches it**: `locator.click()` presses and releases within one tick, before
// React has flushed the closing menu's dismissable-layer cleanup, so the
// dialog's deferred outside-click check still sees itself as covered and
// declines. Measured: with `click()` the bug is invisible; with
// `mouse.down()`/`mouse.up()` as separate input events it fired every time.
//
// So this spec drives the mouse, and it lives at the E2E layer because the
// mechanism needs three things a jsdom test does not have: real layout (the
// guard is geometric), real hit-testing (the click is delivered to the dialog's
// overlay, not to the button under the cursor) and real event timing.
const TWO_AGENTS = { agent: 'claude-cli', agents: ['claude-cli', 'github-copilot'] }

test.describe('estúdio de skills · seletor de agentes dentro do modal', () => {
  test('@p2 clicar duas vezes no seletor de agentes mantém o modal aberto', async ({ seeded }) => {
    patchSeededConfig(seeded, TWO_AGENTS)
    const app = await launchSeededApp(seeded)
    const window = await app.firstWindow()
    await waitForWorkUI(window)
    await openSidebar(window, 'chat')

    await window.getByRole('button', { name: 'Estúdio de skills' }).click()
    const dialog = window.locator('.wb-studio-dialog')
    await expect(dialog).toBeVisible({ timeout: 15_000 })

    // Into the create form, and type the briefing this bug used to destroy.
    await window
      .getByRole('button', { name: /Uma skill|Nova skill/ })
      .first()
      .click()
    await expect(window.locator('.wb-studio-create')).toBeVisible({ timeout: 15_000 })
    await window.locator('.wb-studio-field input').first().fill('revisor de release notes')

    const pill = window.locator('.wb-studio-dialog .wb-agent-pill-btn')
    await expect(pill).toBeVisible({ timeout: 20_000 })

    /** One real click: move, press, release — as separate input events. */
    const click = async (target = pill): Promise<void> => {
      // The create form scrolls inside the dialog, and `boundingBox()` reports
      // viewport coordinates whether or not the element is in the viewport —
      // so a gesture built from raw mouse events has to bring its target into
      // view itself, which `locator.click()` would have done for it.
      await target.scrollIntoViewIfNeeded()
      const box = await target.boundingBox()
      if (box === null) throw new Error('alvo sem caixa')
      await window.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
      await window.mouse.down()
      await window.mouse.up()
    }

    await click()
    await expect(window.locator('.wb-agent-menu')).toBeVisible()

    // The measurement that diagnosed this, asserted: with the menu open, the
    // dialog's own body must still be the thing under the cursor. When the menu
    // is modal it is not — `pointer-events` goes to `none` on the dialog
    // content and the hit-test returns the dialog's *overlay*, which is how a
    // click aimed at the form arrived as a click outside the form.
    const box = await pill.boundingBox()
    if (box === null) throw new Error('seletor sem caixa')
    const reach = await window.evaluate(
      ({ x, y }) => {
        const content = document.querySelector('.wb-studio-dialog')
        const hit = document.elementFromPoint(x, y)
        return {
          contentPointerEvents:
            content === null ? 'sem diálogo' : getComputedStyle(content).pointerEvents,
          hitsOverlay: hit !== null && hit.closest('.hds-dialog-overlay') !== null
        }
      },
      { x: box.x + box.width / 2, y: box.y + box.height / 2 }
    )
    expect(reach).toEqual({ contentPointerEvents: 'auto', hitsOverlay: false })

    // The second click: it closes the menu and nothing else.
    await click()
    await window.waitForTimeout(500)
    await expect(window.locator('.wb-agent-menu')).toHaveCount(0)
    await expect(dialog).toBeVisible()

    // The modal's own body is reachable while the menu is open — the click
    // lands on the control the user aimed at instead of on the dialog's
    // overlay, which is the other half of the same fix.
    await click()
    await expect(window.locator('.wb-agent-menu')).toBeVisible()
    const idea = window.locator('.wb-studio-field textarea').first()
    await click(idea)
    await window.waitForTimeout(400)
    await expect(dialog).toBeVisible()
    await expect(idea).toBeFocused()

    // And the briefing survived all of it.
    await expect(window.locator('.wb-studio-field input').first()).toHaveValue(
      'revisor de release notes'
    )

    await app.close()
  })
})
