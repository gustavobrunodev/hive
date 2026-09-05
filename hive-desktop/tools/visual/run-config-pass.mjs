// Visual + functional pass for this round: the **run-config** on every surface
// that starts a session, the **engine pin**, and the ingestion sheet's named
// **Concluir**.
//
//   npx electron-vite build && python3 -m http.server 8123 -d out/renderer
//   HIVE_THEME=dark node tools/visual/run-scene.mjs tools/visual/run-config-pass.mjs
//   (repeat for light and hive — the pass is only closed when all three are)
//
// It drives production code end to end: the pin is written through the bridge
// mock and read back the way the app reads it, the take is real audio ticks
// through the real segmenter (the dictation E2E seam), and every measurement
// is taken off painted pixels rather than off tokens.
//
// What it proves, and what no unit test can:
//   1. pinning a row from the open panel does **not** also choose it, and the
//      pinned row is then hoisted under "Seu padrão" with the trigger marked;
//   2. the pin is what the next agent switch lands on — the setting is a
//      default, not a decoration;
//   3. the ingestion sheet and "Perguntar à base" both state, on screen, which
//      agent and model the session they launch will use;
//   4. a live take offers a named "Concluir" that keeps what was said;
//   5. every new surface clears its WCAG floor in this theme.
async (page) => {
  const theme = globalThis.HIVE_THEME || 'dark'
  const shot = (name) => page.screenshot({ path: `.playwright-mcp/runconfig-${theme}-${name}.png` })

  // The dictation seam has to be planted before the first script: the sheet
  // builds its engine in a `useMemo` at mount, so a global set afterwards is
  // read by nobody (the rule `live-dictation-pass.mjs` records).
  await page.addInitScript(() => {
    window.__hiveDictationE2E = { transcript: 'a squad decidiu versionar os specs', ticks: [], levels: [] }
    window.__speak = (ms, rms) => {
      const harness = window.__hiveDictationE2E
      for (let elapsed = 0; elapsed < ms; elapsed += 32) {
        const tick = { rms, samples: new Float32Array(512).fill(rms) }
        for (const listener of [...harness.ticks]) listener(tick)
      }
    }
  })
  await page.goto('http://localhost:8123/index.html')
  await page.waitForTimeout(1200)

  const out = []
  const say = (label, ok, detail) => {
    const line = `${ok ? 'PASS' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`
    out.push(line)
    console.log(line)
  }
  /**
   * Text of the first match, or `⌀` when it is not there. A probe that throws
   * on a missing element reports one line and hides every finding after it —
   * the pass is supposed to come back with the whole picture.
   */
  const text = async (selector) => {
    try {
      return (await page.locator(selector).first().innerText({ timeout: 1500 })).trim()
    } catch {
      return '⌀'
    }
  }

  // ---------------------------------------------------------------- the pin
  await page.locator('.wb-engine-btn').click()
  await page.waitForTimeout(400)
  await shot('1-picker-open')

  // The row's own pin, on a row that is NOT the one in use.
  //
  // Matched on the **label element**, not on the row's text: `hasText` is a
  // case-insensitive substring match, and the "Automático" row carries
  // `→ opus` as its resolved-id hint — so a `hasText: 'Opus'` row filter pins
  // the delegated row and every assertion after it reads as a product defect.
  const opusRow = page
    .locator('.hds-picker-item')
    .filter({ has: page.locator('.hds-picker-label', { hasText: /^Opus$/ }) })
    .first()
  await opusRow.hover()
  await opusRow.locator('.hds-picker-pin').click()
  await page.waitForTimeout(350)

  const pinned = await page.evaluate(() => window.hive.agent.pins())
  say('pin written for the agent', pinned['claude-cli'] !== undefined, JSON.stringify(pinned))
  const stillOpen = await page.locator('.hds-picker').count()
  say('panel stayed open (pinning is not choosing)', stillOpen === 1)
  const chosen = await text('.hds-picker-item[data-selected-option] .hds-picker-label')
  say('the chosen row did not move', chosen !== 'Opus', `chosen=${chosen}`)
  const heading = await text('.hds-picker-group [cmdk-group-heading]')
  // Compared case-insensitively: the heading is uppercased by CSS, and
  // `innerText` reports what is painted.
  say('pinned row hoisted under its own heading', /^seu padrão$/i.test(heading.trim()), heading)
  const firstRow = await text('.hds-picker-item')
  say('…and it is the first row', firstRow.includes('Opus'), firstRow.split('\n')[0])
  const footBtn = await text('.wb-engine-pin-btn')
  const footNow = await text('.wb-engine-pin-now')
  say('footer names the agent the default belongs to', /Claude/.test(footBtn), footBtn)
  say('…and says where the pin actually is', /Opus/.test(footNow), footNow)
  await shot('2-pinned')

  // The trigger, closed: the setting has to be visible without opening a panel.
  await page.keyboard.press('Escape')
  await page.waitForTimeout(250)
  say('closed trigger carries no pin mark while another model is in use',
    (await page.locator('.wb-engine-btn .wb-engine-pinned').count()) === 0)

  // ------------------------------------------------- the pin AS the default
  // Switching agent and back re-reads capabilities, which is where a default
  // is applied. Nothing was picked by hand, so the pin is what must win.
  const switchTo = async (name) => {
    await page.locator('.wb-agent-pill-btn').click()
    await page.waitForTimeout(250)
    await page.getByRole('menuitemradio', { name }).click()
    await page.waitForTimeout(600)
  }
  await switchTo('GitHub Copilot')
  await switchTo('Claude Code')
  const triggerName = await text('.wb-engine-name')
  say('a fresh read of the agent lands on the pinned model', triggerName === 'Opus', triggerName)
  say('closed trigger marks it as the pinned default',
    (await page.locator('.wb-engine-btn .wb-engine-pinned').count()) === 1)
  await shot('3-trigger-pinned')

  // ------------------------------------------------------- ingestion sheet
  await page.evaluate(() => window.__setVault({ rawPending: 0 }))
  await page.waitForTimeout(300)
  await page.locator('[class*="fab"]').first().click()
  await page.waitForTimeout(250)
  await page.getByRole('menuitem', { name: 'Ditar ao vivo' }).click()
  await page.waitForTimeout(600)

  const ingestLegend = await text('.wb-brain-ingest .wb-runconfig-legend')
  say('the sheet says who will document', ingestLegend === 'Quem vai documentar', ingestLegend)
  say('…with the agent switcher', (await page.locator('.wb-brain-ingest .wb-agent-pill').count()) > 0)
  const sheetEngine = await text('.wb-brain-ingest .wb-engine-btn')
  say('…and the engine control, opened on the pinned default', /Opus/.test(sheetEngine), sheetEngine.replace(/\n/g, ' '))
  await shot('4-ingest-sheet')

  // The engine panel **inside** a Sheet: a Radix popover portals out of the
  // sheet's DOM, so two things can go wrong that never show up in the
  // composer — the panel can be placed off-screen against the right edge, and
  // the sheet's focus trap can pull focus back out of the panel's filter
  // field, leaving a control that opens and cannot be typed into.
  await page.locator('.wb-brain-ingest .wb-engine-btn').click()
  await page.waitForTimeout(400)
  const box = await page.locator('.hds-picker').boundingBox()
  const viewport = page.viewportSize()
  say(
    'the sheet’s engine panel lands inside the viewport',
    box !== null && box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width + 1,
    box && `x=${Math.round(box.x)} w=${Math.round(box.width)} vw=${viewport.width}`
  )
  const before = await page.locator('.hds-picker-item').count()
  await page.keyboard.type('son')
  await page.waitForTimeout(300)
  const typed = await page.locator('.hds-picker-input').inputValue()
  const filtered = await page.locator('.hds-picker-item').count()
  // Not "exactly one row": cmdk's filter is a fuzzy subsequence match, so
  // "son" legitimately keeps `Opus Plan` too. What is being proven is that the
  // keystrokes reached the panel at all — i.e. the sheet's focus trap did not
  // pull focus back out of a control that had just opened.
  say(
    '…and its filter field keeps focus inside the sheet',
    typed === 'son' && filtered < before,
    `"${typed}" · ${before} → ${filtered} linhas`
  )
  await shot('4b-sheet-picker')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)

  // A real take, through the real segmenter.
  await page.locator('.wb-live-btn').click()
  await page.waitForTimeout(300)
  await page.evaluate(() => window.__speak(100, 0.002))
  await page.evaluate(() => window.__speak(1400, 0.4))
  await page.waitForTimeout(400)
  const finish = page.locator('.wb-live-action[data-emphasis="primary"]')
  say('a live take offers a named Concluir', (await finish.count()) === 1, await text('.wb-live-action[data-emphasis="primary"]'))
  await shot('5-live-take')

  await page.evaluate(() => window.__speak(1500, 0.002))
  await page.waitForTimeout(600)
  await finish.click()
  await page.waitForTimeout(900)
  const kept = await page.locator('.wb-brain-ingest textarea').first().inputValue().catch(() => '')
  say('…and it keeps what was said', kept.trim().length > 0, kept.slice(0, 60))
  say('…and ends the take', (await page.locator('.wb-live-action[data-emphasis="primary"]').count()) === 0)
  await shot('6-after-concluir')

  // ------------------------------------------------------ perguntar à base
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)
  await page.keyboard.press('Control+Shift+K')
  await page.waitForTimeout(700)
  const askLegend = await text('.wb-brain-ask-dialog .wb-runconfig-legend')
  say('the ask dialog says who will answer', askLegend === 'Quem vai responder', askLegend)
  const askEngine = await text('.wb-brain-ask-dialog .wb-engine-btn')
  say('…on the pinned default too', /Opus/.test(askEngine), askEngine.replace(/\n/g, ' '))
  await shot('7-ask-dialog')

  // Escape belongs to the innermost thing that is open. This dialog *also*
  // intercepts Escape (a live take rewinds instead of closing the surface), so
  // a popover opened inside it is exactly where two handlers could fight and
  // take the whole dialog — with the typed question — down with them.
  await page.locator('.wb-brain-ask-dialog .wb-engine-btn').click()
  await page.waitForTimeout(400)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)
  say('Escape closes the engine panel and leaves the dialog standing',
    (await page.locator('.hds-picker').count()) === 0 &&
      (await page.locator('.wb-brain-ask-dialog').count()) === 1)

  // ------------------------------------------------------------- contrast
  // Painted pixels, composited up the ancestor chain: every new surface here
  // sits on a tint (`--selected-bg`, an accent `color-mix`), and a naive read
  // measures text against a colour no pixel actually has. Tokens authored in
  // `oklch()`/`oklab()` are parsed rather than skipped — a skipped sample
  // looks exactly like a passing one.
  const probe = async (targets, label) =>
    page.evaluate(
      ({ targets, label }) => {
        const oklabToRgb = (L, A, B, alpha) => {
          const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3
          const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3
          const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3
          const lin = [
            +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
            -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
            -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s
          ]
          return {
            rgb: lin.map((c) => {
              const v = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(Math.max(c, 0), 1 / 2.4) - 0.055
              return Math.min(255, Math.max(0, v * 255))
            }),
            a: alpha
          }
        }
        const parse = (value) => {
          const text = String(value).trim().toLowerCase()
          const rgb = text.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)\s*(?:[,/]\s*([\d.]+))?\s*\)$/)
          if (rgb)
            return { rgb: [rgb[1], rgb[2], rgb[3]].map(Number), a: rgb[4] === undefined ? 1 : Number(rgb[4]) }
          const oklch = text.match(/^oklch\(([\d.eE+-]+%?)\s+([\d.eE+-]+)\s+([\d.eE+-]+)(?:\s*\/\s*([\d.]+%?))?\)$/)
          if (oklch) {
            const L = oklch[1].endsWith('%') ? Number(oklch[1].slice(0, -1)) / 100 : Number(oklch[1])
            const C = Number(oklch[2])
            const h = (Number(oklch[3]) * Math.PI) / 180
            const alpha =
              oklch[4] === undefined ? 1 : oklch[4].endsWith('%') ? Number(oklch[4].slice(0, -1)) / 100 : Number(oklch[4])
            return oklabToRgb(L, C * Math.cos(h), C * Math.sin(h), alpha)
          }
          const oklab = text.match(/^oklab\(([\d.eE+-]+%?)\s+([\d.eE+-]+)\s+([\d.eE+-]+)(?:\s*\/\s*([\d.]+))?\)$/)
          if (oklab) {
            const L = oklab[1].endsWith('%') ? Number(oklab[1].slice(0, -1)) / 100 : Number(oklab[1])
            return oklabToRgb(L, Number(oklab[2]), Number(oklab[3]), oklab[4] === undefined ? 1 : Number(oklab[4]))
          }
          const hex = text.match(/^#([0-9a-f]{6})$/)
          if (hex) return { rgb: [0, 2, 4].map((i) => parseInt(hex[1].slice(i, i + 2), 16)), a: 1 }
          return null
        }
        const lum = (rgb) => {
          const [r, g, b] = rgb.map((ch) => {
            const c = ch / 255
            return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
          })
          return 0.2126 * r + 0.7152 * g + 0.0722 * b
        }
        const bgOf = (el) => {
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
        const results = []
        for (const [selector, kind] of targets) {
          const el = document.querySelector(selector)
          if (!el) {
            results.push(`${label} ${selector}: ABSENT`)
            continue
          }
          const cs = getComputedStyle(el)
          const fg = parse(cs.color)
          const bg = bgOf(el)
          if (!fg || !bg) {
            results.push(`${label} ${selector}: UNMEASURED (${cs.color})`)
            continue
          }
          const composited = fg.a >= 1 ? fg.rgb : fg.rgb.map((c, i) => c * fg.a + bg[i] * (1 - fg.a))
          const a = lum(composited)
          const b = lum(bg)
          const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
          // A glyph is a non-text mark and takes the 3:1 UI floor; everything
          // else here is read text at the 4.5:1 body floor.
          const floor = kind === 'mark' ? 3 : 4.5
          results.push(
            `${label} ${selector} → ${ratio.toFixed(2)}:1 (floor ${floor}) ${ratio >= floor ? 'PASS' : 'FAIL'}`
          )
        }
        return results
      },
      { targets, label }
    )

  out.push(...(await probe([['.wb-runconfig-legend', 'text'], ['.wb-engine-name', 'text']], 'ask')))

  // Back to the composer's panel for the pin's own surfaces.
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)
  await page.locator('.wb-engine-btn').first().click()
  await page.waitForTimeout(400)
  out.push(
    ...(await probe(
      [
        ['.hds-picker-group [cmdk-group-heading]', 'text'],
        ['.hds-picker-pin[data-pinned]', 'mark'],
        ['.wb-engine-pin-btn[data-on]', 'text'],
        ['.hds-picker-item[data-selected-option] .hds-picker-label', 'text']
      ],
      'picker'
    ))
  )
  await shot('8-picker-pinned')

  return out.join('\n')
}
