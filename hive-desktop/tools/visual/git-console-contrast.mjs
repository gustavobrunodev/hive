// Companion to tools/visual/boot.mjs — run it once, after boot. It opens the
// git command console (git-logs), drives the app's own appearance control
// through all three themes, and measures WCAG contrast for every text-bearing
// surface of the dock in each of them.
//
// Same two rules as `mcp-console-contrast.mjs`, and for the same measured
// reasons:
//
//   1. **Themes are switched through the UI, not localStorage.** `boot.mjs`'s
//      init script re-pins the theme on every navigation, so setting the key
//      and reloading measures the boot theme three times and reports a clean
//      sweep it never performed.
//   2. **Colours are sampled by painting, not by regex.** getComputedStyle
//      returns `oklch(...)` verbatim for tokens authored in it (--danger-ink,
//      --warning-ink), which a regex silently skips — and a skipped sample
//      looks exactly like a passing one.
//
// The console-specific trap this one adds: **measure the failed row too.** Its
// tint sits under the text on that row, and the two colours that only exist
// there (`saiu 128` on `--danger-ink`, the command over a danger wash) are
// precisely the ones a reader is looking for when they open this dock.
//
// Floors, from PRODUCT.md: 4.5:1 for body text, 3:1 for meaningful non-text.
async (page) => {
  /** Opens Source Control, then the console from its overflow menu. */
  const openConsole = async () => {
    if ((await page.locator('.wb-gitlog').count()) === 0) {
      await page
        .getByRole('button', { name: /Controle de versão/i })
        .first()
        .click()
      await page.waitForTimeout(400)
      await page.getByRole('button', { name: 'Mais ações' }).click()
      await page.waitForTimeout(300)
      await page.getByRole('menuitem', { name: /Ver logs do Git/ }).click()
      await page.waitForTimeout(500)
    }
    // The stderr block only exists while a failed row is expanded, and the
    // failed row is the one whose colours matter most.
    if ((await page.locator('.wb-gitlog-stderr').count()) === 0) {
      await page.locator('.wb-gitlog-row[data-failed] .wb-gitlog-cmd-btn').first().click()
      await page.waitForTimeout(300)
    }
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
        ['título', '.wb-gitlog-title'],
        ['hora', '.wb-gitlog-time'],
        ['comando', '.wb-gitlog-cmd-text'],
        ['pasta (cwd)', '.wb-gitlog-cwd'],
        ['duração', '.wb-gitlog-row:not([data-slow]) .wb-gitlog-dur'],
        ['duração lenta', '.wb-gitlog-row[data-slow] .wb-gitlog-dur'],
        ['desfecho ok', '.wb-gitlog-row:not([data-failed]) .wb-gitlog-outcome'],
        ['desfecho falho', '.wb-gitlog-row[data-failed] .wb-gitlog-outcome'],
        ['comando na linha falha', '.wb-gitlog-row[data-failed] .wb-gitlog-cmd-text'],
        ['pasta na linha falha', '.wb-gitlog-row[data-failed] .wb-gitlog-cwd'],
        ['stderr', '.wb-gitlog-stderr'],
        ['busca', '.wb-gitlog-search input'],
        ['comando da barra', '.wb-gitlog-cmdbtn'],
        ['filtro ativo', '.hds-seg-item[data-active="true"] .hds-seg-label'],
        ['filtro inativo', '.hds-seg-item[data-active="false"] .hds-seg-label'],
        ['filtro: contagem de falhas', '.hds-seg-count[data-tone="danger"]']
      ]

      /**
       * Non-text that carries meaning — 3:1.
       *
       * `.wb-gitlog-mark` is deliberately NOT here, and the first run of this
       * probe is why: it measured 1,22:1 and looked like a finding. It is the
       * tinted tile *behind* the dock's icon, sitting beside a text title that
       * says the same thing — a container, not an indicator, and raising it to
       * 3:1 would turn a quiet toolbar into a badge. The repo has logged this
       * mistake once before (the ramp's empty track); the rule is that a
       * coloured pixel earns the floor only when information depends on it.
       */
      const MARKS = [
        ['borda da linha falha', '.wb-gitlog-row[data-failed]'],
        ['seta de detalhe', '.wb-gitlog-caret']
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
        // The failed row's carrier is its left border, not a fill.
        const border = paint(style.borderLeftColor)
        const own = paint(style.backgroundColor)
        const mark =
          style.borderLeftWidth !== '0px' && border.a > 0
            ? border
            : own.a > 0
              ? own
              : paint(style.color)
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
          .slice(0, 4)
      }
    })

  const report = {}
  await openConsole()
  report.escuro = await measure()

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
