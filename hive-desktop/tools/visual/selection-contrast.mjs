// Text-selection contrast sweep (explorer-os-actions / selection-contrast),
// per docs/visual-validation.md.
//
//   npx electron-vite build && python3 -m http.server 8123 -d out/renderer
//   run_code_unsafe --filename tools/visual/boot.mjs
//   run_code_unsafe --filename tools/visual/selection-contrast.mjs
//
// It measures what `::selection` actually paints on every surface a user can
// drag across — and it exists because the defect it was written for is
// invisible to every other kind of check: the DS's global rule painted
// `--accent` on a bubble that IS `--accent`, so selecting your own chat
// message changed nothing on screen while the CSS, the tests and the
// screenshots all looked correct.
//
// Two floors, because a selection is two things at once:
//   ink-on-highlight  ≥ 4.5:1 — you have to be able to read the selected text
//   highlight-on-surface ≥ 3:1 — you have to be able to SEE what is selected
// The second is the one the accent-on-accent bug failed at 1.00:1.
//
// Colours are resolved by painting a pixel and reading it back (the M15
// lesson: a regex parser silently returns null for `oklch()`/`color-mix()`
// and the sample is skipped, which reads as a pass). `missing` is reported
// separately from `failures` and the verdict requires both to be empty.
//
// Theme is driven through the app's own "Aparência" menu inside one run, not
// through localStorage + reload — the boot harness rewrites that key on every
// navigation, so a probe that sets it measures its own default three times
// (docs/visual-validation.md, M15).
async (page) => {
  const THEMES = [
    ['dark', 'Escuro'],
    ['light', 'Claro'],
    ['hive', 'Hive']
  ]

  // Surfaces to drag across. `sel` is the text-bearing element; `floorInk` is
  // the ratio the selected text must clear against the highlight.
  const TARGETS = [
    {
      key: 'chat-user-bubble',
      sel: '.hds-chat-message-user .hds-chat-message-bubble',
      note: 'a mensagem que o usuário enviou (o defeito original)'
    },
    { key: 'chat-assistant', sel: '.wb-chat-md', note: 'resposta do agente' },
    { key: 'composer', sel: '.hds-prompt-input textarea', note: 'o que se está escrevendo' },
    { key: 'tree-row', sel: '.wb-tree-row-content .hds-tree-label-text', note: 'nome de arquivo' }
  ]

  const report = { themes: {}, failures: [], missing: [] }

  for (const [theme, menuLabel] of THEMES) {
    // A Radix menu left open by a previous step covers the page with its
    // dismiss layer, and every click below then times out against
    // "<html> intercepts pointer events" — which reads like a broken selector
    // rather than like leftover state. Cheap to make the probe re-entrant.
    await page.keyboard.press('Escape')
    await page.waitForTimeout(150)
    // Drive the real control, not the storage key. The rows are
    // `menuitemradio` (a theme is a choice, not a command) and their
    // accessible name is the label *plus* the description underneath it —
    // so this anchors on the start of the name rather than matching it whole.
    await page.locator('[aria-label^="Aparência"]').click()
    await page.waitForTimeout(200)
    await page.getByRole('menuitemradio', { name: new RegExp(`^${menuLabel}`) }).click()
    await page.waitForTimeout(350)

    const measured = await page.evaluate(
      ({ TARGETS }) => {
        // One canvas, reused: paints the colour the browser resolved and reads
        // the pixel back, which handles oklch()/color-mix()/var() alike.
        const canvas = document.createElement('canvas')
        canvas.width = canvas.height = 1
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        const toRgb = (value) => {
          if (!value || value === 'transparent') return null
          ctx.clearRect(0, 0, 1, 1)
          ctx.fillStyle = '#000'
          ctx.fillStyle = value
          if (ctx.fillStyle === '#000000' && !/^(#000000|black|rgb\(0, 0, 0\))$/i.test(value)) {
            return null
          }
          ctx.clearRect(0, 0, 1, 1)
          ctx.fillRect(0, 0, 1, 1)
          const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data
          return { r, g, b, a: a / 255 }
        }
        // Composites a possibly-translucent colour over an opaque backdrop.
        // Channels are read as they come (NOT divided by alpha — the M12
        // premultiplication trap blows a 10% tint up to near-white).
        const over = (fg, bg) =>
          fg.a >= 1
            ? fg
            : {
                r: fg.r * fg.a + bg.r * (1 - fg.a),
                g: fg.g * fg.a + bg.g * (1 - fg.a),
                b: fg.b * fg.a + bg.b * (1 - fg.a),
                a: 1
              }
        const lum = ({ r, g, b }) => {
          const f = (c) => {
            const s = c / 255
            return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
          }
          return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
        }
        const ratio = (a, b) => {
          const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
          return Math.round(((x + 0.05) / (y + 0.05)) * 100) / 100
        }

        /** The nearest opaque background behind `el`, composited downward. */
        const backdrop = (el) => {
          const stack = []
          for (let node = el; node; node = node.parentElement) {
            const c = toRgb(getComputedStyle(node).backgroundColor)
            if (!c || c.a === 0) continue
            stack.push(c)
            if (c.a >= 1) break
          }
          let base = stack.pop() ?? { r: 255, g: 255, b: 255, a: 1 }
          while (stack.length) base = over(stack.pop(), base)
          return base
        }

        const out = []
        for (const target of TARGETS) {
          const el = document.querySelector(target.sel)
          if (!el) {
            out.push({ ...target, missing: 'elemento ausente' })
            continue
          }
          // `::selection` resolves var() against its originating element, so
          // the pair has to be read there — reading it off :root would measure
          // the default and miss every local override, which is the whole
          // mechanism under test.
          const style = getComputedStyle(el)
          const bgRaw = style.getPropertyValue('--selection-bg').trim()
          const inkRaw = style.getPropertyValue('--selection-ink').trim()
          if (!bgRaw || !inkRaw) {
            out.push({ ...target, missing: `token não resolvido (bg="${bgRaw}" ink="${inkRaw}")` })
            continue
          }
          const surface = backdrop(el)
          const hlRaw = toRgb(bgRaw)
          const inkColor = toRgb(inkRaw)
          if (!hlRaw || !inkColor) {
            out.push({ ...target, missing: `cor não resolvida (${bgRaw} / ${inkRaw})` })
            continue
          }
          const highlight = over(hlRaw, surface)
          out.push({
            ...target,
            surface: `rgb(${Math.round(surface.r)},${Math.round(surface.g)},${Math.round(surface.b)})`,
            highlight: `rgb(${Math.round(highlight.r)},${Math.round(highlight.g)},${Math.round(highlight.b)})`,
            inkOnHighlight: ratio(over(inkColor, highlight), highlight),
            highlightOnSurface: ratio(highlight, surface)
          })
        }
        return out
      },
      { TARGETS }
    )

    for (const m of measured) {
      if (m.missing) {
        report.missing.push(`${theme}/${m.key}: ${m.missing}`)
        continue
      }
      if (m.inkOnHighlight < 4.5) {
        report.failures.push(
          `${theme}/${m.key}: texto selecionado ${m.inkOnHighlight}:1 (piso 4,5) — ${m.note}`
        )
      }
      if (m.highlightOnSurface < 3) {
        report.failures.push(
          `${theme}/${m.key}: destaque ${m.highlightOnSurface}:1 contra o próprio fundo` +
            ` (piso 3) — a seleção é ${m.highlightOnSurface < 1.1 ? 'invisível' : 'quase invisível'}`
        )
      }
    }
    report.themes[theme] = measured

    // One screenshot per theme with the chat bubble really selected, so the
    // number has a picture next to it.
    const bubble = page.locator('.hds-chat-message-user .hds-chat-message-bubble').first()
    if (await bubble.count()) {
      const r = await bubble.boundingBox()
      await page.mouse.move(r.x + 6, r.y + 12)
      await page.mouse.down()
      await page.mouse.move(r.x + r.width - 6, r.y + r.height - 8, { steps: 10 })
      await page.mouse.up()
      await page.waitForTimeout(150)
    }
    await page.screenshot({
      path: `/home/gustavobgt/user-harness/hive/hive-desktop/.playwright-mcp/selection-${theme}.png`
    })
  }

  report.verdict =
    report.failures.length === 0 && report.missing.length === 0 ? 'PASS' : 'FAIL'
  return report
}
