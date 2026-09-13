// Contrast + geometry probe for this round's three UI changes. Run AFTER
// tools/visual/boot.mjs and tools/visual/round-2026-09-13b.mjs, which build
// the scene this measures.
//
// Walks the three themes through the real "Aparência" control and, in each:
//
//   1. measures every text carrier the round touches, compositing translucent
//      tints over the stack beneath them (the two traps
//      docs/visual-validation.md records: `color-mix()`/`oklch()` come back
//      from getComputedStyle in forms a naive parser reads as near-black, and
//      dividing out a 10% tint's alpha explodes it to near-white — so colours
//      are resolved by PAINTING them into a 1×1 canvas);
//   2. measures the two *surface* pairs that have to be told apart rather than
//      read — the attachment chip against the bubble it sits in, and the
//      fence's header strip against its body. A block inside a block is only
//      a block if its edge is visible; 3:1 is the floor a non-text boundary
//      owes (WCAG 1.4.11);
//   3. reports the `@` menu's scrollbar as *geometry*, because a scrollbar is
//      the one thing a colour measurement cannot confirm: the question is
//      whether Chromium took the `::-webkit-scrollbar` path at all, and the
//      only honest evidence is the reserved gutter (`offsetWidth -
//      clientWidth`) plus the computed pseudo-element.
async (page) => {
  const OUT = globalThis.HIVE_SHOT_DIR || '/home/gustavobgt/user-harness/hive/.playwright-mcp'

  const measure = () =>
    page.evaluate(() => {
      const paint = (css) => {
        const c = document.createElement('canvas')
        c.width = c.height = 1
        const ctx = c.getContext('2d', { willReadFrequently: true })
        ctx.clearRect(0, 0, 1, 1)
        ctx.fillStyle = css
        ctx.fillRect(0, 0, 1, 1)
        const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data
        // NOT premultiply-corrected on purpose: dividing by alpha is the trap.
        return { r, g, b, a: a / 255 }
      }
      const over = (top, bottom) => ({
        r: top.r + (bottom.r - top.r) * (1 - top.a),
        g: top.g + (bottom.g - top.g) * (1 - top.a),
        b: top.b + (bottom.b - top.b) * (1 - top.a),
        a: 1
      })
      /** The opaque stack under `el`, compositing every translucent tint on the way down. */
      const backdrop = (el, from) => {
        const layers = []
        for (let node = from ?? el; node; node = node.parentElement) {
          const bg = paint(getComputedStyle(node).backgroundColor)
          if (bg.a === 0) continue
          layers.push(bg)
          if (bg.a === 1) break
        }
        return layers.reduceRight((acc, layer) => (acc ? over(layer, acc) : layer), null)
      }
      const lum = ({ r, g, b }) =>
        [r, g, b]
          .map((v) => v / 255)
          .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
          .reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0)
      const ratio = (fg, bg) => {
        const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x)
        return Math.round(((a + 0.05) / (b + 0.05)) * 100) / 100
      }

      /** Text (or an icon) against whatever really sits behind it. */
      const text = (selector, label, floor) => {
        const el = document.querySelector(selector)
        if (!el) return { label, missing: true }
        const style = getComputedStyle(el)
        const bg = backdrop(el)
        const fg = over(paint(style.color), bg)
        const size = parseFloat(style.fontSize)
        const bold = parseInt(style.fontWeight, 10) >= 700
        const auto = size >= 24 || (bold && size >= 18.66) ? 3 : 4.5
        const need = floor ?? auto
        const r = ratio(fg, bg)
        return { label, ratio: r, floor: need, passes: r >= need }
      }

      /** Two SURFACES that have to be distinguishable from each other (1.4.11, 3:1). */
      const surfaces = (innerSel, outerSel, label) => {
        const inner = document.querySelector(innerSel)
        const outer = document.querySelector(outerSel)
        if (!inner || !outer) return { label, missing: true }
        const a = backdrop(inner)
        // Start the outer stack ABOVE the inner element, or the walk climbs
        // straight back through the very tint being compared.
        const b = backdrop(outer)
        const r = ratio(a, b)
        return { label, ratio: r, floor: 3, passes: r >= 3 }
      }

      /**
       * A BORDER against the two surfaces it separates — the weaker of the two,
       * since a line is only as findable as its worst side.
       *
       * **Reported, not scored**, and the reasoning is written here so the next
       * round neither re-adds a floor nor re-deletes the row.
       *
       * It started as two fill-vs-fill targets at a 3:1 floor: "faixa ↔ corpo
       * do bloco" measured 1.16:1, "bloco ↔ resposta" 1.07:1, and both read as
       * failures. They were the wrong measurement — on a dark theme every
       * surface in the app is within a few points of luminance of every other,
       * so a fill was never what tells a code block from the prose around it.
       * Re-aimed at the edge, the number rose to ~1.3:1 and still sat under 3.
       *
       * Which is the point at which the floor has to be justified rather than
       * assumed. WCAG 1.4.11 covers what is *required* to identify a component
       * or understand a graphic. Nothing here is: the code reads at 12.8:1, the
       * language tag at 6:1 and the copy control at 6:1 both mark where the
       * block begins, and there is no state of the frame a user has to
       * perceive. Driving a hairline to 3:1 would put a near-white rule around
       * every snippet in the transcript — the one outcome nobody is asking for.
       *
       * So the row stays, because "the block's edge got stronger" is a real
       * claim this round makes (`--border` → `--border-strong`, measured
       * 1.31 → 1.38 dark) and a number is how it is checked. It just is not a
       * pass/fail gate, for the same reason the empty half of a ramp's trough
       * is not one.
       */
      const edge = (selector, label, side) => {
        const el = document.querySelector(selector)
        if (!el) return { label, missing: true }
        const style = getComputedStyle(el)
        const inside = backdrop(el)
        const outside = backdrop(el, el.parentElement)
        const line = paint(style[side === 'bottom' ? 'borderBottomColor' : 'borderTopColor'])
        const against = [inside, outside].map((ground) => ratio(over(line, ground), ground))
        return { label, ratio: Math.min(...against), both: against, informative: true }
      }

      const port = document.querySelector('.wb-mention-scroll')
      const bar = port ? getComputedStyle(port, '::-webkit-scrollbar') : null
      const thumb = port ? getComputedStyle(port, '::-webkit-scrollbar-thumb') : null

      /**
       * What the bubble's chip measured BEFORE this round, by re-applying the
       * treatment it had: a 16% white wash carrying the bubble's own ink, with
       * the file icon in its hue-coded colour.
       *
       * Measured rather than remembered, because "it looked low" is not a
       * finding and the whole point of the change is the size of the gap.
       */
      const baselineChip = () => {
        const chip = document.querySelector('.wb-bubble-attachment')
        const name = chip?.querySelector('.hds-attachment-name')
        const icon = chip?.querySelector('.wb-file-icon')
        if (!chip || !name || !icon) return null
        const saved = chip.getAttribute('style') ?? ''
        const savedName = name.getAttribute('style') ?? ''
        const savedIcon = icon.getAttribute('style') ?? ''
        chip.style.background = 'oklch(100% 0 0 / 16%)'
        chip.style.borderColor = 'transparent'
        chip.style.color = 'var(--accent-ink)'
        name.style.color = 'inherit'
        // The hue-coded ramp, as `.wb-file-icon[data-kind='image']` sets it.
        icon.style.color = 'var(--wb-ic-pink)'
        icon.style.opacity = '0.85'
        const out = {
          name: text('.wb-bubble-attachment .hds-attachment-name', 'nome (antes)'),
          icon: text('.wb-bubble-attachment .wb-file-icon', 'ícone (antes)', 3),
          chipVsBubble: surfaces(
            '.wb-bubble-attachment',
            '.hds-chat-message-user .hds-chat-message-bubble',
            'chip ↔ balão (antes)'
          )
        }
        chip.setAttribute('style', saved)
        name.setAttribute('style', savedName)
        icon.setAttribute('style', savedIcon)
        return out
      }

      return {
        bubbleChip: [
          text('.wb-bubble-attachment .hds-attachment-name', 'nome do arquivo no balão'),
          // An icon is a non-text graphic: 3:1 (WCAG 1.4.11), not 4.5:1.
          text('.wb-bubble-attachment .wb-file-icon', 'ícone do arquivo no balão', 3),
          text('.hds-chat-message-user .wb-user-text', 'texto da mensagem (controle)'),
          surfaces(
            '.wb-bubble-attachment',
            '.hds-chat-message-user .hds-chat-message-bubble',
            'chip ↔ balão (limite de bloco)'
          )
        ],
        fence: [
          text('.hds-fence-lang', 'etiqueta de linguagem'),
          text('.hds-fence-copy', 'botão Copiar (repouso)'),
          text('.hds-fence > pre', 'código'),
          edge('.hds-fence', 'moldura do bloco ↔ o que ela separa', 'top'),
          edge('.hds-fence-bar', 'linha da faixa ↔ o que ela separa', 'bottom')
        ],
        bubbleChipBefore: baselineChip(),
        copyAtRest: (() => {
          // The control must be QUIET at rest — the screenshots showed a plate
          // around it and a plate is what `:hover`/`:focus-within` draw, so the
          // computed value is the only way to tell "designed that way" from
          // "the pointer happened to be there".
          const el = document.querySelector('.hds-fence-copy')
          if (!el) return null
          const style = getComputedStyle(el)
          return { background: style.backgroundColor, border: style.borderTopColor }
        })(),
        mentionScrollbar: {
          // The only honest evidence that Chromium took the
          // `::-webkit-scrollbar` path rather than the platform one.
          gutterPx: port ? port.offsetWidth - port.clientWidth : null,
          declaredWidth: bar ? bar.width : null,
          thumbColor: thumb ? thumb.backgroundColor : null,
          scrollbarWidthProperty: port ? getComputedStyle(port).scrollbarWidth : null,
          scrollable: port ? port.scrollHeight > port.clientHeight : null
        }
      }
    })

  const report = {}
  for (const [label, theme] of [
    ['dark', 'Escuro Grafite'],
    ['light', 'Claro'],
    ['hive', 'Hive Escuro']
  ]) {
    // A menu left open from a previous step swallows the next click.
    await page.keyboard.press('Escape')
    await page.waitForTimeout(150)
    await page.locator('button[aria-label^="Escolha do tema"]').click()
    await page.waitForTimeout(250)
    await page.getByRole('menuitemradio', { name: theme, exact: false }).first().click()
    await page.waitForTimeout(400)

    // Re-open the `@` menu: switching themes closed it with the Escape above.
    const composer = page.getByPlaceholder('Escreva uma mensagem…')
    await composer.click()
    await composer.fill('')
    await composer.type('compara com @relatorio', { delay: 8 })
    await page.waitForTimeout(400)
    await page.evaluate(() => {
      const port = document.querySelector('.wb-mention-scroll')
      if (port) port.scrollTop = 90
    })
    await page.waitForTimeout(200)

    for (const [name, selector] of [
      ['round13b-bubble', '.hds-chat-message-user'],
      ['round13b-fence', '.hds-fence'],
      ['round13b-mention', '.wb-mention-menu']
    ]) {
      const box = await page.locator(selector).first().boundingBox()
      if (!box) continue
      const x = Math.max(0, box.x - 16)
      const y = Math.max(0, box.y - 16)
      await page.screenshot({
        path: `${OUT}/${name}-${label}.png`,
        clip: {
          x,
          y,
          width: Math.min(1440 - x, box.width + 32),
          height: Math.min(900 - y, box.height + 32)
        }
      })
    }
    report[label] = await measure()
  }
  return JSON.stringify(report, null, 1)
}
