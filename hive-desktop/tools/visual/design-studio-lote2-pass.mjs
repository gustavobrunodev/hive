// Passe visual do Design Studio — lote 2 (Dores, folha, Relatórios, Leitura,
// Gráficos, geração e avisos).
//
//   npx electron-vite build && python3 -m http.server 8123 -d out/renderer
//   HIVE_SIDEBAR=chat HIVE_THEME=light HIVE_SHOT_DIR=/tmp/ds \
//     node tools/visual/run-scene.mjs tools/visual/design-studio-lote2-pass.mjs
//
// Os Relatórios saem do script real das skills sobre os dados de exemplo
// reais (Câmbio inteiro e o Likert de Extrato), lidos como o main lê — só que
// aqui, no Node do runner, porque o mock não tem disco. Só roda pelo
// `run-scene.mjs` (usa `import()` do Node).
async (page) => {
  const { spawnSync } = await import('node:child_process')
  const fs = await import('node:fs')
  const os = await import('node:os')
  const path = await import('node:path')
  const { parse } = await import('yaml')
  const dir = globalThis.HIVE_SHOT_DIR || '/tmp'
  const theme = globalThis.HIVE_THEME || 'dark'
  const label = { dark: 'Escuro', light: 'Claro', hive: 'Hive' }[theme]
  const log = []
  const shot = async (name) => {
    const file = `${dir}/ds2-${theme}-${name}.png`
    await page.screenshot({ path: file })
    log.push(file)
  }

  const resources = path.resolve('resources/design-studio')
  const relatorio = (produto, id, fonte) => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'ds-pass-'))
    const saida = path.join('relatorios', fonte, '.r.md.parcial')
    fs.mkdirSync(path.join(cwd, 'relatorios', fonte), { recursive: true })
    spawnSync(process.execPath, [
      path.join(resources, 'skills', `relatorio-${fonte}`, 'scripts', 'relatorio.mjs'),
      '--dados', path.join(resources, 'dados-de-exemplo', id, `${fonte}.json`),
      '--saida', saida, '--agente', 'Claude', '--modelo', 'sonnet'
    ], { cwd })
    const text = fs.readFileSync(path.join(cwd, saida), 'utf-8')
    const [, front, body] = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(text)
    const f = parse(front)
    return {
      ...f,
      caminho: `${produto}/relatorios/${fonte}/2026-10-05-90d.md`,
      geradoPor: { agente: f.geradoPor.agente, modelo: f.geradoPor.modelo ?? null },
      narrativa: body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
    }
  }
  const relatorios = [
    relatorio('Câmbio', 'cambio', 'likert'),
    relatorio('Câmbio', 'cambio', 'voz'),
    relatorio('Câmbio', 'cambio', 'fullstory'),
    relatorio('Extrato', 'extrato', 'likert')
  ]
  await page.evaluate((r) => window.__setDesignDados({ relatorios: r }), relatorios)

  await page.getByRole('button', { name: /^Escolha do tema/ }).click()
  await page.getByRole('menuitemradio', { name: new RegExp(`^${label}`) }).click()
  await page.keyboard.press('Escape')

  const layer = () => page.locator('.wb-work-layer[data-view="design"] [data-page][data-active]')
  const nav = (name) => page.locator('.ds-nav').getByRole('button', { name, exact: true }).click()

  await page.getByRole('tab', { name: /Chat/ }).click()
  await page.getByRole('button', { name: /^(Ocultar )?Design Studio$/ }).click()
  await page.waitForSelector('[data-page="inicio"][data-active]')

  await nav('Dores')
  await page.waitForSelector('[data-page="dores"][data-active] .hds-note')
  await page.waitForTimeout(300)
  await shot('dores')
  await layer().getByRole('button', { name: /^Acompanhar:/ }).click()
  await shot('dores-tela')
  await layer().getByRole('button', { name: 'Ver todas' }).click()

  await layer().getByRole('region', { name: 'Voz do Cliente' }).locator('.hds-note').first().click()
  await page.waitForTimeout(400)
  await shot('folha-voz')
  await page.keyboard.press('Escape')
  await layer().getByRole('region', { name: 'FullStory' }).locator('.hds-note').first().click()
  await page.waitForTimeout(400)
  await shot('folha-fullstory')
  await page.keyboard.press('Escape')
  await layer().getByRole('region', { name: 'Likert' }).locator('.hds-note').first().click()
  await page.waitForTimeout(400)
  await shot('folha-likert')
  await page.keyboard.press('Escape')

  // Pix has no Relatório: the empty columns, then one generating.
  await layer().getByRole('radio', { name: 'Pix' }).click()
  await page.waitForTimeout(200)
  await shot('dores-vazio')
  await layer().getByRole('button', { name: 'Gerar Relatório de Voz do Cliente' }).click()
  await page.evaluate(() =>
    window.__designGeracao({ turnId: 'ds-pass', produto: 'Pix', fonte: 'voz', estado: 'gerando', passo: 3 })
  )
  await page.waitForTimeout(200)
  await shot('dores-gerando')

  await nav('Relatórios')
  await page.waitForTimeout(300)
  await shot('relatorios')
  await page.evaluate(() =>
    window.__designGeracao({ turnId: 'ds-pass', produto: 'Pix', fonte: 'voz', estado: 'falhou', motivo: 'formato' })
  )
  await page.evaluate(() =>
    window.__designGeracao({ turnId: 'x', produto: 'Pix', fonte: 'likert', estado: 'pronto', relatorio: 'Pix/relatorios/likert/x.md', dores: 6 })
  )
  await page.waitForTimeout(300)
  await shot('avisos')

  await layer().getByRole('button', { name: 'Abrir o Relatório de Likert de Câmbio' }).click()
  await page.waitForTimeout(300)
  await shot('leitura')
  await layer().getByRole('radio', { name: 'Gráficos' }).click()
  await page.waitForTimeout(400)
  await shot('graficos')
  await layer().getByRole('slider').hover()
  await page.mouse.move(1100, 560)
  await page.waitForTimeout(200)
  await shot('graficos-mira')
  await layer().getByRole('combobox', { name: 'Dor' }).selectOption({ index: 2 })
  await page.waitForTimeout(200)
  await shot('graficos-dor')
  await layer().getByRole('button', { name: 'Ver tabela' }).first().click()
  await page.waitForTimeout(200)
  await shot('graficos-tabela')

  // The same Leitura in a narrow pane (sidebar + a 900px window).
  await page.setViewportSize({ width: 900, height: 900 })
  await layer().getByRole('radio', { name: 'Leitura' }).click()
  await page.waitForTimeout(300)
  await shot('leitura-estreita')
  return log.join('\n')
}
