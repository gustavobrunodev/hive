// Visual + contrast pass over the four fixes of 2026-08-31, in all three themes:
//
//   1. Ctrl/Cmd+R + "Recarregar janela" in the workspace chip menu (app-reload)
//   2. the discard confirmation's button, which was red-on-red (WCAG)
//   3. the Estúdio / MCP modals centring while their content arrives
//   4. "Trocar de branch (checkout)…" in the SCM overflow menu
//
// Run `tools/visual/boot.mjs` first; this drives the booted page.
//
// **It never reloads.** The boot harness plants the theme in an init script, so
// a reload puts it back to `dark` and every "light"/"hive" number silently
// reports the dark theme's. Themes are switched through the real Aparência menu.
//
// The git bridge `boot.mjs` ships answers "not a repo", which is the wrong
// fixture for three of the four checks here — so this file swaps in a repo with
// changes and branches and lets `useGit` re-read it through the `focus` trigger
// it already listens to (no reload, see above).
async (page) => {
  const OUT = '/home/gustavobgt/user-harness/hive/.playwright-mcp'
  const THEMES = ['dark', 'light', 'hive']
  const report = { centring: {}, contrast: {}, commands: {} }

  // ── Probe: resolves any colour (oklch, color-mix, alpha) by painting it over
  // the real stack of backgrounds beneath it and reading the pixel back.
  const installProbe = () =>
    page.evaluate(() => {
      const cv = document.createElement('canvas')
      cv.width = cv.height = 1
      const ctx = cv.getContext('2d', { willReadFrequently: true })
      const px = (color, stack) => {
        ctx.clearRect(0, 0, 1, 1)
        for (const under of stack) { ctx.fillStyle = under; ctx.fillRect(0, 0, 1, 1) }
        ctx.fillStyle = color
        ctx.fillRect(0, 0, 1, 1)
        const d = ctx.getImageData(0, 0, 1, 1).data
        return [d[0], d[1], d[2]]
      }
      const lum = ([r, g, b]) => {
        const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4) }
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
      }
      const ratio = (a, b) => {
        const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
        return +((x + 0.05) / (y + 0.05)).toFixed(2)
      }
      // Start the stack at the element itself — a filled pill measured from its
      // parent is read against the wrong ground (M22's lesson).
      const groundOf = (el) => {
        const stack = []
        for (let n = el; n; n = n.parentElement) {
          const bg = getComputedStyle(n).backgroundColor
          if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') stack.unshift(bg)
        }
        return stack
      }
      window.__measure = (targets) => {
        const out = {}
        for (const [name, sel, floor] of targets) {
          const el = document.querySelector(sel)
          if (!el) { out[name] = 'MISSING'; continue }
          const ground = groundOf(el)
          const r = ratio(px(getComputedStyle(el).color, ground), px('rgba(0,0,0,0)', ground))
          out[name] = { ratio: r, floor, pass: r >= floor }
        }
        return out
      }
    })

  // ── Fixture: a real repo, with changes to discard and branches to check out.
  const installGit = () =>
    page.evaluate(() => {
      const ok = (v) => () => Promise.resolve(v)
      window.hive.git = {
        ...window.hive.git,
        detect: ok({ isRepo: true, gitMissing: false }),
        status: ok({
          branch: 'feat/voice-prompt',
          upstream: 'origin/feat/voice-prompt',
          ahead: 2, behind: 1, detached: false, mergeInProgress: false,
          changes: [
            { path: 'src/renderer/src/WorkUI.tsx', index: ' ', worktree: 'M', isUntracked: false },
            { path: 'src/renderer/src/assets/workbench.css', index: 'M', worktree: ' ', isUntracked: false },
            { path: 'notas.txt', index: '?', worktree: '?', isUntracked: true }
          ],
          staged: []
        }),
        branches: ok({
          current: 'feat/voice-prompt',
          branches: [
            { name: 'feat/voice-prompt', isRemote: false, isCurrent: true },
            { name: 'main', isRemote: false, isCurrent: false },
            { name: 'origin/main', isRemote: true, isCurrent: false }
          ]
        }),
        stage: ok(undefined), unstage: ok(undefined), discard: ok(undefined),
        commit: ok({ hash: 'abc1234' }), checkout: ok(undefined), createBranch: ok(undefined),
        deleteBranch: ok(undefined), renameBranch: ok(undefined),
        fetch: ok(undefined), pull: ok(undefined), push: ok(undefined), sync: ok(undefined),
        log: ok([]), diff: ok({ hunks: [] }), commitDiff: ok({ files: [] }), fileAtHead: ok(''),
        conflicts: ok([]), resolveConflict: ok(undefined),
        mergeContinue: ok(undefined), mergeAbort: ok(undefined),
        stash: ok(undefined), stashList: ok([]), stashApply: ok(undefined), stashDrop: ok(undefined),
        onChanged: () => () => {}
      }
      // `useGit` refreshes on window focus — the one trigger a probe can pull
      // without reloading the page (and losing the theme).
      window.dispatchEvent(new Event('focus'))
    })

  // ── Fixture: lists that arrive *after* the dialog opens, which is the whole
  // point — a dialog centred against its empty height is the defect.
  const installSlowLists = (delay) =>
    page.evaluate((delay) => {
      const skill = (i) => ({
        key: 'skill-' + i, name: 'Skill número ' + i,
        description: 'Uma descrição razoavelmente longa para ocupar espaço vertical de verdade.',
        kind: i % 3 === 0 ? 'agent' : 'skill', persona: i % 3 === 0 ? 'Maria' : null,
        hasEvals: i % 2 === 0, evalCases: 3, relPath: '.claude/skills/s' + i, updatedAt: Date.now()
      })
      const server = (i) => ({
        name: 'servidor-' + i, transport: 'stdio', command: 'npx',
        args: ['-y', '@exemplo/mcp@latest'], enabled: i % 2 === 0
      })
      const late = (make, n) => () =>
        new Promise((r) => setTimeout(() => r(Array.from({ length: n }, (_, i) => make(i))), delay))
      window.hive.studio.list = late(skill, 12)
      window.hive.mcp.list = late(server, 10)
    }, delay)

  const switchTheme = async (theme) => {
    // The real Aparência menu, never the storage key or the attribute — see
    // the header note.
    await page.click('button[aria-label^="Aparência"]')
    await page.waitForTimeout(200)
    const label = { dark: 'Escuro', light: 'Claro', hive: 'Hive' }[theme]
    await page.getByRole('menuitemradio', { name: label }).click()
    await page.waitForTimeout(250)
  }

  const dialogGeometry = (sel) =>
    page.evaluate((sel) => {
      const el = document.querySelector(sel)
      if (!el) return 'MISSING'
      const r = el.getBoundingClientRect()
      return {
        h: Math.round(r.height),
        top: Math.round(r.top),
        bottom: Math.round(r.bottom),
        vp: innerHeight,
        // The two things the bug broke: the panel has to sit inside the window
        // and its centre has to be the window's centre, at every content size.
        insideViewport: r.top >= 0 && r.bottom <= innerHeight,
        offCentreBy: Math.round((r.top + r.bottom) / 2 - innerHeight / 2)
      }
    }, sel)

  await installGit()
  await page.waitForTimeout(700)

  for (const theme of THEMES) {
    if (theme !== 'dark') await switchTheme(theme)
    await installProbe()

    // ── 3. Centring, sampled while the list is still loading AND after it
    // lands — the growth is the case that used to leave the panel low.
    const centring = {}
    for (const [name, trigger, sel] of [
      ['studio', 'button[aria-label="Estúdio de skills"]', '.wb-studio-dialog'],
      ['mcp', 'button[aria-label="Servidores MCP"]', '.wb-mcp-dialog']
    ]) {
      centring[name] = {}
      for (const vh of [900, 700, 620]) {
        await page.setViewportSize({ width: 1100, height: vh })
        await installSlowLists(500)
        await page.waitForTimeout(150)
        await page.click(trigger)
        await page.waitForTimeout(250)
        const loading = await dialogGeometry(sel)
        await page.waitForTimeout(700)
        const loaded = await dialogGeometry(sel)
        centring[name]['vh' + vh] = { loading, loaded }
        if (vh === 620) await page.screenshot({ path: `${OUT}/fix-${name}-${theme}.png` })
        await page.keyboard.press('Escape')
        await page.waitForTimeout(300)
      }
    }
    report.centring[theme] = centring
    await page.setViewportSize({ width: 1100, height: 700 })
    await page.waitForTimeout(150)

    // ── 2. The discard confirmation's button.
    await page.click('.wb-rail-view[aria-label^="Controle de versão"]')
    await page.waitForTimeout(350)
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('.wb-scm-act')].find((x) =>
        /descartar tudo/i.test(x.getAttribute('aria-label') || '')
      )
      b && b.click()
    })
    await page.waitForTimeout(400)
    report.contrast[theme] = await page.evaluate(() =>
      window.__measure([
        ['discardConfirm', '.wb-btn-danger', 4.5],
        ['discardCancel', '.hds-alert-dialog-content .wb-btn:not(.wb-btn-danger)', 4.5]
      ])
    )
    await page.screenshot({ path: `${OUT}/fix-discard-${theme}.png` })
    // Cancel by its own button, not Escape: the AlertDialog only takes Escape
    // when focus is inside it, and a probe that assumes otherwise leaves the
    // scrim up and every later click lands on the overlay.
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('.hds-alert-dialog-content button')].find((x) =>
        /cancelar/i.test(x.textContent || '')
      )
      b && b.click()
    })
    await page.waitForTimeout(400)

    // ── 4. The checkout command, and 1. the reload command.
    await page.click('.wb-scm-header button[aria-label="Mais ações"]')
    await page.waitForTimeout(300)
    const checkout = await page.evaluate(() =>
      [...document.querySelectorAll('[role="menuitem"]')].map((n) => n.textContent.trim())
    )
    await page.screenshot({ path: `${OUT}/fix-checkout-menu-${theme}.png` })
    await page.keyboard.press('Escape')
    await page.waitForTimeout(250)

    await page.click('.wb-workspace-chip')
    await page.waitForTimeout(300)
    const chipMenu = await page.evaluate(() =>
      [...document.querySelectorAll('[role="menuitem"]')].map((n) => n.textContent.trim())
    )
    await page.screenshot({ path: `${OUT}/fix-reload-menu-${theme}.png` })
    await page.keyboard.press('Escape')
    await page.waitForTimeout(250)

    report.commands[theme] = { scmOverflow: checkout, chipMenu }
  }

  return JSON.stringify(report, null, 1)
}
