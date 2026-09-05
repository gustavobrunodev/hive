// Contrast + structure probe for the AWS connection surfaces (aws-bedrock),
// across the three themes and the four states that matter: a live session, an
// expired one, a login waiting on the browser, and a login that failed.
//
// Run AFTER tools/visual/boot.mjs:
//   run_code_unsafe --filename tools/visual/aws-contrast.mjs
//
// It drives the scenes itself (through `window.__aws`, planted by boot.mjs)
// rather than expecting a scene file, because the four states are the point:
// a probe of only the happy one would miss the two tinted grounds — the
// warning card and the danger tint — which is exactly where this app's
// contrast failures have always been.
//
// Carries the lessons docs/visual-validation.md already paid for:
//  - Resolve colours through a canvas, never a regex (`oklch()` serialises
//    verbatim and a digit regex reads it as near-black).
//  - `--faint` is decoration over `--bg`, not secondary text; nothing here uses
//    it, and this probe is what keeps it that way.
//  - Composite translucent tints against the first opaque ground above them.
//  - Force the theme through the real menu — the boot init script rewrites the
//    storage key on every navigation.
//  - Kill transitions before measuring.
async (page) => {
  // [label, ink selector, ground selector, floor]
  const TEXT = [
    ['painel — título do estado', '.wb-aws-card-title', '.wb-aws-card', 4.5],
    ['painel — frase do estado', '.wb-aws-card-hint', '.wb-aws-card', 4.5],
    ['painel — expiração', '.wb-aws-card-expiry', '.wb-aws-card', 4.5],
    ['anel — valor', '.hds-gauge-value', '.wb-aws-card', 4.5],
    ['anel — legenda', '.hds-gauge-caption', '.wb-aws-card', 4.5],
    ['fato — rótulo', '.wb-aws-fact dt', '.wb-aws-fact dt', 4.5],
    ['fato — valor', '.wb-aws-fact dd', '.wb-aws-fact dd', 4.5],
    ['origem do perfil', '.wb-aws-source', '.wb-aws-source', 4.5],
    ['perfis — título', '.wb-aws-profiles-title', '.wb-aws-profiles-title', 4.5],
    ['perfis — dica', '.wb-aws-profiles-hint', '.wb-aws-profiles-hint', 4.5],
    ['perfil — nome', '.wb-aws-profile-name', '.wb-aws-profile', 4.5],
    ['perfil — meta', '.wb-aws-profile-meta', '.wb-aws-profile', 4.5],
    [
      'perfil selecionado — nome (sobre o tint)',
      '.wb-aws-profile[data-selected] .wb-aws-profile-name',
      '.wb-aws-profile[data-selected]',
      4.5
    ],
    [
      'perfil selecionado — meta (sobre o tint)',
      '.wb-aws-profile[data-selected] .wb-aws-profile-meta',
      '.wb-aws-profile[data-selected]',
      4.5
    ],
    ['selo "com sessão"', '.wb-aws-profile-session[data-signed-in]', '.wb-aws-profile-session[data-signed-in]', 4.5],
    ['selo "sem sessão"', '.wb-aws-profile-session:not([data-signed-in])', '.wb-aws-profile-session:not([data-signed-in])', 4.5]
  ]

  const LOGIN_TEXT = [
    ['login — título', '.wb-aws-flow-title', '.wb-aws-flow', 4.5],
    ['login — perfil', '.wb-aws-flow-profile', '.wb-aws-flow', 4.5],
    ['login — cronômetro', '.wb-aws-flow-elapsed', '.wb-aws-flow', 4.5],
    ['passo ativo — rótulo', '[data-status="active"] .hds-stepflow-label', '.wb-aws-flow', 4.5],
    ['passo ativo — dica', '[data-status="active"] .hds-stepflow-hint', '.wb-aws-flow', 4.5],
    ['passo pendente — rótulo', '[data-status="pending"] .hds-stepflow-label', '.wb-aws-flow', 4.5],
    ['passo concluído — rótulo', '[data-status="done"] .hds-stepflow-label', '.wb-aws-flow', 4.5],
    ['endereço — rótulo', '.wb-aws-flow-url-label', '.wb-aws-flow', 4.5],
    ['endereço — valor', '.wb-aws-flow-url-value', '.wb-aws-flow-url-value', 4.5]
  ]

  // Marks, not text: the 3:1 floor. Split per scene on purpose — the step
  // nodes only exist while a login is running, and measuring them at rest
  // reports `missing`, which reads exactly like "nothing to fix".
  const CARD_MARKS = [['anel — arco', '.hds-gauge-arc', '.wb-aws-card', 3]]
  const LOGIN_MARKS = [
    [
      'nó do passo ativo',
      '.hds-stepflow-step[data-status="active"] .hds-stepflow-node',
      '.wb-aws-flow',
      3
    ],
    [
      'nó do passo concluído',
      '.hds-stepflow-step[data-status="done"] .hds-stepflow-node',
      '.wb-aws-flow',
      3
    ]
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
          // An SVG arc's colour lives in `stroke`; a node's in its border.
          const ink = parse(
            stroke ? (cs.stroke !== 'none' ? cs.stroke : cs.borderTopColor || cs.backgroundColor) : cs.color
          )
          if (!ink) return rows.push({ label, missing: true })
          const ground = groundOf(inkSel === groundSel ? groundEl.parentElement : groundEl)
          const r = ratio(over(ink, ground), ground)
          rows.push({ label, ratio: Math.round(r * 100) / 100, floor, ok: r >= floor })
        }
        for (const row of text) add(row, false)
        for (const row of marks) add(row, true)

        // Hierarchy, not just legibility — the `--ink-2` lesson. A panel where
        // the state title, its sentence and the fact values are all the same
        // grey passes every contrast target and is still flat.
        const inkOf = (sel) => {
          const el = document.querySelector(sel)
          return el ? parse(getComputedStyle(el).color).rgb.join(',') : null
        }
        const title = inkOf('.wb-aws-card-title')
        const hint = inkOf('.wb-aws-card-hint')
        if (title !== null && hint !== null) {
          rows.push({ label: 'hierarquia: título ≠ frase', ok: title !== hint })
        }

        kill.remove()
        return rows
      },
      { text, marks }
    )

  /**
   * The scenes, driven through the fixtures boot.mjs plants.
   *
   * `READY` restates the expiry, and that is not redundant: `__aws.status()`
   * **merges** into the previous fixture, so a scene that only flips `state`
   * back to `ready` inherits the expired scene's `expiresAt` — and the ring,
   * which counts from the timestamp, keeps reading "expirada" while the card
   * says "Sessão ativa". The probe caught it as a `missing` caption; a reader
   * would have caught it as a panel contradicting itself.
   */
  const READY = {
    state: 'ready',
    expiresInMs: 6.2 * 3600e3,
    expiresAt: new Date(Date.now() + 6.2 * 3600e3).toISOString()
  }
  const EXPIRED = {
    state: 'expired',
    expiresInMs: -1,
    expiresAt: new Date(Date.now() - 3600e3).toISOString()
  }
  const LOGIN = {
    phase: 'browser',
    profile: 'fitame-dev',
    url: 'https://oidc.us-east-1.amazonaws.com/authorize?response_type=code&client_id=ItNSDrjknlP2DhQ',
    startedAt: Date.now() - 11000
  }

  async function openPanel() {
    const open = await page.evaluate(() =>
      Boolean(document.querySelector('.wb-profile-sheet[data-view="aws"]'))
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
    await page.getByRole('button', { name: /Conexão AWS/ }).first().click()
    await page.waitForTimeout(350)
  }

  /**
   * Puts one scene on screen.
   *
   * The `canceled` pulse is load-bearing, and it cost a round: the panel's
   * status is **polled** (a minute apart), so replacing the fixture does not
   * change what is drawn — the app re-reads only when a login *ends*. Without
   * the pulse, the second and third themes were still rendering the previous
   * scene's expired card while the probe labelled the rows "repouso": every
   * target still passed, and two of them reported `missing`, which is the only
   * reason it was caught at all.
   */
  async function scene(status, login) {
    await page.evaluate(
      ({ status, login }) => {
        window.__aws.status(status)
        window.__aws.login({ phase: 'canceled' })
        window.__aws.login(login ?? { phase: 'idle' })
      },
      { status, login: login ?? null }
    )
    await page.waitForTimeout(350)
  }

  async function forTheme() {
    await openPanel()
    await scene(READY)
    const ready = await measure(TEXT, CARD_MARKS)
    await scene(EXPIRED, LOGIN)
    const login = await measure(LOGIN_TEXT, LOGIN_MARKS)
    return { repouso: ready, login }
  }

  const report = { escuro: await forTheme() }
  for (const [name, menuLabel] of [
    ['claro', 'Claro'],
    ['hive', 'Hive']
  ]) {
    // The theme menu lives behind the sheet's scrim — close the sheet, switch,
    // reopen. (Measured: clicking through the scrim silently does nothing and
    // the probe reports the previous theme three times.)
    await page.keyboard.press('Escape')
    await page.waitForTimeout(150)
    await page.keyboard.press('Escape')
    await page.waitForTimeout(250)
    await page.locator('.wb-icon-btn[aria-label^="Aparência"]').click()
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
    sample: flat.slice(0, 8)
  }
}
