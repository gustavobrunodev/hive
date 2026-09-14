// A cena da rodada de 2026-09-13 nas Iniciativas: o painel da demanda com a
// barra PRÓPRIA (identidade + engrenagem + expandir + fechar), o painel
// expandido, o diálogo de edição com o seletor de cor, e as conversas do
// histórico marcadas com o crachá da iniciativa que as gerou.
//
//   node tools/visual/run-scene.mjs tools/visual/initiatives-round.mjs
//   HIVE_THEME=light|hive … para varrer os três temas
//
// O que ela existe para mostrar, que nenhum teste vê:
//  - a barra do ✕ e o corpo do painel são UMA superfície (era o defeito: a
//    barra vivia no cabeçalho do painel de trabalho, que atravessa o
//    transcrito também, então o ✕ ficava num fundo e o painel que ele fecha
//    noutro);
//  - o painel expande sobre o transcrito e volta;
//  - a alça entre os dois existe e arrasta;
//  - o crachá colorido liga a conversa à demanda, com o NOME dentro.
async (page) => {
  const theme = globalThis.HIVE_THEME || 'dark'
  const shots = globalThis.HIVE_SHOT_DIR || null
  const shot = async (name) => {
    if (shots) await page.screenshot({ path: `${shots}/${name}-${theme}.png` })
  }

  // Conversas já ligadas às duas demandas da fixture, mais uma solta — é a
  // mistura que faz o crachá e o filtro dizerem alguma coisa.
  await page.addInitScript(() => {
    localStorage.setItem(
      'hive.__seedChat',
      JSON.stringify([
        {
          id: 'seed-prd',
          title: 'PRD do portal de cobrança',
          agent: 'claude-cli',
          updatedAt: Date.now() - 600_000,
          initiativePath: 'docs/iniciativas/R2/portal-de-cobranca',
          messages: [{ id: 'a', role: 'user', text: '/bmad-prd', at: Date.now() }]
        },
        {
          id: 'seed-arq',
          title: 'Arquitetura do antifraude',
          agent: 'claude-cli',
          updatedAt: Date.now() - 3_600_000,
          initiativePath: 'docs/iniciativas/R3/antifraude',
          messages: [{ id: 'b', role: 'user', text: '/bmad-architecture', at: Date.now() }]
        },
        {
          id: 'seed-solta',
          title: 'Dúvida sobre o build',
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

  if (theme !== 'dark') {
    await page.locator('.wb-icon-btn[aria-label^="Escolha do tema"]').click()
    await page.getByRole('menuitemradio', { name: { light: 'Claro', hive: 'Hive' }[theme] }).click()
    await page.waitForTimeout(250)
  }

  await page.getByRole('tab', { name: 'Chat & Cowork' }).click()
  await page.waitForTimeout(300)

  const results = {}

  // --- o crachá no histórico, antes de abrir qualquer demanda --------------
  results.badges = await page.evaluate(() =>
    [...document.querySelectorAll('.wb-history-row .wb-init-badge')].map((el) => ({
      text: el.textContent,
      hue: el.style.getPropertyValue('--init-hue')
    }))
  )
  // Um crachá por conversa ligada, e nenhum na conversa solta.
  results.unbadgedRows = await page.evaluate(
    () =>
      [...document.querySelectorAll('.wb-history-row')].filter(
        (row) => row.querySelector('.wb-init-badge') === null
      ).length
  )
  await shot('inits-history')

  // --- o filtro por iniciativa --------------------------------------------
  await page.locator('button[aria-label="Filtrar conversas por iniciativa"]').click()
  await page.waitForTimeout(200)
  results.filterOptions = await page.evaluate(() =>
    [...document.querySelectorAll('[role="menuitemradio"]')].map((el) => el.textContent)
  )
  await shot('inits-filter')
  await page.getByRole('menuitemradio', { name: /Portal de Cobrança/ }).click()
  await page.waitForTimeout(250)
  results.filteredTitles = await page.evaluate(() =>
    [...document.querySelectorAll('.wb-history-row-name')].map((el) => el.textContent)
  )
  // …e de volta para todas, senão a demanda aberta abaixo some da lateral.
  await page.locator('button[aria-label="Filtrar conversas por iniciativa"]').click()
  await page.getByRole('menuitemradio', { name: 'Todas as iniciativas' }).click()
  await page.waitForTimeout(200)

  // --- a demanda aberta: a barra é do painel -------------------------------
  await page.getByRole('treeitem', { name: /Portal de Cobrança/ }).click()
  await page.waitForTimeout(600)

  results.panel = await page.evaluate(() => {
    const rail = document.querySelector('.wb-initctx')
    const bar = rail?.querySelector('.wb-initctx-id')
    if (!rail || !bar) return null
    const railBg = getComputedStyle(rail).backgroundColor
    const barBg = getComputedStyle(bar).backgroundColor
    return {
      name: rail.querySelector('.wb-initctx-name')?.textContent,
      crumbs: rail.querySelector('.wb-initctx-crumbs')?.textContent,
      // A barra não pinta fundo nenhum: ela é a MESMA superfície do painel.
      // Era esse o defeito — ela vivia no cabeçalho do painel de trabalho.
      barPaintsNothing: barBg === 'rgba(0, 0, 0, 0)' || barBg === railBg,
      railBg,
      actions: [...(rail.querySelectorAll('.wb-initctx-id-actions button') ?? [])].map((b) =>
        b.getAttribute('aria-label')
      ),
      // O ✕ da demanda não está mais no cabeçalho do painel de trabalho.
      closeOutsidePaneHeader:
        document.querySelector('.wb-pane-header [aria-label="Fechar iniciativa"]') === null,
      sash: document.querySelector('.wb-initctx-sash') !== null
    }
  })
  await shot('inits-panel')

  // --- o espaçamento das linhas de "Contexto" ------------------------------
  // O defeito: a árvore do Contexto ficava nos defaults do DS, com ~28px de
  // calha à esquerda que a aba Arquivos não tem. As duas são o MESMO
  // componente; medir as duas é a única prova de que voltaram a concordar.
  results.contextIndent = await page.evaluate(() => {
    const read = (el) => {
      if (!el) return 'ausente'
      const style = getComputedStyle(el)
      return `${style.paddingLeft} / ${style.fontSize}`
    }
    return {
      contexto: read(document.querySelector('.wb-initctx-files .hds-tree-toggle-leaf')),
      // The claim is "the same as the Arquivos tab", so the Arquivos tab is
      // measured in the same breath. They are the same component; the rules
      // that de-indent it were scoped to the sidebar it usually sits in, which
      // is why one of the two homes kept the DS default gutter.
      arquivos: read(document.querySelector('.wb-rail-scroll .hds-tree-toggle-leaf'))
    }
  })

  // --- expandir e voltar ---------------------------------------------------
  const widthOf = () =>
    page.evaluate(() => document.querySelector('.wb-initctx')?.getBoundingClientRect().width ?? 0)
  const splitWidth = await page.evaluate(
    () => document.querySelector('.wb-work-split')?.getBoundingClientRect().width ?? 0
  )
  const resting = await widthOf()
  await page.getByRole('button', { name: 'Expandir o painel da iniciativa' }).click()
  await page.waitForTimeout(300)
  const expanded = await widthOf()
  await shot('inits-expanded')
  results.expand = {
    resting: Math.round(resting),
    expanded: Math.round(expanded),
    split: Math.round(splitWidth),
    // "Expandir" means the panel TAKES the pane, not that it splits it in
    // half with the transcript — which is what `flex: 1` on both did.
    takesThePane: expanded > splitWidth - 12,
    marked: await page.evaluate(
      () => document.querySelector('.wb-initctx')?.hasAttribute('data-expanded') ?? false
    )
  }
  await page.getByRole('button', { name: 'Restaurar o painel da iniciativa' }).click()
  await page.waitForTimeout(300)
  results.expand.restored = Math.round(await widthOf()) === Math.round(resting)

  // --- a alça arrasta de verdade -------------------------------------------
  // Gesto real (move + down + move + up): `locator.drag` desce e sobe cedo
  // demais para um handler que escuta `pointermove` na janela.
  const sash = await page.locator('.wb-initctx-sash').boundingBox()
  if (sash) {
    await page.mouse.move(sash.x + 2, sash.y + sash.height / 2)
    await page.mouse.down()
    await page.mouse.move(sash.x - 120, sash.y + sash.height / 2, { steps: 8 })
    await page.mouse.up()
    await page.waitForTimeout(200)
  }
  results.dragWidened = Math.round(await widthOf()) > Math.round(resting) + 40

  // --- o diálogo de edição --------------------------------------------------
  await page.getByRole('button', { name: 'Editar iniciativa' }).click()
  await page.waitForTimeout(350)
  results.edit = await page.evaluate(() => {
    const dialog = document.querySelector('.wb-initedit')
    if (!dialog) return null
    return {
      name: dialog.querySelector('input')?.value,
      swatches: [...dialog.querySelectorAll('.hds-swatch')].map((el) => ({
        label: el.getAttribute('aria-label'),
        checked: el.getAttribute('aria-checked') === 'true'
      })),
      hasDelete: [...dialog.querySelectorAll('button')].some(
        (b) => b.textContent === 'Excluir iniciativa'
      )
    }
  })
  await shot('inits-edit')

  // A confirmação de exclusão, inline — nunca um modal sobre o modal.
  await page.getByRole('button', { name: 'Excluir iniciativa' }).click()
  await page.waitForTimeout(250)
  results.deleteConfirm = await page.evaluate(() => {
    const box = document.querySelector('.wb-initedit-confirm')
    return box
      ? {
          title: box.querySelector('.wb-initedit-confirm-title')?.textContent,
          // Um só diálogo na tela: a confirmação vive DENTRO do de edição.
          dialogs: document.querySelectorAll('[role="dialog"]').length
        }
      : null
  })
  await shot('inits-delete')

  return results
}
