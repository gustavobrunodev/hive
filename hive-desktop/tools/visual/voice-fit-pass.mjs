// Companion to tools/visual/boot.mjs — the visual + contrast pass for the M26
// bugfix round: the rows this computer cannot run, the delete confirmation, and
// the library re-reading itself the moment a download lands.
//
//   npx electron-vite build && python3 -m http.server 8123 -d out/renderer
//   run_code_unsafe --filename tools/visual/boot.mjs
//   run_code_unsafe --filename tools/visual/voice-fit-pass.mjs
//
// The machine is forced to 8 GB with no GPU through an init script, because the
// three states this pass exists to look at are decided by that number: at 8 GB
// `medium` is too heavy and `large-v3`/`large-v3-turbo` are impossible at fp32
// (a single weight file past V8's 2 GiB ArrayBuffer ceiling — measured).
//
// Screenshots land in `.playwright-mcp/m26fix-<state>-<theme>.png`.
async (page) => {
  const shots = '/home/gustavobgt/user-harness/hive/.playwright-mcp'
  const THEMES = ['dark', 'light', 'hive']

  const measure = async (state, targets, nonText = []) =>
    await page.evaluate(
      ({ state, targets, nonText }) => {
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
        // Starts at the element ITSELF: a tinted card measured against its
        // grandparent is measured against a colour that is not on screen.
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
          // Text carries its own alpha over the composed background.
          const over = fg.rgb.map((ch, i) => ch * fg.a + bg[i] * (1 - fg.a))
          const a = lum(over)
          const b = lum(bg)
          return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
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
          const bg = bgOf(el, false)
          if (fg === null || bg === null) {
            missing.push(`${state} ${selector} UNMEASURED`)
            continue
          }
          const size = parseFloat(style.fontSize)
          const bold = Number(style.fontWeight) >= 700
          const floor = size >= 24 || (bold && size >= 18.66) ? 3 : 4.5
          const ratio = ratioOf(fg, bg)
          if (ratio < floor) {
            failures.push(`${state} ${selector} → ${ratio.toFixed(2)}:1 (floor ${floor})`)
          }
        }
        for (const { selector, prop } of nonText) {
          const el = document.querySelector(selector)
          if (el === null) {
            missing.push(`${state} ${selector}`)
            continue
          }
          const fg = parse(getComputedStyle(el)[prop])
          const bg = bgOf(el, false)
          if (fg === null || bg === null) {
            missing.push(`${state} ${selector} UNMEASURED`)
            continue
          }
          const ratio = ratioOf(fg, bg)
          if (ratio < 3) {
            failures.push(`${state} ${selector} [${prop}] → ${ratio.toFixed(2)}:1 (floor 3)`)
          }
        }
        return { failures, missing }
      },
      { state, targets, nonText }
    )

  const FIT = ['.wb-vfit-title', '.wb-vfit-text']
  const FIT_NON_TEXT = [{ selector: '.wb-vfit-mark svg', prop: 'color' }]
  // The confirmation is a Dialog nested INSIDE the profile Sheet, so both
  // carry `role="dialog"` — a bare `[role="dialog"]` measures the sheet.
  const CONFIRM = [
    '.hds-dialog-content h2',
    '.hds-dialog-content p',
    '.hds-dialog-content .wb-dialog-actions button'
  ]

  async function openVoice() {
    await page.click('.wb-avatar-btn')
    await page.waitForTimeout(300)
    await page.getByRole('button', { name: /Voz e transcrição/ }).click()
    await page.waitForTimeout(600)
  }

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

    await openVoice()

    // 1. The library on a machine that cannot run the top of the ladder.
    take(await measure('fit', FIT, FIT_NON_TEXT))
    await page.locator('.wb-vlib').screenshot({ path: `${shots}/m26fix-library-${theme}.png` })

    // How many rows lost their download button, and to which reason.
    const blocked = await page.evaluate(() =>
      [...document.querySelectorAll('.wb-vrow-library[data-blocked]')].map((row) => ({
        id: row.querySelector('.wb-vrow-name')?.textContent,
        why: row.querySelector('.wb-vfit-title')?.textContent,
        hasDownload: row.querySelector('.wb-vbtn-primary') !== null
      }))
    )

    // 2. The delete confirmation — the one destructive action on this screen.
    await page.click('.wb-vrow-installed .wb-vicon-btn')
    await page.waitForTimeout(400)
    take(await measure('confirm', CONFIRM))
    await page.locator('.hds-dialog-content').screenshot({
      path: `${shots}/m26fix-delete-${theme}.png`
    })
    const confirm = await page.evaluate(
      () => document.querySelector('.hds-dialog-content')?.innerText ?? null
    )
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)

    // 3. A download that finishes while the sheet is open moves lists by itself.
    const before = await page.evaluate(() =>
      [...document.querySelectorAll('.wb-vrow-installed .wb-vrow-name')].map((e) => e.textContent)
    )
    await page.evaluate(() => {
      window.__HIVE_MODELS = window.__HIVE_MODELS.map((m) =>
        m.id === 'small' ? { ...m, downloaded: true, downloadedVariant: 'fp32' } : m
      )
      window.__downloadSettled({ id: 'small', status: 'done' })
    })
    await page.waitForTimeout(700)
    const after = await page.evaluate(() =>
      [...document.querySelectorAll('.wb-vrow-installed .wb-vrow-name')].map((e) => e.textContent)
    )
    await page.locator('.wb-vlib').screenshot({ path: `${shots}/m26fix-settled-${theme}.png` })

    return { theme, failures, missing, blocked, confirm, before, after }
  }

  // The scene: an 8 GB machine with two models on disk and nothing in flight.
  // Planted through an init script rather than `page.evaluate` because the
  // sheet reads the catalog when it opens and the sweep reloads between themes.
  await page.addInitScript(() => {
    const HAVE = ['tiny', 'base']
    window.__HIVE_HW = {
      recommendedId: 'base',
      reason: 'lowMemory',
      gpu: false,
      ramGB: 8,
      cores: 8
    }
    window.__HIVE_MODELS = (window.__HIVE_ALL ?? []).map((m) => ({
      ...m,
      downloaded: HAVE.includes(m.id),
      downloadedVariant: HAVE.includes(m.id) ? 'fp32' : null
    }))
    window.__HIVE_PREF = {
      id: 'base',
      auto: true,
      installed: HAVE,
      recommendation: window.__HIVE_HW
    }
  })

  const results = []
  for (const theme of THEMES) results.push(await sweep(theme))
  const verdict = results.every((r) => r.failures.length === 0 && r.missing.length === 0)
    ? 'PASS'
    : 'FAIL'
  return { verdict, results }
}
