import { test, expect, _electron as electron } from '@playwright/test'
import type { Page } from '@playwright/test'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'

// Agent Change Review (M11) E2E, ACR-R9.4 — Playwright driving the real built
// Electron app. Mirrors git-management.spec.ts's `_electron.launch` +
// seeded-config.json boot recipe (STATE.md T2/T11 lessons: strip
// ELECTRON_RUN_AS_NODE, provision via the on-disk manifest marker).
//
// Scope note: the pending set's *capture* is established by the turn checkpoint
// (`reviewService.beginTurn`, taken when the agent CLI spawns) — which can't be
// driven deterministically in the sandbox (no agent CLI is installed, and the
// error-path `endTurn` races any file writes). The full on-disk round-trip
// (acceptFile keeps bytes, rejectFile restores bytes, rejectAll restores all)
// is therefore asserted authoritatively against **real git** in
// `reviewService.test.ts` (design.md §9). This spec covers what a real launch
// uniquely proves: the tiered review surface is wired end-to-end through
// Electron + IPC + the renderer — the "Revisão do agente" activity-bar view
// switches in and shows the calm teaching empty state (ACR-R1.8), and the
// review bar stays absent while the set is clean (ACR-R2.3).

async function waitForWorkUI(window: Page): Promise<void> {
  const rail = window.locator('.wb-rail')
  const continueAnyway = window.getByRole('button', { name: 'Continuar mesmo assim' })
  // The provisioning gate has TWO steps (BMAD, then second-brain / M12), each
  // shelling out to a real network-backed CLI, and each offering "Continuar
  // mesmo assim". Loop rather than clicking once, so a stalled or failing step
  // never leaves the app parked on the gate.
  for (let step = 0; step < 2; step++) {
    await Promise.race([
      rail.waitFor({ state: 'visible', timeout: 200_000 }),
      continueAnyway.waitFor({ state: 'visible', timeout: 200_000 })
    ])
    if (await rail.isVisible().catch(() => false)) break
    if (await continueAnyway.isVisible().catch(() => false)) {
      await continueAnyway.click()
      await window.waitForTimeout(300)
    }
  }
  await rail.waitFor({ state: 'visible', timeout: 30_000 })
}

test.describe('agent-change-review E2E (real Electron)', () => {
  test('the Revisão do agente view switches in and shows the empty state; no bar when clean', async () => {
    test.setTimeout(300_000)

    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hive-e2e-review-'))
    const workspace = path.join(tmpRoot, 'ws')
    const userDataDir = path.join(tmpRoot, 'userData')
    fs.mkdirSync(workspace, { recursive: true })
    fs.mkdirSync(userDataDir, { recursive: true })

    // Provisioned marker so the app boots straight into the work UI.
    fs.mkdirSync(path.join(workspace, '_bmad', '_config'), { recursive: true })
    fs.writeFileSync(path.join(workspace, '_bmad', '_config', 'manifest.yaml'), 'version: test\n')
    fs.writeFileSync(path.join(workspace, 'README.md'), 'hello\n')

    fs.writeFileSync(
      path.join(userDataDir, 'config.json'),
      JSON.stringify({
        workspacePath: workspace,
        provisioned: true,
        recentWorkspaces: [],
        agent: 'claude',
        agents: ['claude'],
        role: 'dev',
        lastModel: null,
        lastEffort: null
      })
    )

    const appPath = path.join(__dirname, '..', 'out', 'main', 'index.js')
    const launchEnv = { ...process.env }
    delete launchEnv.ELECTRON_RUN_AS_NODE

    const app = await electron.launch({
      args: [appPath, `--user-data-dir=${userDataDir}`],
      env: launchEnv
    })

    try {
      const window = await app.firstWindow()
      await window.waitForLoadState('domcontentloaded')
      await waitForWorkUI(window)

      // Dismiss the first-run guided tour (its overlay intercepts clicks).
      await window.getByRole('button', { name: 'Pular tour' }).click({ timeout: 20_000 })
      await window.locator('.wb-tour').waitFor({ state: 'hidden', timeout: 10_000 })

      // The pending set is clean → the ambient review bar is not present.
      await expect(window.locator('.wb-review-bar')).toHaveCount(0)

      // Flip to the "Revisão do agente" activity-bar view (ACR-R2.4).
      await window.getByRole('button', { name: /Revisão do agente/ }).click()

      // The dedicated panel shows the calm teaching empty state (ACR-R1.8),
      // never a blank void.
      await expect(window.getByText('Sem mudanças para revisar')).toBeVisible({ timeout: 15_000 })
      await expect(
        window.getByText('Quando o agente editar arquivos', { exact: false })
      ).toBeVisible()

      // The review bridge is exposed on window.hive (ACR-R2.5): a get on the
      // clean workspace returns an empty pending set through real IPC.
      const snapshot = await window.evaluate(async (ws) => window.hive.review.get(ws), workspace)
      expect(snapshot).toEqual({ changes: [], turns: [] })
    } finally {
      await app.close()
      fs.rmSync(tmpRoot, { recursive: true, force: true })
    }
  })
})
