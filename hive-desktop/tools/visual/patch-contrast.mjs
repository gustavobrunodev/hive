// Contrast probe over the in-chat patch (agent-patch) — every surface the
// snippet paints, across all three themes in one run.
//
// Run AFTER tools/visual/boot.mjs + tools/visual/chat-patch.mjs, which put a
// two-hunk edit, a created file, a failed edit and a capped patch on screen.
// It drives the REAL "Aparência" menu between themes rather than writing
// localStorage, because the boot init script rewrites that key on every
// navigation — a probe that sets what the harness also sets measures its own
// default three times (docs/visual-validation.md).
//
// Colour is resolved by *painting* a pixel, never by parsing: `oklch()` and
// `color-mix()` do not round-trip through getComputedStyle, and a regex parser
// that returns null **skips** the sample silently, which reads as a PASS. So a
// skipped sample is reported separately from a failure, and the verdict needs
// both lists empty.
async (page) => {
  const measure = () =>
    page.evaluate(() => {
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = 1
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      const rgba = (css) => {
        ctx.clearRect(0, 0, 1, 1)
        ctx.fillStyle = css
        ctx.fillRect(0, 0, 1, 1)
        const d = ctx.getImageData(0, 0, 1, 1).data
        // NOT premultiplied — reading the channels as they come and compositing
        // with the alpha is the only correct move here.
        return [d[0], d[1], d[2], d[3] / 255]
      }
      const over = (fg, bg) => fg.slice(0, 3).map((c, i) => c * fg[3] + bg[i] * (1 - fg[3]))
      const lum = (rgb) => {
        const [r, g, b] = rgb.map((ch) => {
          const v = Math.min(255, Math.max(0, ch)) / 255
          return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
        })
        return 0.2126 * r + 0.7152 * g + 0.0722 * b
      }
      const contrast = (a, b) => {
        const la = lum(a)
        const lb = lum(b)
        return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
      }
      /** Every background layer above the element, composited down to opaque. */
      const bgOf = (el) => {
        const layers = []
        let node = el
        while (node) {
          const colour = rgba(getComputedStyle(node).backgroundColor)
          if (colour[3] > 0) layers.push(colour)
          node = node.parentElement
        }
        layers.push(rgba('#000'))
        let base = layers[layers.length - 1].slice(0, 3)
        for (let i = layers.length - 2; i >= 0; i--) base = over(layers[i], base)
        return base
      }

      const failures = []
      const missing = []
      const rows = []

      /** Text against everything painted behind it. */
      const text = (selector, label) => {
        const el = document.querySelector(selector)
        if (!el) return missing.push(label ?? selector)
        const style = getComputedStyle(el)
        const bg = bgOf(el)
        const ratio = contrast(over(rgba(style.color), bg), bg)
        const size = parseFloat(style.fontSize)
        const large = size >= 24 || (size >= 18.66 && Number(style.fontWeight) >= 700)
        const floor = large ? 3 : 4.5
        rows.push(`${label ?? selector} ${size}px/${style.fontWeight} → ${ratio.toFixed(2)}:1`)
        if (ratio < floor) failures.push(`${label ?? selector} ${ratio.toFixed(2)}:1 < ${floor}`)
      }

      /** A non-text carrier (the diffstat bar's segments) against its surface — 3:1. */
      const mark = (selector, label) => {
        const el = document.querySelector(selector)
        if (!el) return missing.push(label ?? selector)
        const bg = bgOf(el.parentElement)
        const ratio = contrast(over(rgba(getComputedStyle(el).backgroundColor), bg), bg)
        rows.push(`${label ?? selector} (marca) → ${ratio.toFixed(2)}:1`)
        if (ratio < 3) failures.push(`${label ?? selector} ${ratio.toFixed(2)}:1 < 3`)
      }

      // The header line.
      text('.wb-activity-open .wb-activity-verb', 'cabeçalho/verbo')
      text('.wb-activity-open .wb-activity-detail', 'cabeçalho/caminho')
      text('.wb-patch-op', 'chip novo/reescrito')
      text('.wb-patch-count[data-kind="add"]', 'contagem +')
      text('.wb-patch-count[data-kind="del"]', 'contagem −')
      mark('.wb-patch-seg[data-kind="add"]', 'barra +')
      mark('.wb-patch-seg[data-kind="del"]', 'barra −')

      // The body. Context is the quietest thing here and therefore the most
      // likely to fail — it is `--muted`, and M14/M15 both recorded `--faint`
      // failing at exactly this size.
      text('.wb-patch-line[data-type="ctx"] .wb-patch-text', 'código/contexto')
      text('.wb-patch-line[data-type="add"] .wb-patch-text', 'código/adicionado')
      text('.wb-patch-line[data-type="del"] .wb-patch-text', 'código/removido')
      text('.wb-patch-line[data-type="add"] .wb-patch-sign', 'sinal +')
      text('.wb-patch-line[data-type="del"] .wb-patch-sign', 'sinal −')
      text('.wb-patch-no', 'número de linha')
      text('.wb-patch-line[data-type="add"] .wb-patch-word', 'palavra alterada +')
      text('.wb-patch-line[data-type="del"] .wb-patch-word', 'palavra alterada −')

      // Footer + failed state.
      text('.wb-patch-more', 'mostrar mais')
      text('.wb-patch-note', 'aviso de falha')

      return {
        theme: document.documentElement.getAttribute('data-theme'),
        rows,
        failures,
        missing
      }
    })

  const results = []
  for (const theme of ['dark', 'light', 'hive']) {
    if (theme !== 'dark') {
      await page.locator('.wb-icon-btn[aria-label^="Aparência"]').click()
      await page
        .getByRole('menuitemradio', { name: { light: 'Claro', hive: 'Hive' }[theme] })
        .click()
      await page.waitForTimeout(350)
    }
    results.push(await measure())
  }

  const verdict = results.every((r) => r.failures.length === 0 && r.missing.length === 0)
  return { verdict: verdict ? 'PASS' : 'FAIL', results }
}
