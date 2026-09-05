// Visual-pass scenario for chat-command-mentions (MELHORIA 1) + the bare-URL
// autolink regression (MELHORIA 2).
//
// Run AFTER tools/visual/boot.mjs:
//   run_code_unsafe --filename tools/visual/command-mentions-pass.mjs
//
// The point this scene proves that no unit test can: the skill catalog is
// NOT bmad-only. `boot.mjs`'s own fixture answers `skills.list` with `[]`, so
// this scene layers a SECOND init script (registered after boot's — Playwright
// runs page.addInitScript hooks in registration order) that serves a mixed
// catalog — one BMAD workflow, one workspace-custom skill named after this
// very project's own real `.claude/skills/impeccable` — and reloads once so
// `Chat` mounts and fetches it fresh (a store that reads once does not see a
// fixture changed after the fact — docs/visual-validation.md). It also wraps
// `agent.runWorkflow`/`agent.send`/`openExternal` to record what a click did,
// since the mock itself only resolves `undefined`.
async (page) => {
  const theme = globalThis.HIVE_THEME || 'dark'

  await page.addInitScript(() => {
    const calls = (window.__calls = [])
    const record = (name) =>
      function (...args) {
        calls.push({ name, args })
        return Promise.resolve(undefined)
      }
    const patch = () => {
      if (!window.hive) return
      window.hive.skills.list = () =>
        Promise.resolve([
          { key: 'bmad-party-mode', label: 'Reunir os agentes', description: '' },
          { key: 'impeccable', label: 'impeccable', description: '' }
        ])
      window.hive.agent.runWorkflow = record('runWorkflow')
      window.hive.agent.send = record('send')
      window.hive.openExternal = record('openExternal')
    }
    // boot.mjs's own init script runs first (registered first) and defines
    // `window.hive` fresh on this same navigation — patch synchronously right
    // after, well before React reads any of it.
    patch()
  })

  if (theme !== 'dark') {
    await page.locator('.wb-icon-btn[aria-label^="Aparência"]').click()
    await page.getByRole('menuitemradio', { name: { light: 'Claro', hive: 'Hive' }[theme] }).click()
    await page.waitForTimeout(250)
  }
  // Land on a fresh document so BOTH init scripts run, in order, before mount.
  await page.reload()
  await page.waitForTimeout(700)

  const type = async (text) => {
    const box = page.locator('textarea').first()
    await box.click()
    await box.fill(text)
    await page.keyboard.press('Enter')
    await page.waitForTimeout(180)
  }
  const emit = (events) =>
    page.evaluate((list) => {
      for (const event of list) window.__agentEvent(event)
    }, events)

  await type('Como posso explorar isso de outros ângulos?')

  // Written the way an agent actually writes it: a mention mid-sentence, one
  // written as inline code, one from a DIFFERENT (non-BMAD) skill so the chip
  // is never mistaken for "a BMAD-only feature", one decoy that only *looks*
  // like a command, and a bare URL with no markdown syntax at all — the exact
  // shape of the report that opened this round ("A página está aberta em:
  // https://…", no `[text](url)`).
  const reply = [
    'Boa pergunta. Além disso, você pode sempre invocar /bmad-party-mode se ',
    'quiser múltiplas perspectivas de agentes em paralelo, ou rodar `impeccable` ',
    'para uma crítica de UX mais profunda. Isso não é sobre 3/4 do projeto nem ',
    'sobre and/or condições — é sobre o próximo passo.\n\n',
    'Pesquisei "botafogo" no Google usando o Playwright. A página de resultados ',
    'está aberta em:\n\nhttps://www.google.com/search?q=botafogo\n'
  ]
  await emit(reply.map((text) => ({ type: 'token', text })))
  await emit([{ type: 'done' }])
  await page.waitForTimeout(400)

  const chips = await page.locator('.wb-cmdlink').allTextContents()
  const link = page.getByRole('link', { name: 'https://www.google.com/search?q=botafogo' })
  const linkHref = await link.getAttribute('href')

  await page.locator('.wb-cmdlink', { hasText: '/bmad-party-mode' }).click()
  await page.waitForTimeout(150)
  await page.locator('.wb-cmdlink', { hasText: '/impeccable' }).click()
  await page.waitForTimeout(150)
  await link.click()
  await page.waitForTimeout(150)

  const calls = await page.evaluate(() => window.__calls)

  await page.screenshot({ path: `.playwright-mcp/command-mentions-${theme}.png`, fullPage: false })

  return {
    chips,
    linkHref,
    decoyBecameButton: (await page.locator('.wb-cmdlink', { hasText: '3/4' }).count()) > 0,
    calls
  }
}
