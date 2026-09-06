import type { Page } from '@playwright/test'

/**
 * Brings the sidebar back if this launch started with it hidden
 * (workspace-session).
 *
 * A workspace with no stored session opens on the chat alone, so `.wb-rail`
 * is present but collapsed to zero width — which Playwright, correctly, calls
 * not visible. Every spec written before the sidebar could be hidden describes
 * an app whose file rail is on screen, and this is what keeps them describing
 * the app they were written about.
 *
 * Its own module, with no Playwright fixture registration in it, so the specs
 * that deliberately keep their own self-contained launch helper can import the
 * gesture without importing a test harness they do not use.
 */
export async function openSidebar(window: Page): Promise<void> {
  if ((await window.locator('.wb-pane[data-collapsed]').count()) > 0) {
    // Ctrl+B rather than a rail entry: it works whichever view the sidebar was
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
}
