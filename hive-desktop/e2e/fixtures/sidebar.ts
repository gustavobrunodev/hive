import type { Page } from '@playwright/test'

/**
 * Brings the sidebar into the state a spec needs: on screen, on a given tab.
 *
 * Two things this smooths over, both of them real product behaviour:
 *
 *  - **The panel can be hidden** (workspace-session). `.wb-rail` is then present
 *    but collapsed to zero width, which Playwright correctly calls not visible.
 *  - **The sidebar has two tabs** (nav-redesign), and it opens on `Chat`. Every
 *    spec written before that describes an app whose *file tree* is on screen,
 *    so `files` is the default here — which keeps those specs describing the app
 *    they were written about, rather than each of them growing a tab click.
 *
 * Its own module, with no Playwright fixture registration in it, so the specs
 * that deliberately keep their own self-contained launch helper can import the
 * gesture without importing a test harness they do not use.
 */
export async function openSidebar(window: Page, tab: 'chat' | 'files' = 'files'): Promise<void> {
  if ((await window.locator('.wb-pane[data-collapsed]').count()) > 0) {
    // Ctrl+B rather than a nav row: it works whichever view the sidebar was
    // left on, which is not something every caller knows.
    await window.keyboard.press('Control+b')
  }
  await window.locator('.wb-rail').waitFor({ state: 'visible', timeout: 15_000 })
  // The panel *slides* open, and "visible" is true from its first frame — so a
  // spec that measures or drags right after this would be reading a width the
  // animation is still on its way through. Wait for the slide to land.
  await window.waitForFunction(() => document.querySelector('.wb-panes-animating') === null, null, {
    timeout: 5_000
  })

  const target = window.getByRole('tab', { name: tab === 'chat' ? 'Chat' : 'Arquivos' })
  if ((await target.getAttribute('aria-selected')) !== 'true') await target.click()
  await window.waitForFunction(() => document.querySelector('.wb-panes-animating') === null, null, {
    timeout: 5_000
  })
}

/**
 * Starts a fresh conversation.
 *
 * "+ Novo" lives in the sidebar's Chat tab now (nav-redesign) rather than as a
 * glyph on the chat pane's header, so the gesture is two steps and every spec
 * that needs it should spend them in the same place.
 */
export async function newConversation(window: Page): Promise<void> {
  await openSidebar(window, 'chat')
  await window.getByRole('button', { name: 'Novo — iniciar uma nova conversa' }).click()
}

/**
 * Opens the wide "Todas as conversas" archive — the searchable full history
 * behind the sidebar's twelve-row preview.
 */
export async function openAllConversations(window: Page): Promise<void> {
  await openSidebar(window, 'chat')
  await window.getByRole('button', { name: /Ver todas as conversas/ }).click()
  await window.locator('.wb-allconv').waitFor({ state: 'visible', timeout: 15_000 })
}

/**
 * Opens the profile sheet.
 *
 * The avatar left the title bar for the bottom of the sidebar (nav-redesign),
 * so "settings" is a two-step gesture now: open the account menu, then pick
 * Configurações. Specs written against the old single button say
 * "Abrir configurações de perfil", which no longer names anything.
 */
export async function openSettings(window: Page): Promise<void> {
  await window.getByRole('button', { name: /^Menu do usuário/ }).click()
  await window.getByRole('menuitem', { name: /^Configurações/ }).click()
  await window.locator('.wb-pnav-row').first().waitFor({ state: 'visible', timeout: 15_000 })
}
