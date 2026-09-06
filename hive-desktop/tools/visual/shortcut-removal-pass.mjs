// The functional pass for "a role default has to be removable" (2026-09-05).
//
//   npx electron-vite build && python3 -m http.server 8123 -d out/renderer
//   run_code_unsafe --filename tools/visual/boot.mjs
//   run_code_unsafe --filename tools/visual/shortcut-removal-pass.mjs
//   HIVE_NO_BMAD=1 node tools/visual/run-scene.mjs tools/visual/shortcut-removal-pass.mjs
//
// It drives the picker the way a person does and reads the HERO back after
// every edit, because that is the whole claim: the shortcut has to leave the
// surface, not just the dialog. That only means anything against a stateful
// `window.hive.shortcuts` — before this round `set` resolved `undefined` and
// `actions` answered with a frozen list, so a dead edit and a wired one looked
// identical from here.
//
// With `HIVE_NO_BMAD=1` it covers the case that made this a bug rather than an
// annoyance: a workspace with no BMAD catalog, where the picker's list has
// nothing to offer and the only way out is the set itself.
async (page) => {
  const shots = '/home/gustavobgt/user-harness/hive/hive-desktop/.playwright-mcp'
  const noBmad = globalThis.HIVE_NO_BMAD === '1' || globalThis.HIVE_NO_BMAD === true
  const tag = noBmad ? 'nobmad' : 'bmad'
  const results = []
  const check = (name, pass, detail) =>
    results.push(`${pass ? 'PASS' : 'FAIL'} ${name}${detail === undefined ? '' : ` — ${detail}`}`)

  /** The hero's own pills, minus the "Personalizar" affordance at the tail. */
  const heroPills = async () =>
    (await page.locator('.wb-hero .wb-pill').allInnerTexts())
      .map((text) => text.trim())
      .filter((text) => text !== 'Personalizar')

  /** The chips inside the dialog's stage. */
  const stageChips = async () =>
    (await page.locator('.wb-sc-chip').allInnerTexts()).map((text) => text.trim())

  const openPicker = async () => {
    await page.getByRole('button', { name: 'Personalizar atalhos' }).first().click()
    await page.waitForTimeout(450)
  }
  const closePicker = async () => {
    await page.getByRole('button', { name: 'Concluído' }).click()
    await page.waitForTimeout(350)
  }

  const before = await heroPills()
  check('hero starts on the role defaults', before.length > 0, before.join(' · '))

  await openPicker()
  const chips = await stageChips()
  check('the stage draws the same set the hero does', chips.length === before.length, chips.join(' · '))
  await page.locator('.wb-sc-dialog').screenshot({ path: `${shots}/removal-${tag}-start.png` })

  // 1. Remove ONE role default by clicking its chip.
  const target = chips[0]
  await page.getByRole('button', { name: `Remover atalho: ${target}` }).click()
  await page.waitForTimeout(400)
  const afterChips = await stageChips()
  check(
    'clicking a chip removes exactly that shortcut from the set',
    afterChips.length === chips.length - 1 && !afterChips.includes(target),
    afterChips.join(' · ')
  )
  check(
    'the scope is marked as customized',
    (await page.locator('.wb-sc-state-badge').innerText()).trim() === 'Personalizado'
  )

  await closePicker()
  const afterHero = await heroPills()
  check(
    'the removed default is gone from the hero, not just from the dialog',
    !afterHero.includes(target) && afterHero.length === before.length - 1,
    afterHero.join(' · ')
  )

  // 2. Remove the rest in one gesture.
  await openPicker()
  await page.getByRole('button', { name: 'Remover todos' }).click()
  await page.waitForTimeout(400)
  check('"Remover todos" empties the scope', (await stageChips()).length === 0)
  check(
    'the empty set teaches what that means',
    await page.locator('.wb-sc-stage-empty').isVisible()
  )
  await page.locator('.wb-sc-dialog').screenshot({ path: `${shots}/removal-${tag}-empty.png` })

  await closePicker()
  check('the hero keeps no default behind', (await heroPills()).length === 0)

  // 3. Restore, and the role defaults come back.
  await openPicker()
  await page.getByRole('button', { name: 'Restaurar padrão' }).click()
  await page.waitForTimeout(400)
  check('"Restaurar padrão" brings the role set back', (await stageChips()).length === before.length)
  await closePicker()
  check('and the hero with it', (await heroPills()).length === before.length)

  // 4. The other scope was never touched by any of it.
  await openPicker()
  await page.getByRole('radio', { name: /Durante/ }).click()
  await page.waitForTimeout(350)
  const during = await stageChips()
  check('the during-scope set is untouched', during.length === 1, during.join(' · '))
  await page.locator('.wb-sc-dialog').screenshot({ path: `${shots}/removal-${tag}-during.png` })
  await page.getByRole('button', { name: `Remover atalho: ${during[0]}` }).click()
  await page.waitForTimeout(400)
  check('a during-scope default is removable too', (await stageChips()).length === 0)
  await closePicker()

  return { scenario: tag, fails: results.filter((line) => line.startsWith('FAIL')), results }
}
