// The staged-files tray + per-conversation composer drafts. Run AFTER
// tools/visual/boot.mjs, which plants `window.hive`.
//
// Drives the real path the leak used to take, through the real controls: send a
// message (so this conversation gets an id), leave an unsent draft with files in
// it, open ANOTHER conversation from the history panel — the composer must come
// up empty — then come back and find the draft waiting, announced.
//
// Shoots four frames in one run:
//   tray-staged.png    three files staged, summary + Limpar
//   tray-elsewhere.png the other conversation: composer empty (the fix)
//   tray-restored.png  back home: draft returned, notice showing
//   tray-single.png    one file — no tray chrome at all
//
// Theme is a constant INSIDE the function: this file is handed to the MCP tool
// as an expression, so a `const` at module top level breaks the parse
// (docs/visual-validation.md).
async (page) => {
  const THEME = 'dark' // label only; the theme comes from boot.mjs
  const OUT = '/home/gustavobgt/user-harness/hive/.playwright-mcp'
  const composer = page.getByPlaceholder('Escreva uma mensagem…')

  const shoot = async (name) => {
    const box = await page.locator('.wb-composer-wrap').boundingBox()
    await page.screenshot({
      path: `${OUT}/${name}-${THEME}.png`,
      clip: { x: box.x - 14, y: box.y - 14, width: box.width + 28, height: box.height + 28 }
    })
  }

  await page.evaluate(() => {
    window.hive.agent.chooseAttachments = () =>
      Promise.resolve([
        {
          path: '/home/gustavo/Downloads/especificacao-tecnica-plataforma-v3-final.docx',
          name: 'especificacao-tecnica-plataforma-v3-final.docx',
          size: 184320
        },
        {
          path: '/home/gustavo/Downloads/dashboard-metricas.png',
          name: 'dashboard-metricas.png',
          size: 2411724
        },
        { path: '/home/gustavo/Downloads/metricas-q3.xlsx', name: 'metricas-q3.xlsx', size: 51200 }
      ])
  })

  // 1. This conversation earns an id (a draft can only be parked under one).
  await composer.fill('resume o trimestre para a diretoria')
  await page.getByRole('button', { name: 'Enviar' }).click()
  await page.waitForTimeout(300)
  await page.evaluate(() => window.__agentEvent({ type: 'done' }))
  await page.waitForTimeout(300)

  // 2. A second conversation to switch to.
  await page.evaluate(async () => {
    const s = await window.hive.chatHistory.create('/ws', 'claude')
    await window.hive.chatHistory.append('/ws', s.id, {
      role: 'user',
      text: 'revisar o contrato do fornecedor'
    })
  })

  // 3. Stage files + type, and leave it unsent.
  await page.getByRole('button', { name: 'Anexar arquivos' }).click()
  await composer.fill('compara estes números com a especificação e me diz o que mudou')
  await page.waitForTimeout(400)
  await shoot('tray-staged')

  // 4. Away, through the history panel — the exact gesture that used to carry
  //    the files into a conversation they had nothing to do with.
  await page.getByRole('button', { name: 'Histórico de conversas' }).click()
  await page.waitForTimeout(400)
  await page.getByText('revisar o contrato do fornecedor').last().click()
  await page.waitForTimeout(600)
  await shoot('tray-elsewhere')
  const leaked = await page.evaluate(() => ({
    text: document.querySelector('.hds-prompt-input textarea').value,
    chips: document.querySelectorAll('.wb-composer-chip').length
  }))

  // 5. …and back.
  await page.getByRole('button', { name: 'Histórico de conversas' }).click()
  await page.waitForTimeout(400)
  await page.getByText('resume o trimestre para a diretoria').last().click()
  await page.waitForTimeout(600)
  await shoot('tray-restored')
  const restored = await page.evaluate(() => ({
    text: document.querySelector('.hds-prompt-input textarea').value,
    chips: document.querySelectorAll('.wb-composer-chip').length,
    notice: document.querySelector('[data-testid="draft-restored"]')?.textContent ?? null
  }))

  // 6. A single file needs none of the tray's chrome.
  await page.evaluate(() => {
    document.querySelectorAll('.wb-composer-chip .hds-attachment-remove').forEach((b) => b.click())
    window.hive.agent.chooseAttachments = () =>
      Promise.resolve([
        { path: '/home/gustavo/Downloads/relatorio-anual.pdf', name: 'relatorio-anual.pdf', size: 204800 }
      ])
  })
  await composer.fill('')
  await page.waitForTimeout(200)
  await page.getByRole('button', { name: 'Anexar arquivos' }).click()
  await page.waitForTimeout(400)
  await shoot('tray-single')

  return JSON.stringify({ leaked, restored }, null, 2)
}
