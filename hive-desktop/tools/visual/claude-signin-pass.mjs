// Functional pass for claude-account: the whole repair, from the turn that
// failed to the code that fixes it.
//
// Run AFTER tools/visual/boot.mjs:
//   run_code_unsafe --filename tools/visual/claude-signin-pass.mjs
//   node tools/visual/run-scene.mjs tools/visual/claude-signin-pass.mjs
//
// What it proves, and what no unit test can: the four surfaces are **one
// flow**. A turn dies with a credential failure → the transcript says so in
// words with a button under it → the button starts a sign-in → the sign-in
// appears as a beacon above the work (the user may be anywhere) → the code the
// user carries back from the browser reaches the CLI.
//
// `HIVE_SHOT_DIR` writes one screenshot per step.
async (page) => {
  const theme = globalThis.HIVE_THEME || 'dark'
  const shots = globalThis.HIVE_SHOT_DIR || null

  // Record what the app asked main to do — the boot mock only resolves, so a
  // click against it cannot be told from a dead control.
  await page.addInitScript(() => {
    const patch = () => {
      if (!window.hive) return
      window.__signin = { login: 0, codes: [], cancels: 0 }
      const auth = window.hive.claudeAuth
      const login = auth.login
      auth.login = (...args) => {
        window.__signin.login += 1
        // What main really does next: the CLI prints its URL and then sits at
        // its paste prompt.
        window.__claude.login({
          phase: 'code',
          url: 'https://claude.com/cai/oauth/authorize?code=true&client_id=9d1c250a',
          startedAt: Date.now()
        })
        return login(...args)
      }
      auth.submitCode = (code) => {
        window.__signin.codes.push(code)
        window.__claude.login({ phase: 'finishing' })
        return Promise.resolve(true)
      }
      auth.cancel = () => {
        window.__signin.cancels += 1
        return Promise.resolve(undefined)
      }
      // Count the turns the app actually asks for: the resend after a landed
      // sign-in is the last step of the repair, and a mock that only resolves
      // cannot tell it happened.
      window.__sends = 0
      const send = window.hive.agent.send
      window.hive.agent.send = (...args) => {
        window.__sends += 1
        return send(...args)
      }
      window.__claude.status({ state: 'signed-out', account: null })
      window.__aws.status({ active: false })
    }
    patch()
  })

  if (theme !== 'dark') {
    await page.locator('.wb-icon-btn[aria-label^="Aparência"]').click()
    await page.getByRole('menuitemradio', { name: { light: 'Claro', hive: 'Hive' }[theme] }).click()
    await page.waitForTimeout(250)
  }
  await page.reload()
  await page.waitForTimeout(700)

  // 1. A turn that dies the way a signed-out CLI dies: no stderr, an exit
  //    code, and — since this feature — a cause.
  const box = page.locator('textarea').first()
  await box.click()
  await box.fill('Resuma o PRD em três linhas')
  await page.keyboard.press('Enter')
  await page.waitForTimeout(400)
  await page.evaluate(() =>
    window.__agentEvent({ type: 'error', message: 'claude-auth:signed-out' })
  )
  await page.waitForTimeout(300)
  const banner = await page.evaluate(() => {
    const alert = document.querySelector('.wb-composer-error')
    return {
      text: alert?.innerText.replace(/\s+/g, ' ').trim() ?? null,
      cta: alert?.querySelector('.wb-composer-error-cta')?.textContent ?? null
    }
  })
  if (shots) await page.screenshot({ path: `${shots}/signin-1-error-${theme}.png` })

  // 2. The repair, from where the problem is.
  await page.getByRole('button', { name: 'Conectar conta' }).click()
  await page.waitForTimeout(400)
  const beacon = await page.evaluate(() => {
    const node = document.querySelector('.wb-claude-beacon')
    return {
      present: Boolean(node),
      role: node?.getAttribute('role') ?? null,
      step:
        node?.querySelector('[aria-current="step"] .hds-stepflow-label')?.textContent?.trim() ??
        null,
      field: Boolean(node?.querySelector('.hds-paste-input'))
    }
  })
  if (shots) await page.screenshot({ path: `${shots}/signin-2-beacon-${theme}.png` })

  // 3. The code the user carries back. Through the paste control, because that
  //    is the gesture — the clipboard is planted the way main would answer it.
  await page.evaluate(() => window.__claude.clipboard('cod-9f21-a7c4'))
  await page.locator('.wb-claude-beacon .hds-paste-btn').click()
  await page.waitForTimeout(400)

  // 4. …and the receipt, which is the only proof the trip worked.
  await page.evaluate(() =>
    window.__claude.login({
      phase: 'success',
      account: {
        loggedIn: true,
        authMethod: 'claude.ai',
        apiProvider: 'firstParty',
        apiKeySource: null,
        email: 'gustavo@fitame.dev',
        organization: 'Fitame',
        subscription: 'max'
      }
    })
  )
  await page.waitForTimeout(300)
  const receipt = await page.evaluate(() => ({
    text: document.querySelector('.wb-claude-connected')?.innerText.replace(/\s+/g, ' ').trim() ?? null,
    // The repair only counts as finished when the question the user asked is
    // on its way again: the banner is gone and a second turn was sent.
    bannerGone: document.querySelector('.wb-composer-error') === null,
    sends: window.__sends,
    calls: window.__signin
  }))
  if (shots) await page.screenshot({ path: `${shots}/signin-3-receipt-${theme}.png` })

  return { theme, banner, beacon, receipt }
}
