// Visual-pass scenario for the conversation scope of the in-chat change card
// (Agent Change Review, ACR-R2.2).
//
// Run AFTER tools/visual/boot.mjs:
//   run_code_unsafe --filename tools/visual/review-scope.mjs
//
// The defect it exists to show: the pending set is per workspace, so every
// conversation used to render every turn's change card. A review asked for in
// one conversation appeared — pending, actionable, unexplained — at the bottom
// of the next one. The scene puts two conversations on the same workspace, each
// with a turn that edited one file, and walks the three surfaces that now carry
// the scope: the card in its own transcript, the card in the other transcript,
// and the history list's marker pointing back at whichever conversation is
// still holding something.
//
// Theme is switched through the REAL topbar control, never localStorage — the
// boot init script rewrites that key on every navigation, so a probe that sets
// it measures its own default three times (docs/visual-validation.md). All
// three themes run in this single file for the same reason.
async (page) => {
  const shot = (name) =>
    page.screenshot({
      path: `/home/gustavobgt/user-harness/hive/hive-desktop/.playwright-mcp/revscope-${name}.png`
    })

  const setTheme = async (theme) => {
    await page.locator('.wb-icon-btn[aria-label^="Aparência"]').click()
    await page
      .getByRole('menuitemradio', { name: { dark: 'Escuro', light: 'Claro', hive: 'Hive' }[theme] })
      .click()
    await page.waitForTimeout(250)
  }

  // Colours are sampled by painting a pixel, never by regex: tokens authored in
  // `oklch()` come back verbatim from getComputedStyle, and a regex parser
  // *skips* them silently — a skipped sample looks exactly like a passing one
  // (docs/visual-validation.md, M15). Backgrounds composite up the ancestor
  // chain, so the popover's own surface is what the marker is measured against.
  const measure = () =>
    page.evaluate(() => {
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = 1
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      const paint = (value) => {
        ctx.clearRect(0, 0, 1, 1)
        ctx.fillStyle = '#000'
        ctx.fillStyle = value
        ctx.fillRect(0, 0, 1, 1)
        const d = ctx.getImageData(0, 0, 1, 1).data
        return { rgb: [d[0], d[1], d[2]], a: d[3] / 255 }
      }
      const over = (f, b) => f.rgb.map((c, i) => c * f.a + b[i] * (1 - f.a))
      const lum = (rgb) => {
        const [r, g, b] = rgb.map((c) => {
          const s = c / 255
          return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
        })
        return 0.2126 * r + 0.7152 * g + 0.0722 * b
      }
      const ratio = (a, b) => {
        const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
        return (hi + 0.05) / (lo + 0.05)
      }
      const backdrop = (node) => {
        const stack = []
        for (let el = node; el; el = el.parentElement) {
          const bg = paint(getComputedStyle(el).backgroundColor)
          if (bg.a > 0) stack.push(bg)
          if (bg.a === 1) break
        }
        let base = [255, 255, 255]
        for (const layer of stack.reverse()) base = over(layer, base)
        return base
      }
      // The marker's label (text, 4.5:1) and its pencil (non-text carrier, 3:1).
      const TARGETS = [
        ['marca de revisão pendente', '.wb-history-review', 4.5],
        ['ícone da marca', '.wb-history-review svg', 3]
      ]
      const failures = []
      const missing = []
      const samples = []
      for (const [label, selector, floor] of TARGETS) {
        const el = document.querySelector(selector)
        if (!el) {
          missing.push(label)
          continue
        }
        const style = getComputedStyle(el)
        const fg = paint(style.color)
        const r = ratio(over(fg, backdrop(el)), backdrop(el.parentElement ?? el))
        samples.push({ label, ratio: Number(r.toFixed(2)), floor })
        if (r < floor) failures.push({ label, ratio: Number(r.toFixed(2)), floor })
      }
      return { samples, failures, missing }
    })

  const type = async (text) => {
    const box = page.locator('textarea').first()
    await box.click()
    await box.fill(text)
    await page.keyboard.press('Enter')
    await page.waitForTimeout(200)
  }

  const emit = (events) =>
    page.evaluate((list) => {
      for (const event of list) window.__agentEvent(event)
    }, events)

  const line = (type, text, oldNo, newNo) => ({ type, text, oldNo, newNo })

  // What each conversation's turn left on disk.
  const memlog = {
    path: '_bmad-output/party-mode/memories/installed/.memlog.md',
    status: 'modified',
    adds: 6,
    dels: 0,
    diff: {
      binary: false,
      hunks: [
        {
          header: '@@ -1,3 +1,9 @@',
          oldStart: 1,
          newStart: 1,
          lines: [
            line('ctx', '# Memórias da sala', 1, 1),
            line('ctx', '', 2, 2),
            line('add', '## 2026-08-14 — rodada com John e Mary', null, 3),
            line('add', '- Produto ainda não nomeado; sensação vaga aceita como entrada.', null, 4),
            line('add', '- Mary assume a pesquisa de contexto.', null, 5),
            line('add', '- John cobra uma frase de produto até sexta.', null, 6),
            line('add', '', null, 7),
            line('add', '<!-- registrado pela party-mode -->', null, 8),
            line('ctx', '## Anterior', 3, 9)
          ]
        }
      ]
    }
  }
  const brief = {
    path: 'docs/brief-brainstorm.md',
    status: 'created',
    adds: 4,
    dels: 0,
    diff: {
      binary: false,
      hunks: [
        {
          header: '@@ -0,0 +1,4 @@',
          oldStart: 0,
          newStart: 1,
          lines: [
            line('add', '# Brainstorm — sessão 2', null, 1),
            line('add', '', null, 2),
            line('add', '## Divergir', null, 3),
            line('add', '- 12 ideias soltas, sem filtro.', null, 4)
          ]
        }
      ]
    }
  }

  // --- conversation 1: the party-mode round that edited the memory log ------
  await type('Reúne o time e decide o que fazemos com essa ideia solta')
  await emit([
    {
      type: 'token',
      text: 'John: Certo. Três perguntas, escolhe uma e responde solto.\n\nMary: E se você tem só uma sensação vaga, joga a sensação vaga. Eu trabalho com isso.'
    },
    {
      type: 'tool',
      name: 'Edit',
      detail: memlog.path,
      toolId: 'e1',
      phase: 'start',
      filePath: `/ws/${memlog.path}`
    }
  ])
  await page.waitForTimeout(700)
  await emit([{ type: 'tool', name: '', toolId: 'e1', phase: 'end', ok: true }, { type: 'done' }])
  await page.waitForTimeout(300)

  // The pending set as main would have it after that turn: one file, one turn,
  // named with the conversation that asked for it (`s1`, minted by the mock's
  // chatHistory.create on the first message).
  await page.evaluate(
    ([change, at]) => {
      window.__setReview({
        changes: [change],
        turns: [{ turnId: 'turn-1', at, paths: [change.path], conversationId: 's1' }]
      })
    },
    [memlog, Date.now()]
  )
  await page.waitForTimeout(400)
  await shot('conv1-dark')

  // --- conversation 2: a fresh one, its own turn, its own file --------------
  await page.locator('.wb-history-trigger[aria-label="Nova conversa"]').click()
  await page.waitForTimeout(250)
  await type('/bmad-brainstorming')
  await emit([
    { type: 'token', text: 'Iniciando.' },
    {
      type: 'tool',
      name: 'Write',
      detail: brief.path,
      toolId: 'w1',
      phase: 'start',
      filePath: `/ws/${brief.path}`
    }
  ])
  await page.waitForTimeout(600)
  await emit([{ type: 'tool', name: '', toolId: 'w1', phase: 'end', ok: true }, { type: 'done' }])

  // Both conversations now hold something. This is the exact state that used to
  // print conversation 1's card at the bottom of conversation 2.
  await page.evaluate(
    ([a, b, at]) => {
      window.__setReview({
        changes: [a, b],
        turns: [
          { turnId: 'turn-1', at, paths: [a.path], conversationId: 's1' },
          { turnId: 'turn-2', at: at + 1000, paths: [b.path], conversationId: 's2' }
        ]
      })
    },
    [memlog, brief, Date.now()]
  )
  await page.waitForTimeout(400)
  await shot('conv2-dark')

  // The history list is the thread back to a review waiting elsewhere.
  const contrast = {}
  await page.locator('.wb-history-trigger[aria-label="Histórico de conversas"]').click()
  await page.waitForTimeout(400)
  await shot('history-dark')
  contrast.dark = await measure()
  await page.keyboard.press('Escape')
  await page.waitForTimeout(200)

  // Same three states in the other two themes.
  for (const theme of ['light', 'hive']) {
    await setTheme(theme)
    await shot(`conv2-${theme}`)
    await page.locator('.wb-history-trigger[aria-label="Histórico de conversas"]').click()
    await page.waitForTimeout(400)
    await shot(`history-${theme}`)
    contrast[theme] = await measure()
    await page.keyboard.press('Escape')
    await page.waitForTimeout(200)
  }

  // What conversation 2 shows, and what it must not: its own file, never the
  // other conversation's.
  const scene = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('.wb-change-card')].map((el) =>
      el.innerText.replace(/\s+/g, ' ').trim()
    )
    return { cards, bar: document.querySelector('.wb-review-bar')?.innerText ?? null }
  })
  // A missing sample is a state that never rendered, not a pass — the verdict
  // needs both lists empty in all three themes.
  const verdict = Object.entries(contrast).every(
    ([, r]) => r.failures.length === 0 && r.missing.length === 0
  )
  return { scene, contrast, verdict: verdict ? 'PASS' : 'FAIL' }
}
