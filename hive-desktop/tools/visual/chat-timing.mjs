// Visual-pass scenario for chat-timing / chat-queue / session-usage.
// Run AFTER tools/visual/boot.mjs. Drives one long turn far enough that every
// new readout has something real to show: a settled turn with its receipt, a
// live turn mid-step, two queued follow-ups, and a context meter with a
// composition worth opening.
//
//   run_code_unsafe --filename tools/visual/chat-timing.mjs
//
// Scenario and theme are chosen by editing the two defaults below — each
// `run_code_unsafe` call gets its own context, so a `globalThis` set in one
// call is gone by the next (docs/visual-validation.md).
//   scene: 'live' — a turn running, with a queue behind it
//          'tight' — the same, with the context window nearly full
//          'held'  — the same, then interrupted: paused queue + failed receipt
//   theme: 'dark' | 'light' | 'hive' — switched through the REAL topbar
//          control, not localStorage, which the init script would overwrite.
// (The file is a bare function *expression* handed to the MCP tool, not a
// module — the knobs have to live inside it.)
async (page) => {
  const scene = 'live'
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

  const usage = (over) => ({
    inputTokens: 812,
    cacheReadTokens: 61_400,
    cacheCreationTokens: 14_300,
    outputTokens: 1_240,
    model: 'claude-opus-5',
    ...over
  })

  // --- turn 1: settled, so its receipt is on screen -------------------------
  await type('Levanta os requisitos do módulo de faturamento e escreve o PRD')
  await emit([{ type: 'token', text: 'Vou ler o módulo antes de escrever.\n\n' }])
  await emit([
    { type: 'tool', name: 'Read', detail: '/ws/src/billing/index.ts', toolId: 'a1', phase: 'start' }
  ])
  await page.waitForTimeout(1400)
  await emit([
    { type: 'tool', name: '', toolId: 'a1', phase: 'end', ok: true },
    { type: 'tool', name: 'Grep', detail: 'invoice|charge|refund', toolId: 'a2', phase: 'start' }
  ])
  await page.waitForTimeout(2600)
  await emit([
    { type: 'tool', name: '', toolId: 'a2', phase: 'end', ok: true },
    {
      type: 'token',
      text: 'O módulo cobre cobrança recorrente e estorno, mas não tem trilha de auditoria. Escrevi o PRD em `_bmad-output/prd.md`.'
    },
    { type: 'usage', usage: usage({ outputTokens: 1_240 }) },
    {
      type: 'usage',
      final: true,
      usage: usage({ outputTokens: 1_240, costUsd: 0.0918, durationMs: 24_180, apiDurationMs: 21_902 })
    },
    { type: 'done' }
  ])
  await page.waitForTimeout(300)

  // --- turn 2: live, mid-step ----------------------------------------------
  await type('Agora gera as histórias a partir dele')
  await emit([{ type: 'token', text: 'Certo — vou quebrar em histórias por fluxo.\n\n' }])
  await emit([
    { type: 'tool', name: 'Read', detail: '/ws/_bmad-output/prd.md', toolId: 'b1', phase: 'start' }
  ])
  await page.waitForTimeout(1200)
  const tight = scene === 'tight'
  await emit([
    { type: 'tool', name: '', toolId: 'b1', phase: 'end', ok: true },
    { type: 'tool', name: 'Write', detail: '/ws/_bmad-output/stories/s1.md', toolId: 'b2', phase: 'start' },
    {
      type: 'usage',
      usage: tight
        ? usage({ cacheReadTokens: 152_000, cacheCreationTokens: 16_900, inputTokens: 1_240 })
        : usage({ cacheReadTokens: 68_900, cacheCreationTokens: 6_400, inputTokens: 940 })
    }
  ])

  // --- the queue: two follow-ups typed while it works ----------------------
  await type('Depois revisa os riscos de segurança de cada história')
  await type('E gera os critérios de aceite no formato Gherkin')

  // 'held' also interrupts the running turn, so the queue's paused state (and
  // the receipt's interrupted outcome) are on screen instead of only in prose.
  if (scene === 'held') {
    await page.waitForTimeout(1200)
    await emit([{ type: 'interrupted' }])
  }

  await page.waitForTimeout(2200)
  return await page.evaluate(() => document.body.innerText.slice(0, 200))
}
