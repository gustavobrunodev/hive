// Contrast probe over the chat transcript's surfaces — the tool-activity rail,
// the permission card (pending and answered) and the in-chat change card — in
// whatever theme the page is booted into. Companion to tools/visual/boot.mjs:
// boot, drive a turn, then run this.
//
// Three traps this avoids (docs/visual-validation.md):
//   1. `oklch()` / `color-mix()` do not round-trip through getComputedStyle, so
//      every colour is resolved by *painting* it and reading the pixel.
//   2. The approval card's surface is a translucent `--warning-bg` over the
//      chat background. Measuring against the tint alone reports ~1.3:1 and is
//      simply wrong — every background layer is composited to opaque first.
//   3. See the `rgba` comment: canvas `getImageData` is NOT premultiplied.
async (page) => {
  return await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 1
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    /** [r,g,b,a] for any CSS colour, alpha included. */
    const rgba = (css) => {
      ctx.clearRect(0, 0, 1, 1)
      ctx.fillStyle = css
      ctx.fillRect(0, 0, 1, 1)
      const d = ctx.getImageData(0, 0, 1, 1).data
      // getImageData returns NON-premultiplied channels. Dividing by alpha
      // here (the obvious-looking "un-premultiply") blows a 10%-opacity tint
      // up to near-white and reports a confident, completely wrong ratio —
      // the same class of trap docs/visual-validation.md records for
      // color-mix() parsing.
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
      const la = lum(a), lb = lum(b)
      return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
    }
    /** Every background layer above the element, composited down to opaque. */
    const bgOf = (el) => {
      const layers = []
      let n = el
      while (n) {
        const c = rgba(getComputedStyle(n).backgroundColor)
        if (c[3] > 0) layers.push(c)
        n = n.parentElement
      }
      layers.push(rgba('#000'))
      let base = layers[layers.length - 1].slice(0, 3)
      for (let i = layers.length - 2; i >= 0; i--) base = over(layers[i], base)
      return base
    }
    const check = (sel) => {
      const el = document.querySelector(sel)
      if (!el) return `${sel}: MISSING`
      const st = getComputedStyle(el)
      const bg = bgOf(el)
      const r = contrast(over(rgba(st.color), bg), bg)
      const size = parseFloat(st.fontSize)
      const floor = size >= 24 || (size >= 18.66 && Number(st.fontWeight) >= 700) ? 3 : 4.5
      return `${sel} ${st.fontSize}/${st.fontWeight} -> ${r.toFixed(2)}:1 ${r >= floor ? 'PASS' : 'FAIL'}`
    }
    const targets = [
      '.wb-approval-title', '.wb-approval-desc', '.wb-approval-keys',
      '.wb-approval-payload', '.wb-approval-details-toggle',
      '.wb-approval-note-verdict', '.wb-approval-note-payload', '.wb-approval-note-toggle',
      '.wb-change-card-title', '.wb-change-card-sub',
      '.wb-change-card-bulk-btn[data-kind="accept"]', '.wb-change-card-bulk-btn[data-kind="reject"]',
      '.wb-change-card-dir', '.wb-change-card-counts', '.wb-change-card-name',
      '.wb-activity-verb', '.wb-activity-detail'
    ]
    return { theme: document.documentElement.getAttribute('data-theme'), out: targets.map(check) }
  })
}
