// The context window as a ring (2026-09-13). Run AFTER tools/visual/boot.mjs.
//
//   run_code_unsafe --filename tools/visual/boot.mjs
//   run_code_unsafe --filename tools/visual/ring-pass.mjs
//
// Shoots the footer dial and the sheet's segmented one in three readings —
// comfortable, tight, and never-measured — plus a contrast sweep over the
// text the ring replaced the bar for. The theme is switched through the REAL
// topbar control, not localStorage, which the init script would overwrite.
//
// Theme is a constant INSIDE the function: this file is handed to the MCP tool
// as an expression, so a `const` at module top level breaks the parse.
async (page) => {
  const theme = 'dark'
  const OUT = '/home/gustavobgt/user-harness/hive/.playwright-mcp'

  if (theme !== 'dark') {
    await page.locator('.wb-icon-btn[aria-label^="Escolha do tema"]').click()
    await page.getByRole('menuitemradio', { name: { light: 'Claro', hive: 'Hive' }[theme] }).click()
    await page.waitForTimeout(250)
  }

  const box = page.locator('textarea').first()
  await box.click()
  await box.fill('Levanta os requisitos do módulo de faturamento e escreve o PRD')
  await page.keyboard.press('Enter')
  await page.waitForTimeout(200)

  const emit = (event) => page.evaluate((e) => window.__agentEvent(e), event)

  const feed = async (usage) => {
    await emit({ type: 'usage', final: true, usage })
    await page.waitForTimeout(500)
  }

  const results = []
  const assert = (name, ok, detail) => results.push({ name, ok: Boolean(ok), detail })

  const readRing = () =>
    page.evaluate(() => {
      const trigger = document.querySelector('.wb-ctx-meter')
      const ring = trigger?.querySelector('.hds-ring-meter')
      const arc = ring?.querySelector('.hds-ring-meter-arc')
      const circle = arc ? Number(arc.getAttribute('r')) * 2 * Math.PI : 0
      const dash = arc ? Number((arc.getAttribute('stroke-dasharray') ?? '0').split(' ')[0]) : 0
      return {
        exists: Boolean(ring),
        // The trigger has no linear bar left anywhere in it.
        noBar: trigger?.querySelector('.wb-ctx-meter-bar') === null,
        tone: ring?.getAttribute('data-tone') ?? null,
        // How much of the lap the arc actually covers.
        sweep: circle > 0 ? dash / circle : 0,
        size: ring ? Math.round(ring.getBoundingClientRect().width) : 0,
        label: trigger?.getAttribute('aria-label') ?? null,
        // A `meter` nested in a button would announce the reading twice.
        hidden: ring?.getAttribute('aria-hidden') === 'true',
        indeterminate: ring?.getAttribute('data-indeterminate') !== null
      }
    })

  const shootComposer = async (name) => {
    const rect = await page.locator('.wb-composer-wrap').boundingBox()
    await page.screenshot({
      path: `${OUT}/${name}-${theme}.png`,
      clip: { x: rect.x - 12, y: rect.y - 12, width: rect.width + 24, height: rect.height + 24 }
    })
  }

  // --- 1. a comfortable reading -------------------------------------------
  await feed({
    inputTokens: 812,
    cacheReadTokens: 61_400,
    cacheCreationTokens: 14_300,
    outputTokens: 1_240,
    model: 'claude-opus-5'
  })
  const calm = await readRing()
  assert('the footer meter is a ring, not a bar', calm.exists && calm.noBar, calm)
  assert('it is a 16px dial', calm.size === 16, calm.size)
  assert('the arc covers the share it reports', Math.abs(calm.sweep - 0.384) < 0.02, calm.sweep)
  assert('accent while there is room', calm.tone === 'accent', calm.tone)
  assert('the ring is hidden from AT — the button already says the reading', calm.hidden, calm)
  assert('and the button still carries it', /38%/.test(calm.label ?? ''), calm.label)
  await shootComposer('ring-footer')

  // --- 2. the sheet --------------------------------------------------------
  await page.locator('.wb-ctx-meter').click()
  await page.waitForTimeout(450)
  const sheet = await page.evaluate(() => {
    const ring = document.querySelector('.wb-ctx-ring')
    const arcs = [...(ring?.querySelectorAll('.hds-ring-meter-arc') ?? [])]
    const swatches = [...document.querySelectorAll('.wb-ctx-swatch')]
    const paint = (node) => getComputedStyle(node).stroke || getComputedStyle(node).backgroundColor
    return {
      runs: arcs.map((a) => a.getAttribute('data-seg')),
      // The ring's runs and the legend's swatches must name the same colours —
      // two surfaces reading one fact must not be able to drift.
      runPaints: arcs.map((a) => getComputedStyle(a).stroke),
      swatchPaints: swatches
        .filter((s) => s.getAttribute('data-seg') !== 'free')
        .map((s) => getComputedStyle(s).backgroundColor),
      face: ring?.querySelector('.hds-ring-meter-value')?.textContent ?? null,
      caption: ring?.querySelector('.hds-ring-meter-caption')?.textContent ?? null,
      valueNow: ring?.getAttribute('aria-valuenow') ?? null,
      valueText: ring?.getAttribute('aria-valuetext') ?? null,
      noLinearBar: document.querySelector('.wb-ctx-bar') === null,
      headline: document.querySelector('.wb-ctx-headline')?.innerText.replace(/\n/g, ' ') ?? null,
      // Does anything in the sheet ellipsise? The legend labels are the reason
      // the sheet got wider.
      clipped: [...document.querySelectorAll('.wb-ctx-legend-row dt')].filter(
        (dt) => dt.scrollWidth > dt.clientWidth + 1
      ).length
    }
  })
  assert('the sheet draws one segmented dial, not a linear bar', sheet.noLinearBar, sheet.noLinearBar)
  assert(
    'the three provenances are three runs of one lap',
    JSON.stringify(sheet.runs) === JSON.stringify(['cacheRead', 'cacheCreation', 'input']),
    sheet.runs
  )
  assert(
    'the legend names the colours the ring actually drew',
    JSON.stringify(sheet.runPaints) === JSON.stringify(sheet.swatchPaints),
    { ring: sheet.runPaints, legend: sheet.swatchPaints }
  )
  assert('the share is inside the ring', /%/.test(sheet.face ?? ''), sheet.face)
  assert('and the window size under it', /de /.test(sheet.caption ?? ''), sheet.caption)
  assert('the absolute count keeps its own noun', /tokens/.test(sheet.headline ?? ''), sheet.headline)
  assert('the dial is a named meter for AT', sheet.valueText !== null, sheet.valueText)
  assert('no legend label is clipped', sheet.clipped === 0, sheet.clipped)

  const sheetBox = await page.locator('.wb-ctx-detail').boundingBox()
  await page.screenshot({
    path: `${OUT}/ring-sheet-${theme}.png`,
    clip: { x: sheetBox.x - 16, y: sheetBox.y - 16, width: sheetBox.width + 32, height: sheetBox.height + 32 }
  })
  await page.keyboard.press('Escape')
  await page.waitForTimeout(250)

  // --- 3. near the ceiling -------------------------------------------------
  await feed({
    inputTokens: 4_000,
    cacheReadTokens: 168_000,
    cacheCreationTokens: 6_000,
    outputTokens: 900,
    model: 'claude-opus-5'
  })
  const tight = await readRing()
  assert('the ring turns at the app’s own threshold', tight.tone === 'warning', tight.tone)
  await shootComposer('ring-footer-tight')

  await page.locator('.wb-ctx-meter').click()
  await page.waitForTimeout(450)
  const tightSheet = await page.evaluate(() => ({
    ringTone: document.querySelector('.wb-ctx-ring')?.getAttribute('data-tone') ?? null,
    // A legend still painted accent under a warning ring names colours that
    // are not on screen.
    swatch: getComputedStyle(document.querySelector('.wb-ctx-swatch[data-seg="input"]')).backgroundColor,
    arc: getComputedStyle(document.querySelector('.hds-ring-meter-arc[data-seg="input"]')).stroke
  }))
  assert('the sheet’s dial turns with it', tightSheet.ringTone === 'warning', tightSheet.ringTone)
  assert('and its key turns too', tightSheet.swatch === tightSheet.arc, tightSheet)
  const tightBox = await page.locator('.wb-ctx-detail').boundingBox()
  await page.screenshot({
    path: `${OUT}/ring-sheet-tight-${theme}.png`,
    clip: { x: tightBox.x - 16, y: tightBox.y - 16, width: tightBox.width + 32, height: tightBox.height + 32 }
  })
  await page.keyboard.press('Escape')
  await page.waitForTimeout(250)

  // --- 4. nothing measured yet --------------------------------------------
  // A compaction whose agent reported no post-count leaves the occupancy
  // genuinely unknown — the state the meter used to answer by disappearing.
  await feed({
    inputTokens: 0,
    cacheReadTokens: 0,
    cacheCreationTokens: 0,
    outputTokens: 0,
    model: 'claude-opus-5'
  })
  const unread = await readRing()
  assert(
    'an unmeasured window keeps its place instead of vanishing',
    unread.exists && unread.indeterminate,
    unread
  )
  await shootComposer('ring-footer-unread')

  return { theme, results }
}
