// Os dois percursos desta rodada que só existem no encontro de duas partes do
// app, e que nenhum teste unitário observa inteiros:
//
//   1. abrir no histórico uma conversa que NÃO é da iniciativa fecha a
//      iniciativa por completo — o mesmo efeito do "Fechar iniciativa";
//   2. excluir um arquivo aberto no editor fecha a aba dele, tanto pela árvore
//      "Contexto" da demanda quanto pela aba "Arquivos".
//
//   node tools/visual/run-scene.mjs tools/visual/initiatives-round-flows.mjs
//
// A fixture planta as conversas ligadas; `window.__fsChange` do boot.mjs é o
// que faz um arquivo sumir do jeito que o watcher reporta.
async (page) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'hive.__seedChat',
      JSON.stringify([
        {
          id: 'seed-prd',
          title: 'PRD do portal',
          agent: 'claude-cli',
          updatedAt: Date.now() - 600_000,
          initiativePath: 'docs/iniciativas/R2/portal-de-cobranca',
          messages: [{ id: 'a', role: 'user', text: '/bmad-prd', at: Date.now() }]
        },
        {
          id: 'seed-solta',
          title: 'Duvida sobre o build',
          agent: 'claude-cli',
          updatedAt: Date.now() - 7_200_000,
          messages: [{ id: 'c', role: 'user', text: 'como builda?', at: Date.now() }]
        }
      ])
    )
  })
  await page.reload()
  await page.waitForTimeout(500)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.getByRole('tab', { name: 'Chat & Cowork' }).click()
  await page.waitForTimeout(300)

  const railOpen = () => page.locator('.wb-initctx').count()
  const results = {}

  // --- 1. a conversa de outro assunto fecha a iniciativa -------------------
  await page.getByRole('treeitem', { name: /Portal de Cobrança/ }).click()
  await page.waitForTimeout(500)
  results.openedDemand = (await railOpen()) === 1

  // Uma conversa DA demanda mantém o painel: é o caso que prova que o fecho
  // abaixo é sobre o assunto da conversa, e não sobre clicar no histórico.
  const historyRow = (title) =>
    page.locator('.wb-history-row').getByRole('button', { name: `Abrir conversa: ${title}` })
  await historyRow('PRD do portal').click()
  await page.waitForTimeout(500)
  results.sameDemandKeepsPanel = (await railOpen()) === 1

  await historyRow('Duvida sobre o build').click()
  await page.waitForTimeout(500)
  results.otherSubjectClosesPanel = (await railOpen()) === 0

  // --- 2. excluir o arquivo aberto fecha a aba ----------------------------
  await page.getByRole('treeitem', { name: /Portal de Cobrança/ }).click()
  await page.waitForTimeout(500)
  // Pela árvore "Contexto" da demanda.
  await page.locator('.wb-initctx-files').getByText('prd.md', { exact: true }).click()
  await page.waitForTimeout(500)
  const tabNames = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('.wb-tab-name')].map((el) => el.textContent)
    )
  results.openedFromContext = await tabNames()

  await page.evaluate(() => window.__fsChange?.('docs/iniciativas/R2/portal-de-cobranca/prd.md', 'unlink'))
  await page.waitForTimeout(600)
  results.afterDeleteFromContext = await tabNames()

  // E pela aba "Arquivos", que é a mesma árvore noutro lar.
  await page.getByRole('tab', { name: 'Arquivos' }).click()
  await page.waitForTimeout(400)
  await page.locator('.wb-rail-scroll').getByText('README.md', { exact: true }).click()
  await page.waitForTimeout(500)
  results.openedFromFiles = await tabNames()
  await page.evaluate(() => window.__fsChange?.('README.md', 'unlink'))
  await page.waitForTimeout(600)
  results.afterDeleteFromFiles = await tabNames()

  return results
}
