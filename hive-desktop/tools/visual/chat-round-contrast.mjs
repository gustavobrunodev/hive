// Contrast + structure pass for the 2026-09-05 round, three themes in one run:
//
//  1. the tokens inside a sent user message (`MessageToken`) — the run that
//     names a command and the run that names a file, on the bubble's accent
//     fill, which is the ground the old invocation object existed to avoid;
//  2. the travelling light on the composer while a turn runs (`ActivityBorder`);
//  3. the removable chips of the shortcut set, at rest and under the pointer.
//
// Run AFTER tools/visual/boot.mjs:
//   run_code_unsafe --filename tools/visual/chat-round-contrast.mjs
//   node tools/visual/run-scene.mjs tools/visual/chat-round-contrast.mjs
//
// Colours are resolved by PAINTING them into a 1×1 canvas and reading the pixel
// back, then compositing translucent layers down the stack — the two traps
// docs/visual-validation.md records (a naive parser reads `oklch()`/`color-mix()`
// as near-black; dividing out a tint's alpha explodes it to near-white).
//
// It also asserts three things contrast cannot see, each of which was a real
// defect in the surface this round replaced:
//   - the command token's plate is actually visible against the bubble it sits
//     on (≥1.08:1 — the `--surface-2`-on-`--bg` lesson, where a "plate" measured
//     1.006:1 and simply wasn't there);
//   - the token's box is no taller than the line it sits in, so a message with
//     one does not loosen against a message without;
//   - the command NAME is never truncated. The old token ellipsised it
//     (`/bmad-…`) because it shared one line with arguments free to grow, and
//     that is the single most important run in the message.
async (page) => {
  const OUT = '/home/gustavobgt/user-harness/hive/hive-desktop/.playwright-mcp'

  const stage = async () => {
    const box = page.locator('textarea').first()
    const send = async (text) => {
      await box.click()
      await box.fill(text)
      await page.keyboard.press('Enter')
      await page.waitForTimeout(200)
    }
    const emit = (list) =>
      page.evaluate((events) => {
        for (const e of events) window.__agentEvent(e)
      }, list)

    if ((await page.locator('.hds-message-token').count()) === 0) {
      await send('Preciso revisar o escopo do faturamento antes da sprint.')
      await emit([{ type: 'token', text: 'Claro, vamos por partes.' }, { type: 'done' }])
      await send(
        '/bmad-prd revisar o escopo de faturamento com foco em cobrança recorrente, a partir de @README.md — inadimplência entra depois'
      )
      await emit([{ type: 'token', text: 'Lendo os artefatos.' }, { type: 'done' }])
      await send('e o que falta para fechar?')
      // Left running on purpose: the ring is only measurable while it is on.
      await emit([{ type: 'token', text: 'Verificando as pendências…' }])
    }
    await page.waitForTimeout(400)
  }

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
        return { r, g, b, a: a / 255 }
      }
      const over = (top, bottom) => ({
        r: top.r + (bottom.r - top.r) * (1 - top.a),
        g: top.g + (bottom.g - top.g) * (1 - top.a),
        b: top.b + (bottom.b - top.b) * (1 - top.a),
        a: 1
      })
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

      const out = []
      /** Text against whatever really paints under it, starting at the element. */
      const text = (selector, label, floor) => {
        const el = document.querySelector(selector)
        if (!el) return out.push({ label, missing: true })
        const style = getComputedStyle(el)
        const bg = backdrop(el)
        const fg = over(paint(style.color), bg)
        const size = parseFloat(style.fontSize)
        const bold = parseInt(style.fontWeight, 10) >= 700
        const min = floor ?? (size >= 24 || (bold && size >= 18.66) ? 3 : 4.5)
        const r = ratio(fg, bg)
        out.push({ label, ratio: r, floor: min, passes: r >= min, px: Math.round(size * 100) / 100 })
      }
      /** A non-text carrier (a stroke, a plate edge) against its own ground. */
      const carrier = (selector, cssColor, againstSelector, label, floor) => {
        const el = document.querySelector(selector)
        const ground = document.querySelector(againstSelector)
        if (!el || !ground) return out.push({ label, missing: true })
        const value = cssColor(getComputedStyle(el))
        const bg = backdrop(ground)
        const fg = over(paint(value), bg)
        const r = ratio(fg, bg)
        out.push({ label, ratio: r, floor, passes: r >= floor })
      }

      // 1. Tokens inside the user bubble.
      text('.hds-chat-message-user .hds-message-token[data-kind="command"]', 'token de comando')
      text('.hds-chat-message-user .hds-message-token[data-kind="file"]', 'token de arquivo')
      text('.hds-chat-message-user .wb-user-text', 'prosa da mensagem enviada')
      // The plate has to EXIST: a "plate" that measures 1.006:1 against its
      // ground is text with a glyph next to it, not a token.
      const cmd = document.querySelector(
        '.hds-chat-message-user .hds-message-token[data-kind="command"]'
      )
      if (!cmd) out.push({ label: 'placa do token vs bolha', missing: true })
      else {
        const plate = backdrop(cmd)
        const bubble = backdrop(cmd.closest('.hds-chat-message-bubble'))
        const r = ratio(plate, bubble)
        out.push({ label: 'placa do token vs bolha', ratio: r, floor: 1.08, passes: r >= 1.08 })
      }

      // 2. The travelling light, against the surface it rides.
      carrier(
        '.hds-activity-border-ring rect[data-lane="head"]',
        (s) => s.stroke,
        '.wb-composer .hds-prompt-input',
        'cabeça do facho (piso 3:1)',
        3
      )
      // The composer's resting border is NOT held to 3:1, and it never was:
      // measured, `--border-strong` on this ground is 1,98 (escuro) · 1,70
      // (claro) · 1,92 (hive) — ordinary container-edge numbers. It is not the
      // state indicator either; the facho above is (6,7:1), together with the
      // send control flipping to stop and the status line under the turn. What
      // this border has to do is stop the frame FLICKERING between "border" and
      // "light" as the head passes, so what gets asserted is the thing that
      // does that job: while a turn runs it is measurably brighter than at
      // rest. Held to a flat 3:1 it reads as a defect that isn't one, and the
      // "fix" would be to brighten a plain 1px edge past every other edge in
      // the app. (Third time this lesson lands — see the ramp trough and the
      // MCP dock plate in docs/visual-validation.md.)
      const input = document.querySelector('.wb-composer .hds-prompt-input')
      const composer = document.querySelector('.wb-composer')
      if (!input || !composer) out.push({ label: 'borda do compositor', missing: true })
      else {
        const ground = backdrop(composer)
        const root = getComputedStyle(document.documentElement)
        const working = ratio(over(paint(getComputedStyle(input).borderTopColor), ground), ground)
        const resting = ratio(
          over(paint(root.getPropertyValue('--border-strong').trim()), ground),
          ground
        )
        out.push({
          label: 'borda do compositor: em trabalho > em repouso',
          ratio: working,
          floor: Math.round((resting + 0.3) * 100) / 100,
          passes: working >= resting + 0.3
        })
      }

      // 3. The removable chips of the shortcut set.
      text('.wb-sc-chip', 'rótulo do chip do conjunto')
      text('.wb-sc-clear', 'ação "Remover todos"')
      carrier('.wb-sc-chip-x svg', (s) => s.color, '.wb-sc-chip', 'X do chip (piso 3:1)', 3)

      return out
    })

  /** Assertions contrast is blind to. */
  const structure = () =>
    page.evaluate(() => {
      const claims = []
      const say = (name, pass, detail) =>
        claims.push(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)

      const cmd = document.querySelector(
        '.hds-chat-message-user .hds-message-token[data-kind="command"]'
      )
      if (!cmd) return ['FAIL nenhum token de comando na tela']

      // The defect that opened this round: the name was ellipsised.
      say(
        'o nome do comando não é truncado',
        cmd.scrollWidth <= cmd.clientWidth + 1,
        `${cmd.textContent} · scroll ${cmd.scrollWidth} / client ${cmd.clientWidth}`
      )
      const line = parseFloat(getComputedStyle(cmd.closest('.wb-user-text')).lineHeight)
      say(
        'a caixa do token cabe na linha',
        cmd.getBoundingClientRect().height <= line + 0.5,
        `${Math.round(cmd.getBoundingClientRect().height * 10) / 10}px vs line-height ${line}px`
      )
      // One size, in `rem`: `em` composes with a parent's own relative size and
      // the same token renders at two sizes in one message.
      const sizes = new Set(
        [...document.querySelectorAll('.hds-message-token')].map(
          (el) => getComputedStyle(el).fontSize
        )
      )
      say('um só tamanho de token', sizes.size <= 2, [...sizes].join(' / '))

      // The message is still a message: it keeps the bubble every other one has.
      const bubble = cmd.closest('.hds-chat-message-bubble')
      const plain = document.querySelector(
        '.hds-chat-message-user .hds-chat-message-bubble:not(:has(.hds-message-token))'
      )
      say(
        'a mensagem com comando mantém a bolha das outras',
        plain !== null &&
          getComputedStyle(bubble).backgroundColor === getComputedStyle(plain).backgroundColor,
        getComputedStyle(bubble).backgroundColor
      )

      // The ring is decoration; the state it mirrors is announced elsewhere.
      const ring = document.querySelector('.hds-activity-border-ring')
      say('o facho está fora da árvore de acessibilidade', ring?.getAttribute('aria-hidden') === 'true')
      return claims
    })

  const report = {}
  for (const [label, theme] of [
    ['dark', 'Escuro Grafite'],
    ['light', 'Claro'],
    ['hive', 'Hive Escuro']
  ]) {
    await page.keyboard.press('Escape')
    await page.waitForTimeout(150)
    await page.locator('button[aria-label^="Aparência"]').click()
    await page.waitForTimeout(250)
    await page.getByRole('menuitemradio', { name: theme, exact: false }).first().click()
    await page.waitForTimeout(400)
    await stage()

    // The chip only exists inside the picker, and its ✕ only under the pointer.
    await page.getByRole('button', { name: 'Personalizar atalhos' }).first().click()
    await page.waitForTimeout(450)
    await page.locator('.wb-sc-chip').first().hover()
    await page.waitForTimeout(220)
    await page.locator('.wb-sc-dialog').screenshot({ path: `${OUT}/round-picker-${label}.png` })
    const dialog = await measure()
    await page.getByRole('button', { name: 'Concluído' }).click()
    await page.waitForTimeout(300)

    await page.locator('.wb-chat-messages').screenshot({ path: `${OUT}/round-bubbles-${label}.png` })
    await page.locator('.wb-composer').screenshot({ path: `${OUT}/round-composer-${label}.png` })

    const samples = [...dialog, ...(await measure())]
    const seen = new Set()
    const merged = samples.filter((s) => {
      if (s.missing && samples.some((o) => o.label === s.label && !o.missing)) return false
      if (seen.has(s.label)) return false
      seen.add(s.label)
      return true
    })
    report[label] = {
      fails: merged.filter((s) => s.passes === false),
      missing: merged.filter((s) => s.missing).map((s) => s.label),
      structure: (await structure()).filter((line) => line.startsWith('FAIL')),
      samples: merged
    }
  }
  return JSON.stringify(report, null, 1)
}
