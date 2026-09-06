// add-context: the `+` that replaced the composer's paperclip, and the menu it
// opens. Run AFTER tools/visual/boot.mjs, which plants `window.hive`.
//
// Shoots the three states that matter, plus the payoff of each row:
//   addctx-rest.png     the toolbar at rest — one `+`, no paperclip
//   addctx-open.png     the menu: two sources, two second lines, the `@` hint
//   addctx-hover.png    the highlight travelling into the icon tile
//   addctx-mention.png  row 1's payoff: `@` typed, workspace picker open
//   addctx-upload.png   row 2's payoff: the OS picker's files staged
//
// Theme is a constant INSIDE the function (the MCP hands this file over as an
// expression, so a module-level `const` breaks the parse).
async (page) => {
  const THEME = globalThis.HIVE_THEME || 'dark'
  const OUT = '/home/gustavobgt/user-harness/hive/.playwright-mcp'
  const composer = page.getByPlaceholder('Escreva uma mensagem…')

  // Wide enough to hold the composer AND a menu that opens above it.
  const shoot = async (name) => {
    const box = await page.locator('.wb-composer-wrap').boundingBox()
    const top = Math.max(0, box.y - 300)
    await page.screenshot({
      path: `${OUT}/${name}-${THEME}.png`,
      clip: { x: box.x - 14, y: top, width: box.width + 28, height: box.y + box.height + 20 - top }
    })
  }

  await page.evaluate(() => {
    window.hive.agent.chooseAttachments = () =>
      Promise.resolve([
        {
          path: '/home/gustavo/Downloads/especificacao-tecnica-plataforma-v3.docx',
          name: 'especificacao-tecnica-plataforma-v3.docx',
          size: 184320
        },
        { path: '/home/gustavo/Downloads/metricas-q3.xlsx', name: 'metricas-q3.xlsx', size: 51200 }
      ])
  })

  const plus = page.getByRole('button', { name: 'Adicionar contexto' })

  await composer.fill('')
  await page.waitForTimeout(200)
  await shoot('addctx-rest')

  await plus.click()
  await page.getByRole('menu').waitFor()
  await page.waitForTimeout(320)
  await shoot('addctx-open')

  // The highlight is the state channel: it has to reach the tile, not stop at
  // the row. Hover the SECOND row so the frame shows both states side by side.
  await page.getByRole('menuitem', { name: /Arquivos do computador/ }).hover()
  await page.waitForTimeout(320)
  await shoot('addctx-hover')

  const menu = {
    trigger: await plus.getAttribute('data-state'),
    rows: await page
      .getByRole('menuitem')
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('aria-label') ?? node.innerText))
  }

  // Row 1 — the mention route. The promise printed on the row is that this is
  // the same thing the `@` key does, so the workspace picker must come up.
  await page.getByRole('menuitem', { name: /Arquivos do workspace/ }).click()
  await page.waitForTimeout(400)
  const mention = {
    value: await composer.inputValue(),
    focused: await page.evaluate(
      () => document.activeElement?.getAttribute('placeholder') ?? document.activeElement?.tagName
    ),
    picker: await page.locator('.wb-mention-menu').isVisible(),
    rows: await page.locator('.wb-mention-item').count()
  }
  await shoot('addctx-mention')

  // Esc leaves the picker; the typed sigil stays, as the menu's own footer says.
  await page.keyboard.press('Escape')
  await composer.fill('')
  await page.waitForTimeout(200)

  // Row 2 — the OS picker route, the old paperclip's whole job.
  await plus.click()
  await page.getByRole('menuitem', { name: /Arquivos do computador/ }).click()
  await page.waitForTimeout(400)
  await composer.fill('compara estes dois com a especificação')
  await page.waitForTimeout(300)
  const upload = {
    chips: await page.locator('.wb-composer-chip').count(),
    closed: await page.getByRole('menu').count()
  }
  await shoot('addctx-upload')

  return JSON.stringify({ menu, mention, upload }, null, 2)
}
