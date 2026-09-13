// Contrast + structure probe for the Claude-account surfaces (claude-account),
// across the three themes and the four states that matter: a connected
// account, a machine with none, a sign-in waiting on a pasted code, and one
// that failed.
//
// Run AFTER tools/visual/boot.mjs:
//   run_code_unsafe --filename tools/visual/claude-connection-contrast.mjs
//   node tools/visual/run-scene.mjs tools/visual/claude-connection-contrast.mjs
//
// It drives the scenes itself (through `window.__claude`, planted by boot.mjs)
// rather than expecting a scene file, because the states are the point: a probe
// of only the connected one would miss both tinted grounds — the danger tint on
// the "no account" card and the success tint on the receipt — which is exactly
// where this app's contrast failures have always been.
//
// Carries the lessons docs/visual-validation.md already paid for, the same way
// `aws-contrast.mjs` does: resolve colours through a canvas (never a regex —
// `oklch()` serialises verbatim), composite translucent tints against the first
// opaque ground above them, force the theme through the real menu, and kill
// transitions before measuring.
async (page) => {
  // [label, ink selector, ground selector, floor]
  const LANE_TEXT = [
    ['pista — nome', '.wb-conn-lane[data-state="active"] .wb-conn-lane-name', '.wb-conn-lanes', 4.5],
    ['pista — leitura', '.wb-conn-lane[data-state="active"] .wb-conn-lane-meta', '.wb-conn-lanes', 4.5],
    ['pista inativa — nome', '.wb-conn-lane[data-state="inactive"] .wb-conn-lane-name', '.wb-conn-lanes', 4.5],
    ['pista inativa — leitura', '.wb-conn-lane[data-state="inactive"] .wb-conn-lane-meta', '.wb-conn-lanes', 4.5],
    ['selo "em uso"', '.wb-conn-lane-badge', '.wb-conn-lane-badge', 4.5]
  ]

  const CARD_TEXT = [
    ['painel — título do estado', '.wb-claude-card-title', '.wb-claude-card', 4.5],
    ['painel — frase do estado', '.wb-claude-card-hint', '.wb-claude-card', 4.5],
    ['painel — nota do escopo', '.wb-claude-scope-note', '.wb-claude-scope-note', 4.5]
  ]

  /**
   * The account line exists only where there IS an account — a signed-out
   * machine has none, and listing it everywhere reports `missing`, which reads
   * exactly like "nothing to fix". (The lesson `aws-contrast.mjs` paid for.)
   */
  const ACCOUNT_TEXT = [
    ['painel — conta', '.wb-claude-card-account', '.wb-claude-card', 4.5]
  ]

  const LOGIN_TEXT = [
    ['login — título', '.wb-claude-flow-title', '.wb-claude-flow', 4.5],
    ['login — cronômetro', '.wb-claude-flow-elapsed', '.wb-claude-flow', 4.5],
    ['passo ativo — rótulo', '[data-status="active"] .hds-stepflow-label', '.wb-claude-flow', 4.5],
    ['passo ativo — dica', '[data-status="active"] .hds-stepflow-hint', '.wb-claude-flow', 4.5],
    ['passo pendente — rótulo', '[data-status="pending"] .hds-stepflow-label', '.wb-claude-flow', 4.5],
    ['passo concluído — rótulo', '[data-status="done"] .hds-stepflow-label', '.wb-claude-flow', 4.5],
    ['código — rótulo', '.hds-paste-label', '.wb-claude-code', 4.5],
    ['código — descrição', '.hds-paste-desc', '.wb-claude-code', 4.5],
    ['código — campo', '.hds-paste-input', '.hds-paste-row', 4.5],
    ['código — botão colar', '.hds-paste-btn', '.hds-paste-btn', 4.5],
    ['código — botão conectar', '.hds-paste-go', '.hds-paste-go', 4.5],
    ['endereço — rótulo', '.wb-claude-flow-url-label', '.wb-claude-flow', 4.5],
    ['endereço — valor', '.wb-claude-flow-url-value', '.wb-claude-flow-url-value', 4.5]
  ]

  const SUCCESS_TEXT = [
    ['recibo — conta', '.wb-claude-connected-line', '.wb-claude-connected', 4.5],
    ['recibo — frase', '.wb-claude-connected-hint', '.wb-claude-connected', 4.5],
    ['recibo — inicial', '.wb-claude-connected-mark', '.wb-claude-connected-mark', 4.5]
  ]

  const FAILED_TEXT = [
    ['falha — título', '.wb-claude-flow-title', '.wb-claude-flow', 4.5],
    ['falha — dica do passo', '[data-status="failed"] .hds-stepflow-hint', '.wb-claude-flow', 4.5]
  ]

  // Marks, not text: the 3:1 floor.
  const CARD_MARKS = [['placa do estado', '.wb-claude-card-mark', '.wb-claude-card', 3]]
  const LOGIN_MARKS = [
    ['placa do login', '.wb-claude-flow-mark', '.wb-claude-flow', 3],
    [
      'nó do passo ativo',
      '.hds-stepflow-step[data-status="active"] .hds-stepflow-node',
      '.wb-claude-flow',
      3
    ],
    ['moldura do campo de código', '.hds-paste-row', '.wb-claude-flow', 3]
  ]

  const measure = (text, marks) =>
    page.evaluate(
      ({ text, marks }) => {
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
        const add = ([label, inkSel, groundSel, floor], stroke) => {
          const inkEl = document.querySelector(inkSel)
          const groundEl = document.querySelector(groundSel)
          if (!inkEl || !groundEl) return rows.push({ label, missing: true })
          const cs = getComputedStyle(inkEl)
          // A mark's colour lives in its border or its fill, never in `color`.
          const ink = parse(
            stroke
              ? cs.borderTopColor && parse(cs.borderTopColor)?.a > 0
                ? cs.borderTopColor
                : cs.backgroundColor
              : cs.color
          )
          if (!ink) return rows.push({ label, missing: true })
          // Start the walk **at** the ground element, not at its parent.
          // `groundOf` already skips transparent backgrounds, so starting here
          // is right for plain text — and it is the only thing that measures a
          // *filled* control correctly: the connect button's ink sits on the
          // accent, not on the panel behind it, and the parent-first rule this
          // probe was copied from reported it as 1,13:1 (accent ink on
          // surface, a pair that never renders).
          const ground = groundOf(groundEl)
          const r = ratio(over(ink, ground), ground)
          rows.push({ label, ratio: Math.round(r * 100) / 100, floor, ok: r >= floor })
        }
        for (const row of text) add(row, false)
        for (const row of marks) add(row, true)

        kill.remove()
        return rows
      },
      { text, marks }
    )

  /** The scenes, driven through the fixtures boot.mjs plants. */
  const URL =
    'https://claude.com/cai/oauth/authorize?code=true&client_id=9d1c250a&state=Z-3SiFig7X9emMm'
  const ACCOUNT = {
    loggedIn: true,
    authMethod: 'claude.ai',
    apiProvider: 'firstParty',
    apiKeySource: null,
    email: 'gustavo@fitame.dev',
    organization: 'Fitame',
    subscription: 'max'
  }

  async function scene(status, login) {
    await page.evaluate(
      ({ status, login, url, account }) => {
        window.__aws.status({ active: false })
        window.__claude.status(status)
        // A pulse first: the panel re-reads its status when a sign-in *ends*,
        // so replacing the fixture alone leaves the previous scene on screen —
        // the same trap `aws-contrast.mjs` documents.
        window.__claude.login({ phase: 'canceled' })
        window.__claude.login(
          login
            ? {
                ...login,
                url,
                startedAt: Date.now() - 11_000,
                ...(login.phase === 'success' ? { account } : {})
              }
            : { phase: 'idle' }
        )
      },
      { status, login: login ?? null, url: URL, account: ACCOUNT }
    )
    await page.waitForTimeout(380)
  }

  async function openPanel() {
    const open = await page.evaluate(() =>
      Boolean(document.querySelector('.wb-profile-sheet[data-view="connection"] .wb-claude-scope'))
    )
    if (open) return
    const sheet = await page.evaluate(() => Boolean(document.querySelector('.wb-profile-sheet')))
    if (!sheet) {
      await page
        .locator('[data-tour="profile"], .wb-avatar-btn, [aria-label*="perfil" i]')
        .first()
        .click()
      await page.waitForTimeout(400)
    }
    const row = page.getByRole('button', { name: /Conexão do Claude/ })
    if ((await row.count()) > 0) {
      await row.first().click()
      await page.waitForTimeout(350)
    }
    const lane = page.getByRole('tab', { name: /Conta Claude/ })
    if ((await lane.count()) > 0 && (await lane.first().getAttribute('aria-selected')) !== 'true') {
      await lane.first().click()
      await page.waitForTimeout(250)
    }
  }

  async function forTheme() {
    await openPanel()
    await scene({ state: 'connected', account: ACCOUNT })
    const connected = await measure([...LANE_TEXT, ...CARD_TEXT, ...ACCOUNT_TEXT], CARD_MARKS)
    await scene({ state: 'signed-out', account: null }, { phase: 'code' })
    const code = await measure([...CARD_TEXT, ...LOGIN_TEXT], [...CARD_MARKS, ...LOGIN_MARKS])
    await scene({ state: 'signed-out', account: null }, { phase: 'success' })
    const success = await measure(SUCCESS_TEXT, [])
    await scene({ state: 'signed-out', account: null }, { phase: 'failed', message: 'boom' })
    const failed = await measure(FAILED_TEXT, [])
    return { conectado: connected, codigo: code, sucesso: success, falha: failed }
  }

  const report = { escuro: await forTheme() }
  for (const [name, menuLabel] of [
    ['claro', 'Claro'],
    ['hive', 'Hive']
  ]) {
    // The theme menu lives behind the sheet's scrim — close the sheet, switch,
    // reopen. (Measured in the AWS probe: clicking through the scrim silently
    // does nothing and the probe reports the previous theme three times.)
    await page.keyboard.press('Escape')
    await page.waitForTimeout(150)
    await page.keyboard.press('Escape')
    await page.waitForTimeout(250)
    await page.locator('.wb-icon-btn[aria-label^="Escolha do tema"]').click()
    await page.getByRole('menuitemradio', { name: new RegExp(`^${menuLabel}`) }).click()
    await page.waitForTimeout(320)
    report[name] = await forTheme()
  }

  const flat = Object.entries(report).flatMap(([theme, scenes]) =>
    Object.entries(scenes).flatMap(([sceneName, rows]) =>
      rows.map((row) => ({ ...row, where: `${theme}/${sceneName}` }))
    )
  )
  return {
    total: flat.length,
    failures: flat.filter((row) => row.ok === false || row.missing),
    sample: flat.slice(0, 6)
  }
}
