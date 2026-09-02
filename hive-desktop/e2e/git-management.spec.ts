import { test, expect, _electron as electron } from '@playwright/test'
import type { Page } from '@playwright/test'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'
import { execFileSync } from 'node:child_process'

// git-management (M10) E2E, GIT-R14.6 — Playwright driving the real built
// Electron app against a throwaway git repo + a local **bare** remote (no
// network, so system credentials aren't needed, satisfying D-GIT-1). Mirrors
// workspace-switching.spec.ts's `_electron.launch` + seeded-config.json boot
// recipe (STATE.md T2/T11 lessons: strip ELECTRON_RUN_AS_NODE, provision via
// the on-disk `_bmad/_config/manifest.yaml` marker rather than a real install).
//
// Drives the everyday loop through the UI — flip to Source Control, read a
// diff, stage, commit, sync (push to the bare remote), then stash — asserting
// real `git`/on-disk state at each step (not just the DOM). Conflict
// resolution + branch delete are exercised by the unit/component suites
// (conflictParse/ConflictView/BranchPicker); this spec covers the linear
// write→publish→stash loop that most needs a real repo to be trustworthy.

/** Runs a git command in `cwd`, returning stdout. */
function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf-8' })
}

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

test.describe('git-management E2E (real repo + bare remote, real Electron)', () => {
  test('flip → diff → stage → commit → sync (push) → stash', async () => {
    test.setTimeout(300_000)

    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hive-e2e-git-'))
    const workspace = path.join(tmpRoot, 'repo')
    const remote = path.join(tmpRoot, 'origin.git')
    const userDataDir = path.join(tmpRoot, 'userData')
    fs.mkdirSync(workspace, { recursive: true })
    fs.mkdirSync(userDataDir, { recursive: true })

    // Provisioned marker so the app boots straight into the work UI.
    fs.mkdirSync(path.join(workspace, '_bmad', '_config'), { recursive: true })
    fs.writeFileSync(path.join(workspace, '_bmad', '_config', 'manifest.yaml'), 'version: test\n')

    // A bare remote + a repo with an initial commit pushed to it (upstream set).
    git(tmpRoot, 'init', '--bare', '-b', 'main', remote)
    git(workspace, 'init', '-b', 'main')
    git(workspace, 'config', 'user.email', 'e2e@test')
    git(workspace, 'config', 'user.name', 'E2E')
    fs.writeFileSync(path.join(workspace, 'README.md'), 'line1\nline2\nline3\n')
    git(workspace, 'add', '-A')
    git(workspace, 'commit', '-m', 'initial commit')
    git(workspace, 'remote', 'add', 'origin', remote)
    git(workspace, 'push', '-u', 'origin', 'main')

    // A pending unstaged change to review on boot.
    fs.writeFileSync(path.join(workspace, 'README.md'), 'line1\nCHANGED LINE\nline3\n')

    fs.writeFileSync(
      path.join(userDataDir, 'config.json'),
      JSON.stringify({
        workspacePath: workspace,
        provisioned: true,
        recentWorkspaces: [],
        // A pre-enabled agent + a chosen role skip the agent-setup and
        // role-setup onboarding gates (no agent CLI is installed in CI); the
        // work UI never actually starts a session.
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

      // Dismiss the first-run guided tour (it opens once role actions load, so
      // wait for its skip button rather than racing an early isVisible check) —
      // its overlay would otherwise intercept every click.
      await window.getByRole('button', { name: 'Pular tour' }).click({ timeout: 20_000 })
      await window.locator('.wb-tour').waitFor({ state: 'hidden', timeout: 10_000 })

      // --- Flip to Source Control (GIT-R13) --------------------------------
      await window.getByRole('button', { name: /Controle de versão/ }).click()
      const row = window.locator('.wb-scm-row', { hasText: 'README.md' })
      await expect(row).toBeVisible({ timeout: 15_000 })

      // --- Open the diff (GIT-R4): the change renders add/remove lines ------
      await row.locator('.wb-scm-row-open').click()
      await expect(window.locator('.wb-diff')).toBeVisible({ timeout: 15_000 })
      await expect(window.getByText('CHANGED LINE')).toBeVisible()

      // --- Stage (GIT-R3) → the file lands in the staged group + git index --
      await row.hover()
      await row.getByRole('button', { name: 'Preparar', exact: true }).click({ force: true })
      await expect(window.getByText('Alterações prontas')).toBeVisible({ timeout: 15_000 })
      await expect
        .poll(() => git(workspace, 'diff', '--cached', '--name-only').trim())
        .toContain('README.md')

      // --- Commit (GIT-R5) → git log has it, the list clears ---------------
      await window.getByPlaceholder(/commitar/).fill('feat: change line 2')
      await window.getByRole('button', { name: 'Commit', exact: true }).click()
      await expect
        .poll(() => git(workspace, 'log', '--oneline'), { timeout: 15_000 })
        .toContain('change line 2')
      await expect(window.getByText('Nenhuma alteração')).toBeVisible({ timeout: 15_000 })

      // --- Sync (GIT-R7): push the new commit to the bare remote -----------
      await window.getByRole('button', { name: /Sincronizar/ }).click()
      await expect
        .poll(() => git(remote, 'log', '--oneline'), { timeout: 30_000 })
        .toContain('change line 2')

      // --- Stash (GIT-R10): a fresh edit, stashed, leaves the tree clean ---
      fs.writeFileSync(path.join(workspace, 'README.md'), 'line1\nCHANGED LINE\nSTASH ME\n')
      await window.getByRole('button', { name: 'Atualizar', exact: true }).click()
      await expect(window.locator('.wb-scm-row', { hasText: 'README.md' })).toBeVisible({
        timeout: 15_000
      })
      await window.getByRole('button', { name: 'Guardar alterações', exact: true }).click()
      await window.getByRole('button', { name: 'Guardar', exact: true }).click()
      await expect
        .poll(() => git(workspace, 'stash', 'list'), { timeout: 15_000 })
        .toContain('stash@{0}')
      // The README edit is gone from the working tree (the stash took it). Scope
      // to README.md: the running app provisions untracked `_bmad/*` files, so
      // the tree as a whole is never empty.
      await expect
        .poll(() => git(workspace, 'status', '--porcelain', '--', 'README.md').trim())
        .toBe('')

      // --- git-logs: the command journal, end to end -----------------------
      // Everything above ran real `git` through the main process. The console
      // is the only surface that proves it: main recorded each invocation,
      // the preload bridge carried the backlog across, and the dock rendered
      // it. Asserting on the commands this very test caused is what makes the
      // journal a record rather than a decoration — a mocked console can look
      // identical and be reporting nothing.
      await window.getByRole('button', { name: 'Mais ações' }).click()
      await window.getByRole('menuitem', { name: /Ver logs do Git/ }).click()
      const console_ = window.locator('.wb-gitlog')
      await expect(console_).toBeVisible({ timeout: 15_000 })
      await expect(console_.getByText('git push', { exact: true })).toBeVisible({
        timeout: 15_000
      })
      // The `add` and the `commit` this spec drove, with their real cwd.
      await expect(console_.locator('.wb-gitlog-cmd-text', { hasText: /^git add/ }).first())
        .toBeVisible()
      await expect(console_.locator('.wb-gitlog-cmd-text', { hasText: /^git commit/ }).first())
        .toBeVisible()
      await expect(console_.locator('.wb-gitlog-cwd').first()).toHaveText(workspace)
      // Every row carries a real, non-empty duration — the timing is measured,
      // not a placeholder.
      await expect(console_.locator('.wb-gitlog-dur').first()).not.toBeEmpty()
    } finally {
      await app.close()
    }
  })
})
