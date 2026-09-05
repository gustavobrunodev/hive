// Cena da rodada de 2026-09-04: o editor de `.csv`, a pasta vazia que abre e o
// "revelar" vindo do Ctrl+P.
//
//   run_code_unsafe --filename tools/visual/boot.mjs
//   run_code_unsafe --filename tools/visual/csv-explorer.mjs
//
// O `boot.mjs` devolve o MESMO texto para qualquer `readFile`, então a cena
// troca a bridge por uma que responde por extensão — sem isso o painel abre a
// tabela sobre um `# README` e a coluna vira uma coluna só.
//
// A planilha do fixture é de propósito irregular: tem campo com vírgula dentro
// de aspas, coluna numérica, coluna de datas (que NÃO pode ser lida como
// número) e uma célula vazia. É o que separa uma tabela que só desenha de uma
// que entende o arquivo.
async (page) => {
  await page.evaluate(() => {
    const CSV = [
      'história,squad,pontos,entrega,status',
      '"Login com SSO, incluindo Okta",Plataforma,8,2026-09-12,Em revisão',
      'Editor de planilhas,Workspace,13,2026-09-19,Em construção',
      'Busca no workspace,Workspace,5,2026-08-29,Entregue',
      'Console de MCP,Plataforma,8,2026-10-03,Descoberta',
      'Ditado ao vivo,Voz,21,2026-09-26,Em construção',
      'Revisão do agente,Workspace,13,2026-08-15,Entregue',
      'Segundo cérebro,Conhecimento,34,2026-11-07,Descoberta',
      'Conexão AWS,Plataforma,5,2026-09-05,Entregue',
      'Temas do app,Design,3,,Descoberta'
    ].join('\n')

    const tree = window.hive.listTree
    window.hive.listTree = async (...args) => {
      const nodes = await tree(...args)
      return [
        ...nodes,
        { name: 'rascunhos', path: 'rascunhos', type: 'directory', children: [] },
        {
          name: 'dados',
          path: 'dados',
          type: 'directory',
          children: [
            { name: 'backlog.csv', path: 'dados/backlog.csv', type: 'file' },
            { name: 'metricas.tsv', path: 'dados/metricas.tsv', type: 'file' }
          ]
        }
      ]
    }

    const read = window.hive.readFile
    window.hive.readFile = async (root, path) =>
      path.endsWith('.csv') || path.endsWith('.tsv') ? CSV : read(root, path)

    const list = window.hive.listFiles
    window.hive.listFiles = async (...args) => [...(await list(...args)), 'dados/backlog.csv']
  })

  // A árvore já está montada com a bridge antiga; um evento do watcher é o que
  // a faz re-caminhar — trocar de aba não remonta nada quando ela já está
  // aberta, e a cena ficava sem os arquivos novos.
  await page.getByRole('button', { name: 'Explorador' }).click()
  await page.evaluate(() => window.__fsChange('dados/backlog.csv'))
  await page.waitForTimeout(600)

  const row = (name) => page.locator('[role="treeitem"]').filter({ hasText: name }).first()

  // A pasta vazia fica ABERTA na cena: é o estado que precisa ser visto.
  await row('rascunhos').click()
  await page.waitForTimeout(250)
  await row('dados').click()
  await page.waitForTimeout(250)
  await page.locator('[role="treeitem"]').filter({ hasText: 'backlog.csv' }).first().click()
  await page.waitForTimeout(700)

  return await page.evaluate(() => ({
    rows: document.querySelectorAll('.hds-grid-table tbody tr').length,
    columns: document.querySelectorAll('.hds-grid-colhead').length,
    emptyFolderCaption: document.body.innerText.includes('Pasta vazia')
  }))
}
