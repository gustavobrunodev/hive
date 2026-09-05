// The file-manager round (2026-09-04): the tab context menu, the knowledge
// base browsed with the Explorer's own tree, the sidebar layers that keep
// their state, and the undo that survives Editar⇄Visualizar.
//
//   npx electron-vite build && python3 -m http.server 8123 -d out/renderer
//   run_code_unsafe --filename tools/visual/boot.mjs
//   run_code_unsafe --filename tools/visual/file-manager-pass.mjs
//
// Structural + functional assertions, in all three themes. Screenshots are
// written next to the report so a failing line can be looked at.
async (page) => {
  const OUT = globalThis.HIVE_OUT || '/tmp/hive-fm'
  const THEMES = ['dark', 'light', 'hive']
  const report = { themes: {}, functional: {} }

  const setTheme = async (theme) => {
    await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme)
    await page.waitForTimeout(250)
  }

  /**
   * Resolves any CSS colour to sRGB bytes by *painting* it and reading the
   * pixel back.
   *
   * Not by parsing the string: Chromium serializes a `color-mix()` result as
   * `color(srgb 0.75 0.71 0.71)` — components in 0–1, not 0–255 — and canvas
   * `fillStyle` hands that same string straight back. A probe that pulls the
   * numbers out with a regex reads 0.75 as "almost black", measures every
   * target against an almost-black plate, and reports ratios of 1.00 for
   * perfectly legible text. It cost this round one full pass. `getImageData`
   * is the only reading that is always sRGB bytes.
   */
  const RESOLVE = `(css) => {
    const c = document.createElement('canvas')
    c.width = 1; c.height = 1
    const ctx = c.getContext('2d', { willReadFrequently: true })
    ctx.clearRect(0, 0, 1, 1)
    ctx.fillStyle = css
    ctx.fillRect(0, 0, 1, 1)
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data
    return [r, g, b, a / 255]
  }`

  /**
   * The colour actually painted behind an element: its own background if it is
   * opaque, otherwise composited over whatever its ancestors paint. A panel
   * with no background of its own is not a black panel, and treating it as one
   * is how a light theme "fails" a contrast check it passes on screen.
   */
  const EFFECTIVE_BG = `(el, resolve) => {
    // Composited in PREMULTIPLIED space and unpremultiplied at the end.
    // Adding straight channels — acc.r + layer.r * (1 - acc.a) — makes a 10%
    // accent tint over a near-black rail come out BRIGHTER than either, and a
    // probe built that way reports the sidebar's own copy at 1.34:1 in the
    // dark theme while the light theme sails through. Second colour-maths trap
    // of this round, after the 0–1 vs 0–255 one above.
    let r = 0, g = 0, b = 0, a = 0
    for (let node = el; node && a < 0.999; node = node.parentElement) {
      const layer = resolve(getComputedStyle(node).backgroundColor)
      if (layer[3] === 0) continue
      const k = layer[3] * (1 - a)
      r += layer[0] * k
      g += layer[1] * k
      b += layer[2] * k
      a += k
    }
    // Nothing opaque anywhere up the chain: the page itself is the last resort.
    if (a < 0.999) {
      const k = 1 - a
      const page = resolve(getComputedStyle(document.documentElement).backgroundColor)
      const base = page[3] === 0 ? [255, 255, 255] : page
      r += base[0] * k; g += base[1] * k; b += base[2] * k; a = 1
    }
    return [r / a, g / a, b / a, 1]
  }`

  const contrast = async (selector) =>
    page.evaluate(
      ([sel, resolveSrc, bgSrc]) => {
        const resolve = eval(resolveSrc)
        const effectiveBg = eval(bgSrc)
        const el = document.querySelector(sel)
        if (!el) return { missing: sel }
        const plate = effectiveBg(el, resolve)
        const fg = resolve(getComputedStyle(el).color)
        const ink = [0, 1, 2].map((i) => fg[i] * fg[3] + plate[i] * (1 - fg[3]))
        const lum = (rgb) => {
          const [r, g, b] = rgb.slice(0, 3).map((v) => {
            const x = v / 255
            return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4
          })
          return 0.2126 * r + 0.7152 * g + 0.0722 * b
        }
        const a = lum(ink)
        const b = lum(plate)
        const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
        const size = Number.parseFloat(getComputedStyle(el).fontSize)
        const weight = Number(getComputedStyle(el).fontWeight) || 400
        // WCAG's "large text" floor: 18.66px bold, or 24px at any weight.
        const floor = size >= 24 || (size >= 18.66 && weight >= 700) ? 3 : 4.5
        return {
          ratio: Math.round(ratio * 100) / 100,
          size,
          floor,
          pass: Math.round(ratio * 100) / 100 >= floor
        }
      },
      [selector, RESOLVE, EFFECTIVE_BG]
    )

  const tree = () => page.getByRole('tree', { name: 'Arquivos do workspace' })

  // --- one-time scene: three tabs, a vault, the explorer expanded -----------
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.evaluate(() => window.__setVault({ rawPending: 3 }))
  await page.waitForTimeout(300)
  await page.getByRole('treeitem', { name: 'docs' }).click()
  await page.waitForTimeout(250)
  await tree().getByText('prd.md', { exact: true }).click()
  await page.waitForTimeout(350)
  await page.locator('.wb-tab').first().dblclick()
  await tree().getByText('architecture.md', { exact: true }).click()
  await page.waitForTimeout(350)

  // --- 1. ordering: folders first, then files, naturally compared ----------
  report.functional.rootOrder = await page.evaluate(() =>
    [...document.querySelectorAll('.wb-sidebar-layer[data-view="explorer"] [role="treeitem"]')]
      .filter((r) => r.getAttribute('aria-level') === '1')
      .map((r) => r.querySelector('.hds-tree-label-text')?.textContent)
  )

  // --- 2. the tab menu, per theme ------------------------------------------
  for (const theme of THEMES) {
    await setTheme(theme)
    await page.locator('.wb-tab').last().click({ button: 'right' })
    await page.waitForTimeout(350)
    const menu = page.locator('[role="menu"]').last()
    const box = await menu.boundingBox()
    await page.screenshot({ path: `${OUT}/tabmenu-${theme}.png`, clip: box, scale: 'device' })
    report.themes[theme] = {
      menuItem: await contrast('[role="menu"] .hds-context-menu-item:not([data-disabled])'),
      menuShortcut: await contrast('[role="menu"] .hds-context-menu-shortcut'),
      items: await menu.locator('[role="menuitem"]').count(),
      activeTab: await contrast('.wb-tab[data-active] .wb-tab-name'),
      previewTab: await contrast('.wb-tab[data-preview] .wb-tab-name'),
      treeRow: await contrast('.wb-sidebar-layer[data-active] .hds-tree-label-text')
    }
    await page.keyboard.press('Escape')
    await page.waitForTimeout(250)
  }

  // --- 3. the knowledge base, per theme ------------------------------------
  await page.getByRole('button', { name: /Bases de conhecimento/ }).click()
  await page.waitForTimeout(500)
  for (const theme of THEMES) {
    await setTheme(theme)
    await page.screenshot({
      path: `${OUT}/brain-${theme}.png`,
      clip: { x: 0, y: 40, width: 400, height: 700 },
      scale: 'device'
    })
    report.themes[theme].sectionTitle = await contrast('.wb-tree-toolbar-title')
    report.themes[theme].askHint = await contrast('.wb-brain-ask-cta-hint')
  }
  await setTheme('dark')

  // The vault tree is the Explorer's, rooted at the vault.
  report.functional.vaultRows = await page.evaluate(() =>
    [...document.querySelectorAll('.wb-sidebar-layer[data-view="brain"] [role="treeitem"]')].map(
      (r) => r.querySelector('.hds-tree-label-text')?.textContent
    )
  )

  // --- 4. the sidebar keeps its state --------------------------------------
  await page.getByRole('button', { name: 'Explorador' }).click()
  await page.waitForTimeout(400)
  report.functional.stateKept = await page.evaluate(() => {
    const layer = document.querySelector('.wb-sidebar-layer[data-view="explorer"]')
    const hidden = document.querySelector('.wb-sidebar-layer:not([data-active])')
    let reachable = 0
    for (const el of hidden?.querySelectorAll('button, [tabindex]') ?? []) {
      el.focus?.()
      if (document.activeElement === el) reachable += 1
    }
    return {
      expanded: [...layer.querySelectorAll('[role="treeitem"][aria-expanded="true"]')].map(
        (r) => r.querySelector('.hds-tree-label-text')?.textContent
      ),
      hiddenView: hidden?.getAttribute('data-view'),
      hiddenVisibility: hidden ? getComputedStyle(hidden).visibility : null,
      hiddenReachable: reachable
    }
  })

  // --- 5. undo survives the surface swap -----------------------------------
  const clickMode = (label) =>
    page.evaluate((name) => {
      const el = [
        ...document.querySelectorAll('.wb-viewer-actions [role="radio"], .wb-viewer-actions button')
      ].find((n) => (n.textContent || n.getAttribute('aria-label') || '').trim() === name)
      el?.click()
    }, label)

  // Every open tab keeps a mounted editor (that is what preserves its scroll),
  // so a bare `.hds-editor-input` matches all of them — scope to the tab body
  // that is actually showing.
  const editor = page.locator('.wb-tab-body:not([hidden]) .hds-editor-input')
  await editor.click()
  await page.keyboard.press('End')
  await page.keyboard.type(' RASCUNHO')
  await page.waitForTimeout(300)
  const edited = await editor.inputValue()
  await clickMode('Visualizar')
  await page.waitForTimeout(400)
  await clickMode('Editar')
  await page.waitForTimeout(400)
  await editor.click()
  await page.keyboard.press('Control+z')
  await page.waitForTimeout(250)
  const undone = await editor.inputValue()
  await page.keyboard.press('Control+Shift+z')
  await page.waitForTimeout(250)
  const redone = await editor.inputValue()
  report.functional.undo = {
    tookBack: undone !== edited && !undone.includes('RASCUNHO'),
    putBack: redone === edited
  }

  // --- 6. the guard names the file, and the buttons are not three peers ----
  // Both open files edited, so the close asks twice and the dialog has to say
  // how much is still coming.
  await page.locator('.wb-tab').first().click()
  await page.waitForTimeout(300)
  await page.locator('.wb-tab-body:not([hidden]) .hds-editor-input').click()
  await page.keyboard.press('End')
  await page.keyboard.type(' X')
  await page.waitForTimeout(300)
  await page.locator('.wb-tab').last().click()
  await page.waitForTimeout(300)
  await page.locator('.wb-tab-body:not([hidden]) .hds-editor-input').click()
  await page.keyboard.press('End')
  await page.keyboard.type(' X')
  await page.waitForTimeout(300)

  await page.locator('.wb-tab').last().click({ button: 'right' })
  await page.waitForTimeout(350)
  await page.getByRole('menuitem', { name: 'Fechar todas' }).click()
  await page.waitForTimeout(500)
  report.functional.guard = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]')
    if (!dialog) return { missing: true }
    return {
      file: dialog.querySelector('.wb-guard-file')?.textContent,
      remaining: dialog.querySelector('.wb-guard-remaining')?.textContent ?? null,
      buttons: [...dialog.querySelectorAll('.wb-dialog-actions button')].map((b) => ({
        label: b.textContent,
        primary: b.classList.contains('hds-btn-primary'),
        danger: b.classList.contains('wb-btn-danger')
      }))
    }
  })
  const dialogBox = await page.locator('[role="dialog"]').last().boundingBox()
  for (const theme of THEMES) {
    await setTheme(theme)
    await page.screenshot({
      path: `${OUT}/guard-${theme}.png`,
      clip: { x: dialogBox.x - 8, y: dialogBox.y - 8, width: dialogBox.width + 16, height: dialogBox.height + 16 },
      scale: 'device'
    })
    report.themes[theme].guardFile = await contrast('.wb-guard-file')
    report.themes[theme].guardRemaining = await contrast('.wb-guard-remaining')
    report.themes[theme].guardDanger = await contrast('.wb-btn-danger')
  }
  await setTheme('dark')

  return report
}
