// Sonda de contraste da barra de atividade com a lateral ocultável
// (workspace-session), nos três temas e nos DOIS estados que a rail passou a
// ter: a view no ar e a view em repouso (a que o Ctrl+B traz de volta).
//
//   run_code_unsafe --filename tools/visual/boot.mjs
//   run_code_unsafe --filename tools/visual/sidebar-contrast.mjs
//
// Lições já pagas por outras sondas deste repositório e aplicadas aqui:
//
//   - **Resolva cor por canvas, nunca por regex** (agent-tool-details): os
//     tokens são `oklch()`/`oklab()` e um parser de números lê quase-preto.
//   - **A busca de fundo SOBE** (compaction): componha do elemento para cima
//     até o primeiro fundo opaco, `html` incluído — descer mediu tinta comum
//     em 1,13:1 no tema claro.
//   - **Force o tema pelo menu** (engine-contrast), não pelo boot.
//   - **Ícone não é texto.** O piso de um glifo de UI é 3:1 (WCAG 1.4.11),
//     e é `stroke`/`color` que pinta esses SVGs, não `background`.
//   - **Pseudo-elemento não aparece em `innerText` nem em `style`** — a barra
//     de acento e a de repouso são `::before`, e só `getComputedStyle(el,
//     '::before')` as enxerga.
async (page) => {
  const THEMES = [
    { id: 'dark', label: 'Escuro' },
    { id: 'light', label: 'Claro' },
    { id: 'hive', label: 'Hive' }
  ]
  const results = []

  // A cena que a sonda mede: lateral aberta, uma aba fixada e outra em
  // preview ao lado dela. Feita aqui e não num arquivo à parte porque um
  // passe existe para trazer o quadro completo de uma vez.
  const railRow = (name) =>
    page.locator('.wb-rail-scroll .hds-tree-row', { hasText: name }).first()
  if ((await page.locator('.wb-pane[data-collapsed]').count()) > 0) {
    await page.keyboard.press('Control+b')
    await page.waitForTimeout(400)
  }
  await railRow('README.md').dblclick()
  await page.waitForTimeout(300)
  await railRow('notas.txt').click()
  await page.waitForTimeout(400)

  /**
   * As duas marcas da rail nunca estão na tela ao mesmo tempo — "no ar" e "em
   * repouso" são estados opostos da mesma entrada —, então cada tema mede em
   * duas fases. Um `evaluate` só reportaria `ausente` para metade da lista.
   */
  const measurePhase = async () =>
    await page.evaluate(() => {
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
      const backdrop = (el) => {
        let color = [0, 0, 0, 0]
        for (let node = el; node; node = node.parentElement) {
          const own = parse(getComputedStyle(node).backgroundColor)
          if (own[3] === 0) continue
          color = color[3] === 0 ? own : over(color, own)
          if (color[3] >= 0.999) break
        }
        return color[3] >= 0.999 ? color : over(color, [255, 255, 255, 1])
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
      /** Um alvo de TEXTO: `color` sobre o primeiro fundo opaco acima dele. */
      const text = (name, selector, floor = 4.5) => {
        const el = document.querySelector(selector)
        if (!el) return out.push({ name, status: 'ausente' })
        const style = getComputedStyle(el)
        const value = ratio(over(parse(style.color), backdrop(el)), backdrop(el))
        out.push({ name, ratio: Number(value.toFixed(2)), size: style.fontSize, pass: value >= floor })
      }
      /** Um alvo de MARCA (ícone, barra): a cor pintada contra o fundo, piso 3:1. */
      const mark = (name, selector, pick, floor = 3) => {
        const el = document.querySelector(selector)
        if (!el) return out.push({ name, status: 'ausente' })
        const raw = pick(el)
        if (!raw) return out.push({ name, status: 'sem cor' })
        const value = ratio(over(parse(raw), backdrop(el)), backdrop(el))
        out.push({ name, ratio: Number(value.toFixed(2)), pass: value >= floor, floor })
      }
      const color = (el) => getComputedStyle(el).color
      const beforeBg = (el) => getComputedStyle(el, '::before').backgroundColor

      // --- a rail nos dois estados ----------------------------------------
      mark('rail: ícone da view no ar', '.wb-rail-view[data-active]', color)
      mark('rail: barra de acento da view no ar', '.wb-rail-view[data-active]', beforeBg)
      mark('rail: ícone da view em repouso', '.wb-rail-view[data-resting]', color)
      mark('rail: barra da view em repouso', '.wb-rail-view[data-resting]', beforeBg)
      mark(
        'rail: ícone de uma view qualquer',
        '.wb-rail-view:not([data-active]):not([data-resting])',
        color
      )
      mark('rail: ícone de ferramenta (busca, estúdio…)', '.wb-rail-btn', color)
      text('rail: contagem no selo', '.wb-rail-badge', 4.5)

      // --- o que a lateral aberta mostra -----------------------------------
      text('cabeçalho do painel', '.wb-pane-header-label', 4.5)
      text('linha da árvore', '.wb-rail-scroll .hds-tree-row', 4.5)
      text('nome da aba ativa', '.wb-tab[aria-selected="true"] .wb-tab-name', 4.5)
      text('nome de aba inativa', '.wb-tab:not([aria-selected="true"]) .wb-tab-name', 4.5)

      // --- geometria que a sonda de cor não vê -----------------------------
      const primary = document.querySelector('.wb-pane-header-primary')
      const header = primary?.closest('.wb-pane-header')
      const asserts = {
        // As ações primárias moram na borda final do cabeçalho, não flutuando
        // no meio dele (dois `margin-left: auto` dividiam o espaço livre).
        acoesPrimariasNaBorda:
          primary && header
            ? Math.round(
                header.getBoundingClientRect().right - primary.getBoundingClientRect().right
              )
            : null,
        // A alça ao lado de uma lateral oculta sai do layout.
        alcasVisiveis: Array.from(document.querySelectorAll('[data-separator]')).filter(
          (el) => getComputedStyle(el).display !== 'none'
        ).length
      }
      return { out, asserts }
    })

  for (const theme of THEMES) {
    await page.getByRole('button', { name: 'Aparência' }).click()
    await page.getByRole('menuitemradio', { name: new RegExp(`^${theme.label}`) }).click()
    await page.waitForTimeout(400)

    const open = await measurePhase()
    // Fase 2: a lateral guardada, que é a única em que existe uma view em
    // repouso — e a única em que a alça ao lado dela sai do layout.
    await page.keyboard.press('Control+b')
    await page.waitForTimeout(500)
    const closed = await measurePhase()
    await page.keyboard.press('Control+b')
    await page.waitForTimeout(500)

    const merged = new Map()
    for (const row of [...open.out, ...closed.out]) {
      const known = merged.get(row.name)
      // Cada alvo existe numa das duas fases; a que o encontrou é a que vale.
      if (!known || known.status) merged.set(row.name, row)
    }
    results.push({
      theme: theme.id,
      out: [...merged.values()],
      asserts: { aberta: open.asserts, fechada: closed.asserts }
    })
  }

  const lines = []
  for (const result of results) {
    lines.push(`\n── ${result.theme} ──`)
    for (const row of result.out) {
      if (row.status) lines.push(`  ⌀ ${row.name}: ${row.status}`)
      else
        lines.push(
          `  ${row.pass ? '✓' : '✗'} ${row.name}: ${row.ratio}:1${row.floor ? ` (piso ${row.floor})` : ''}`
        )
    }
    lines.push(`  · geometria: ${JSON.stringify(result.asserts)}`)
  }
  const failures = results.flatMap((r) =>
    r.out.filter((row) => row.pass === false).map((row) => `${r.theme}/${row.name} ${row.ratio}:1`)
  )
  lines.push(`\n${failures.length === 0 ? 'TODOS ACIMA DO PISO' : `REPROVADOS: ${failures.join(' · ')}`}`)
  return lines.join('\n')
}
