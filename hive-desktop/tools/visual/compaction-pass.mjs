// Visual + functional pass for this round: the **`/` command menu that
// completes instead of firing**, the **command token in the composer**, and
// **context compaction** — its seam, its numbers, and Hive's own threshold.
//
//   npx electron-vite build && python3 -m http.server 8123 -d out/renderer
//   HIVE_THEME=dark node tools/visual/run-scene.mjs tools/visual/compaction-pass.mjs
//   (repeat for light and hive — the pass is only closed when all three are)
//
// It drives production code end to end: the menu is the real listbox, the
// completion is the real caret insertion, the seam is drawn by the real
// `compact` event arriving over the real bridge, and every colour is measured
// off painted pixels rather than read off a token.
//
// What it proves, and what no unit test can:
//   1. picking a row leaves the command *in the composer* with the caret after
//      it, and sends nothing;
//   2. a completed command is a visible token under the caret — and a typo is
//      not, which is what makes the pill mean something;
//   3. the compaction seam reads as a seam (full column, rule + mark) and
//      leads with the number it exists to explain;
//   4. the context sheet offers compaction, and says who is minding the
//      ceiling for the agent in play;
//   5. every new surface clears its WCAG floor in this theme.
async (page) => {
  const theme = globalThis.HIVE_THEME || 'dark'
  const shot = (name) => page.screenshot({ path: `.playwright-mcp/compaction-${theme}-${name}.png` })

  await page.goto('http://localhost:8123/index.html')
  await page.waitForTimeout(1200)

  const out = []
  const say = (label, ok, detail) => {
    const line = `${ok ? 'PASS' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`
    out.push(line)
    console.log(line)
  }

  const composer = page.getByPlaceholder('Escreva uma mensagem…')

  /** Types `value` into the composer, replacing whatever is there. */
  const type = async (value) => {
    await composer.fill(value)
    await page.waitForTimeout(120)
  }

  // ---------------------------------------------------------------- 1. menu
  await type('/')
  await page.waitForTimeout(200)
  const sections = await page.locator('.wb-slash-section').allInnerTexts()
  say(
    'menu splits the app’s own commands from the workspace’s skills',
    sections.length === 2 && /HIVE/i.test(sections[0]) && /SKILLS/i.test(sections[1]),
    sections.join(' | ')
  )
  const firstRow = await page.locator('.wb-slash-item').first().innerText()
  // The brackets around the hint are `::before`/`::after` content, and
  // `innerText` cannot see a pseudo-element — the probe has to ask the style
  // system for them (a sonda lesson now recorded in visual-validation.md).
  const hintBrackets = await page.locator('.wb-slash-arg').first().evaluate((node) => [
    getComputedStyle(node, '::before').content,
    getComputedStyle(node, '::after').content
  ])
  say(
    'the compaction row leads, with its argument hint and a sentence',
    /compact/.test(firstRow) &&
      /janela/i.test(firstRow) &&
      hintBrackets.join('') === '"[""]"',
    `${firstRow.replace(/\n/g, ' · ')} ${hintBrackets.join('')}`
  )
  const foot = await page.locator('.wb-slash-menu-foot').innerText()
  say(
    'the footer promises what Enter now does: complete, not run',
    /completar/.test(foot) && !/executa/.test(foot),
    foot.replace(/\n/g, ' ')
  )
  await shot('menu')

  // Match highlighting explains the ranking.
  await type('/ux')
  await page.waitForTimeout(200)
  const marks = await page.locator('.wb-slash-match').count()
  say('the query’s match is painted on the row', marks > 0, `${marks} marca(s)`)

  // ---------------------------------------------------- 2. completion, not fire
  await page.locator('.wb-slash-item').first().click()
  await page.waitForTimeout(250)
  const afterPick = await composer.inputValue()
  const caret = await composer.evaluate((node) => node.selectionStart)
  say(
    'picking completes the command and hands the line back',
    afterPick === '/bmad-ux ' && caret === afterPick.length,
    `valor=${JSON.stringify(afterPick)} caret=${caret}`
  )
  const menuGone = (await page.locator('.wb-slash-menu').count()) === 0
  say('…and the menu closes instead of reopening over the sentence', menuGone)

  // ------------------------------------------------------- 3. the token pill
  await type('/bmad-ux quero uma tela de login')
  await page.waitForTimeout(200)
  const chip = page.locator('.wb-command-chip')
  const chipCount = await chip.count()
  const chipText = chipCount > 0 ? await chip.first().innerText() : '⌀'
  say(
    'a real command is a token under the caret',
    chipCount === 1 && chipText === '/bmad-ux',
    chipText
  )
  await shot('composer-token')

  await type('/bmda-ux quero uma tela de login')
  await page.waitForTimeout(200)
  say(
    '…and a command that names nothing stays plain text',
    (await page.locator('.wb-command-chip').count()) === 0
  )

  // The two tokens are different claims, so they must not share a colour.
  await type('/bmad-ux veja @README.md')
  await page.waitForTimeout(250)
  const tints = await page.evaluate(() => {
    const read = (selector) => {
      const node = document.querySelector(selector)
      return node ? getComputedStyle(node).backgroundColor : null
    }
    return { command: read('.wb-command-chip'), mention: read('.wb-mention-token') }
  })
  say(
    'the command pill and the file pill are told apart by hue',
    tints.command !== null && tints.mention !== null && tints.command !== tints.mention,
    `${tints.command} vs ${tints.mention}`
  )

  // Told apart is half of it: each pill also has to *read as a pill* against
  // the composer, which is the bar the `@` token was tuned to and the failure
  // it was tuned away from ("a smudge"). Both are measured, and the command's
  // floor is the mention's own number — a new token must not be quieter than
  // the one it sits beside. The ink over each stays body text and owes 4.5:1.
  const pills = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 1
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    const parse = (value) => {
      ctx.clearRect(0, 0, 1, 1)
      ctx.fillStyle = '#000'
      ctx.fillStyle = value
      ctx.fillRect(0, 0, 1, 1)
      const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data
      return [r, g, b, a / 255]
    }
    const over = (fg, bg) => fg.map((c, i) => (i === 3 ? 1 : c * fg[3] + bg[i] * (1 - fg[3])))
    const backdrop = (el) => {
      let color = [0, 0, 0, 0]
      for (let node = el; node; node = node.parentElement) {
        const own = parse(getComputedStyle(node).backgroundColor)
        if (own[3] === 0) continue
        color = color[3] === 0 ? own : over(color, own)
        if (color[3] >= 0.999) break
      }
      return color[3] >= 0.999 ? color : over(color, [255, 255, 255, 1])
    }
    const lum = ([r, g, b]) => {
      const f = (c) => {
        const s = c / 255
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
      }
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
    }
    const ratio = (a, b) => {
      const x = lum(a)
      const y = lum(b)
      return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
    }
    const ink = parse(getComputedStyle(document.querySelector('textarea')).color)
    const of = (selector) => {
      const node = document.querySelector(selector)
      if (!node) return null
      const ground = backdrop(node.parentElement)
      const fill = over(parse(getComputedStyle(node).backgroundColor), ground)
      return {
        vsSurface: Number(ratio(fill, ground).toFixed(2)),
        inkOverPill: Number(ratio(over(ink, fill), fill).toFixed(2))
      }
    }
    return { command: of('.wb-command-chip'), mention: of('.wb-mention-token') }
  })
  for (const [label, pill] of Object.entries(pills)) {
    say(
      `pill — ${label} reads as a pill, and the caret's own text over it`,
      pill !== null && pill.vsSurface >= 1.4 && pill.inkOverPill >= 4.5,
      pill === null ? '⌀' : `${pill.vsSurface}:1 sobre a superfície · ${pill.inkOverPill}:1 de tinta`
    )
  }
  await shot('composer-both-tokens')

  // ------------------------------------------------------------ 4. the seam
  await type('/compact')
  await page.waitForTimeout(150)
  await page.getByRole('button', { name: 'Enviar' }).click()
  await page.waitForTimeout(300)
  const pending = await page.locator('.wb-compact-seam[data-pending]').count()
  say('the compaction is on screen while it runs', pending === 1)
  await shot('seam-pending')

  await page.evaluate(() =>
    window.__agentEvent({
      type: 'compact',
      phase: 'end',
      trigger: 'manual',
      preTokens: 22678,
      postTokens: 757,
      durationMs: 8400
    })
  )
  await page.evaluate(() => window.__agentEvent({ type: 'done' }))
  await page.waitForTimeout(350)

  const seam = page.locator('.wb-compact-seam').first()
  const seamText = (await seam.innerText()).replace(/\n/g, ' ')
  say(
    'the settled seam leads with the number it exists to explain',
    /22,7 mil/.test(seamText) && /757/.test(seamText) && /a pedido/.test(seamText),
    seamText
  )
  // A seam is a boundary the column crosses, not another entry in it.
  const geometry = await page.evaluate(() => {
    const node = document.querySelector('.wb-compact-seam')
    const column = document.querySelector('.wb-chat-messages')
    const mark = document.querySelector('.wb-compact-mark')
    if (!node || !column || !mark) return null
    const seam = node.getBoundingClientRect()
    const box = column.getBoundingClientRect()
    const style = getComputedStyle(column)
    // The column's *content* width — its border box carries 24px of padding a
    // child can never span, so comparing against it fails a seam that is in
    // fact edge to edge.
    const content = box.width - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
    const glyph = mark.getBoundingClientRect()
    return {
      spans: Math.abs(seam.width - content) < 2,
      centred: Math.abs(glyph.x - seam.x - (seam.width - glyph.width) / 2) < 2,
      rules: node.querySelectorAll('.wb-compact-rule').length
    }
  })
  say(
    'it spans the column, with a rule on each side of a centred mark',
    geometry !== null && geometry.spans && geometry.centred && geometry.rules === 2,
    JSON.stringify(geometry)
  )
  say('no user bubble was left behind', !(await page.locator('.wb-msg-command').count()))
  // 757 of 200k is a real reading, and "0%" is the one thing a meter must never
  // say about a window that holds something.
  const meterAfter = await page.locator('.wb-ctx-meter').innerText()
  say(
    'the meter admits a sliver instead of rounding it to nothing',
    /<1%/.test(meterAfter),
    meterAfter.replace(/\n/g, ' ')
  )
  await shot('seam')

  // A seam whose agent handed over a summary opens; the one that didn't is a
  // label, because a control that does nothing is worse than no control.
  say('a seam with nothing to show is not a button', !(await page.locator('.wb-compact-mark[data-static]').count() === 0))
  await page.evaluate(() =>
    window.__agentEvent({
      type: 'compact',
      phase: 'end',
      trigger: 'auto',
      summary: '## Objetivo\n\nVersionar os specs do produto e revisar a PRD.\n\n## Decisões\n\n- O vault fica em `second-brain/`.\n- A ingestão passa por revisão humana.'
    })
  )
  await page.waitForTimeout(300)
  // …and an agent that reported no post-count leaves the occupancy genuinely
  // unknown. The meter says so rather than inventing a zero.
  const meterUnread = await page.locator('.wb-ctx-meter').innerText()
  say(
    'an unreported occupancy reads as unknown, not as zero',
    /—/.test(meterUnread) && !/0%/.test(meterUnread),
    meterUnread.replace(/\n/g, ' ')
  )
  const openable = page.locator('.wb-compact-mark').nth(1)
  await openable.click()
  await page.waitForTimeout(250)
  const summaryText = await page.locator('.wb-compact-summary').innerText()
  say(
    'the agent’s own summary opens under the seam',
    // Case-insensitive: the summary's headings step down to the panel's scale
    // *in caps*, and `innerText` returns what is painted — the lesson this
    // repo has now paid for twice.
    /objetivo/i.test(summaryText) && /decisões/i.test(summaryText),
    summaryText.split('\n').slice(0, 3).join(' · ')
  )
  await shot('seam-summary')

  // ------------------------------------------------------- 5. context sheet
  await page.evaluate(() =>
    window.__agentEvent({
      type: 'usage',
      final: true,
      usage: {
        inputTokens: 4000,
        cacheReadTokens: 160000,
        cacheCreationTokens: 4000,
        outputTokens: 900,
        model: 'claude-opus-5'
      }
    })
  )
  await page.waitForTimeout(300)
  await page.locator('.wb-ctx-meter').click()
  await page.waitForTimeout(350)
  const sheet = (await page.locator('.wb-ctx-detail').innerText()).replace(/\n/g, ' · ')
  say(
    'the sheet offers compaction and names who minds this agent’s ceiling',
    /Compactar contexto/.test(sheet) && /Compactar sozinho/.test(sheet),
    sheet.slice(0, 200)
  )
  say('…and reports the compaction it already did', /Compacta(ções|ção)/.test(sheet))
  await shot('context-sheet')

  // ------------------------------------------------------------- 6. contrast
  // In two phases, because the two surfaces cannot be open at once: closing the
  // context sheet to reach the menu takes its targets off the page with it, and
  // a probe that measured them in one pass reported `⌀` for half of them.
  const measureContrast = (targets) =>
    page.evaluate((list) => {
      // The colour apparatus is `csv-contrast.mjs`'s, verbatim, and the reason
      // is a defect this pass produced on its first run: a probe that seeded
      // the ground from `document.body` and composed *downward* measured every
      // light-theme target against black and reported 1.13:1 for plain ink.
      // The ground is found by walking **up** to the first opaque background —
      // `html` included — which is where a theme actually paints.
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = 1
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      /** Any CSS colour (oklch, oklab, color-mix, rgba) → [r,g,b,a] in sRGB. */
      const parse = (value) => {
        ctx.clearRect(0, 0, 1, 1)
        ctx.fillStyle = '#000'
        ctx.fillStyle = value
        ctx.fillRect(0, 0, 1, 1)
        const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data
        return [r, g, b, a / 255]
      }
      const over = (fg, bg) => fg.map((c, i) => (i === 3 ? 1 : c * fg[3] + bg[i] * (1 - fg[3])))
      const backdrop = (el) => {
        let color = [0, 0, 0, 0]
        for (let node = el; node; node = node.parentElement) {
          const own = parse(getComputedStyle(node).backgroundColor)
          if (own[3] === 0) continue
          color = color[3] === 0 ? own : over(color, own)
          if (color[3] >= 0.999) break
        }
        return color[3] >= 0.999 ? color : over(color, [255, 255, 255, 1])
      }
      const lum = ([r, g, b]) => {
        const f = (c) => {
          const s = c / 255
          return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
        }
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
      }
      const ratio = (fg, bg) => {
        const a = lum(fg)
        const b = lum(bg)
        return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
      }
      const measure = (label, selector, floor) => {
        const node = document.querySelector(selector)
        if (!node) return { label, ratio: null, floor, ok: false }
        const ground = backdrop(node)
        const value = ratio(over(parse(getComputedStyle(node).color), ground), ground)
        return { label, ratio: Number(value.toFixed(2)), floor, ok: value >= floor }
      }
    return list.map(([label, selector, floor]) => measure(label, selector, floor))
  }, targets)

  const sheetContrast = await measureContrast([
    ['seam title', '.wb-compact-title', 4.5],
    ['seam "before"', '.wb-compact-from', 4.5],
    ['seam "after"', '.wb-compact-to', 4.5],
    ['seam meta', '.wb-compact-meta', 4.5],
    ['sheet compact CTA', '.wb-ctx-compact-cta', 4.5],
    ['sheet auto label', '.wb-ctx-auto-label', 4.5],
    ['sheet auto hint', '.wb-ctx-auto-hint', 4.5]
  ])

  await page.keyboard.press('Escape')
  await type('/')
  await page.waitForTimeout(250)
  const menuContrast = await measureContrast([
    ['menu section head', '.wb-slash-section', 4.5],
    ['menu command', '.wb-slash-cmd', 4.5],
    ['menu row description', '.wb-slash-item-desc', 4.5],
    ['menu argument hint', '.wb-slash-arg', 4.5],
    ['menu keyboard key', '.wb-slash-kbd', 4.5],
    ['menu footer hint', '.wb-slash-menu-foot', 4.5]
  ])

  for (const row of [...sheetContrast, ...menuContrast]) {
    say(`contraste — ${row.label}`, row.ok, `${row.ratio ?? '⌀'}:1 (piso ${row.floor})`)
  }

  return out.join('\n')
}
