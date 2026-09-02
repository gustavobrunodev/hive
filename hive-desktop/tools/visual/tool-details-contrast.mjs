// Contrast probe for agent-tool-details — the call/result panel disclosed under
// an activity row — across the three themes, with every state the panel takes
// on screen at once (a passing command, a failing one, a capped search result,
// a step still running).
//
// Run AFTER tools/visual/boot.mjs + tools/visual/tool-details.mjs:
//   run_code_unsafe --filename tools/visual/tool-details-contrast.mjs
//
// Lessons it already carries (docs/visual-validation.md):
//  - **`--faint` is decoration, not secondary text.** It measured 2,95:1 in the
//    light theme on the git console and again on the engine picker. Nothing in
//    this panel uses it — the meta line, the argument names and the grow control
//    all take `--muted` — and this probe is what keeps them there.
//  - **Force the theme through the real menu.** The boot init script rewrites
//    `localStorage` on every navigation, so a probe that sets the key measures
//    its own default three times over.
//  - **Kill transitions before measuring.** `getComputedStyle` mid-transition
//    returns the colour the element is leaving, not the one it is going to.
//  - **Resolve colours through a canvas, never a regex.** Chromium serialises
//    `oklch()` verbatim, so `getComputedStyle(...).color` on this app's
//    `--danger-ink` is the string `oklch(0.7 0.17 25.3)`. A digit regex over
//    that reads it as RGB 0/0/25 — near-black — and the probe reported the
//    error label at 1,15:1 against its own tint, a failure that did not exist.
//  - **Measure the failure tone against its own tint.** The danger frame paints
//    `--danger-bg` under its own text; that pair is what a reader of a failed
//    step actually sees, and it is the one `--danger-ink` has failed before.
async (page) => {
  // [label, ink selector, ground selector, floor]
  const TEXT = [
    ['rótulo do bloco', '.hds-out-label', '.hds-out-label', 4.5],
    ['meta do resultado', '.hds-out-meta', '.hds-out-meta', 4.5],
    ['corpo do resultado', '.hds-out-body', '.hds-out-body', 4.5],
    ['nome do argumento', '.wb-tdetail-row dt', '.wb-tdetail-row dt', 4.5],
    ['valor do argumento', '.wb-tdetail-row dd', '.wb-tdetail-row dd', 4.5],
    ['botão copiar', '.hds-out-copy', '.hds-out-copy', 4.5],
    ['contagem de linhas (linha fechada)', '.wb-activity-lines', '.wb-activity-lines', 4.5],
    ['erro — rótulo', '.hds-out-danger .hds-out-label', '.hds-out-danger .hds-out-body', 4.5],
    ['erro — corpo', '.hds-out-danger .hds-out-body', '.hds-out-danger .hds-out-body', 4.5],
    ['nota de corte', '.hds-out-note', '.hds-out-note', 4.5],
    ['mostrar mais', '.hds-out-more', '.hds-out-more', 4.5],
    ['vazio — sem conteúdo', '.hds-out-empty', '.hds-out-empty', 4.5]
  ]
  // Marks, not text: the 3:1 floor.
  const MARKS = [['prompt do shell ($)', '.hds-out-prompt', '.hds-out-body', 3]]

  const measure = () =>
    page.evaluate(
      ({ text, marks }) => {
        const kill = document.createElement('style')
        kill.textContent = '*, *::before, *::after { transition: none !important; }'
        document.head.append(kill)

        // Resolved through a canvas, NOT through a regex over
        // `getComputedStyle`. Chromium serialises `oklch()` verbatim — this
        // app's `--danger-ink` computes to the literal string
        // `oklch(0.7 0.17 25.3)` — and a `/[\d.]+/g` over that reads
        // `0.7, 0.17, 25.3` as an RGB triple, i.e. as near-black. That is not a
        // rounding error: it reported the error label at 1,15:1 against its own
        // tint, a failure that does not exist. Canvas 2D resolves any CSS
        // colour to sRGB bytes, including `oklch`, `oklab` and `color-mix`.
        const paint = document.createElement('canvas').getContext('2d', {
          willReadFrequently: true
        })
        const parse = (value) => {
          if (value === '' || value === 'none') return null
          paint.clearRect(0, 0, 1, 1)
          paint.fillStyle = '#000'
          paint.fillStyle = value
          // An unparseable value leaves fillStyle at the previous colour;
          // painting on a cleared (transparent) canvas keeps alpha honest.
          paint.fillRect(0, 0, 1, 1)
          const [r, g, b, a] = paint.getImageData(0, 0, 1, 1).data
          return { rgb: [r, g, b], a: a / 255 }
        }
        const lum = (rgb) => {
          const [r, g, b] = rgb.map((c) => {
            const v = c / 255
            return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
          })
          return 0.2126 * r + 0.7152 * g + 0.0722 * b
        }
        const ratio = (a, b) => {
          const [hi, lo] = [lum(a), lum(b)].sort((p, q) => q - p)
          return (hi + 0.05) / (lo + 0.05)
        }
        const over = (fg, bg) => fg.rgb.map((c, i) => c * fg.a + bg[i] * (1 - fg.a))
        /** The first opaque ground up the tree, with every translucent tint above it composited on. */
        const groundOf = (el) => {
          const stack = []
          for (let node = el; node; node = node.parentElement) {
            const bg = parse(getComputedStyle(node).backgroundColor)
            if (!bg || bg.a === 0) continue
            if (bg.a >= 0.999) {
              let out = bg.rgb
              for (const tint of stack.reverse()) out = over(tint, out)
              return out
            }
            stack.push(bg)
          }
          return [0, 0, 0]
        }

        const rows = []
        const add = ([label, inkSel, groundSel, floor], isBorder) => {
          const inkEl = document.querySelector(inkSel)
          const groundEl = document.querySelector(groundSel)
          if (!inkEl || !groundEl) return rows.push({ label, missing: true })
          const cs = getComputedStyle(inkEl)
          const ink = parse(isBorder ? cs.borderTopColor : cs.color)
          const ground = groundOf(inkSel === groundSel ? groundEl.parentElement : groundEl)
          const r = ratio(over(ink, ground), ground)
          rows.push({ label, ratio: Math.round(r * 100) / 100, floor, ok: r >= floor })
        }
        for (const row of text) add(row, false)
        for (const row of marks) add(row, false)

        // Hierarchy, not just legibility. Every target above passed at 6,54:1
        // in a build where the section label, the meta line and the output body
        // were all the SAME grey: `var(--ink-2)` names a token this system does
        // not have, and an unresolvable `var()` silently inherits. Contrast
        // alone cannot see that — a flat panel is perfectly legible. So the
        // probe also asserts the two ranks are actually different colours.
        const inkOf = (sel) => {
          const el = document.querySelector(sel)
          return el ? parse(getComputedStyle(el).color).rgb.join(',') : null
        }
        const label = inkOf('.hds-out-label')
        const meta = inkOf('.hds-out-meta')
        const body = inkOf('.hds-out-body')
        rows.push({
          label: 'hierarquia: rótulo do bloco ≠ meta',
          ratio: null,
          floor: null,
          ok: label !== null && meta !== null && label !== meta
        })
        rows.push({
          label: 'hierarquia: corpo da saída = tinta cheia',
          ratio: null,
          floor: null,
          ok: body !== null && body === label
        })

        kill.remove()
        return rows
      },
      { text: TEXT, marks: MARKS }
    )

  const report = { escuro: await measure() }

  for (const [name, menuLabel] of [
    ['claro', 'Claro'],
    ['hive', 'Hive']
  ]) {
    await page.locator('.wb-icon-btn[aria-label^="Aparência"]').click()
    await page.getByRole('menuitemradio', { name: new RegExp(`^${menuLabel}`) }).click()
    await page.waitForTimeout(320)
    report[name] = await measure()
  }
  return report
}
