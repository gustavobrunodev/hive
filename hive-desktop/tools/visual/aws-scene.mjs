// Companion to tools/visual/boot.mjs — the AWS connection scene (aws-bedrock).
// Run it after boot:
//
//   run_code_unsafe --filename tools/visual/boot.mjs
//   run_code_unsafe --filename tools/visual/aws-scene.mjs
//
// It opens Perfil › Conexão AWS and leaves it there. Everything else is driven
// from the console, because each run_code_unsafe call is its own context and a
// scenario set in one call is gone by the next:
//
//   window.__aws.status({ state: 'expired', expiresInMs: -1 })
//   window.__aws.login({ phase: 'browser', url: 'https://oidc…', code: 'VFRM-JRXW' })
//   window.__aws.login({ phase: 'success' })
//
// The status poll is a minute apart, so a `status()` change shows up on the
// next tick — call `window.__aws.login({ phase: 'success' })` to force the
// panel to re-read immediately (that is exactly what a landed login does).
async (page) => {
  const open = await page.evaluate(() => Boolean(document.querySelector('.wb-profile-sheet')))
  if (!open) {
    await page
      .locator('[data-tour="profile"], .wb-avatar-btn, [aria-label*="perfil" i]')
      .first()
      .click()
    await page.waitForTimeout(500)
  }
  const row = page.getByRole('button', { name: /Conexão AWS/ })
  if ((await row.count()) > 0) {
    await row.first().click()
    await page.waitForTimeout(400)
  }
  return await page.evaluate(() => ({
    scope: document.querySelector('.wb-profile-sheet')?.getAttribute('data-view') ?? null,
    text: document.querySelector('.wb-aws-scope')?.innerText.slice(0, 400) ?? null
  }))
}
