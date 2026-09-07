// Companion to tools/visual/boot.mjs — the Claude account connection
// (claude-account). Run it after boot:
//
//   run_code_unsafe --filename tools/visual/boot.mjs
//   run_code_unsafe --filename tools/visual/claude-connection.mjs
//
// It opens Perfil › Conexão do Claude and leaves it there, on whichever lane
// the fixture says is in use. Everything else is driven from the console,
// because each run_code_unsafe call is its own context:
//
//   window.__claude.status({ state: 'signed-out' })
//   window.__claude.login({ phase: 'code', url: 'https://claude.com/cai/oauth/authorize?x=1' })
//   window.__claude.clipboard('cod-9f21-a7c4')   // what "Colar" will find
//   window.__claude.login({ phase: 'success' })
//
// `HIVE_CLAUDE_STATE` / `HIVE_CLAUDE_PHASE` pre-set the scenario before the
// panel opens, so a theme sweep can render the same state three times.
async (page) => {
  const state = globalThis.HIVE_CLAUDE_STATE ?? null
  const phase = globalThis.HIVE_CLAUDE_PHASE ?? null

  if (state) {
    await page.evaluate((next) => {
      // A signed-out (or CLI-less) machine has no account to name: the CLI's
      // own payload carries no email there, and a fixture that kept one would
      // draw a panel no machine can produce.
      const account = next === 'signed-out' || next === 'no-cli' ? null : undefined
      window.__claude.status({ state: next, ...(account === null ? { account: null } : {}) })
      // A first-party machine is not on Bedrock: leaving the AWS fixture
      // active would make the strip claim both lanes are in use, which is a
      // machine that cannot exist.
      window.__aws.status({ active: next !== 'third-party' ? false : true })
    }, state)
  }

  const open = await page.evaluate(() => Boolean(document.querySelector('.wb-profile-sheet')))
  if (!open) {
    await page
      .locator('[data-tour="profile"], .wb-avatar-btn, [aria-label*="perfil" i]')
      .first()
      .click()
    await page.waitForTimeout(500)
  }
  const row = page.getByRole('button', { name: /Conexão do Claude/ })
  if ((await row.count()) > 0) {
    await row.first().click()
    await page.waitForTimeout(400)
  }

  if (phase) {
    await page.evaluate((next) => {
      window.__claude.clipboard('cod-9f21-a7c4')
      window.__claude.login({
        phase: next,
        url: 'https://claude.com/cai/oauth/authorize?code=true&client_id=9d1c250a&state=Z-3SiFig',
        startedAt: Date.now() - 11_000,
        ...(next === 'code' ? { codeError: null } : {}),
        ...(next === 'success'
          ? {
              account: {
                loggedIn: true,
                authMethod: 'claude.ai',
                apiProvider: 'firstParty',
                apiKeySource: null,
                email: 'gustavo@fitame.dev',
                organization: 'Fitame',
                subscription: 'max'
              }
            }
          : {})
      })
    }, phase)
    await page.waitForTimeout(400)
  }

  if (globalThis.HIVE_SHOT) {
    await page.screenshot({ path: globalThis.HIVE_SHOT })
  }

  return await page.evaluate(() => {
    const tab = [...document.querySelectorAll('[role="tab"]')].find(
      (node) => node.getAttribute('aria-selected') === 'true'
    )
    return {
      lane: tab?.innerText.replace(/\s+/g, ' ').trim() ?? null,
      panel:
        document.querySelector('.wb-claude-scope, .wb-aws-scope')?.innerText.slice(0, 400) ?? null,
      code: document.querySelector('.hds-paste-input')?.value ?? null
    }
  })
}
