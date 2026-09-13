// The fence's copy control, in the three states a still frame cannot infer:
// at rest, under the pointer, and just after a copy. Run AFTER
// tools/visual/boot.mjs and tools/visual/round-2026-09-13b.mjs.
//
// Shoots fence-rest / fence-hover / fence-copied per theme, and returns what
// the control actually put on the clipboard — the assertion a screenshot
// cannot make.
async (page) => {
  const THEME = globalThis.HIVE_THEME || 'dark'
  const OUT = globalThis.HIVE_SHOT_DIR || '/home/gustavobgt/user-harness/hive/.playwright-mcp'

  // The app's clipboard goes through the Electron bridge (`ui/clipboard.ts`),
  // which in this harness is a mock — so the copy is observable.
  await page.evaluate(() => {
    globalThis.__copied = []
    window.hive.clipboard = { writeText: (t) => (globalThis.__copied.push(t), Promise.resolve()) }
  })

  const fence = page.locator('.hds-fence').first()
  const copy = fence.locator('.hds-fence-copy')
  const shoot = async (tag) => {
    const box = await fence.boundingBox()
    await page.screenshot({
      path: `${OUT}/round13b-${tag}-${THEME}.png`,
      clip: { x: box.x - 8, y: box.y - 8, width: box.width + 16, height: Math.min(140, box.height) }
    })
  }

  await page.mouse.move(10, 10)
  await page.waitForTimeout(250)
  await shoot('fence-rest')

  await copy.hover()
  await page.waitForTimeout(250)
  await shoot('fence-hover')

  await copy.click()
  await page.waitForTimeout(250)
  await shoot('fence-copied')

  // The "done" state is a tint carrying its own ink, which is exactly the pair
  // `--success-tint-ink` exists for (ink tuned against a surface is not
  // automatically legible on a tint of its own hue) — so it is measured, not
  // assumed, on the surface it actually lands on.
  const copiedRatio = await page.evaluate(() => {
    const paint = (css) => {
      const c = document.createElement('canvas')
      c.width = c.height = 1
      const ctx = c.getContext('2d', { willReadFrequently: true })
      ctx.clearRect(0, 0, 1, 1)
      ctx.fillStyle = css
      ctx.fillRect(0, 0, 1, 1)
      const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data
      return { r, g, b, a: a / 255 }
    }
    const over = (t, b) => ({
      r: t.r + (b.r - t.r) * (1 - t.a),
      g: t.g + (b.g - t.g) * (1 - t.a),
      b: t.b + (b.b - t.b) * (1 - t.a),
      a: 1
    })
    const el = document.querySelector('.hds-fence-copy')
    const layers = []
    for (let n = el; n; n = n.parentElement) {
      const bg = paint(getComputedStyle(n).backgroundColor)
      if (bg.a === 0) continue
      layers.push(bg)
      if (bg.a === 1) break
    }
    const bg = layers.reduceRight((acc, l) => (acc ? over(l, acc) : l), null)
    const fg = over(paint(getComputedStyle(el).color), bg)
    const lum = ({ r, g, b }) =>
      [r, g, b]
        .map((v) => v / 255)
        .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
        .reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0)
    const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x)
    return Math.round(((a + 0.05) / (b + 0.05)) * 100) / 100
  })

  return JSON.stringify(
    {
      theme: THEME,
      copiedRatio,
      copiedPasses: copiedRatio >= 4.5,
      label: (await copy.textContent())?.trim(),
      ariaLabel: await copy.getAttribute('aria-label'),
      clipboard: await page.evaluate(() => globalThis.__copied)
    },
    null,
    1
  )
}
