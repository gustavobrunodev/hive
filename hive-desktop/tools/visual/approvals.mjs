// Companion to tools/visual/boot.mjs — run it once, after boot. Drives the two
// states the session-wide grant added (agent-approvals) and measures WCAG
// contrast on each, in all three themes, leaving a screenshot per state.
//
// The states, and what each is for:
//
//   1. **pending card, with the session row** — the three answers about *this*
//      call, plus, under a hairline, the one answer that turns the asking off.
//      What the shot has to prove is the ranking: the blanket grant must not
//      read as a fourth peer button.
//   2. **granted** — both cards closed as answered notes and the composer
//      carrying the standing chip with its undo. A blanket permission with no
//      visible state is one the user forgets they gave.
//
// Same disciplines as tools/visual/mcp-visibility.mjs: themes are switched
// through the app's own Aparência menu (never localStorage, which boot.mjs
// re-pins on navigation), and colours are sampled by painting a pixel (never
// by regex, which silently skips oklch() and color-mix()).
//
// Floors: 4.5:1 for text, 3:1 for meaningful non-text.
async (page) => {
  const SHOT_DIR = '/home/gustavobgt/user-harness/hive/hive-desktop/.playwright-mcp'

  const seed = async () => {
    await page.evaluate(() => {
      window.__agentEvent?.({ type: 'token', text: 'Vou preparar o ambiente do projeto.' })
      window.__agentEvent?.({
        type: 'approval',
        requestId: 'req-1',
        tool: 'Bash',
        detail: 'npm ci --prefer-offline',
        input: { command: 'npm ci --prefer-offline', description: 'Instala as dependências' }
      })
      window.__agentEvent?.({
        type: 'approval',
        requestId: 'req-2',
        tool: 'WebFetch',
        detail: 'https://registry.npmjs.org/@hive/design-system',
        input: { url: 'https://registry.npmjs.org/@hive/design-system' }
      })
    })
    await page.waitForTimeout(400)
  }

  // By index, not by name: "Escuro" is also a word inside the Hive item's
  // description, and a name matcher picks the wrong row. THEMES order is
  // dark, light, hive (src/renderer/src/ui/theme.ts).
  const THEME_INDEX = { dark: 0, light: 1, hive: 2 }
  const setTheme = async (key) => {
    // Blur, never Escape: a pending approval card takes focus on mount and
    // reads Escape as "Recusar" — a probe that closes menus with Escape
    // silently answers the very card it came to photograph.
    await page.evaluate(() => document.activeElement?.blur())
    await page.waitForTimeout(150)
    await page.locator('button[aria-label^="Aparência"]').first().click()
    await page.waitForTimeout(250)
    await page.locator('[role="menuitemradio"]').nth(THEME_INDEX[key]).click()
    await page.waitForTimeout(350)
  }

  const measure = async (selectors) =>
    await page.evaluate((sel) => {
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
      // Start the stack at the element itself: a tinted pill measured against
      // its parent is measured against the wrong ground.
      const backdrop = (node) => {
        const stack = []
        for (let el = node; el; el = el.parentElement) {
          const bg = paint(getComputedStyle(el).backgroundColor)
          if (bg.a === 0) continue
          stack.push(bg)
          if (bg.a === 1) break
        }
        let base = [255, 255, 255]
        for (let i = stack.length - 1; i >= 0; i -= 1) base = over(stack[i], base)
        return base
      }
      const out = {}
      for (const s of sel) {
        const el = document.querySelector(s)
        if (!el) {
          out[s] = 'absent'
          continue
        }
        const style = getComputedStyle(el)
        const fg = paint(style.color)
        // From the element itself: a tinted pill's own background IS the
        // ground its text sits on (docs/visual-validation.md, the tray probe's
        // lesson) — starting at the parent measures the wrong surface.
        const bg = backdrop(el)
        out[s] = {
          ratio: Number(ratio(over(fg, bg), bg).toFixed(2)),
          px: Number(parseFloat(style.fontSize).toFixed(1))
        }
      }
      return out
    }, selectors)

  const PENDING = [
    '.wb-approval-title',
    '.wb-approval-desc',
    '.wb-approval-session-cta',
    '.wb-approval-session-hint',
    '.wb-approval-keys'
  ]
  const GRANTED = ['.wb-approval-session-chip', '.wb-approval-session-chip-cta']

  const report = {}
  await seed()
  for (const key of ['dark', 'light', 'hive']) {
    if (key !== 'dark') await setTheme(key)
    report[`${key}/pending`] = await measure(PENDING)
    await page.screenshot({ path: `${SHOT_DIR}/approval-pending-${key}.png` })
  }

  // Grant it, then look at the standing state in the theme we ended on.
  await page.locator('.wb-approval-session-cta').first().click()
  await page.waitForTimeout(400)
  for (const key of ['hive', 'dark', 'light']) {
    if (key !== 'hive') await setTheme(key)
    report[`${key}/granted`] = await measure(GRANTED)
    await page.screenshot({ path: `${SHOT_DIR}/approval-granted-${key}.png` })
  }
  return report
}
