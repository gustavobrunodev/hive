// The agent-onboarding visual pass — every state of the first-run agent
// picker, in all three themes, in one run.
//
//   npx electron-vite build && python3 -m http.server 8123 -d out/renderer
//   run_code_unsafe --filename tools/visual/agent-setup.mjs
//
// `boot.mjs` deliberately sails past every first-run gate to land on the work
// UI, which means the agent step — the very first screen a new user sees — is
// never in a screenshot. This harness stops there instead: it reports an
// already-picked workspace and an **empty** enabled-agent set, which is what
// routes `App` to `setupAgent`.
//
// Theme comes from a URL query param rather than a control, because this gate has
// no "Aparência" menu (that lives in the work UI) and because the init script
// re-runs on every navigation — so writing `localStorage` from one call and
// reloading in the next just restores the default (docs/visual-validation.md).
// One init script + three `goto(...?theme=)` gives three real themes in one
// context.
//
// Returns one entry per theme with its contrast FAILs, and writes
// `.playwright-mcp/agents-<state>-<theme>.png` for every state.
async (page) => {
  const shots = '/home/gustavobgt/user-harness/hive/hive-desktop/.playwright-mcp'

  await page.context().clearCookies()
  await page.addInitScript(() => {
    const theme = new URLSearchParams(location.search).get('theme') || 'dark'
    localStorage.setItem('hive.tourSeen', '1')
    localStorage.setItem('hive-desktop-theme', theme)

    const ok = (v) => () => Promise.resolve(v)

    const AGENTS = [
      {
        id: 'claude-cli',
        displayName: 'Claude Code',
        description: 'Agente da Anthropic via CLI `claude`.',
        available: false,
        version: null,
        detectCommand: 'claude',
        installHint: 'Instale o Claude Code: npm i -g @anthropic-ai/claude-code',
        installable: true,
        installCommand: 'npm install -g @anthropic-ai/claude-code',
        docsUrl: 'https://docs.claude.com/en/docs/claude-code/overview'
      },
      {
        id: 'github-copilot',
        displayName: 'GitHub Copilot',
        description: 'CLI agêntica do GitHub Copilot com modelos Anthropic e OpenAI.',
        available: false,
        version: null,
        detectCommand: 'copilot',
        installHint: 'Instale a CLI do Copilot: npm i -g @github/copilot',
        installable: true,
        installCommand: 'npm install -g @github/copilot',
        docsUrl: 'https://docs.github.com/copilot/how-tos/use-copilot-agents/use-copilot-cli'
      },
      {
        id: 'devin',
        displayName: 'Devin',
        description: 'Agente de engenharia autônomo da Cognition via CLI `devin`.',
        available: false,
        version: null,
        detectCommand: 'devin',
        installHint: 'Instale a CLI do Devin e faça login em app.devin.ai.',
        installable: false,
        installCommand: null,
        docsUrl: 'https://docs.devin.ai/work-with-devin/devin-cli'
      }
    ]

    let detected = AGENTS.map((agent) => ({ ...agent }))
    const streams = new Map()

    // Drive the scene from the page after boot.
    window.__agents = {
      set: (list) => {
        detected = list
      },
      /** Marks an agent detected, as a re-probe would. */
      found: (id, version) => {
        detected = detected.map((agent) =>
          agent.id === id ? { ...agent, available: true, version } : agent
        )
      }
    }
    window.__install = {
      progress: (id, message) => streams.get(id)?.({ type: 'progress', message }),
      done: (id, version) => {
        window.__agents.found(id, version)
        streams.get(id)?.({ type: 'done', agent: detected.find((a) => a.id === id) })
      },
      fail: (id, reason, detail) => streams.get(id)?.({ type: 'error', reason, detail })
    }

    window.hive = {
      getWorkspace: ok('/home/dev/squad-workspace'),
      chooseWorkspace: ok('/home/dev/squad-workspace'),
      isProvisioned: ok(true),
      provisionState: ok(true),
      openExternal: ok(undefined),
      profile: {
        agents: () => Promise.resolve(detected.map((agent) => ({ ...agent }))),
        installAgent: (id, onEvent) => {
          streams.set(id, onEvent)
          return () => streams.delete(id)
        },
        getAgent: ok(null),
        setAgent: ok(undefined),
        // Empty → App routes straight to the agent step.
        getAgents: ok([]),
        setAgents: ok(undefined),
        getRole: ok('pm'),
        setRole: ok(undefined),
        getUserName: ok('Gustavo'),
        setUserName: ok(undefined)
      }
    }
  })

  const measure = async (state, targets) =>
    await page.evaluate(
      ({ state, targets }) => {
        // Resolve any color syntax the browser accepts (oklch, color-mix, …)
        // by painting one pixel and reading it back — parsing lies, see
        // docs/visual-validation.md.
        const probe = document.createElement('canvas')
        probe.width = probe.height = 1
        const ctx = probe.getContext('2d', { willReadFrequently: true })
        function parse(value) {
          ctx.clearRect(0, 0, 1, 1)
          ctx.fillStyle = '#000'
          ctx.fillStyle = value
          const resolved = ctx.fillStyle
          ctx.clearRect(0, 0, 1, 1)
          ctx.fillStyle = resolved
          ctx.fillRect(0, 0, 1, 1)
          const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data
          // Read the channels as they come and compose with alpha; dividing
          // them by alpha blows a 10% tint out to near-white.
          return { rgb: [r, g, b], a: a / 255 }
        }
        function lum(rgb) {
          const [r, g, b] = rgb.map((ch) => {
            const c = ch / 255
            return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
          })
          return 0.2126 * r + 0.7152 * g + 0.0722 * b
        }
        /** Stacks every translucent background up the tree into real pixels. */
        function bgOf(el) {
          const layers = []
          let node = el
          while (node) {
            const parsed = parse(getComputedStyle(node).backgroundColor)
            if (parsed && parsed.a > 0) layers.push(parsed)
            node = node.parentElement
          }
          if (layers.length === 0) return null
          let base = layers[layers.length - 1].rgb
          for (let i = layers.length - 2; i >= 0; i--) {
            const { rgb, a } = layers[i]
            base = base.map((channel, idx) => rgb[idx] * a + channel * (1 - a))
          }
          return base
        }
        const out = []
        for (const [selector, kind] of targets) {
          const el = document.querySelector(selector)
          if (!el) {
            out.push(`${state} ${selector} MISSING`)
            continue
          }
          const style = getComputedStyle(el)
          const fg = parse(kind === 'icon' ? style.color : style.color)
          const bg = bgOf(el)
          if (!fg || !bg) {
            out.push(`${state} ${selector} UNMEASURED`)
            continue
          }
          const composited =
            fg.a >= 1 ? fg.rgb : fg.rgb.map((c, i) => c * fg.a + bg[i] * (1 - fg.a))
          const a = lum(composited)
          const b = lum(bg)
          const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
          const px = parseFloat(style.fontSize)
          const bold = Number(style.fontWeight) >= 700
          // Non-text carriers (icons, meter fills) take the 3:1 floor.
          const floor = kind === 'icon' || px >= 24 || (bold && px >= 18.66) ? 3 : 4.5
          out.push(
            `${state} ${selector} ${style.fontSize} → ${ratio.toFixed(2)}:1 (floor ${floor}) ${
              ratio >= floor ? 'PASS' : 'FAIL'
            }`
          )
        }
        return out
      },
      { state, targets }
    )

  const card = () => page.locator('.wb-agent-setup-card')

  async function sweep(theme) {
    const results = []
    await page.setViewportSize({ width: 1440, height: 980 })
    // A query param, not a hash: changing only the hash is a same-document
    // navigation, so the init script never re-runs and the previous theme's
    // scene leaks into the next sweep.
    await page.goto(`http://localhost:8123/index.html?theme=${theme}`)
    await page.waitForTimeout(900)

    // 1. Nothing detected — the state the bug report was filed against, and
    //    the one the old screen turned into a dead end.
    await card().screenshot({ path: `${shots}/agents-none-${theme}.png` })
    results.push(
      ...(await measure('none', [
        ['.wb-gate-title', 'text'],
        ['.wb-gate-desc', 'text'],
        ['.wb-agent-scan-text', 'text'],
        ['.wb-agent-scan-btn', 'text'],
        ['.wb-agent-empty', 'text'],
        ['.wb-agent-group-label', 'text'],
        ['.wb-agent-card-title', 'text'],
        ['.wb-agent-card-desc', 'text'],
        ['.wb-agent-install-command', 'text'],
        ['.wb-agent-install-command code', 'text'],
        ['.wb-agent-install-link', 'text'],
        ['.wb-agent-card-hint', 'text'],
        ['.wb-setup-selection-hint', 'text']
      ]))
    )

    // 2. An install in flight, with npm talking.
    await page.getByLabel('Instalar Claude Code agora').click()
    await page.evaluate(() =>
      window.__install.progress('claude-cli', 'reify:@anthropic-ai/claude-code: timing reifyNode')
    )
    await page.waitForTimeout(250)
    await card().screenshot({ path: `${shots}/agents-installing-${theme}.png` })
    results.push(
      ...(await measure('installing', [
        ['.wb-agent-install-status', 'text'],
        ['.wb-agent-install-line', 'text']
      ]))
    )

    // 3. The failure a real user hits most: a global prefix they can't write.
    await page.evaluate(() =>
      window.__install.fail(
        'claude-cli',
        'permission',
        "npm ERR! code EACCES\nnpm ERR! Error: EACCES: permission denied, mkdir '/usr/lib/node_modules'"
      )
    )
    await page.waitForTimeout(250)
    await page.locator('.wb-agent-install-detail summary').click()
    await page.waitForTimeout(150)
    await card().screenshot({ path: `${shots}/agents-failed-${theme}.png` })
    results.push(
      ...(await measure('failed', [
        ['.wb-agent-install-error', 'text'],
        ['.wb-agent-install-error svg', 'icon'],
        ['.wb-agent-install-detail summary', 'text'],
        ['.wb-agent-install-detail pre', 'text']
      ]))
    )

    // 4. Installed + detected: the card crosses into "Prontos para usar" with
    //    the version as evidence, enabled and holding the default.
    await page.evaluate(() => window.__install.done('claude-cli', '2.1.226 (Claude Code)'))
    await page.waitForTimeout(300)
    await card().screenshot({ path: `${shots}/agents-ready-${theme}.png` })
    results.push(
      ...(await measure('ready', [
        ['.wb-agent-card-found', 'text'],
        ['.wb-agent-card-found code', 'text'],
        ['.wb-agent-card-default', 'text'],
        ['.wb-agent-default-btn[data-active] svg', 'icon']
      ]))
    )

    // 5. A re-scan that finds something — the answer to "I installed it
    //    outside Hive and you can't see it".
    await page.evaluate(() => window.__agents.found('github-copilot', '1.4.0'))
    await page.getByText('Procurar de novo').click()
    await page.waitForTimeout(400)
    await card().screenshot({ path: `${shots}/agents-rescan-${theme}.png` })
    results.push(...(await measure('rescan', [['.wb-agent-scan-text', 'text']])))

    return {
      theme: await page.evaluate(() => document.documentElement.getAttribute('data-theme')),
      fails: results.filter((line) => /FAIL|MISSING|UNMEASURED/.test(line)),
      results
    }
  }

  return [await sweep('dark'), await sweep('light'), await sweep('hive')]
}
