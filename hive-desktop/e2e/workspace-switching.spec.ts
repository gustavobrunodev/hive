import { test, expect, _electron as electron } from '@playwright/test'
import type { Page } from '@playwright/test'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'

// T9 (workspace-switching, M8) — E2E + visual validation, WS-R8.3/WS-R8.4.
// Extends the file-management/explorer-editor-ux E2E harness conventions
// (`_electron.launch` against the real built app, `--user-data-dir` +
// pre-written `config.json` to skip the native OS folder picker/dialog —
// see STATE.md's T11 lesson) to cover the new in-app workspace-switch flow:
// boot into workspace A, switch to a provisioned workspace B via the chip
// menu's "Recentes" list (→ UpdateGate → work UI rebound to B), then switch
// to an unprovisioned workspace C the same way (→ GuidedInstall shown
// instead of the work UI).
//
// Fixture note (per T11's lesson): workspace B's "provisioned" state is
// established by writing `_bmad/_config/manifest.yaml` directly to disk —
// the exact marker `WorkspaceService.provisionState()` checks (see
// `src/main/workspaceService.ts`) — NOT by running a real `bmad-method
// install`. Workspace C is a plain empty directory (no `_bmad/` at all).
//
// Recentes-seeding note: `WorkspacePicker`/the chip menu's "Abrir pasta…"
// opens a real native `dialog.showOpenDialog`, which — like the first-run
// picker — is not scriptable from Playwright (STATE.md T11). There is no
// test-only hook on `window.hive`/`WorkspaceService` to inject a picker
// result (checked `src/preload/index.d.ts` and `workspaceService.ts`: the
// only path in is the real dialog). So, per the task's own documented
// fallback, both switches in this spec are driven via the chip menu's
// "Recentes" list, seeded directly into `<userData>/config.json`'s
// `recentWorkspaces` array before launch — exercising the exact same
// `requestSwitch`/`proceedSwitch`/`openWorkspace` pipeline "Abrir pasta…"
// itself calls once a path is resolved (`WorkUI.tsx`'s `handleChooseFolder`
// vs. the Recentes `onSelect` both funnel into the same `requestSwitch`).
//
// Workspace C's guided-install assertion deliberately stops at Act 1 (the
// `InstallConfigForm` screen, heading "Configurar o BMAD") rather than
// submitting the form and waiting out a real `bmad-method install` — WS-R4.2
// only requires that switching to an unprovisioned workspace shows
// `GuidedInstall` instead of the work UI, and `GuidedInstall.tsx` renders
// the config form immediately (Act 1) with nothing installed until it's
// submitted (see that file's own header comment), so the form's presence is
// sufficient, real-on-DOM proof of the routing decision without paying for
// a second live install run in the same spec (workspace B's switch already
// exercises one real update-gate cycle).
test.describe('workspace switching E2E (real Electron, throwaway workspaces)', () => {
  test('switch A -> provisioned B (update, rebind) -> unprovisioned C (guided install)', async () => {
    // Two onboarding-gate transitions in one test (A's initial UpdateGate +
    // B's post-switch UpdateGate), each potentially running a real `npx
    // bmad-method install` — give this real headroom, matching the other
    // specs' single-transition 240s budget roughly doubled.
    test.setTimeout(400_000)

    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hive-e2e-ws-'))
    const workspaceA = path.join(tmpRoot, 'workspace-a')
    const workspaceB = path.join(tmpRoot, 'workspace-b')
    const workspaceC = path.join(tmpRoot, 'workspace-c')
    const userDataDir = path.join(tmpRoot, 'userData')
    const screenshotsDir = path.join(
      __dirname,
      '..',
      'test-results',
      'workspace-switching-screenshots'
    )

    fs.mkdirSync(workspaceA, { recursive: true })
    fs.mkdirSync(workspaceB, { recursive: true })
    fs.mkdirSync(workspaceC, { recursive: true })
    fs.mkdirSync(userDataDir, { recursive: true })
    fs.mkdirSync(screenshotsDir, { recursive: true })

    // Distinguishing content per workspace, so the file tree post-switch
    // proves a real rebind (fresh tree bound to the new path), not just a
    // relabeled chip over stale state (WS-R4.4).
    fs.writeFileSync(path.join(workspaceA, 'a-only.txt'), 'lives only in workspace A\n', 'utf-8')
    fs.writeFileSync(path.join(workspaceB, 'b-only.txt'), 'lives only in workspace B\n', 'utf-8')

    // Workspaces A and B: provisioned via the on-disk marker only (T11's
    // lesson) — no real `bmad-method install` run. WS-R3.3 made onboarding
    // routing disk-based (`WorkspaceService.provisionState()`), so A's own
    // `provisioned: true` config flag below is not by itself enough to skip
    // `GuidedInstall` on boot — the marker has to actually exist too (see
    // the same fix applied to file-management.spec.ts/explorer-editor-ux.
    // spec.ts's fixtures).
    for (const ws of [workspaceA, workspaceB]) {
      const manifestDir = path.join(ws, '_bmad', '_config')
      fs.mkdirSync(manifestDir, { recursive: true })
      fs.writeFileSync(path.join(manifestDir, 'manifest.yaml'), 'version: test-fixture\n', 'utf-8')
    }

    // Workspace C stays a plain empty directory — no `_bmad/` at all, so
    // `provisionState()` (a disk check) is false for it.

    // Seed `config.json` (`ConfigStore`'s `Config` shape, `configStore.ts`):
    // boot straight into workspace A (skips WorkspacePicker), with B and C
    // already in the MRU so the chip menu's Recentes section shows both
    // without ever needing the native picker dialog.
    fs.writeFileSync(
      path.join(userDataDir, 'config.json'),
      JSON.stringify({
        workspacePath: workspaceA,
        provisioned: true,
        recentWorkspaces: [workspaceB, workspaceC],
        lastModel: null,
        lastEffort: null
      }),
      'utf-8'
    )

    const appPath = path.join(__dirname, '..', 'out', 'main', 'index.js')

    // Same ELECTRON_RUN_AS_NODE-stripping as the other specs (STATE.md T2).
    const launchEnv = { ...process.env }
    delete launchEnv.ELECTRON_RUN_AS_NODE

    const app = await electron.launch({
      args: [appPath, `--user-data-dir=${userDataDir}`],
      env: launchEnv
    })

    try {
      const window = await app.firstWindow()
      await window.waitForLoadState('domcontentloaded')

      // --- Boot into A (provisioned, via seeded config.json) ---------------
      await waitForWorkUI(window)
      await expect(window.locator('[id="hds-tree-item-a-only.txt"]')).toBeVisible({
        timeout: 15_000
      })
      await expect(window.locator('.wb-workspace-chip-name')).toHaveText('workspace-a')

      // --- WS-R8.4: screenshot the chip menu open, showing Recentes --------
      await openChipMenu(window)
      const recentsSection = window.getByText('Recentes', { exact: true })
      await expect(recentsSection).toBeVisible()
      await expect(window.getByRole('menuitem', { name: 'workspace-b' })).toBeVisible()
      await expect(window.getByRole('menuitem', { name: 'workspace-c' })).toBeVisible()
      await window.screenshot({
        path: path.join(screenshotsDir, '01-chip-menu-recentes.png')
      })

      // --- Switch A -> B via Recentes (WS-R1.2, WS-R4.1/R4.3) ---------------
      await window.getByRole('menuitem', { name: 'workspace-b' }).click()

      // B is provisioned (disk marker) -> routes to UpdateGate, same
      // race-the-real-CLI pattern as every other spec's initial boot.
      await waitForWorkUI(window)

      // --- Assert: work UI rebinds to B, not leaking A's content -----------
      await expect(window.locator('.wb-workspace-chip-name')).toHaveText('workspace-b')
      await expect(window.locator('[id="hds-tree-item-b-only.txt"]')).toBeVisible({
        timeout: 15_000
      })
      await expect(window.locator('[id="hds-tree-item-a-only.txt"]')).toHaveCount(0)

      // --- Assert: config.json reflects B as active + MRU head -------------
      await expect
        .poll(() => readConfig(userDataDir).workspacePath, { timeout: 10_000 })
        .toBe(workspaceB)
      expect(readConfig(userDataDir).recentWorkspaces[0]).toBe(workspaceB)

      // --- WS-R8.4: screenshot the post-switch work UI ----------------------
      await window.screenshot({
        path: path.join(screenshotsDir, '02-post-switch-work-ui.png')
      })

      // --- Switch B -> C via Recentes (unprovisioned) -----------------------
      await openChipMenu(window)
      await expect(window.getByRole('menuitem', { name: 'workspace-c' })).toBeVisible()
      await window.getByRole('menuitem', { name: 'workspace-c' }).click()

      // C is NOT provisioned (no _bmad/ at all) -> WS-R4.2 routes to
      // GuidedInstall, whose Act 1 (InstallConfigForm) renders immediately,
      // before anything is actually installed (GuidedInstall.tsx's own
      // header comment) — sufficient real-DOM proof of the routing decision.
      await expect(window.getByRole('heading', { name: 'Configurar o BMAD' })).toBeVisible({
        timeout: 30_000
      })
      await expect(window.locator('.wb-rail')).toHaveCount(0)

      // --- Assert: config.json reflects C as active + MRU head -------------
      await expect
        .poll(() => readConfig(userDataDir).workspacePath, { timeout: 10_000 })
        .toBe(workspaceC)
      expect(readConfig(userDataDir).recentWorkspaces[0]).toBe(workspaceC)
    } finally {
      await app.close()
      fs.rmSync(tmpRoot, { recursive: true, force: true })
    }
  })
})

