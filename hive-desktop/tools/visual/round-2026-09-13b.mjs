// The three UI changes of this round, staged in one transcript. Run AFTER
// tools/visual/boot.mjs.
//
//   1. the `@` file-mention menu's scrollbar  (was a raw platform bar)
//   2. the attachment chips inside a sent user bubble (contrast)
//   3. the copy control on every fenced block of an agent reply
//
// Shoots, per theme:
//   round13b-bubble-<theme>.png  the user message with its attachment chips
//   round13b-fence-<theme>.png   the agent reply with its fenced block
//   round13b-mention-<theme>.png the `@` menu, scrolled off the top so the bar
//                                is actually drawn
//
// Theme is a constant INSIDE the function: this file is handed to the MCP tool
// as an expression, so a `const` at module top level breaks the parse
// (docs/visual-validation.md).
async (page) => {
  const THEME = globalThis.HIVE_THEME || 'dark'
  const OUT = globalThis.HIVE_SHOT_DIR || '/home/gustavobgt/user-harness/hive/.playwright-mcp'
  const composer = page.getByPlaceholder('Escreva uma mensagem…')

  // A workspace with enough files that the `@` menu actually overflows its
  // eight-row port — a scrollbar you cannot make appear is a scrollbar you
  // cannot look at.
  await page.evaluate(() => {
    const files = []
    for (let i = 1; i <= 60; i += 1) {
      files.push(`docs/relatorios/relatorio-${String(i).padStart(2, '0')}.md`)
    }
    files.push('docs/prd.md', 'src/main/index.ts', 'README.md')
    window.hive.listFiles = () => Promise.resolve(files)
  })

  // 1. A sent message carrying attachments — the chips this round re-grounds.
  await page.evaluate(() => {
    window.hive.agent.chooseAttachments = () =>
      Promise.resolve([
        {
          path: 'C:\\Users\\gusta\\Downloads\\WhatsApp Image 2026-09-11 at 00.16.18.jpeg',
          name: 'WhatsApp Image 2026-09-11 at 00.16.18.jpeg',
          size: 248320
        },
        { path: 'C:\\Users\\gusta\\Downloads\\teste.txt', name: 'teste.txt', size: 0 }
      ])
  })
  await page.getByRole('button', { name: 'Adicionar contexto' }).click()
  await page.waitForTimeout(200)
  await page.getByRole('menuitem', { name: /Arquivos do computador/ }).click()
  await page.waitForTimeout(250)
  await composer.fill('Extraia o texto da foto anexada')
  await page.getByRole('button', { name: 'Enviar' }).click()
  await page.waitForTimeout(400)

  // 2. …answered with prose AND a fenced block, which is the reply shape the
  // copy control exists for.
  await page.evaluate(() => {
    const reply = [
      'Texto extraído da foto:',
      '',
      '```md',
      '# Renomear Fluxo BMAD => Fluxo',
      '',
      'Na visão fluxo ter uma visão de Etapas, e badges para fluxos opcionais.',
      '',
      '## Análise',
      '- Pesquisa de domínio (Opcional)',
      '- Brainstorming (Opcional)',
      '',
      '## Planejamento',
      '- PRD',
      '- UX Design (Opcional — se tiver UX)',
      '```',
      '',
      'E o mesmo bloco como comando, para conferir um bloco sem linguagem:',
      '',
      '```',
      'npm run verify && npm run build',
      '```'
    ].join('\n')
    for (const chunk of reply.split(/(?=\n)/)) {
      window.__agentEvent({ type: 'token', text: chunk })
    }
    window.__agentEvent({ type: 'done' })
  })
  await page.waitForTimeout(900)

  const shoot = async (name, selector, pad = 16) => {
    const box = await page.locator(selector).first().boundingBox()
    if (!box) return
    await page.screenshot({
      path: `${OUT}/${name}-${THEME}.png`,
      clip: {
        x: Math.max(0, box.x - pad),
        y: Math.max(0, box.y - pad),
        width: Math.min(1440 - Math.max(0, box.x - pad), box.width + pad * 2),
        height: Math.min(900 - Math.max(0, box.y - pad), box.height + pad * 2)
      }
    })
  }

  await shoot('round13b-bubble', '.hds-chat-message-user')
  await shoot('round13b-fence', '.hds-fence')

  // 3. The `@` menu, scrolled a little so the thumb is off the top rail and
  // its full geometry is on screen.
  await composer.click()
  await composer.fill('')
  await composer.type('compara com @relatorio', { delay: 12 })
  await page.waitForTimeout(500)
  await page.evaluate(() => {
    const port = document.querySelector('.wb-mention-scroll')
    if (port) port.scrollTop = 90
  })
  await page.waitForTimeout(250)
  await shoot('round13b-mention', '.wb-mention-menu')

  return JSON.stringify(
    {
      theme: THEME,
      chips: await page.locator('.wb-bubble-attachment').count(),
      fences: await page.locator('.hds-fence').count(),
      copyControls: await page.locator('.hds-fence-copy').count(),
      languages: await page.locator('.hds-fence-lang').allTextContents(),
      mentionRows: await page.locator('.wb-mention-item').count(),
      mentionScrollable: await page.evaluate(() => {
        const port = document.querySelector('.wb-mention-scroll')
        return port ? port.scrollHeight > port.clientHeight : null
      })
    },
    null,
    1
  )
}
