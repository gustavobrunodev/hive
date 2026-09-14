// Sonda de contraste da rodada de 2026-09-13 nas Iniciativas, nos três temas:
// o crachá colorido que liga uma conversa à demanda (nas SEIS cores, porque a
// que reprova é sempre a que ninguém abriu), a barra própria do painel, o
// terceiro controle do histórico e o diálogo de edição com a confirmação de
// exclusão aberta.
//
//   node tools/visual/run-scene.mjs tools/visual/initiatives-round.mjs \
//                                   tools/visual/initiatives-round-contrast.mjs
//
// Lições herdadas, todas pagas neste repositório e todas aplicáveis aqui:
//
//   - **Resolva cor por canvas, nunca por regex.** Os tokens novos são
//     `oklch()` e o tint do crachá é `color-mix()`; o Chromium serializa as
//     duas literalmente, e um parser de números lê `oklch(0.78 0.13 295)` como
//     um RGB quase preto (agent-tool-details).
//   - **Componha alpha de baixo para cima.** O tint do crachá é translúcido e
//     a linha selecionada do histórico tem o *seu* tint — dois tints
//     empilhados, que é exatamente o par que a conta de cima para baixo errava.
//   - **Force o tema pelo menu, não pelo boot** (engine-contrast).
//   - **Meça a paleta INTEIRA.** Seis cores × três temas é a única forma de
//     saber; medir só a que a fixture escolheu deixa cinco sem medição, e a que
//     reprova é sempre uma dessas.
//   - **Nem todo pixel colorido é um indicador.** O fio de 2px na borda do
//     painel não está na lista: ele repete, em cor, o que o crachá da conversa
//     e o nome no topo do painel já dizem em palavras.
async (page) => {
  const THEMES = [
    { id: 'dark', label: 'Escuro' },
    { id: 'light', label: 'Claro' },
    { id: 'hive', label: 'Hive' }
  ]

  const HUES = ['violet', 'sky', 'emerald', 'amber', 'rose', 'slate']

  const results = []

  // The scene before this one leaves the edit dialog open on its delete
  // confirmation — deliberately, it is the last thing it screenshots. A modal
  // swallows every click aimed at the theme menu, and the probe then reports
  // every target as absent, which reads exactly like "nothing to fix".
  await page.keyboard.press('Escape')
  await page.waitForTimeout(200)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)

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


      // --- o crachá, nas seis cores ---------------------------------------
      // Plantado num container real do histórico, e não medido só na cor que a
      // fixture calhou de escolher: a que reprova é sempre uma das outras
      // cinco. O crachá é tipo de 11px, então deve 4,5:1 — não os 3:1 de marca.
      // Declared inside the page: `page.evaluate` runs in the browser, which
      // cannot see the runner's constants.
      const HUES = ['violet', 'sky', 'emerald', 'amber', 'rose', 'slate']
      const host = document.querySelector('.wb-history-row-meta')
      if (host) {
        for (const hue of HUES) {
          const probe = document.createElement('span')
          probe.className = 'wb-init-badge'
          probe.dataset.variant = 'row'
          probe.dataset.probe = hue
          probe.style.setProperty('--init-hue', `var(--init-${hue})`)
          // The real badge is dot + text. A probe built as a bare span has no
          // `.wb-init-badge-dot` to measure, and the dot targets came back
          // `ausente` — which reads exactly like "nothing to fix".
          const dot = document.createElement('span')
          dot.className = 'wb-init-badge-dot'
          const text = document.createElement('span')
          text.className = 'wb-init-badge-text'
          text.textContent = 'Demanda'
          probe.append(dot, text)
          host.appendChild(probe)
        }
        for (const hue of HUES) target(`crachá: ${hue}`, `[data-probe="${hue}"] .wb-init-badge-text`)
        // O ponto colorido é um objeto gráfico ao lado da palavra que ele
        // acompanha — 3:1, medido contra o tint da própria pílula.
        for (const hue of HUES) {
          const el = document.querySelector(`[data-probe="${hue}"] .wb-init-badge-dot`)
          if (!el) {
            out.push({ name: `crachá: ponto ${hue}`, status: 'ausente' })
            continue
          }
          // `backdrop` starts at the element itself, and the dot's own
          // background IS the hue — measuring it that way composes the dot
          // over itself and reports a flat 1,00 for every colour, on every
          // theme. What is behind the dot is the PILL.
          const bg = backdrop(el.parentElement)
          const value = ratio(over(parse(getComputedStyle(el).backgroundColor), bg), bg)
          out.push({ name: `crachá: ponto ${hue}`, ratio: Number(value.toFixed(2)), pass: value >= 3 })
        }
        for (const el of document.querySelectorAll('[data-probe]')) el.remove()
      } else {
        out.push({ name: 'crachá', status: 'ausente' })
      }

      // O crachá real, sobre a linha e sobre a linha SELECIONADA — dois tints
      // empilhados, o par que a conta errada reprovava.
      target('crachá: na linha', '.wb-history-row .wb-init-badge-text')
      // The selected row's own tint UNDER the badge's tint — two translucent
      // layers, which is the pair the top-down composition used to get wrong.
      // Planted rather than waited for: this scene opens a demand, not a
      // conversation, so no row carries `data-active` on its own.
      const activeRow = document.querySelector('.wb-history-row')
      if (activeRow) {
        activeRow.setAttribute('data-active', '')
        target('crachá: na linha atual', '.wb-history-row[data-active] .wb-init-badge-text')
        activeRow.removeAttribute('data-active')
      }

      // --- a barra própria do painel ---------------------------------------
      target('painel: migalha', '.wb-initctx-id .wb-initctx-crumbs')
      target('painel: nome', '.wb-initctx-id .wb-initctx-name')
      // A barra e o corpo têm de ser UMA superfície: era esse o defeito. Um
      // par que se distingue é justamente o que não pode acontecer aqui, então
      // o piso é invertido — eles devem medir ~1:1.
      const bar = document.querySelector('.wb-initctx-id')
      const body = document.querySelector('.wb-initctx-flow')
      if (bar && body) {
        const value = ratio(backdrop(bar), backdrop(body))
        out.push({
          name: 'painel: barra vs. corpo (devem ser a MESMA superfície)',
          ratio: Number(value.toFixed(2)),
          pass: value < 1.05
        })
      }

      // --- o terceiro controle do histórico --------------------------------
      target('histórico: valor do filtro de iniciativa', '.wb-conv-control:last-child .wb-conv-control-value')

      out.push({ __scene: 'painel' })
      return out    })

    results.push({ theme: theme.id, targets: measured })
  }

  // --- a segunda cena: o diálogo de edição, com a confirmação aberta -------
  for (const theme of THEMES) {
    await page.keyboard.press('Escape')
    await page.waitForTimeout(200)
    await page.getByRole('button', { name: /^Escolha do tema/ }).click()
    await page.getByRole('menuitemradio', { name: new RegExp(`^${theme.label}`) }).click()
    await page.waitForTimeout(300)
    await page.getByRole('button', { name: 'Editar iniciativa' }).click()
    await page.waitForTimeout(300)

    // Measured BEFORE arming the confirmation: the footer's delete button is
    // replaced by the confirmation box, so a probe that opens the box first
    // reports the button `ausente` — which reads as "nothing to fix".
    const deleteCta = await page.evaluate(() => {
      const el = document.querySelector('.wb-initedit-delete')
      return el ? getComputedStyle(el).color : null
    })

    await page.getByRole('button', { name: 'Excluir iniciativa' }).click()
    await page.waitForTimeout(250)

    const measured = await page.evaluate((deleteColor) => {

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


      target('editar: rótulo do campo', '.wb-initedit .hds-label')
      target('editar: dica da cor', '.wb-initedit .hds-field-description')
      target('confirmação: título', '.wb-initedit-confirm-title')
      target('confirmação: corpo', '.wb-initedit-confirm-body')
      // A borda da caixa de confirmação é o que a separa do diálogo em volta:
      // objeto gráfico, 3:1 — e, ao contrário do fio do painel, ela NÃO repete
      // nada escrito (a caixa não tem outro marcador de perigo).
      stroke('confirmação: borda', '.wb-initedit-confirm', '.wb-initedit', 3)
      // O ✓ dentro da amostra escolhida: é o segundo sinal de seleção (o
      // primeiro é o anel), e é o que sobra para quem não separa dois tons.
      const check = document.querySelector('.hds-swatch[data-active] .hds-swatch-check')
      if (check) {
        const fill = document.querySelector('.hds-swatch[data-active] .hds-swatch-fill')
        const bg = parse(getComputedStyle(fill).backgroundColor)
        const value = ratio(over(parse(getComputedStyle(check).stroke), bg), bg)
        out.push({ name: 'cor: ✓ da amostra escolhida', ratio: Number(value.toFixed(2)), pass: value >= 3 })
      } else {
        out.push({ name: 'cor: ✓ da amostra escolhida', status: 'ausente' })
      }
      // The delete CTA's colour, read while its button still existed, against
      // the dialog surface it sits on.
      if (deleteColor) {
        const surface = backdrop(document.querySelector('.wb-initedit'))
        const value = ratio(over(parse(deleteColor), surface), surface)
        out.push({
          name: 'editar: "Excluir iniciativa"',
          ratio: Number(value.toFixed(2)),
          pass: value >= 4.5
        })
      }
      out.push({ __scene: 'editar' })
      return out
    }, deleteCta)

    results.push({ theme: theme.id, targets: measured })
  }

  const flat = results.flatMap((r) =>
    r.targets.filter((t) => !t.__scene).map((t) => ({ theme: r.theme, ...t }))
  )
  return {
    total: flat.length,
    failing: flat.filter((t) => t.pass === false || t.status === 'ausente'),
    worst: [...flat].filter((t) => t.ratio).sort((a, b) => a.ratio - b.ratio).slice(0, 8)
  }
}
