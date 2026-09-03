// Visual-pass scenario for the 2026-09-03 round: file paths in a reply that
// open the file, and Devin's per-model reasoning ladder.
//
// Run AFTER tools/visual/boot.mjs:
//   run_code_unsafe --filename tools/visual/devin-round.mjs
//
// It stages one settled turn whose prose names files three different ways —
// bare in a sentence, inside inline code, and with a `:line` — alongside a
// path that is NOT in the workspace and a fenced block full of paths, so a
// single screenshot shows both what links and what deliberately does not.
//
// Then it opens a fresh conversation on Devin, which is where the second half
// of the round lives: a model list whose rows state how many reasoning rungs
// they carry, and a ladder that belongs to the selected model rather than to
// the agent. A conversation locks to the agent that answered it, so the switch
// needs a new one — that is the app's rule, not the scene's.
//
// Theme is chosen by the constant below and switched through the REAL topbar
// control, never localStorage: the boot init script rewrites that key on every
// navigation, so a probe that sets it measures its own default three times
// (docs/visual-validation.md).
//   theme: 'dark' | 'light' | 'hive'
async (page) => {
  const theme = 'dark'

  if (theme !== 'dark') {
    await page.locator('.wb-icon-btn[aria-label^="Aparência"]').click()
    await page.getByRole('menuitemradio', { name: { light: 'Claro', hive: 'Hive' }[theme] }).click()
    await page.waitForTimeout(250)
  }

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

  await type('Onde você mexeu para consertar o Devin?')

  // Deliberately written the way an agent really writes: bare paths, inline
  // code, a compiler-style location, a listing, and one path that does not
  // exist in this workspace (`src/main/naoExiste.ts` must stay plain text).
  const reply = [
    '## O que mudou\n\n',
    'O parser lia uma forma que a CLI não responde, então reescrevi ',
    'src/main/devinCliAdapter.ts e o catálogo que ele usa. A ligação com o ',
    'chat está em `src/renderer/src/chat/Chat.tsx`, e o estilo do chip novo ',
    'ficou em src/renderer/src/assets/workbench.css:1621.\n\n',
    '- `package.json` não precisou mudar\n',
    '- `docs/prd.md` ganhou uma seção\n',
    '- src/main/naoExiste.ts não existe, e por isso continua texto\n\n',
    'Para conferir:\n\n',
    '```bash\n',
    'npm run test -- src/main/devinCliAdapter.test.ts\n',
    'cat src/main/agentService.ts | head -40\n',
    '```\n\n',
    'O resumo completo está em README.md.\n'
  ]

  await emit(reply.map((text) => ({ type: 'token', text })))
  await emit([{ type: 'done' }])
  await page.waitForTimeout(400)

  const links = await page.locator('.wb-pathlink').allTextContents()
  const plainInProse = await page.locator('.wb-md li', { hasText: 'não existe' }).count()
  const linksInsidePre = await page.locator('pre .wb-pathlink').count()

  // --- second half: Devin's per-model reasoning ladder ---------------------
  // A conversation locks to the agent that answered it, so the Devin half
  // needs a fresh one.
  await page.locator('button[aria-label="Nova conversa"]').click()
  await page.waitForTimeout(300)
  await page.locator('.wb-agent-pill').first().click()
  await page.waitForTimeout(280)
  await page.getByRole('menuitemradio', { name: 'Devin' }).click()
  await page.waitForTimeout(420)

  return {
    links,
    plainInProse,
    linksInsidePre,
    agent: await page.locator('.wb-agent-pill').first().innerText()
  }
}
