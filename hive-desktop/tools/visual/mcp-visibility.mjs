// Companion to tools/visual/boot.mjs — run it once, after boot. It drives the
// three surfaces mcp-visibility added and measures WCAG contrast on each, in
// all three themes, leaving a screenshot per state.
//
// The surfaces, and what each is for:
//
//   1. **status card** — the standing answer to "quais servidores MCP eu
//      tenho". It hangs off the status-bar cluster on hover *and* focus, so the
//      probe opens it by focusing the button rather than hovering: a card that
//      only exists under a pointer is a card a keyboard user does not have.
//   2. **console strip** — the same roster inside the dock, present even when
//      the stream below it is empty. Measured in exactly that state, which is
//      the one the old console got wrong.
//   3. **transcript row** — the turn's handshake, in its plain and its failed
//      form (the failed one tints its own background, so its text has to be
//      measured against that tint and not against the surface).
//
// Same two disciplines as tools/visual/mcp-console-contrast.mjs, for the same
// reasons documented there: themes are switched through the app's own
// Aparência menu (never localStorage, which boot.mjs re-pins on navigation),
// and colours are sampled by painting a pixel (never by regex, which silently
// skips oklch() and makes a skipped sample look like a passing one).
//
// Floors, from PRODUCT.md: 4.5:1 for text, 3:1 for meaningful non-text.
async (page) => {
  const SHOT_DIR = '/home/gustavobgt/user-harness/hive/hive-desktop/.playwright-mcp'

  /** Puts a turn on screen carrying an MCP handshake row. */
  const seedTranscript = async (trouble) => {
    await page.evaluate((bad) => {
      const servers = [
        { name: 'playwright', status: bad ? 'failed' : 'connected', tools: ['browser_navigate'] },
        { name: 'pencil', status: 'connected', tools: ['execute', 'get_app_state'] },
        { name: 'hive-approvals', status: 'connected', tools: ['approve'] }
      ]
      window.__agentEvent?.({ type: 'mcp', servers })
      window.__agentEvent?.({ type: 'token', text: 'Vou abrir o Google e pesquisar.' })
      window.__agentEvent?.({
        type: 'tool',
        name: 'mcp__playwright__browser_navigate',
        detail: 'https://www.google.com',
        toolId: 'mcp-1',
        phase: 'start'
      })
      window.__agentEvent?.({ type: 'tool', name: '', toolId: 'mcp-1', phase: 'end', ok: true })
    }, trouble)
    await page.waitForTimeout(350)
  }

  /** Opens the status cluster's roster card the way a keyboard user would. */
  const openStatusCard = async () => {
    await page.locator('.wb-status-mcp').focus()
    await page.waitForTimeout(250)
  }

  const openConsole = async () => {
    if ((await page.locator('.wb-mcplog').count()) === 0) {
      await page.keyboard.press('Control+Shift+M')
      await page.waitForTimeout(400)
    }
  }

  const measure = async (selectors) =>
    await page.evaluate(({ TEXT, MARKS }) => {
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

      const results = []
      for (const [label, selector] of TEXT) {
        const node = document.querySelector(selector)
        if (!node) {
          results.push({ label, ratio: null, min: 4.5, note: 'ausente' })
          continue
        }
        const bg = backdrop(node)
        const fg = paint(getComputedStyle(node).color)
        results.push({ label, ratio: Math.round(ratio(over(fg, bg), bg) * 100) / 100, min: 4.5 })
      }
      for (const [label, selector] of MARKS) {
        const node = document.querySelector(selector)
        if (!node) {
          results.push({ label, ratio: null, min: 3, note: 'ausente' })
          continue
        }
        const style = getComputedStyle(node)
        const own = paint(style.backgroundColor)
        const pseudo = paint(getComputedStyle(node, '::before').backgroundColor)
        const mark = own.a > 0 ? own : pseudo.a > 0 ? pseudo : paint(style.color)
        const bg = backdrop(node.parentElement ?? node)
        results.push({ label, ratio: Math.round(ratio(over(mark, bg), bg) * 100) / 100, min: 3 })
      }

      return {
        failures: results.filter((r) => r.ratio !== null && r.ratio < r.min),
        missing: results.filter((r) => r.ratio === null).map((r) => r.label),
        worst: results
          .filter((r) => r.ratio !== null)
          .sort((a, b) => a.ratio / a.min - b.ratio / b.min)
          .slice(0, 3)
      }
    }, selectors)

  const TRANSCRIPT = {
    TEXT: [
      ['turno: manchete', '.wb-mcpturn-head'],
      ['turno: nome do servidor', '.wb-mcpturn-name'],
      ['turno: contagem de ferramentas', '.wb-mcpturn-count']
    ],
    MARKS: [
      ['turno: ponto conectado', '.wb-mcpturn-chip[data-status="connected"] .wb-mcpturn-dot'],
      ['turno: marca', '.wb-mcpturn-mark']
    ]
  }

  const TROUBLE = {
    TEXT: [
      ['turno com falha: manchete', '.wb-mcpturn[data-trouble] .wb-mcpturn-head'],
      ['turno com falha: nome', '.wb-mcpturn[data-trouble] .wb-mcpturn-name']
    ],
    MARKS: [
      ['turno com falha: ponto', '.wb-mcpturn-chip[data-status="failed"] .wb-mcpturn-dot'],
      ['turno com falha: marca', '.wb-mcpturn[data-trouble] .wb-mcpturn-mark']
    ]
  }

  /** Present on every roster, healthy or not. */
  const STATUS = {
    TEXT: [
      ['barra: resumo', '.wb-status-mcp-label'],
      ['card: título', '.wb-status-mcp-card-head'],
      ['card: nome', '.wb-status-mcp-card-name'],
      ['card: estado', '.wb-status-mcp-card-state'],
      ['card: ferramentas', '.wb-status-mcp-card-tools'],
      ['card: rodapé', '.wb-status-mcp-card-foot']
    ],
    MARKS: [
      [
        'card: ponto conectado',
        '.wb-status-mcp-card-row[data-state="connected"] .wb-status-mcp-card-dot'
      ]
    ]
  }

  /** Only reachable once something is actually failing — measured in that sweep. */
  const STATUS_TROUBLE = {
    TEXT: [
      ...STATUS.TEXT,
      ['barra: badge de problema', '.wb-status-mcp-errors'],
      ['card: estado com falha', '.wb-status-mcp-card-row[data-state="failed"] .wb-status-mcp-card-state']
    ],
    MARKS: [
      ...STATUS.MARKS,
      ['card: ponto com falha', '.wb-status-mcp-card-row[data-state="failed"] .wb-status-mcp-card-dot']
    ]
  }

  const CONSOLE = {
    TEXT: [
      ['strip: nome', '.wb-mcplog-pill-name'],
      ['strip: estado', '.wb-mcplog-pill-state'],
      ['strip: contagem', '.wb-mcplog-pill-count'],
      ['strip: estado com falha', '.wb-mcplog-pill[data-state="failed"] .wb-mcplog-pill-state'],
      ['vazio: título', '.wb-mcplog-state-title'],
      ['vazio: descrição', '.wb-mcplog-state-desc'],
      ['vazio: rótulo do caminho', '.wb-mcplog-source-label'],
      ['vazio: caminho', '.wb-mcplog-source-path'],
      ['vazio: CTA', '.wb-mcplog-state-cta']
    ],
    MARKS: [
      ['strip: ponto conectado', '.wb-mcplog-pill[data-state="connected"] .wb-mcplog-pill-dot'],
      ['strip: ponto com falha', '.wb-mcplog-pill[data-state="failed"] .wb-mcplog-pill-dot']
    ]
  }

  /** One theme's whole sweep: three surfaces, six measurements, four shots. */
  const sweep = async (theme) => {
    const out = {}

    // 1. The transcript row, healthy — a turn that got everything it asked for.
    await seedTranscript(false)
    out.transcrito = await measure(TRANSCRIPT)
    await page.screenshot({ path: `${SHOT_DIR}/mcpvis-transcript-${theme}.png` })

    // 2. The status card. Seeded by the same handshake, so the two surfaces are
    //    showing the same roster — which is half of what this feature promises.
    await openStatusCard()
    out.status = await measure(STATUS)
    await page.screenshot({ path: `${SHOT_DIR}/mcpvis-status-${theme}.png` })

    // 3. The failed handshake: its own tint, its own ink, its own measurement.
    await seedTranscript(true)
    out.falha = await measure(TROUBLE)
    await openStatusCard()
    out.statusFalha = await measure(STATUS_TROUBLE)
    await page.screenshot({ path: `${SHOT_DIR}/mcpvis-trouble-${theme}.png` })

    return out
  }

  /**
   * The console with a roster and *no* stream — the state the old console
   * rendered as "you have no MCP servers", which was never true.
   *
   * Reached by navigating, not by mutating the fixture: `useMcpLogs` reads
   * history once per workspace, so a post-load mutation leaves the stream on
   * screen and the probe measures a state that never rendered. The reload drops
   * the theme back to boot's default, so the sweep re-applies it afterwards.
   */
  const sweepEmpty = async (theme, applyTheme) => {
    await page.goto('http://localhost:8123/index.html?mcpsilent=1')
    await page.waitForTimeout(900)
    if (applyTheme) await applyTheme()
    await seedTranscript(true)
    await openConsole()
    await page.waitForTimeout(400)
    const out = await measure(CONSOLE)
    await page.screenshot({ path: `${SHOT_DIR}/mcpvis-console-empty-${theme}.png` })
    return out
  }

  /** Drives the app's own Aparência menu — never localStorage (see header). */
  const pickTheme = (item) => async () => {
    await page.locator('.wb-icon-btn[aria-label^="Aparência"]').click()
    await page.waitForTimeout(250)
    await page.getByRole('menuitemradio', { name: item }).click()
    await page.waitForTimeout(450)
  }

  const report = {}
  for (const [name, slug, apply] of [
    ['escuro', 'dark', null],
    ['claro', 'light', pickTheme('Claro')],
    ['hive', 'hive', pickTheme('Hive')]
  ]) {
    if (apply) await apply()
    report[name] = await sweep(slug)
    report[name].consoleVazio = await sweepEmpty(slug, apply)
  }

  const states = Object.values(report).flatMap((theme) => Object.values(theme))
  const clean = states.every((s) => s.failures.length === 0 && s.missing.length === 0)
  return { verdict: clean ? 'PASS' : 'FAIL', ...report }
}
