// Companion to tools/visual/boot.mjs — the contrast pass for the profile sheet
// and its "Voz e transcrição" scope (voice-settings M25, rebuilt in M26).
//
//   npx electron-vite build && python3 -m http.server 8123 -d out/renderer
//   run_code_unsafe --filename tools/visual/boot.mjs
//   run_code_unsafe --filename tools/visual/profile-voice-pass.mjs
//
// It boots ONCE and switches theme through the real "Aparência" menu inside
// the same file — setting `globalThis.HIVE_THEME` in one call and running the
// file in the next measures the boot default three times
// (docs/visual-validation.md, M15/M16).
//
// Seven states per theme: the index, the library with models installed, a
// pinned (non-automatic) model, a download in flight, a download that stopped,
// the **empty** library a fresh install now opens on (the app ships no weights
// since M26), and the terminal scope.
//
// The last two are driven through the harness fixtures the boot mock plants —
// `window.__HIVE_MODELS` / `window.__HIVE_PREF` for the catalog, and
// `window.__downloads(list)` for a live transfer — because both are states no
// click sequence can reach in under twenty minutes.
// Screenshots land in `.playwright-mcp/m26-<state>-<theme>.png`.
async (page) => {
  const shots = '/home/gustavobgt/user-harness/hive/.playwright-mcp'
  const THEMES = ['dark', 'light', 'hive']

  const measure = async (state, targets, nonText = []) =>
    await page.evaluate(
      ({ state, targets, nonText }) => {
        // Any CSS colour → sRGB + alpha, by letting the canvas do the
        // conversion. Hand-written regexes silently report UNMEASURED for
        // `oklch()` and `oklab()` — which is most of this palette, including
        // `--accent-tint-ink` and every `color-mix()` tint on this surface.
        const cv = document.createElement('canvas')
        cv.width = cv.height = 1
        const ctx = cv.getContext('2d', { willReadFrequently: true })
        function parse(value) {
          const text = String(value).trim()
          if (text === '' || text === 'transparent') return { rgb: [0, 0, 0], a: 0 }
          ctx.clearRect(0, 0, 1, 1)
          // Seed with a known colour: an unparseable value leaves `fillStyle`
          // at its previous setting rather than throwing, and this makes that
          // case observable instead of silently black.
          ctx.fillStyle = '#010203'
          ctx.fillStyle = text
          if (ctx.fillStyle === '#010203' && text !== '#010203') return null
          ctx.clearRect(0, 0, 1, 1)
          ctx.fillRect(0, 0, 1, 1)
          const d = ctx.getImageData(0, 0, 1, 1).data
          // `getImageData` hands back UN-premultiplied RGBA, so the channels
          // are already the source colour. Dividing by alpha here is a second
          // correction that blows a 16% tint out to near-white.
          return { rgb: [d[0], d[1], d[2]], a: d[3] / 255 }
        }
        function lum(rgb) {
          const [r, g, b] = rgb.map((ch) => {
            const c = ch / 255
            return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
          })
          return 0.2126 * r + 0.7152 * g + 0.0722 * b
        }
        /**
         * The pixel actually behind `el`. Starts at the element ITSELF, not at
         * its parent: a tinted pill measured against its grandparent's surface
         * is measured against a colour that is not on screen.
         */
        function bgOf(el, includeSelf) {
          const layers = []
          let node = includeSelf ? el : el.parentElement
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
        function ratioOf(fg, bg) {
          const composited = fg.a >= 1 ? fg.rgb : fg.rgb.map((c, i) => c * fg.a + bg[i] * (1 - fg.a))
          const a = lum(composited)
          const b = lum(bg)
          return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
        }

        const failures = []
        const missing = []
        for (const selector of targets) {
          const el = document.querySelector(selector)
          if (el === null) {
            // A skipped sample and a passing sample look identical in a report
            // unless the skip is reported separately — so it is.
            missing.push(`${state} ${selector}`)
            continue
          }
          const style = getComputedStyle(el)
          const fg = parse(style.color)
          const bg = bgOf(el, true)
          if (fg === null || bg === null) {
            missing.push(`${state} ${selector} UNMEASURED`)
            continue
          }
          const ratio = ratioOf(fg, bg)
          const px = parseFloat(style.fontSize)
          const bold = Number(style.fontWeight) >= 700
          const floor = px >= 24 || (bold && px >= 18.66) ? 3 : 4.5
          if (ratio < floor) {
            failures.push(
              `${state} ${selector} ${style.fontSize} → ${ratio.toFixed(2)}:1 (floor ${floor})`
            )
          }
        }
        // Non-text carriers — the radio ring, the progress fill, the chevron —
        // owe the 3:1 floor, and they carry `background`/`box-shadow` rather
        // than `color`, so they are read differently.
        for (const { selector, prop } of nonText) {
          const el = document.querySelector(selector)
          if (el === null) {
            missing.push(`${state} ${selector}`)
            continue
          }
          const style = getComputedStyle(el)
          const raw = prop === 'ring' ? style.boxShadow.match(/(oklch|oklab|rgba?|#)[^)]*\)?/)?.[0] : style[prop]
          const fg = parse(raw)
          const bg = bgOf(el, false)
          if (fg === null || bg === null) {
            missing.push(`${state} ${selector} UNMEASURED`)
            continue
          }
          const ratio = ratioOf(fg, bg)
          if (ratio < 3) failures.push(`${state} ${selector} [${prop}] → ${ratio.toFixed(2)}:1 (floor 3)`)
        }
        return { failures, missing }
      },
      { state, targets, nonText }
    )

  const INDEX = [
    '.wb-pnav-avatar',
    '.wb-pnav-name',
    '.wb-pnav-role',
    '.wb-pnav-label',
    '.wb-pnav-value',
    '.wb-pnav-tour-title',
    '.wb-pnav-tour-hint',
    '.wb-profile-scope-note',
    '.hds-sheet-title',
    '.hds-sheet-description'
  ]
  const INDEX_NON_TEXT = [{ selector: '.wb-pnav-chevron', prop: 'color' }]

  const VOICE = [
    '.wb-profile-back',
    '.wb-voice-lead',
    '.wb-machine-title',
    '.wb-machine-fact dt',
    '.wb-machine-fact dd',
    '.wb-machine-fact dd[data-strong]',
    // What is transcribing right now — the answer this screen owes first.
    '.wb-vinforce-label',
    '.wb-vinforce-name',
    '.wb-vinforce-mode',
    // The two lists.
    '.wb-vsection-title',
    '.wb-vsection-note',
    '.wb-vrow-name',
    '.wb-vrow-tradeoff',
    '.wb-vrow-facts',
    '.wb-vbadge',
    '.wb-vbadge-quiet',
    '.wb-vmeter-label',
    '.wb-vbtn-primary',
    '.wb-vicon-btn'
  ]
  // Non-text carriers owe the 3:1 floor on their own: the radio ring, the
  // filled meter step (which IS the reading), the live "em uso" dot and the
  // progress fill. An empty meter step is the absence of a reading, not a
  // second one, so it is deliberately not measured.
  const VOICE_NON_TEXT = [
    { selector: '.wb-vopt[data-state="checked"] .wb-vopt-dot', prop: 'borderColor' },
    { selector: '.wb-vmeter-step[data-on]', prop: 'backgroundColor' },
    { selector: '.wb-vinforce-dot', prop: 'backgroundColor' }
  ]

  // The "why" sentence belongs to the AUTOMATIC state only — a pinned model
  // was not explained by a probe, so measuring it in the pinned/downloading
  // states would report `missing` for a line that is correctly absent.
  const VOICE_AUTO = [...VOICE, '.wb-vinforce-why']

  const DOWNLOADING = [
    ...VOICE,
    '.wb-vdl-numbers',
    '.wb-vdl-pct',
    '.wb-vdl-meta',
    '.wb-vlink-quiet'
  ]
  const DOWNLOADING_NON_TEXT = [
    ...VOICE_NON_TEXT,
    { selector: '.wb-vdl-fill', prop: 'backgroundColor' }
  ]
  const FAILED = [...VOICE, '.wb-vfail-text', '.wb-vfail-resume', '.wb-vfail .wb-vbtn']
  // The empty state has no "em uso" block and no installed list, so it carries
  // its own list rather than extending VOICE — a selector that never renders
  // reports `missing`, which is noise rather than a finding (M19).
  const EMPTY = [
    '.wb-profile-back',
    '.wb-voice-lead',
    '.wb-machine-title',
    '.wb-machine-fact dd',
    '.wb-vempty-title',
    '.wb-vempty-text',
    '.wb-vpick-eyebrow',
    '.wb-vrow-name[data-lg]',
    '.wb-vrow-tradeoff',
    '.wb-vrow-facts',
    '.wb-vmeter-label',
    '.wb-vbtn-wide',
    '.wb-vsection-title',
    '.wb-vsection-note'
  ]
  const EMPTY_NON_TEXT = [{ selector: '.wb-vmeter-step[data-on]', prop: 'backgroundColor' }]

  /** One in-flight download, as main broadcasts it. */
  const LIVE_DOWNLOAD = {
    id: 'medium',
    variant: 'fp32',
    status: 'downloading',
    loaded: 1288490188,
    total: 3205496832,
    file: 'onnx/encoder_model.onnx',
    bytesPerSecond: 2411724,
    failure: null,
    startedAt: 0,
    updatedAt: 0
  }

  async function openSheet() {
    await page.click('[aria-label="Abrir configurações de perfil"]')
    await page.waitForTimeout(500)
  }
  async function openVoice() {
    await page.click('button.wb-pnav-row[data-scope="voice"]')
    await page.waitForTimeout(600)
  }
  async function back() {
    await page.click('[aria-label="Voltar para a lista de configurações"]')
    await page.waitForTimeout(400)
  }
  const sheet = () => page.locator('.wb-profile-sheet')

  async function sweep(theme) {
    const failures = []
    const missing = []
    const take = async (result) => {
      failures.push(...result.failures)
      missing.push(...result.missing)
    }

    await page.reload()
    await page.waitForTimeout(1200)
    if (theme !== 'dark') {
      // Driven through the app's own control. A probe that sets what the boot
      // harness also sets measures the harness default three times (M15).
      await page.locator('[aria-label^="Aparência (atual:"]').click()
      await page.waitForTimeout(200)
      await page.getByRole('menuitemradio', { name: theme === 'light' ? /Claro/ : /Hive/ }).click()
      await page.waitForTimeout(400)
    }

    // 1. The index.
    await openSheet()
    await take(await measure('index', INDEX, INDEX_NON_TEXT))
    await sheet().screenshot({ path: `${shots}/m26-index-${theme}.png` })

    // 2. The library, with models installed and the choice on automatic.
    await openVoice()
    await take(await measure('voice', VOICE_AUTO, VOICE_NON_TEXT))
    await sheet().screenshot({ path: `${shots}/m26-voice-${theme}.png`, fullPage: false })

    // 3. A pinned model — the "em uso" block changes, and so does the checked row.
    await page.locator('.wb-vopt[value="tiny"]').click()
    await page.waitForTimeout(400)
    await take(await measure('pinned', VOICE, VOICE_NON_TEXT))
    await sheet().screenshot({ path: `${shots}/m26-pinned-${theme}.png` })

    // 4. A download in flight. Pushed through the broadcast the real manager
    // uses, because reaching this state by clicking takes twenty minutes.
    await page.evaluate((d) => window.__downloads([d]), LIVE_DOWNLOAD)
    await page.waitForTimeout(400)
    await take(await measure('downloading', DOWNLOADING, DOWNLOADING_NON_TEXT))
    await sheet().screenshot({ path: `${shots}/m26-downloading-${theme}.png` })

    // 5. …and the same download, stopped, with its bytes still on disk.
    await page.evaluate(
      (d) =>
        window.__downloads([
          { ...d, status: 'error', bytesPerSecond: 0, failure: { kind: 'offline', detail: 'fetch failed' } }
        ]),
      LIVE_DOWNLOAD
    )
    await page.waitForTimeout(400)
    await take(await measure('failed', FAILED, VOICE_NON_TEXT))
    await sheet().screenshot({ path: `${shots}/m26-failed-${theme}.png` })

    // 6. The empty library — where a fresh install now starts, since the app
    // ships no weights (M26).
    //
    // The sheet has to be CLOSED and reopened, not merely navigated back to:
    // `useWhisperCatalog`/`useWhisperPreference` key their read on the sheet's
    // own `open`, not on which scope is showing, so switching scopes re-renders
    // a catalog that was read once. Mutating the fixture and clicking back in
    // measures the previous answer — a probe reporting a state it never
    // rendered (docs/visual-validation.md).
    await page.keyboard.press('Escape')
    await page.waitForTimeout(200)
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
    await page.evaluate(() => {
      window.__HIVE_MODELS = (window.__HIVE_ALL ?? []).map((m) => ({
        ...m,
        downloaded: false,
        downloadedVariant: null
      }))
      window.__HIVE_PREF = { id: null, auto: true, installed: [], recommendation: window.__HIVE_HW }
      window.__downloads([])
    })
    await openSheet()
    await openVoice()
    await take(await measure('empty', EMPTY, EMPTY_NON_TEXT))
    await sheet().screenshot({ path: `${shots}/m26-empty-${theme}.png` })

    // 7. The terminal scope — content this pass did not author but sits beside.
    await back()
    await page.click('button.wb-pnav-row[data-scope="shell"]')
    await page.waitForTimeout(500)
    await take(await measure('shell', ['.wb-profile-back', '.hds-sheet-title', '.hds-sheet-description']))
    await sheet().screenshot({ path: `${shots}/m26-shell-${theme}.png` })

    await page.keyboard.press('Escape')
    await page.waitForTimeout(200)
    await page.keyboard.press('Escape')
    await page.waitForTimeout(200)
    return { theme, failures, missing }
  }

  const results = []
  for (const theme of THEMES) results.push(await sweep(theme))
  // The verdict needs BOTH empty: a state that never rendered reports no
  // failures, which reads exactly like a state that passed.
  const verdict = results.every((r) => r.failures.length === 0 && r.missing.length === 0)
    ? 'PASS'
    : 'FAIL'
  return { verdict, results }
}
