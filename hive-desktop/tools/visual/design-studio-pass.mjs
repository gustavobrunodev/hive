// Passe visual do Design Studio — lote 1 (entrada e navegação do módulo).
//
//   npx electron-vite build && python3 -m http.server 8123 -d out/renderer
//   HIVE_SIDEBAR=chat HIVE_THEME=light HIVE_SHOT_DIR=/tmp/ds \
//     node tools/visual/run-scene.mjs tools/visual/design-studio-pass.mjs
//
// Abre o módulo pela linha "Design Studio", passa pelas três páginas da
// navegação e abre uma conversa de Recentes, com uma captura de cada uma; depois
// esconde a lateral (Ctrl+B) e captura de novo, porque o selo "Dados de
// exemplo" só aparece no cabeçalho quando a navegação some.
//
// Tema pelo menu de Aparência, nunca pelo boot (engine-contrast): o boot só
// planta o atributo, e o React continuaria no tema anterior.
async (page) => {
  const dir = globalThis.HIVE_SHOT_DIR || '/tmp'
  const theme = globalThis.HIVE_THEME || 'dark'
  const label = { dark: 'Escuro', light: 'Claro', hive: 'Hive' }[theme]
  const log = []
  const shot = async (name) => {
    const path = `${dir}/ds-${theme}-${name}.png`
    await page.screenshot({ path })
    log.push(path)
  }

  await page.getByRole('button', { name: /^Escolha do tema/ }).click()
  await page.getByRole('menuitemradio', { name: new RegExp(`^${label}`) }).click()
  await page.keyboard.press('Escape')

  await page.getByRole('tab', { name: /Chat/ }).click()
  await page.getByRole('button', { name: /^(Ocultar )?Design Studio$/ }).click()
  await page.waitForSelector('.wb-work-layer[data-view="design"][data-active] [data-page="inicio"]')
  await page.waitForTimeout(300)
  await shot('inicio')

  for (const [name, page_] of [
    ['Dores', 'dores'],
    ['Relatórios', 'relatorios']
  ]) {
    await page.locator('.ds-nav').getByRole('button', { name }).click()
    await page.waitForSelector(`[data-page="${page_}"][data-active]`)
    await shot(page_)
  }

  await page.locator('.ds-recente').first().click()
  await page.waitForSelector('[data-page="conversa"][data-active]')
  await shot('conversa')

  // Focus ring on a nav row, by keyboard.
  await page.locator('.ds-nav').getByRole('button', { name: 'Início' }).focus()
  await page.keyboard.press('Tab')
  await shot('focus')

  await page.keyboard.press('Control+b')
  await page.waitForTimeout(400)
  await page.locator('[data-page="conversa"]').waitFor()
  await shot('conversa-sem-lateral')
  // Back to the home without the sidebar: the seal sits in the hero.
  await page.keyboard.press('Control+b')
  await page.waitForTimeout(400)
  await page.locator('.ds-nav').getByRole('button', { name: 'Início' }).click()
  await page.keyboard.press('Control+b')
  await page.waitForTimeout(400)
  await shot('inicio-sem-lateral')
  await page.keyboard.press('Control+b')
  await page.waitForTimeout(400)
  await page.locator('.ds-nav').getByRole('button', { name: 'Dores' }).click()
  await page.keyboard.press('Control+b')
  await page.waitForTimeout(400)
  await shot('dores-sem-lateral')
  return log.join('\n')
}
