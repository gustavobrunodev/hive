// Sonda de contraste + geometria das Iniciativas, nos três temas.
//
//   run_code_unsafe --filename tools/visual/boot.mjs
//   run_code_unsafe --filename tools/visual/initiatives.mjs
//   run_code_unsafe --filename tools/visual/initiatives-contrast.mjs
//
// Lições de sondas anteriores deste repositório, aplicadas aqui:
//
//   - **Resolva cor por canvas, nunca por regex.** Os tokens são `oklch()` e o
//     Chromium serializa a string literal; um parser de números lê
//     `oklch(0.77 0.108 248)` como um RGB quase preto (agent-tool-details).
//   - **Componha alpha.** `--selected-bg` e `--success-bg` são tints
//     translúcidos; medir contra eles sem compor com o fundo mede um pixel que
//     não existe na tela — e as duas pílulas de progresso vivem sobre eles.
//   - **Meça o estado quieto, não o destacado.** A linha de etapa *pendente* é
//     a metade em risco: ela é `--muted` sobre `--bg-2`, enquanto a próxima
//     ganha `--ink` e negrito (nav-redesign, segunda rodada).
//   - **Force o tema pelo menu, não pelo boot** (engine-contrast).
//   - **Nem todo pixel colorido é um indicador.** O fio entre os nós do trilho
//     não está na lista: ele repete, em cor, exatamente o que o glifo de cada
//     nó (✓ / número) e o rótulo `, concluída` já dizem — e clareá-lo até 3:1
//     achataria justamente o vão aceso↔apagado que faz o trilho dizer "até
//     aqui".
async (page) => {
  const THEMES = [
    { id: 'dark', label: 'Escuro' },
    { id: 'light', label: 'Claro' },
    { id: 'hive', label: 'Hive' }
  ]

  const results = []

  for (const theme of THEMES) {
    await page.getByRole('button', { name: /^Escolha do tema/ }).click()
    await page.getByRole('menuitemradio', { name: new RegExp(`^${theme.label}`) }).click()
    await page.waitForTimeout(350)

    const measured = await page.evaluate(() => {
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = 1
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      const parse = (value) => {
        ctx.clearRect(0, 0, 1, 1)
        ctx.fillStyle = '#000'
        ctx.fillStyle = value
        ctx.fillRect(0, 0, 1, 1)
        const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data
        return [r, g, b, a / 255]
      }
      const over = (fg, bg) => fg.map((c, i) => (i === 3 ? 1 : c * fg[3] + bg[i] * (1 - fg[3])))
      /**
       * A cor realmente pintada atrás de `el`.
       *
       * Ela junta as camadas de baixo para cima, e é aí que está a diferença
       * em relação à versão que este arquivo herdou das sondas anteriores:
       * aquela compunha de cima para baixo e tratava a SEGUNDA camada
       * translúcida como se fosse opaca — `over()` força alpha 1. Com um tint
       * só sobre uma superfície opaca (o caso comum) o resultado é o mesmo;
       * com DOIS tints empilhados, não. E é exatamente o que acontece aqui: a
       * pílula de progresso da demanda aberta tem o próprio tint sobre o tint
       * da linha selecionada. A conta errada devolveu 1,03:1 — uma reprovação
       * que não existia, sobre um par que mede 5,15:1 na tela.
       */
      const backdrop = (el) => {
        const layers = []
        let base = null
        for (let node = el; node; node = node.parentElement) {
          const own = parse(getComputedStyle(node).backgroundColor)
          if (own[3] === 0) continue
          if (own[3] >= 0.999) {
            base = own
            break
          }
          layers.push(own)
        }
        let color = base ?? [255, 255, 255, 1]
        for (let i = layers.length - 1; i >= 0; i -= 1) color = over(layers[i], color)
        return color
      }
      const lum = ([r, g, b]) => {
        const f = (c) => {
          const s = c / 255
          return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
        }
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
      }
      const ratio = (a, b) => {
        const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
        return (x + 0.05) / (y + 0.05)
      }

      const out = []
      const target = (name, selector, floor = 4.5) => {
        const el = document.querySelector(selector)
        if (!el) return out.push({ name, status: 'ausente' })
        const style = getComputedStyle(el)
        const bg = backdrop(el)
        const value = ratio(over(parse(style.color), bg), bg)
        out.push({
          name,
          ratio: Number(value.toFixed(2)),
          size: style.fontSize,
          weight: style.fontWeight,
          pass: value >= floor
        })
      }
      /** Duas superfícies que precisam ser distinguíveis uma da outra. */
      const surfaces = (name, a, b, floor) => {
        const left = document.querySelector(a)
        const right = document.querySelector(b)
        if (!left || !right) return out.push({ name, status: 'ausente' })
        const value = ratio(backdrop(left), backdrop(right))
        out.push({ name, ratio: Number(value.toFixed(2)), pass: value >= floor })
      }
      /** Um traço (borda) contra o que está atrás dele — piso de objeto gráfico. */
      const stroke = (name, selector, againstSelector, floor = 3) => {
        const el = document.querySelector(selector)
        const against = document.querySelector(againstSelector)
        if (!el || !against) return out.push({ name, status: 'ausente' })
        const bg = backdrop(against)
        const value = ratio(over(parse(getComputedStyle(el).borderColor), bg), bg)
        out.push({ name, ratio: Number(value.toFixed(2)), pass: value >= floor })
      }

      // --- a seção na lateral ----------------------------------------------
      target('lateral: título da seção', '.wb-inits .wb-sidebar-group-label')
      target('lateral: ano', '.wb-inits-tree [aria-level="1"] .wb-inits-name')
      target('lateral: contagem do ano', '.wb-inits-count')
      target('lateral: release', '.wb-inits-tree [aria-level="2"] .wb-inits-name')
      target('lateral: demanda', '.wb-inits-tree [aria-level="3"] .wb-inits-name')
      target('lateral: demanda selecionada', '.hds-tree-item-selected .wb-inits-name')
      // As três pílulas, cada uma sobre o seu próprio tint.
      target('lateral: progresso 0/8 (contorno)', '.wb-inits-progress:not([data-started])')
      target('lateral: progresso 3/8 (em curso)', '.wb-inits-progress[data-started]:not([data-complete])')
      target('lateral: progresso 8/8 (completo)', '.wb-inits-progress[data-complete]')

      // --- a lateral da demanda --------------------------------------------
      target('demanda: migalha (ano / release)', '.wb-initctx-crumbs')
      target('demanda: nome', '.wb-initctx-name')
      target('fluxo: título', '.wb-initctx-title')
      target('fluxo: contagem de etapas', '.wb-initctx-count')
      // A linha que ensina as duas coisas que o trilho não conseguia dizer
      // sozinho: que as linhas rodam algo, e onde.
      target('fluxo: dica de uso', '.wb-initctx-flow-hint')
      // As fases. O nome é `--ink` a 11px e a contagem é `--muted` — os dois
      // são tipo pequeno, então os dois devem 4,5:1, não 3:1.
      target('fluxo: nome da fase', '.hds-stage-group-label')
      target('fluxo: contagem da fase', '.hds-stage-group-meta')
      // A badge "Opcional": texto a 11px sobre o fundo do painel, e um traço
      // ao redor. O traço é decoração (a palavra já está escrita dentro dele),
      // então só o texto tem piso.
      target('fluxo: badge Opcional', '.hds-stage-badge')
      // O estado quieto primeiro: é ele que corre risco, não o destacado.
      target('fluxo: etapa pendente', '.hds-stage[data-status="pending"] .hds-stage-label')
      // Uma etapa pendente não tem dica: ela não teria nada a dizer, e oito
      // linhas repetindo "Ainda não iniciada" eram uma coluna de ruído entre o
      // leitor e as quatro fases. Sobraram as duas dicas que informam algo — o
      // arquivo da concluída e "Próxima etapa" na que é a próxima.
      target('fluxo: etapa concluída', '.hds-stage[data-status="done"] .hds-stage-label')
      target('fluxo: arquivo da concluída', '.hds-stage[data-status="done"] .hds-stage-hint')
      target('fluxo: etapa próxima', '.hds-stage[data-status="active"] .hds-stage-label')
      target('fluxo: dica da próxima', '.hds-stage[data-status="active"] .hds-stage-hint')
      // O número dentro do nó pendente é tipo de 11px: 4,5:1, não 3:1.
      target('fluxo: número do nó pendente', '.hds-stage[data-status="pending"] .hds-stage-ordinal')
      target('fluxo: número do nó próximo', '.hds-stage[data-status="active"] .hds-stage-ordinal')
      // O ✓ é glifo, não texto — piso de componente gráfico.
      target('fluxo: ✓ do nó concluído', '.hds-stage[data-status="done"] .hds-stage-node', 3)
      // Os indicadores de "isto executa alguma coisa". Eles são a correção do
      // defeito que motivou a rodada, então são exatamente o que não pode
      // falhar: o ▷ é glifo (3:1) e a pílula "Iniciar" é tipo de 11px (4,5:1).
      // A primeira versão os deixava a 55% de opacidade e media 2,83:1 no
      // escuro e 2,71:1 no claro — quieto até o ponto de sumir.
      target('fluxo: ▷ da etapa pendente', '.hds-stage[data-status="pending"] .hds-stage-cue', 3)
      target('fluxo: pílula "Iniciar"', '.hds-stage[data-status="active"] .hds-stage-cue')
      // O atalho de refazer deixou de ser hover-only nesta rodada, então passou
      // a dever os 3:1 que um ícone interativo deve.
      target('fluxo: ícone de refazer', '.wb-initctx-redo', 3)
      // O anel do nó da próxima etapa é o que diz "você está aqui" — e ele é
      // uma BORDA. A primeira versão desta sonda comparava os dois *fundos*
      // (`--bg` do nó contra `--bg-2` do painel) e reprovava em 1,07:1 um
      // indicador que nunca esteve ali: o alvo é o traço.
      stroke(
        'fluxo: anel da próxima etapa',
        '.hds-stage[data-status="active"] .hds-stage-node',
        '.wb-initctx-flow'
      )
      // A lateral da demanda tem que se separar do transcrito ao lado dela.
      surfaces('demanda: lateral vs. transcrito', '.wb-initctx', '.wb-work-host', 1.05)

      // --- geometria + afirmações estruturais -------------------------------
      const section = document.querySelector('.wb-inits')
      const history = document.querySelector('.wb-chatside-head')
      const rail = document.querySelector('.wb-initctx')
      const chat = document.querySelector('.wb-work-host')
      const asserts = {
        // O pedido é uma ORDEM na tela; só a ordem no DOM diz isso.
        initiativesAboveHistory:
          section && history
            ? Boolean(
                section.compareDocumentPosition(history) & Node.DOCUMENT_POSITION_FOLLOWING
              )
            : null,
        // A lateral fica AO LADO do chat, nunca no lugar dele.
        railBesideChat:
          rail && chat
            ? Math.round(rail.getBoundingClientRect().left) >=
              Math.round(chat.getBoundingClientRect().right) - 1
            : null,
        // Exatamente uma etapa é "a próxima": duas setas não são orientação.
        exactlyOneActive:
          document.querySelectorAll('.hds-stage[data-status="active"]').length === 1,
        // As quatro fases estão na tela ao mesmo tempo — a razão de existirem é
        // ver a forma inteira do fluxo de uma vez, e um teto que esconde a
        // última devolve o problema que elas resolvem.
        phasesOnScreen: [...document.querySelectorAll('.hds-stage-group')].filter((el) => {
          const box = el.getBoundingClientRect()
          const host = document.querySelector('.wb-initctx-flow').getBoundingClientRect()
          return box.top >= host.top - 1 && box.bottom <= host.bottom + 1
        }).length,
        // Nenhuma etapa opcional pode ser "a próxima": ninguém está atrasado
        // por ter pulado o que sempre foi opcional.
        activeIsNeverOptional:
          document.querySelector('.hds-stage[data-status="active"] .hds-stage-badge') === null,
        optionalBadges: document.querySelectorAll('.hds-stage-badge').length,
        // O plano inteiro cabe sem rolar o painel na horizontal.
        railNoHorizontalScroll: rail ? rail.scrollWidth <= rail.clientWidth + 1 : null,
        // A seção cede a coluna: a lista de conversas continua na tela.
        historyVisible: history ? history.getBoundingClientRect().height > 0 : null,
        // "Refazer" existe só onde a etapa já rodou — e é a ação secundária,
        // porque re-executar uma skill do BMAD sobrescreve o documento que a
        // dica ao lado está nomeando.
        redoShortcuts: {
          done: document.querySelectorAll('.hds-stage[data-status="done"] .wb-initctx-redo')
            .length,
          pending: document.querySelectorAll('.hds-stage[data-status="pending"] .wb-initctx-redo')
            .length
        },
        // A árvore de contexto é a do explorador, enraizada na demanda: se ela
        // listasse o workspace inteiro, `_bmad` estaria aqui.
        contextIsScoped: ![...document.querySelectorAll('.wb-initctx-files .hds-tree-label-text')]
          .map((el) => el.textContent)
          .includes('_bmad')
      }

      return { targets: out, asserts }
    })

    results.push({ theme: theme.id, ...measured })
    await page.screenshot({
      path: `/home/gustavobgt/user-harness/hive/hive-desktop/.playwright-mcp/initiatives-${theme.id}.png`
    })
  }

  const failures = results.flatMap((r) =>
    r.targets
      .filter((t) => t.pass === false || t.status === 'ausente')
      .map((t) => ({ theme: r.theme, ...t }))
  )
  return { failures, asserts: results.map((r) => ({ theme: r.theme, ...r.asserts })) }
}
