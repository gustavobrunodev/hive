// Sonda de contraste + geometria do editor de `.csv`, da pasta vazia e do
// pulso de "revelar" — nos três temas.
//
//   run_code_unsafe --filename tools/visual/boot.mjs
//   run_code_unsafe --filename tools/visual/csv-explorer.mjs
//   run_code_unsafe --filename tools/visual/csv-contrast.mjs
//
// Lições já pagas por outras sondas deste repositório e aplicadas aqui:
//
//   - **Resolva cor por canvas, nunca por regex.** Os tokens deste sistema são
//     `oklch()` e o Chromium serializa a string literal; um parser de números
//     lê `oklch(0.77 0.108 248)` como um RGB quase preto e reprova alvos que
//     estão certos (agent-tool-details).
//   - **Componha alpha.** `--selected-bg` é um tint translúcido; medir contra
//     ele sem compor com o fundo mede um pixel que não existe na tela.
//   - **Force o tema pelo menu, não pelo boot.** Uma rodada logo depois de uma
//     cena que deixou o app no claro mede claro três vezes e chama de escuro
//     (engine-contrast).
//   - **Nem todo pixel colorido é um indicador.** A barra de cor sob o
//     cabeçalho é a MESMA informação que o nome colorido logo acima dela; o
//     alvo que vale é o texto, e é ele que está na lista.
async (page) => {
  const THEMES = [
    { id: 'dark', label: 'Escuro' },
    { id: 'light', label: 'Claro' },
    { id: 'hive', label: 'Hive' }
  ]

  const results = []

  for (const theme of THEMES) {
    // O menu de aparência é o controle real; trocar `data-theme` na mão não
    // passa pelo React e o valor da sessão anterior sobrevive no storage.
    await page.getByRole('button', { name: 'Aparência' }).click()
    await page.getByRole('menuitemradio', { name: new RegExp(`^${theme.label}`) }).click()
    await page.waitForTimeout(350)

    const measured = await page.evaluate(() => {
      // --- resolução de cor -------------------------------------------------
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = 1
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      /** Qualquer cor CSS (oklch, oklab, color-mix, rgba) → [r,g,b,a] sRGB. */
      const parse = (value) => {
        ctx.clearRect(0, 0, 1, 1)
        ctx.fillStyle = '#000'
        ctx.fillStyle = value
        ctx.fillRect(0, 0, 1, 1)
        const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data
        return [r, g, b, a / 255]
      }
      const over = (fg, bg) => fg.map((c, i) => (i === 3 ? 1 : c * fg[3] + bg[i] * (1 - fg[3])))
      /** A cor realmente pintada atrás de `el`, compondo todo tint translúcido. */
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
      const target = (name, selector, floor = 4.5) => {
        const el = document.querySelector(selector)
        if (!el) return out.push({ name, status: 'ausente' })
        const style = getComputedStyle(el)
        const fg = over(parse(style.color), backdrop(el))
        const value = ratio(fg, backdrop(el))
        out.push({
          name,
          ratio: Number(value.toFixed(2)),
          size: style.fontSize,
          weight: style.fontWeight,
          pass: value >= floor
        })
      }

      // --- texto do editor de planilhas ------------------------------------
      target('csv: forma (linhas × colunas)', '.wb-csv-shape')
      target('csv: separador', '.wb-csv-delimiter')
      target('csv: pílula do cabeçalho (ligada)', '.wb-csv-toggle[aria-pressed="true"]')
      target('csv: rodapé "Nova linha"', '.wb-csv-addrow')
      target('grade: número da linha', '.hds-grid-rowhead:not([data-current])')
      target('grade: número da linha (atual)', '.hds-grid-rowhead[data-current]')
      target('grade: célula', '.hds-grid-cell:not([data-active])')
      target('grade: célula sob o cursor', '.hds-grid-cell[data-active]')
      target('grade: letra da coluna', '.hds-grid-colhead-hint')
      for (const hue of [0, 1, 2, 3, 4]) {
        target(
          `grade: nome da coluna (matiz ${hue})`,
          `.hds-grid-colhead[data-hue="${hue}"] .hds-grid-colhead-label`
        )
      }
      // --- a árvore ---------------------------------------------------------
      target('árvore: legenda de pasta vazia', '.wb-tree-empty-row .hds-tree-label-text')

      // --- geometria + afirmações estruturais -------------------------------
      const head = document.querySelector('.hds-grid-colhead')
      const scroller = document.querySelector('.hds-grid-scroller')
      const cell = document.querySelector('.hds-grid-cell[data-active]')
      const asserts = {
        // O cabeçalho é opaco: as linhas rolam POR BAIXO dele. Vale para a
        // coluna sob o cursor também — o tint dela é uma CAMADA sobre a
        // superfície, não um substituto: pintada só com `--selected-bg` (16%),
        // a coluna destacada deixava as linhas passarem por dentro do nome.
        headerOpaque: parse(getComputedStyle(head).backgroundColor)[3] >= 0.999,
        currentHeaderOpaque:
          parse(
            getComputedStyle(document.querySelector('.hds-grid-colhead[data-current]'))
              .backgroundColor
          )[3] >= 0.999,
        currentGutterOpaque:
          parse(
            getComputedStyle(document.querySelector('.hds-grid-rowhead[data-current]'))
              .backgroundColor
          )[3] >= 0.999,
        headerSticky: getComputedStyle(head).position === 'sticky',
        gutterSticky: getComputedStyle(document.querySelector('.hds-grid-rowhead')).position === 'sticky',
        // A mira: a célula, o cabeçalho da coluna e o número da linha.
        crosshair:
          !!cell &&
          !!document.querySelector('.hds-grid-colhead[data-current]') &&
          !!document.querySelector('.hds-grid-rowhead[data-current]'),
        // Uma coluna numérica alinha o nome sobre os próprios dígitos.
        numericHeaderAligned:
          getComputedStyle(
            document.querySelector('.hds-grid-colhead[data-numeric] .hds-grid-colhead-body')
          ).alignItems === 'flex-end',
        // A tabela rola dentro de si; o painel nunca rola na horizontal.
        gridScrollsItself: scroller ? scroller.scrollWidth > scroller.clientWidth : null,
        paneNoHorizontalScroll:
          document.querySelector('.wb-csv').scrollWidth <=
          document.querySelector('.wb-csv').clientWidth
      }

      return { targets: out, asserts }
    })

    results.push({ theme: theme.id, ...measured })
    await page.screenshot({
      path: `/home/gustavobgt/user-harness/hive/hive-desktop/.playwright-mcp/csv-theme-${theme.id}.png`
    })
  }

  const failures = results.flatMap((r) =>
    r.targets.filter((t) => t.pass === false || t.status === 'ausente').map((t) => ({ theme: r.theme, ...t }))
  )
  return { failures, asserts: results.map((r) => ({ theme: r.theme, ...r.asserts })), results }
}
