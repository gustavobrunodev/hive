// Functional pass for composer-menu-scroll: the `/` command menu's scroll port
// follows the keyboard.
//
// Run AFTER tools/visual/boot.mjs:
//   run_code_unsafe --filename tools/visual/slash-scroll-pass.mjs
//   node tools/visual/run-scene.mjs tools/visual/slash-scroll-pass.mjs
//
// The defect it exists for: the rows are `role="option"` driven from the
// textarea through `aria-activedescendant`, so **focus never moves** — and a
// scroll port only follows focus. Arrowing past the last visible row put the
// highlight on a row nobody could see, and wrapping from the last row to the
// first left the view parked at the bottom.
//
// No unit test can make this claim: jsdom lays nothing out, so "is the
// highlighted row inside the port" is a question only a real browser answers.
// This pass reads the real geometry after every press.
//
// It serves its own skill catalog (24 rows) through a second init script,
// because boot's fixture is five skills — a menu that fits has no fold to
// arrow past, and the pass would go green against the broken build.
async (page) => {
  const theme = globalThis.HIVE_THEME || 'dark'

  await page.addInitScript(() => {
    const patch = () => {
      if (!window.hive) return
      window.hive.skills.list = () =>
        Promise.resolve(
          Array.from({ length: 24 }, (_, index) => ({
            key: `bmad-skill-${String(index + 1).padStart(2, '0')}`,
            label: `Skill ${index + 1}`,
            description: `Descrição da skill ${index + 1} do workspace`
          }))
        )
    }
    patch()
  })

  if (theme !== 'dark') {
    await page.locator('.wb-icon-btn[aria-label^="Escolha do tema"]').click()
    await page.getByRole('menuitemradio', { name: { light: 'Claro', hive: 'Hive' }[theme] }).click()
    await page.waitForTimeout(250)
  }
  await page.reload()
  await page.waitForTimeout(700)

  const box = page.locator('textarea').first()
  await box.click()
  await box.fill('/')
  await page.waitForTimeout(350)

  /** Where the port is, and whether the highlighted row is inside it. */
  const read = () =>
    page.evaluate(() => {
      const list = document.querySelector('.wb-slash-list')
      const row = list?.querySelector('[data-active]')
      if (!list || !row) return null
      const port = list.getBoundingClientRect()
      const box = row.getBoundingClientRect()
      return {
        index: [...list.querySelectorAll('[role="option"]')].indexOf(row),
        label: row.getAttribute('aria-label'),
        scrollTop: Math.round(list.scrollTop),
        scrollable: list.scrollHeight > list.clientHeight + 1,
        // A row is "in view" when both its edges are inside the port's.
        visible: box.top >= port.top - 1 && box.bottom <= port.bottom + 1
      }
    })

  const first = await read()
  const steps = []
  const total = await page.evaluate(
    () => document.querySelectorAll('.wb-slash-list [role="option"]').length
  )

  // Down the whole list, one press at a time.
  for (let press = 0; press < total - 1; press++) {
    await page.keyboard.press('ArrowDown')
    await page.waitForTimeout(40)
    steps.push(await read())
  }
  const last = steps.at(-1)

  if (globalThis.HIVE_SHOT) await page.screenshot({ path: globalThis.HIVE_SHOT })

  // One more press wraps to the first row — the case where the highlight went
  // home and the view used to stay at the bottom.
  await page.keyboard.press('ArrowDown')
  await page.waitForTimeout(60)
  const wrapped = await read()

  // …and one press up from there wraps to the last row, at the other end.
  await page.keyboard.press('ArrowUp')
  await page.waitForTimeout(60)
  const wrappedBack = await read()

  const offScreen = steps.filter((step) => step && !step.visible)
  return {
    theme,
    rows: total,
    scrollable: first?.scrollable ?? null,
    // The whole claim, in three numbers.
    offScreenAfterPress: offScreen.length,
    offScreenLabels: offScreen.map((step) => step.label),
    bottom: { index: last?.index ?? null, scrollTop: last?.scrollTop ?? null },
    wrapToTop: { index: wrapped?.index ?? null, scrollTop: wrapped?.scrollTop ?? null },
    wrapToBottom: {
      index: wrappedBack?.index ?? null,
      scrollTop: wrappedBack?.scrollTop ?? null,
      visible: wrappedBack?.visible ?? null
    }
  }
}
