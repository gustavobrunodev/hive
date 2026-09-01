// Functional pass for the Files tab's refresh (the "pisca e fica carregando
// pra sempre" defect).
//
//   run_code_unsafe --filename tools/visual/boot.mjs
//   run_code_unsafe --filename tools/visual/explorer-refresh-pass.mjs
//
// The defect had three causes and only one of them is in the renderer, so this
// probe covers that one and the main-process halves are covered by
// `fsService.test.ts` / `gitService.test.ts`:
//
//   - `.git` was walked by `listTree` and watched by `watchWorkspace` (main);
//   - `git status` rewrote `.git/index`, which the watcher reported, which ran
//     `git status` again (main);
//   - **every** refresh blanked the tree to a spinner and none of them were
//     coalesced (here).
//
// What it proves: a refresh keeps the rows on screen — including while the walk
// is still running — and a burst of writes costs one walk, not twenty.
async (page) => {
  // Open the Files rail.
  await page.getByRole('button', { name: 'Explorador' }).click()
  await page.waitForTimeout(300)

  // Count the walks, and make the next one hang: whatever is on screen while it
  // hangs is what a refresh looks like.
  await page.evaluate(() => {
    const original = window.hive.listTree
    window.__walks = 0
    window.__hangNext = false
    window.hive.listTree = (...args) => {
      window.__walks += 1
      return window.__hangNext ? new Promise(() => {}) : original(...args)
    }
  })

  const before = await page.evaluate(() => ({
    rows: document.querySelectorAll('[role="treeitem"]').length,
    spinner: document.body.innerText.includes('Carregando arquivos')
  }))

  // One write, with the walk it triggers never returning.
  await page.evaluate(() => {
    window.__hangNext = true
    window.__fsChange('docs/prd.md')
  })
  await page.waitForTimeout(600)

  const during = await page.evaluate(() => ({
    walks: window.__walks,
    rows: document.querySelectorAll('[role="treeitem"]').length,
    spinner: document.body.innerText.includes('Carregando arquivos')
  }))

  await page.screenshot({ path: '.playwright-mcp/explorer-refresh-during-walk.png' })

  // Now the burst: what an `npm install`, a checkout, or an agent rewriting a
  // dozen files actually looks like at this seam.
  await page.evaluate(() => {
    window.__hangNext = false
    window.__walks = 0
    for (let i = 0; i < 20; i += 1) window.__fsChange(`src/f${i}.ts`)
  })
  await page.waitForTimeout(800)

  const afterBurst = await page.evaluate(() => ({
    walks: window.__walks,
    rows: document.querySelectorAll('[role="treeitem"]').length,
    spinner: document.body.innerText.includes('Carregando arquivos')
  }))

  await page.screenshot({ path: '.playwright-mcp/explorer-refresh-after-burst.png' })

  return { before, during, afterBurst }
}
