// Contrast probe for the 2026-09-03 round: the file-link chip in an agent
// reply, and Devin's per-model reasoning ladder in the engine picker — across
// the three themes, at rest AND on hover.
//
// Run AFTER tools/visual/boot.mjs + tools/visual/devin-round.mjs:
//   run_code_unsafe --filename tools/visual/devin-round-contrast.mjs
//
// It carries the lessons the earlier probes paid for (docs/visual-validation.md):
//  - resolve colour through a canvas, never a regex over `getComputedStyle`
//    (Chromium serialises `oklch()` verbatim and a digit regex reads it as RGB);
//  - composite every translucent tint down to the first opaque ground;
//  - kill transitions before measuring, or you read the colour the element is
//    leaving;
//  - force the theme through the real menu, because the boot init script
//    rewrites the storage key on every navigation.
//
// And one this feature added: **measure the chip on hover too.** At rest it is
// deliberately quiet — a plate with no border — so the whole affordance lives
// in the hover state, and an unreadable hover is an unreadable control.
async (page) => {
  // [label, ink selector, ground selector, floor]
  const REST = [
    ['chip — caminho', '.wb-pathlink .wb-pathlink-text', '.wb-pathlink', 4.5],
    ['chip — prosa em volta', '.wb-chat-md p', '.wb-chat-md p', 4.5],
    ['rampa — rótulo do degrau', '.hds-ramp-label', '.hds-ramp-label', 4.5],
    ['rampa — custo do degrau', '.hds-ramp-description', '.hds-ramp-description', 4.5],
    ['picker — nome do modelo', '.hds-picker-label', '.hds-picker-label', 4.5],
    ['picker — selo "N níveis"', '.hds-picker-tag', '.hds-picker-tag', 4.5],
    ['prioritária — rótulo', '.wb-engine-fast-name', '.wb-engine-fast-name', 4.5],
    ['prioritária — preço', '.wb-engine-fast-hint', '.wb-engine-fast-hint', 4.5]
  ]
  // Marks, not text: the 3:1 floor.
  const MARKS = [['chip — glifo do arquivo', '.wb-pathlink .wb-file-icon', '.wb-pathlink', 3]]
  const HOVER = [
    ['chip (hover) — caminho', '.wb-pathlink .wb-pathlink-text', '.wb-pathlink', 4.5],
    ['chip (hover) — borda', '.wb-pathlink', '.wb-chat-md p', 3]
  ]

  const measure = (hovering) =>
    page.evaluate(
      ({ rest, marks, hover, hovering }) => {
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
        const add = ([label, inkSel, groundSel, floor], isBorder) => {
          const inkEl = document.querySelector(inkSel)
          const groundEl = document.querySelector(groundSel)
          if (!inkEl || !groundEl) return rows.push({ label, missing: true })
          const cs = getComputedStyle(inkEl)
          const ink = parse(isBorder ? cs.borderTopColor : cs.color)
          if (!ink) return rows.push({ label, missing: 'sem cor' })
          const ground = groundOf(inkSel === groundSel ? groundEl.parentElement : groundEl)
          const value = ratio(over(ink, ground), ground)
          rows.push({ label, ratio: Math.round(value * 100) / 100, floor, ok: value >= floor })
        }
        if (hovering) {
          add(hover[0], false)
          add(hover[1], true)
        } else {
          for (const row of rest) add(row, false)
          for (const row of marks) add(row, false)
          // Hierarchy, not just legibility: a chip that is the same colour as
          // the prose around it is legible and invisible. The plate is what
          // separates them, so the two grounds must actually differ.
          const chip = document.querySelector('.wb-pathlink')
          const prose = document.querySelector('.wb-chat-md p')
          // The two halves of the round live in two conversations, so half the
          // targets are legitimately absent on each pass; those rows are
          // dropped by the caller rather than reported as failures.
          if (chip === null || prose === null) {
            kill.remove()
            return rows
          }
          // NOT "the two grounds are different bytes": `--surface-2` differs
          // from `--bg` by 1,006:1 in the light theme, which is a plate you
          // cannot see. The floor is a measured one.
          const plate = ratio(groundOf(chip), groundOf(prose))
          rows.push({
            label: `placa do chip contra a prosa (${plate.toFixed(3)}:1)`,
            ratio: Math.round(plate * 1000) / 1000,
            floor: 1.08,
            ok: plate >= 1.08
          })
          // The defect a size measurement catches and contrast cannot: the same
          // control rendering at two sizes because `em` compounded inside a
          // code span, and a box taller than the line it sits on.
          const chips = [...document.querySelectorAll('.wb-pathlink')]
          const sizes = new Set(chips.map((c) => getComputedStyle(c).fontSize))
          const tallest = Math.max(...chips.map((c) => c.getBoundingClientRect().height))
          const line = parseFloat(getComputedStyle(prose).lineHeight)
          rows.push({
            label: `chip: um só tamanho (${[...sizes].join(', ')})`,
            ratio: null,
            floor: null,
            ok: sizes.size === 1
          })
          rows.push({
            label: `chip: cabe na linha (${tallest.toFixed(1)}px ≤ ${line}px)`,
            ratio: null,
            floor: null,
            ok: tallest <= line
          })
          rows.push({
            label: 'chip: nenhuma placa dentro de outra',
            ratio: null,
            floor: null,
            ok: document.querySelectorAll('code .wb-pathlink').length === 0
          })
        }

        kill.remove()
        return rows
      },
      { rest: REST, marks: MARKS, hover: HOVER, hovering }
    )

  /**
   * Opens the engine picker on a Devin model that has a ladder AND a fast
   * twin, so the ramp, its cost line and the capacity switch are all on screen
   * at once. Re-selecting is idempotent: the panel closes on choose, so it is
   * reopened afterwards.
   */
  const openPanel = async () => {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      if (await page.locator('.wb-engine-foot').count()) return
      await page.locator('.wb-engine-btn').click()
      await page.waitForTimeout(300)
    }
  }
  const openLadder = async () => {
    // Choosing a model CLOSES the panel, so the reopen is a separate step and
    // not a retry of the same one — a loop that treats them as one keeps
    // re-picking the model and never leaves the panel open, which reports
    // every picker target as "absent". That reads exactly like "nothing to
    // fix", which is the worst thing a probe can say.
    await openPanel()
    const opus = page.getByRole('option', { name: /Claude Opus 5/ }).first()
    if (await opus.count()) {
      await opus.click()
      await page.waitForTimeout(260)
    }
    await openPanel()
    const max = page.getByRole('radio', { name: 'Máximo' })
    if (await max.count()) {
      await max.click()
      await page.waitForTimeout(200)
    }
  }
  const closeLadder = async () => {
    await page.keyboard.press('Escape')
    await page.waitForTimeout(180)
  }

  /**
   * The two halves live in two conversations — a conversation locks to the
   * agent that answered it — so the probe walks between them: the picker is
   * measured on the Devin one, the chips on the transcript reached through
   * "Continuar de onde parou".
   */
  const toTranscript = async () => {
    await page.getByText('Onde você mexeu para consertar o Devin?').first().click()
    await page.waitForTimeout(420)
  }
  const toDevin = async () => {
    await page.locator('button[aria-label="Nova conversa"]').click()
    await page.waitForTimeout(280)
    await page.locator('.wb-agent-pill').first().click()
    await page.waitForTimeout(240)
    await page.getByRole('menuitemradio', { name: 'Devin' }).click()
    await page.waitForTimeout(420)
  }

  const round = async () => {
    await openLadder()
    const picker = await measure(false)
    await closeLadder()
    await toTranscript()
    const chips = await measure(false)
    await page.locator('.wb-pathlink').first().hover()
    await page.waitForTimeout(220)
    const hover = await measure(true)
    await toDevin()
    // Each half reports `missing` for the targets that live in the other, so
    // only the rows that were actually on screen are kept.
    const seen = new Set()
    return [...picker, ...chips, ...hover].filter((row) => {
      if (row.missing || seen.has(row.label)) return false
      seen.add(row.label)
      return true
    })
  }

  const setTheme = async (menuLabel) => {
    await page.locator('.wb-icon-btn[aria-label^="Aparência"]').click()
    // Anchored: the Hive theme's own description reads "Escuro, nas cores da
    // marca", so a loose `Escuro` matches two rows and throws on strict mode.
    await page.getByRole('menuitemradio', { name: new RegExp(`^${menuLabel}`) }).click()
    await page.waitForTimeout(320)
  }

  const report = {}
  // The first theme is SELECTED, never assumed: this browser profile is reused
  // across passes, and a run that started right after a light-theme scene once
  // measured light three times and filed it under "escuro".
  for (const [name, menuLabel] of [
    ['escuro', 'Escuro'],
    ['claro', 'Claro'],
    ['hive', 'Hive']
  ]) {
    await setTheme(menuLabel)
    report[name] = await round()
  }
  return report
}
