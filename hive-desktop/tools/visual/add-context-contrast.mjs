// Contrast + structure probe for the composer's add-context menu, across the
// three themes, in both of the states a row takes (at rest and highlighted).
//
// Run AFTER tools/visual/boot.mjs:
//   run_code_unsafe --filename tools/visual/add-context-contrast.mjs
//
// Lessons it carries forward from docs/visual-validation.md:
//  - Resolve colours through a canvas, never a regex — this app's tokens are
//    `oklch()`, which Chromium serialises verbatim.
//  - Kill transitions before measuring: the icon tile cross-fades on highlight,
//    and `getComputedStyle` mid-transition reports the colour being left.
//  - Not every coloured pixel is an indicator, but a *plate* is: a surface that
//    exists to separate its content from the row has to be measurably
//    different from it (≥1,08:1), or it is not a plate at all.
//  - Force the theme through the real menu; the boot init script rewrites
//    `localStorage` on every navigation.
async (page) => {
  // [label, ink selector, ground selector | 'self', floor]
  const TEXT = [
    ['rótulo do menu', '.wb-add-context-menu .hds-dropdown-menu-label', 'parent', 4.5],
    ['título da linha', '.wb-add-context-menu .hds-dropdown-menu-item-title', 'parent', 4.5],
    ['descrição da linha', '.wb-add-context-menu .hds-dropdown-menu-item-desc', 'parent', 4.5],
    ['dica @ (tecla)', '.wb-add-context-menu .hds-kbd', 'self', 4.5],
    [
      'título na linha destacada',
      '.wb-add-context-menu [data-highlighted] .hds-dropdown-menu-item-title',
      'parent',
      4.5
    ],
    [
      'descrição na linha destacada',
      '.wb-add-context-menu [data-highlighted] .hds-dropdown-menu-item-desc',
      'parent',
      4.5
    ]
  ]
  // Marks and controls: the 3:1 floor.
  const MARKS = [
    ['ícone da linha em repouso', '.wb-add-context-menu .hds-dropdown-menu-item-icon', 'self', 3],
    [
      'ícone da linha destacada',
      '.wb-add-context-menu [data-highlighted] .hds-dropdown-menu-item-icon',
      'self',
      3
    ],
    ['glifo + no gatilho', '.wb-add-context-btn', 'parent', 3]
  ]
  // Plates: a surface that exists to hold something apart from its row.
  const PLATES = [
    [
      'placa do ícone vs. linha em repouso',
      '.wb-add-context-menu .hds-dropdown-menu-item:not([data-highlighted]) .hds-dropdown-menu-item-icon',
      1.08
    ],
    [
      'placa do ícone vs. linha destacada',
      '.wb-add-context-menu [data-highlighted] .hds-dropdown-menu-item-icon',
      1.08
    ],
    ['cap da tecla @ vs. sua linha', '.wb-add-context-menu .hds-kbd', 1.08]
  ]

  const openMenu = async () => {
    if ((await page.getByRole('menu').count()) === 0) {
      await page.getByRole('button', { name: 'Adicionar contexto' }).click()
      await page.getByRole('menu').waitFor()
    }
    // Highlight the row that owns the `@` hint, so both row states and both
    // plate pairs are on screen in the same measurement.
    await page.getByRole('menuitem', { name: /Arquivos do workspace/ }).hover()
    await page.waitForTimeout(320)
  }

  const measure = () =>
    page.evaluate(
      ({ text, marks, plates }) => {
        const kill = document.createElement('style')
        kill.textContent = '*, *::before, *::after { transition: none !important; }'
        document.head.append(kill)

        const paint = document.createElement('canvas').getContext('2d', {
          willReadFrequently: true
        })
        const parse = (value) => {
          if (value === '' || value === 'none') return null
          paint.clearRect(0, 0, 1, 1)
          paint.fillStyle = '#000'
          paint.fillStyle = value
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
        for (const [label, sel, mode, floor] of [...text, ...marks]) {
          const el = document.querySelector(sel)
          if (!el) {
            rows.push({ label, missing: true })
            continue
          }
          const ink = parse(getComputedStyle(el).color)
          // 'self' includes the element's OWN background — the icon tile and
          // the key cap are painted plates, and measuring their glyph against
          // the row behind them would flatter a tile that hides its icon.
          const ground = groundOf(mode === 'self' ? el : el.parentElement)
          const r = ratio(over(ink, ground), ground)
          rows.push({ label, ratio: Math.round(r * 100) / 100, floor, ok: r >= floor })
        }
        for (const [label, sel, floor] of plates) {
          const el = document.querySelector(sel)
          if (!el) {
            rows.push({ label, missing: true })
            continue
          }
          const plate = groundOf(el)
          const behind = groundOf(el.parentElement)
          const r = ratio(plate, behind)
          rows.push({ label, ratio: Math.round(r * 100) / 100, floor, ok: r >= floor })
        }

        // Structure. Contrast cannot see any of this, and each one is a way the
        // menu stops reading as a choice between two equals.
        const items = [...document.querySelectorAll('.wb-add-context-menu .hds-dropdown-menu-item')]
        const titles = [
          ...document.querySelectorAll('.wb-add-context-menu .hds-dropdown-menu-item-title')
        ]
        const descs = [
          ...document.querySelectorAll('.wb-add-context-menu .hds-dropdown-menu-item-desc')
        ]
        const heights = items.map((el) => Math.round(el.getBoundingClientRect().height))
        rows.push({
          label: 'as duas linhas têm a mesma altura',
          detail: heights.join(' · '),
          ok: items.length === 2 && new Set(heights).size === 1
        })
        rows.push({
          label: 'nenhuma descrição quebra em duas linhas',
          detail: descs.map((el) => el.getClientRects().length).join(' · '),
          ok: descs.length === 2 && descs.every((el) => el.getClientRects().length === 1)
        })
        rows.push({
          label: 'um só tamanho de título',
          detail: [...new Set(titles.map((el) => getComputedStyle(el).fontSize))].join(' · '),
          ok: new Set(titles.map((el) => getComputedStyle(el).fontSize)).size === 1
        })
        // Hierarchy: a title and its description at the same ink is a flat row
        // that reads as one long label.
        rows.push({
          label: 'hierarquia: título ≠ descrição',
          ok:
            titles.length > 0 &&
            descs.length > 0 &&
            getComputedStyle(titles[0]).color !== getComputedStyle(descs[0]).color
        })
        // The menu opens above the composer it belongs to, never over the send
        // button it would cover.
        const menu = document.querySelector('.wb-add-context-menu')
        const trigger = document.querySelector('.wb-add-context-btn')
        rows.push({
          label: 'o menu abre acima do gatilho',
          ok:
            menu !== null &&
            trigger !== null &&
            menu.getBoundingClientRect().bottom <= trigger.getBoundingClientRect().top + 1
        })

        kill.remove()
        return rows
      },
      { text: TEXT, marks: MARKS, plates: PLATES }
    )

  await openMenu()
  const report = { escuro: await measure() }

  for (const [name, menuLabel] of [
    ['claro', 'Claro'],
    ['hive', 'Hive']
  ]) {
    await page.keyboard.press('Escape')
    await page.waitForTimeout(200)
    await page.locator('.wb-icon-btn[aria-label^="Aparência"]').click()
    await page.getByRole('menuitemradio', { name: new RegExp(`^${menuLabel}`) }).click()
    await page.waitForTimeout(320)
    await openMenu()
    report[name] = await measure()
  }
  return report
}
