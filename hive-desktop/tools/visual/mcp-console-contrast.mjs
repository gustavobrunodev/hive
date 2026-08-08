// Companion to tools/visual/boot.mjs — run it once, after boot. It drives the
// app's own appearance control through all three themes and measures WCAG
// contrast for every text-bearing surface of the MCP console (mcp-logs) in
// each of them.
//
// Two things this gets right that a naive probe doesn't, both of which hid a
// real defect on the first pass of this feature:
//
//   1. **Themes are switched through the UI, not localStorage.** `boot.mjs`'s
//      init script re-pins the theme on every navigation, so setting the key
//      and reloading measures the boot theme three times and reports a clean
//      sweep it never performed.
//   2. **Colours are sampled by painting, not by regex.** getComputedStyle
//      returns `oklch(...)` verbatim for tokens authored in it (--danger-ink,
//      --success), which a regex silently skips — and a skipped sample looks
//      exactly like a passing one.
//
// Backgrounds are composited up the ancestor chain, so a translucent row tint
// is measured against what the eye actually sees. Floors, from PRODUCT.md:
// 4.5:1 for body text, 3:1 for meaningful non-text (level dots, meter fill).
async (page) => {
  /** Opens the dock and maximizes it, without toggling either back off. */
  const openConsole = async () => {
    if ((await page.locator('.wb-mcplog').count()) === 0) {
      await page.keyboard.press('Control+Shift+M')
      await page.waitForTimeout(400)
    }
    if ((await page.locator('.wb-mcplog[data-maximized]').count()) === 0) {
      await page.getByLabel('Expandir o console para a área toda').click()
      await page.waitForTimeout(400)
    }
    // The live badge only renders inside the freshness window.
    await page.evaluate(() => window.__mcpLog?.({ kind: 'tool-call', tool: 'browser_navigate' }))
    await page.waitForTimeout(250)
  }

  const measure = async () =>
    await page.evaluate(() => {
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = 1
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      /** Paints one pixel and samples it — reads every colour syntax, oklch included. */
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

      /** Text — 4.5:1. */
      const TEXT = [
        ['título', '.wb-mcplog-title'],
        ['ao vivo', '.wb-mcplog-live'],
        ['hora', '.wb-mcplog-time'],
        ['categoria', '.wb-mcplog-cat'],
        ['servidor', '.wb-mcplog-server'],
        ['texto do evento', '.wb-mcplog-text'],
        ['latência', '.wb-mcplog-latency-num'],
        ['faixa de sessão', '.wb-mcplog-band-label'],
        ['contagem da faixa', '.wb-mcplog-band-count'],
        ['rail: título', '.wb-mcplog-rail-head'],
        ['rail: nome', '.wb-mcplog-card-name'],
        ['rail: estado', '.wb-mcplog-card-state'],
        ['rail: métricas', '.wb-mcplog-card-metrics'],
        ['rail: erros', '.wb-mcplog-card-errors'],
        ['rail: fora do catálogo', '.wb-mcplog-card-foreign'],
        ['status bar: servidor', '.wb-status-mcp-label'],
        ['status bar: erros', '.wb-status-mcp-errors'],
        ['busca', '.wb-mcplog-search input'],
        ['erro sobre a linha tingida', '.wb-mcplog-row[data-level="error"] .wb-mcplog-text'],
        ['filtro ativo', '.hds-seg-item[data-active="true"] .hds-seg-label'],
        ['filtro inativo', '.hds-seg-item[data-active="false"] .hds-seg-label'],
        ['filtro: contagem de problemas', '.hds-seg-count[data-tone="danger"]']
      ]

      /** Non-text that carries meaning — 3:1. The level dots paint on ::before. */
      const MARKS = [
        ['ponto: erro', '.wb-mcplog-row[data-level="error"] .wb-mcplog-dot'],
        ['ponto: chamada', '.wb-mcplog-row[data-kind="tool-call"] .wb-mcplog-dot'],
        ['ponto: retorno', '.wb-mcplog-row[data-kind="tool-ok"] .wb-mcplog-dot'],
        ['medidor de duração', '.wb-mcplog-meter-fill']
      ]

      const results = []
      for (const [label, selector] of TEXT) {
        const node = document.querySelector(selector)
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
        const pseudo = paint(getComputedStyle(node, '::before').backgroundColor)
        const mark = own.a > 0 ? own : pseudo.a > 0 ? pseudo : paint(style.color)
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

  const report = {}
  await openConsole()
  report.escuro = await measure()

  // Drive the real appearance control — see the header note on why.
  for (const [name, item] of [
    ['claro', 'Claro'],
    ['hive', 'Hive']
  ]) {
    await page.locator('.wb-icon-btn[aria-label^="Aparência"]').click()
    await page.waitForTimeout(250)
    await page.getByRole('menuitemradio', { name: item }).click()
    await page.waitForTimeout(500)
    await openConsole()
    report[name] = await measure()
  }

  const clean = Object.values(report).every(
    (r) => r.failures.length === 0 && r.missing.length === 0
  )
  return { verdict: clean ? 'PASS' : 'FAIL', ...report }
}
