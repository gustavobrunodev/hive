// A cena das Iniciativas: a seção na lateral, uma demanda aberta com o chat
// embutido, e o trilho do fluxo com as três situações de etapa na tela ao
// mesmo tempo (concluída, próxima, pendente) dentro das quatro fases.
//
//   run_code_unsafe --filename tools/visual/boot.mjs
//   run_code_unsafe --filename tools/visual/initiatives.mjs
//   run_code_unsafe --filename tools/visual/initiatives-contrast.mjs
//
// A fixture de `boot.mjs` foi montada para esta cena: três demandas em três
// pontos diferentes do plano (0/8, 3/8, 8/8), duas releases e um manifesto só —
// que é a diferença entre um título com acento e um lido de volta do slug.
// Medir só a demanda pela metade deixaria de fora justamente os dois extremos
// que a pílula de progresso e o trilho precisam saber desenhar.
async (page) => {
  await page.setViewportSize({ width: 1440, height: 900 })

  await page.getByRole('tab', { name: 'Chat & Cowork' }).click()
  await page.waitForTimeout(300)

  // A demanda pela metade: três etapas concluídas, a quarta em destaque e três
  // ainda por fazer — o único estado em que o trilho mostra os três ao mesmo
  // tempo, e por isso o que a sonda mede.
  await page.getByRole('treeitem', { name: /Portal de Cobrança/ }).click()
  await page.waitForTimeout(600)

  return {
    paneTitle: await page.locator('.wb-pane-header-label').first().innerText(),
    railOpen: (await page.locator('.wb-initctx').count()) === 1,
    // O chat continua montado ao lado — a lateral da demanda não o substitui.
    chatBeside: (await page.locator('.wb-work-split .wb-work-host').count()) === 1,
    stages: await page.evaluate(() =>
      [...document.querySelectorAll('.wb-initctx-stages .hds-stage')].map((el) => ({
        status: el.getAttribute('data-status'),
        text: (el.querySelector('.hds-stage-label')?.textContent ?? '').split(',')[0]
      }))
    )
  }
}
