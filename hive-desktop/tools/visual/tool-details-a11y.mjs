// Accessibility pass for agent-tool-details — the disclosure on an activity row
// and the call/result panel behind it.
//
// Run AFTER tools/visual/boot.mjs + tools/visual/tool-details.mjs:
//   run_code_unsafe --filename tools/visual/tool-details-a11y.mjs
//
// What it checks, and why each one is here:
//  - **The disclosure is operable from the keyboard**, and Enter actually flips
//    `aria-expanded` — a chevron that only answers the mouse is an affordance
//    half the users don't have.
//  - **`aria-controls` never dangles.** The body is unmounted while closed, so
//    a static `aria-controls` points at an id that is not in the document. It
//    reported `false` here on the first run and is now conditional.
//  - **The button's name is the row's own words.** An `aria-label` of "Ver
//    detalhes" would replace "Rodou npm run verify" and cost the row its
//    identity. Measured through `ariaSnapshot`, NOT `textContent`: the two
//    disagree. Flex children run together in `textContent`
//    ("Rodounpm run verify10 linhas") while Chromium's name computation spaces
//    them correctly and drops the `aria-hidden` count — a probe reading
//    `textContent` reports a defect that does not exist.
//  - **No landmark inflation.** The two halves of the panel are `role="group"`,
//    not `<section aria-label>`: a labelled section is a landmark, and forty
//    steps would put forty of them in the page's navigation list.
//  - **Long output is reachable.** The result frame is focusable so a keyboard
//    user can scroll it.
//  - **Decoration stays silent.** The shell's `$` is punctuation, not content.
async (page) => {
  const first = page.locator('.wb-activity-open').first()
  await first.focus()
  const before = await first.getAttribute('aria-expanded')
  await page.keyboard.press('Enter')
  await page.waitForTimeout(150)
  const afterClose = await first.getAttribute('aria-expanded')
  const controlsWhenClosed = await first.getAttribute('aria-controls')
  await page.keyboard.press('Enter')
  await page.waitForTimeout(150)
  const afterOpen = await first.getAttribute('aria-expanded')

  const names = []
  const rows = page.locator('.wb-activity-open')
  for (let i = 0; i < Math.min(await rows.count(), 4); i += 1) {
    names.push((await rows.nth(i).ariaSnapshot()).split('\n')[0].trim())
  }

  const dom = await page.evaluate(() => ({
    controlsResolve: [...document.querySelectorAll('.wb-activity-open[aria-controls]')].every((r) =>
      document.getElementById(r.getAttribute('aria-controls'))
    ),
    panelsNamed: [...document.querySelectorAll('.wb-tdetail')].every((p) =>
      (p.getAttribute('aria-label') ?? '').startsWith('Detalhes de ')
    ),
    landmarks: document.querySelectorAll('.wb-tdetail section').length,
    focusableBodies: document.querySelectorAll('.hds-out-body[tabindex="0"]').length,
    promptsHidden: [...document.querySelectorAll('.hds-out-prompt')].every(
      (n) => n.getAttribute('aria-hidden') === 'true'
    )
  }))

  return {
    keyboard: { before, afterClose, afterOpen, ok: afterClose === 'false' && afterOpen === 'true' },
    controlsDroppedWhenClosed: { value: controlsWhenClosed, ok: controlsWhenClosed === null },
    names,
    ...dom
  }
}
