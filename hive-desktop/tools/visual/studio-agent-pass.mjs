// Companion to tools/visual/boot.mjs — the visual + contrast pass for the
// Estúdio's builder picker (M26): who builds the skill, and therefore who the
// user goes on talking to in the conversation the build opens.
//
//   run_code_unsafe --filename tools/visual/boot.mjs
//   run_code_unsafe --filename tools/visual/studio-agent-pass.mjs
//
// Two states per theme: the create form with Claude selected (the app default)
// and with Copilot selected — which is also the state that proves the run
// config follows the agent, since Copilot's capabilities expose no effort.
// Screenshots land in `.playwright-mcp/m26-studio-<state>-<theme>.png`.
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

  const RUN = [
    '.wb-studio-run-legend',
    '.wb-studio-agent[aria-checked="true"] .wb-studio-agent-name',
    '.wb-studio-agent[aria-checked="false"] .wb-studio-agent-name',
    '.wb-studio-run-field label',
    '.wb-studio-run-field .hds-select-trigger'
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
      await page.locator('[aria-label^="Aparência (atual:"]').click()
      await page.waitForTimeout(200)
      await page.getByRole('menuitemradio', { name: theme === 'light' ? /Claro/ : /Hive/ }).click()
      await page.waitForTimeout(400)
    }

    // Into the Estúdio, then into the create form (the empty gallery's own CTA).
    await page.locator('[aria-label="Estúdio de skills"]').click()
    await page.waitForTimeout(700)
    await page.getByRole('button', { name: /Uma skill/ }).first().click()
    await page.waitForTimeout(500)
    await page.locator('.wb-studio-run').scrollIntoViewIfNeeded()
    await page.waitForTimeout(300)

    take(await measure('run-claude', RUN))
    await page.locator('.wb-studio-run').screenshot({ path: `${shots}/m26-studio-claude-${theme}.png` })

    await page.getByRole('radio', { name: /GitHub Copilot/ }).click()
    await page.waitForTimeout(600)
    take(await measure('run-copilot', RUN))
    await page.locator('.wb-studio-run').screenshot({ path: `${shots}/m26-studio-copilot-${theme}.png` })

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
