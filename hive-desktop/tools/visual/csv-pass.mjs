// Passe FUNCIONAL da rodada de 2026-09-04, no app de verdade: a tabela do
// `.csv` editando o mesmo rascunho que o texto, a pasta vazia que abre e o
// "revelar" do Ctrl+P.
//
//   run_code_unsafe --filename tools/visual/boot.mjs
//   run_code_unsafe --filename tools/visual/csv-explorer.mjs
//   run_code_unsafe --filename tools/visual/csv-pass.mjs
//
// Ele existe porque nenhum teste unitário toca no que está aqui: a grade real
// (o duble do DS nos testes é um campo por célula), o teclado de planilha, e o
// caminho inteiro tabela → rascunho → `saveFile`.
//
// **Aviso de captura, medido nesta rodada:** um screenshot de página inteira
// neste ambiente pode CONGELAR o retângulo do painel do editor — a região
// continua com as cores do tema anterior mesmo depois de trocar de tema,
// remontar a subárvore e pintar o fundo de verde-limão à força. O recorte
// (`clip`) do mesmo elemento sai correto, e `getComputedStyle` também. Quando
// uma região parecer errada, prove por medição e por recorte ANTES de tratar
// como defeito de CSS.
async (page) => {
  const out = {}

  /**
   * Trocar de modo pelo controle que ESTIVER na tela.
   *
   * O painel tem duas formas do mesmo interruptor e uma container query
   * escolhe entre elas: com o arquivo sujo, os botões Descartar/Salvar entram
   * na mesma linha e abaixo de 560px o interruptor rotulado dá lugar ao ícone.
   * Uma sonda que só conhece o `radio` some justamente depois da primeira
   * edição — que é quando ela mais precisa dele.
   */
  const mode = async (name) => {
    const radio = page.getByRole('radio', { name })
    if (await radio.isVisible().catch(() => false)) return radio.click()
    return page.getByRole('button', { name }).click()
  }

  // --- 1. a tabela edita o mesmo rascunho que o texto ----------------------
  const cell = (row, column) =>
    page.locator('.hds-grid-table tbody tr').nth(row).locator('.hds-grid-cell').nth(column)

  await cell(1, 1).dblclick()
  await page.locator('.hds-grid-input').fill('Plataforma')
  await page.keyboard.press('Enter')
  await page.waitForTimeout(250)

  out.edit = await page.evaluate(() => ({
    // Editar uma célula suja o painel: os controles de salvar aparecem.
    dirty: !!document.querySelector('.wb-viewer[data-dirty]'),
    // E o cursor desceu uma linha, como em qualquer planilha.
    cursorRow: [...document.querySelectorAll('.hds-grid-table tbody tr')].findIndex((tr) =>
      tr.querySelector('.hds-grid-cell[data-active]')
    )
  }))

  // --- 2. o teclado de planilha -------------------------------------------
  await page.locator('.hds-grid-cell[data-active]').press('ArrowRight')
  await page.locator('.hds-grid-cell[data-active]').press('ArrowUp')
  out.keyboard = await page.evaluate(() => {
    const active = document.querySelector('.hds-grid-cell[data-active]')
    const row = active.closest('tr')
    return {
      column: [...row.querySelectorAll('.hds-grid-cell')].indexOf(active),
      row: [...document.querySelectorAll('.hds-grid-table tbody tr')].indexOf(row),
      // A mira acompanha: cabeçalho da coluna e número da linha marcados.
      headerMarked: !!document.querySelector('.hds-grid-colhead[data-current]'),
      gutterMarked: !!document.querySelector('.hds-grid-rowhead[data-current]'),
      // Uma só parada de tabulação na grade inteira.
      tabStops: document.querySelectorAll('.hds-grid-cell[tabindex="0"]').length
    }
  })

  // Digitar substitui o valor (convenção de planilha), Escape desfaz.
  await page.locator('.hds-grid-cell[data-active]').press('z')
  const seeded = await page.locator('.hds-grid-input').inputValue()
  await page.locator('.hds-grid-input').press('Escape')
  out.typeToEdit = {
    seeded,
    restored: await page.locator('.hds-grid-cell[data-active] .hds-grid-value').innerText()
  }

  // --- 3. o texto vê a mesma edição, com as colunas coloridas -------------
  await mode('Texto')
  await page.waitForTimeout(400)
  out.text = await page.evaluate(() => {
    const field = document.querySelector('.hds-editor-input')
    const roles = [...document.querySelectorAll('.hds-editor-line')]
      .at(1)
      ?.querySelectorAll('[data-role]')
    return {
      // A edição feita na tabela está no texto.
      hasEdit: field.value.includes('Editor de planilhas,Plataforma'),
      // E o texto pinta por COLUNA: seis papéis girando, vírgulas à parte.
      rolesOnRow: [...(roles ?? [])].map((el) => el.dataset.role).slice(0, 6),
      colouredRuns: roles?.length ?? 0
    }
  })
  await mode('Tabela')
  await page.waitForTimeout(400)

  // --- 4. salvar escreve texto delimitado ---------------------------------
  await page.evaluate(() => {
    window.__saved = null
    const original = window.hive.fs.saveFile
    window.hive.fs.saveFile = async (root, path, content, opts) => {
      window.__saved = content
      return original(root, path, content, opts)
    }
  })
  await page.getByRole('button', { name: 'Salvar' }).click()
  await page.waitForTimeout(400)
  out.saved = await page.evaluate(() => {
    const text = window.__saved ?? ''
    return {
      // Aspas preservadas onde o arquivo já as tinha; nada de reescrever o
      // arquivo inteiro por causa de uma célula.
      keepsQuotedField: text.includes('"Login com SSO, incluindo Okta"'),
      hasEdit: text.includes('Editor de planilhas,Plataforma'),
      lines: text.split('\n').length
    }
  })

  // --- 5. revelar pelo Ctrl+P ---------------------------------------------
  // Recolhe tudo pelo controle da barra, não clicando na pasta: a caixa de uma
  // linha de pasta CONTÉM as linhas filhas, e o clique no centro dela pousa no
  // filho — a primeira versão desta sonda "fechou" a pasta abrindo um arquivo,
  // e mediu um revelar que nunca escondeu nada.
  await page.getByRole('button', { name: 'Recolher todas as pastas' }).click()
  await page.waitForTimeout(400)
  const before = await page.evaluate(
    () => !!document.querySelector('[data-tree-path="dados/backlog.csv"]')
  )

  await page.keyboard.press('Control+p')
  await page.waitForTimeout(400)
  await page.getByPlaceholder(/Buscar/i).fill('backlog')
  await page.waitForTimeout(300)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(700)

  out.reveal = await page.evaluate(() => {
    const row = document.querySelector('[data-tree-path="dados/backlog.csv"]')
    const box = row?.getBoundingClientRect()
    const rail = document.querySelector('.wb-rail-scroll')?.getBoundingClientRect()
    return {
      rowNowVisible: !!row,
      parentExpanded:
        document
          .querySelector('[data-tree-path="dados"]')
          ?.closest('[role="treeitem"]')
          ?.getAttribute('aria-expanded') ?? null,
      selected: row?.closest('[role="treeitem"]')?.getAttribute('aria-selected') === 'true',
      pulsing: row?.hasAttribute('data-tree-revealed') ?? false,
      // Dentro da área visível da árvore, não só presente no DOM: rolar até a
      // linha é metade do trabalho e a metade que ninguém lembra de medir.
      insideViewport:
        box && rail ? box.top >= rail.top - 1 && box.bottom <= rail.bottom + 1 : null
    }
  })
  out.reveal.hiddenBefore = !before
  await page.screenshot({
    path: '/home/gustavobgt/user-harness/hive/hive-desktop/.playwright-mcp/csv-05-reveal.png'
  })

  return out
}
