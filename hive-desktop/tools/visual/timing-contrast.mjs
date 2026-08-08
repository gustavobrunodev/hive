// Contrast probe over the surfaces chat-timing / chat-queue / session-usage
// added: the per-step clock, the turn meter (live and settled), the queue
// strip, the composer's context meter and its detail sheet.
//
// Same three traps as tools/visual/transcript-contrast.mjs (see its header):
// colours are resolved by painting a pixel (oklch/color-mix do not round-trip
// through getComputedStyle), every background layer is composited to opaque
// before measuring, and getImageData is read WITHOUT un-premultiplying.
//
// Run after boot.mjs + chat-timing.mjs, with the context sheet open.
async (page) => {
  return await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 1
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    const rgba = (css) => {
      ctx.clearRect(0, 0, 1, 1)
      ctx.fillStyle = css
      ctx.fillRect(0, 0, 1, 1)
      const d = ctx.getImageData(0, 0, 1, 1).data
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
      '.wb-activity-time',
      '.wb-turn-meter[data-live] .wb-turn-meter-lead',
      '.wb-turn-meter[data-live] .wb-turn-meter-stat',
      '.wb-turn-meter:not([data-live]) .wb-turn-meter-lead',
      '.wb-turn-meter:not([data-live]) .wb-turn-meter-stat',
      '.wb-queue-title',
      '.wb-queue-action',
      '.wb-queue-index',
      '.wb-queue-text',
      '.wb-queue-attachments',
      '.wb-ctx-meter',
      '.wb-ctx-meter-value',
      '.wb-ctx-detail-title',
      '.wb-ctx-model',
      '.wb-ctx-used',
      '.wb-ctx-window',
      '.wb-ctx-percent',
      '.wb-ctx-legend-row dt',
      '.wb-ctx-legend-tokens',
      '.wb-ctx-legend-share',
      '.wb-ctx-note',
      '.wb-ctx-total dt',
      '.wb-ctx-total dd',
      '.wb-ctx-advice p',
      '.wb-ctx-advice-cta'
    ]
    return { theme: document.documentElement.getAttribute('data-theme'), out: targets.map(check) }
  })
}