/** Shape written/read by `ConfigStore` (`src/main/configStore.ts`) — duplicated locally to keep this spec self-contained. */
interface OnDiskConfig {
  workspacePath: string | null
  provisioned: boolean
  recentWorkspaces: string[]
  lastModel: string | null
  lastEffort: string | null
}

/** Reads `<userDataDir>/config.json` fresh off disk (no caching) — mirrors `ConfigStore`'s own "disk is the source of truth" design. */
function readConfig(userDataDir: string): OnDiskConfig {
  const raw = fs.readFileSync(path.join(userDataDir, 'config.json'), 'utf-8')
  return JSON.parse(raw) as OnDiskConfig
}

/** Opens the workspace chip's dropdown menu (`WorkUI.tsx`'s `DropdownMenuTrigger`). */
async function openChipMenu(window: Page): Promise<void> {
  await window.locator('.wb-workspace-chip').click()
}

/**
 * Waits out the onboarding gate (`App.tsx`'s `checking`/`checkingProvisioned`
 * spinner, then `UpdateGate` since the target workspace is seeded/marked
 * provisioned) until the real work UI (`WorkUI`'s file-tree rail) is on
 * screen — or clicks UpdateGate's "continue anyway" escape hatch if the real
 * `npx bmad-method` update errors out. Duplicated from the other E2E specs'
 * own copy of this helper, matching their convention of keeping each spec
 * self-contained.
 */
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
