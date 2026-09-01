// Companion to tools/visual/boot.mjs — run it once, after boot. It opens the
// composer's engine picker (model-picker) and measures WCAG contrast for every
// text-bearing surface of the trigger and the panel, in all three themes, for
// BOTH shapes the picker takes: Claude (effort ladder, tier groups) and
// Copilot (vendor groups, no effort, a note line).
//
// Same two rules the MCP console probe documents, and for the same reasons:
//
//   1. **Themes are switched through the UI**, not localStorage — `boot.mjs`'s
//      init script re-pins the theme on every navigation, so a probe that sets
//      the key and reloads measures the boot theme three times.
//   2. **Colours are sampled by painting**, not by regex — tokens authored in
//      `oklch()` (and `color-mix(in oklab, …)`, which this panel uses for the
//      selected row, the tags and the icon tile) come back verbatim from
//      getComputedStyle, and a regex silently skips them. A skipped sample
//      looks exactly like a passing one.
//
// Backgrounds are composited up the ancestor chain, which matters more here
// than anywhere else in the app: the selected row is a translucent
// `--selected-bg` over the panel, and the tags are a `color-mix` over that.
async (page) => {
  /** Opens the picker, closing whatever menu was left open first. */
  const openPicker = async () => {
    await page.keyboard.press('Escape')
    await page.waitForTimeout(150)
    if ((await page.locator('.hds-picker').count()) === 0) {
      await page.locator('.wb-engine-btn').click()
      await page.waitForTimeout(350)
    }
  }

  /** Switches the conversation's agent through the composer's own switcher. */
  const useAgent = async (name) => {
    await page.keyboard.press('Escape')
    await page.waitForTimeout(150)
    await page.locator('.wb-agent-pill-btn').click()
    await page.waitForTimeout(250)
    await page.getByRole('menuitemradio', { name }).click()
    await page.waitForTimeout(500)
  }

  const measure = async () =>
    await page.evaluate(() => {
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = 1
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      const paint = (value) => {
        ctx.clearRect(0, 0, 1, 1)
        ctx.fillStyle = '#000'
        ctx.fillStyle = value
        ctx.fillRect(0, 0, 1, 1)
        const d = ctx.getImageData(0, 0, 1, 1).data
        return { rgb: [d[0], d[1], d[2]], a: d[3] / 255 }
      }
      const over = (f, b) => f.rgb.map((c, i) => c * f.a + b[i] * (1 - f.a))
      const lum = (rgb) => {
        const [r, g, b] = rgb.map((c) => {
          const s = c / 255
          return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
        })
        return 0.2126 * r + 0.7152 * g + 0.0722 * b
      }
      const ratio = (a, b) => {
        const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
        return (hi + 0.05) / (lo + 0.05)
      }
      const backdrop = (node) => {
        const stack = []
        for (let el = node; el; el = el.parentElement) {
          const bg = paint(getComputedStyle(el).backgroundColor)
          if (bg.a > 0) stack.push(bg)
          if (bg.a === 1) break
        }
        let base = [255, 255, 255]
        for (const layer of stack.reverse()) base = over(layer, base)
        return base
      }

      /** Text — 4.5:1, including the 10–11px chrome, which is where this fails first. */
      const TEXT = [
        ['gatilho: modelo', '.wb-engine-name'],
        ['gatilho: id resolvido', '.wb-engine-resolved'],
        ['gatilho: esforço', '.wb-engine-effort-chip'],
        ['busca (placeholder)', '.hds-picker-input'],
        ['cabeçalho de grupo', '.hds-picker-group [cmdk-group-heading]'],
        ['nome do modelo', '.hds-picker-label'],
        ['descrição', '.hds-picker-desc'],
        ['id resolvido na linha', '.hds-picker-hint'],
        ['janela de contexto', '.hds-picker-meta'],
        ['etiqueta', '.hds-picker-tag'],
        ['linha escolhida: nome', '[data-selected-option] .hds-picker-label'],
        ['linha escolhida: descrição', '[data-selected-option] .hds-picker-desc'],
        // The unselected rows are a different measurement: they sit on the bare
        // panel, the chosen one on a translucent tint. Measuring only the first
        // `.hds-picker-desc` in the DOM measures whichever happens to be first.
        [
          'linha comum: descrição',
          '.hds-picker-item:not([data-selected-option]) .hds-picker-desc'
        ],
        [
          'linha comum: contexto',
          '.hds-picker-item:not([data-selected-option]) .hds-picker-meta'
        ],
        ['título do esforço', '.wb-engine-effort-title'],
        ['esforço ativo', '.hds-seg-item[data-active="true"] .hds-seg-label'],
        ['esforço inativo', '.hds-seg-item[data-active="false"] .hds-seg-label'],
        ['dica do esforço', '.wb-engine-effort-hint'],
        ['procedência', '.wb-engine-source-text'],
        ['redetectar', '.wb-engine-refresh'],
        ['aviso', '.wb-engine-note'],
        ['modelo em uso', '.wb-engine-running']
      ]

      /** Non-text that carries meaning — 3:1. */
      const MARKS = [
        ['ponto de procedência', '.wb-engine-source-dot'],
        ['glifo do gatilho', '.wb-engine-glyph svg'],
        ['glifo da linha', '.hds-picker-icon svg'],
        ['marca de escolhido', '.hds-picker-check svg']
      ]

      const results = []
      for (const [label, selector] of TEXT) {
        const node = document.querySelector(selector)
        // Absent is reported, never skipped: a surface that did not render is
        // a different failure from one that rendered illegibly, and silence
        // reads as a pass.
        if (!node) {
          results.push({ label, ratio: null, min: 4.5, note: 'ausente' })
          continue
        }
        const bg = backdrop(node)
        const fg = paint(getComputedStyle(node).color)
        results.push({ label, ratio: Math.round(ratio(over(fg, bg), bg) * 100) / 100, min: 4.5 })
      }
      for (const [label, selector] of MARKS) {
        const node = document.querySelector(selector)
        if (!node) {
          results.push({ label, ratio: null, min: 3, note: 'ausente' })
          continue
        }
        const style = getComputedStyle(node)
        const own = paint(style.backgroundColor)
        const mark = own.a > 0 ? own : paint(style.color)
        const bg = backdrop(node.parentElement ?? node)
        results.push({ label, ratio: Math.round(ratio(over(mark, bg), bg) * 100) / 100, min: 3 })
      }

      return {
        theme: document.documentElement.dataset.theme ?? 'dark',
        failures: results.filter((r) => r.ratio !== null && r.ratio < r.min),
        missing: results.filter((r) => r.ratio === null).map((r) => r.label),
        worst: results
          .filter((r) => r.ratio !== null)
          .sort((a, b) => a.ratio / a.min - b.ratio / b.min)
          .slice(0, 3)
      }
    })

  /** Both shapes of the picker, in the theme that is currently on. */
  const bothAgents = async () => {
    await useAgent(/Claude Code/i)
    await openPicker()
    const claude = await measure()
    await useAgent(/Copilot/i)
    await openPicker()
    const copilot = await measure()
    // Leave the conversation back on Claude so the next theme starts even.
    await useAgent(/Claude Code/i)
    return { claude, copilot }
  }

  /** Puts the app on one named theme through its own appearance menu. */
  const useTheme = async (item) => {
    await page.keyboard.press('Escape')
    await page.locator('.wb-icon-btn[aria-label^="Aparência"]').click()
    await page.waitForTimeout(250)
    // Anchored: each row's accessible name is "<tema> <descrição>", and
    // "Escuro" also appears inside the Hive row's description ("Escuro, nas
    // cores da marca"), so an unanchored match resolves to two elements.
    await page.getByRole('menuitemradio', { name: new RegExp(`^${item}`) }).click()
    await page.waitForTimeout(500)
  }

  // Explicitly, even for the boot theme: a probe run after an earlier scene
  // left the app in light would otherwise measure light and label it "escuro"
  // — which is exactly what happened on this feature's first pass.
  await useTheme('Escuro')
  const report = { escuro: await bothAgents() }
  for (const [name, item] of [
    ['claro', 'Claro'],
    ['hive', 'Hive']
  ]) {
    await useTheme(item)
    report[name] = await bothAgents()
  }

  const scenes = Object.values(report).flatMap((theme) => Object.values(theme))
  // Copilot legitimately has no effort control and Claude legitimately has no
  // note line, so "missing" is only a failure when it is missing from the
  // shape that should have it — checked per scene by the caller reading the
  // report, not collapsed into the verdict.
  const clean = scenes.every((r) => r.failures.length === 0)
  return { verdict: clean ? 'PASS' : 'FAIL', ...report }
}
