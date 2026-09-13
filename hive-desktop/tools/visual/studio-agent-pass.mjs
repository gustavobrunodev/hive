// The visual + contrast pass for the Estúdio's builder picker: who builds the
// skill, and therefore who the user goes on talking to in the conversation the
// build opens.
//
//   npx electron-vite build && python3 -m http.server 8123 -d out/renderer
//   node tools/visual/run-scene.mjs tools/visual/studio-agent-pass.mjs
//
// Two states per theme: the create form with Claude selected (the app default)
// and with Copilot selected — which is also the state that proves the run
// config follows the agent, since Copilot's capabilities expose no effort.
// Screenshots land in `.playwright-mcp/studio-run-<state>-<theme>.png`.
//
// **Its targets went stale once, and it stayed green.** This pass was written
// against a bespoke `.wb-studio-run` block with `.wb-studio-agent` radios; that
// form was replaced by the shared `RunConfigBar` (the composer's own controls),
// and every selector here started reporting `missing` — which the verdict read
// as "nothing to fix". So it now measures the shared control's classes, and
// `missing` is a **failure**, not a skip. See `docs/visual-validation.md`.
async (page) => {
  const shots = '/home/gustavobgt/user-harness/hive/.playwright-mcp'
  const THEMES = ['dark', 'light', 'hive']

  const measure = async (state, targets) =>
    await page.evaluate(
      ({ state, targets }) => {
        const cv = document.createElement('canvas')
        cv.width = cv.height = 1
        const ctx = cv.getContext('2d', { willReadFrequently: true })
        function parse(value) {
          const text = String(value).trim()
          if (text === '' || text === 'transparent') return { rgb: [0, 0, 0], a: 0 }
          ctx.clearRect(0, 0, 1, 1)
          ctx.fillStyle = '#010203'
          ctx.fillStyle = text
          if (ctx.fillStyle === '#010203' && text !== '#010203') return null
          ctx.clearRect(0, 0, 1, 1)
          ctx.fillRect(0, 0, 1, 1)
          const d = ctx.getImageData(0, 0, 1, 1).data
          return { rgb: [d[0], d[1], d[2]], a: d[3] / 255 }
        }
        function lum(rgb) {
          const [r, g, b] = rgb.map((ch) => {
            const c = ch / 255
            return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
          })
          return 0.2126 * r + 0.7152 * g + 0.0722 * b
        }
        function bgOf(el) {
          const layers = []
          let node = el
          while (node) {
            const parsed = parse(getComputedStyle(node).backgroundColor)
            if (parsed && parsed.a > 0) layers.push(parsed)
            node = node.parentElement
          }
          if (layers.length === 0) return null
          let base = layers[layers.length - 1].rgb
          for (let i = layers.length - 2; i >= 0; i--) {
            const { rgb, a } = layers[i]
            base = base.map((channel, idx) => rgb[idx] * a + channel * (1 - a))
          }
          return base
        }
        const failures = []
        const missing = []
        for (const selector of targets) {
          const el = document.querySelector(selector)
          if (el === null) {
            missing.push(`${state} ${selector}`)
            continue
          }
          const style = getComputedStyle(el)
          const fg = parse(style.color)
          const bg = bgOf(el)
          if (fg === null || bg === null) {
            missing.push(`${state} ${selector} UNMEASURED`)
            continue
          }
          const composited = fg.a >= 1 ? fg.rgb : fg.rgb.map((c, i) => c * fg.a + bg[i] * (1 - fg.a))
          const ratio =
            (Math.max(lum(composited), lum(bg)) + 0.05) / (Math.min(lum(composited), lum(bg)) + 0.05)
          const px = parseFloat(style.fontSize)
          const bold = Number(style.fontWeight) >= 700
          const floor = px >= 24 || (bold && px >= 18.66) ? 3 : 4.5
          if (ratio < floor) {
            failures.push(`${state} ${selector} ${style.fontSize} → ${ratio.toFixed(2)}:1`)
          }
        }
        return { failures, missing }
      },
      { state, targets }
    )

  /** The shared run-config's own classes — the controls the composer uses. */
  const RUN = [
    '.wb-studio-dialog .wb-runconfig-legend',
    '.wb-studio-dialog .wb-agent-pill-name',
    '.wb-studio-dialog .wb-engine-name',
    '.wb-studio-dialog .wb-studio-handoff'
  ]

  async function sweep(theme) {
    const failures = []
    const missing = []
    const take = (r) => {
      failures.push(...r.failures)
      missing.push(...r.missing)
    }

    await page.reload()
    await page.waitForTimeout(1400)
    if (theme !== 'dark') {
      await page.locator('[aria-label^="Escolha do tema (atual:"]').click()
      await page.waitForTimeout(200)
      await page.getByRole('menuitemradio', { name: theme === 'light' ? /^Claro/ : /^Hive/ }).click()
      await page.waitForTimeout(400)
    }

    // Into the Estúdio, then into the create form (whichever entry point this
    // workspace has — the empty gallery teaches with cards, a populated one
    // puts the two CTAs in the header).
    await page.getByRole('tab', { name: 'Chat' }).click()
    await page.waitForTimeout(250)
    await page.locator('button[data-tour="studio"]').click()
    await page.waitForTimeout(700)
    await page
      .getByRole('button', { name: /Uma skill|Nova skill/ })
      .first()
      .click()
    await page.waitForTimeout(500)
    await page.locator('.wb-runconfig').scrollIntoViewIfNeeded()
    await page.waitForTimeout(300)

    take(await measure('run-claude', RUN))
    await page.locator('.wb-runconfig').screenshot({ path: `${shots}/studio-run-claude-${theme}.png` })

    // The agent, picked through the real control (a dropdown, not radios).
    await page.locator('.wb-studio-dialog .wb-agent-pill-btn').click()
    await page.waitForTimeout(300)
    await page.getByRole('menuitemradio', { name: /Copilot/ }).click()
    await page.waitForTimeout(800)
    take(await measure('run-copilot', RUN))
    await page
      .locator('.wb-runconfig')
      .screenshot({ path: `${shots}/studio-run-copilot-${theme}.png` })

    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
    return { theme, failures, missing }
  }

  const results = []
  for (const theme of THEMES) results.push(await sweep(theme))
  const verdict = results.every((r) => r.failures.length === 0 && r.missing.length === 0)
    ? 'PASS'
    : 'FAIL'
  return { verdict, results }
}
