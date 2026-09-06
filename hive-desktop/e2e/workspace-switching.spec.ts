import { test, expect } from './fixtures/workspace'
import { launchSeededApp } from './fixtures/workspace'
import type { Page } from '@playwright/test'
import path from 'node:path'
import fs from 'node:fs'
import { openSidebar } from './fixtures/sidebar'

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
// `InstallConfigForm` screen, heading "Como você quer trabalhar?") rather than
// submitting the form and waiting out a real `bmad-method install` — WS-R4.2
// only requires that switching to an unprovisioned workspace shows
// `GuidedInstall` instead of the work UI, and `GuidedInstall.tsx` renders
// the config form immediately (Act 1) with nothing installed until it's
// submitted (see that file's own header comment), so the form's presence is
// sufficient, real-on-DOM proof of the routing decision without paying for
// a second live install run in the same spec (workspace B's switch already
// exercises one real update-gate cycle).
test.describe('workspace switching E2E (real Electron, throwaway workspaces)', () => {
  test('@p0 switch A -> provisioned B (update, rebind) -> unprovisioned C (guided install)', async ({
    seeded
  }) => {
    // The fixture's workspace is A. B and C are siblings under the same
    // throwaway root, so teardown still removes everything in one go.
    const workspaceA = seeded.workspace
    const workspaceB = path.join(seeded.root, 'workspace-b')
    const workspaceC = path.join(seeded.root, 'workspace-c')
    const screenshotsDir = path.join(
      __dirname,
      '..',
      'test-results',
      'workspace-switching-screenshots'
    )
    fs.mkdirSync(workspaceB, { recursive: true })
    fs.mkdirSync(workspaceC, { recursive: true })
    fs.mkdirSync(screenshotsDir, { recursive: true })

    // Distinguishing content per workspace, so the file tree post-switch
    // proves a real rebind (fresh tree bound to the new path), not just a
    // relabeled chip over stale state (WS-R4.4).
    fs.writeFileSync(path.join(workspaceA, 'a-only.txt'), 'lives only in workspace A\n', 'utf-8')
    fs.writeFileSync(path.join(workspaceB, 'b-only.txt'), 'lives only in workspace B\n', 'utf-8')

    // B is provisioned via the on-disk marker only — WS-R3.3 made onboarding
    // routing disk-based, so the config flag alone would not skip
    // `GuidedInstall`. C stays a plain empty directory with no `_bmad/` at
    // all, which is exactly what its leg of this test asserts.
    const manifestDir = path.join(workspaceB, '_bmad', '_config')
    fs.mkdirSync(manifestDir, { recursive: true })
    fs.writeFileSync(path.join(manifestDir, 'manifest.yaml'), 'version: test-fixture\n', 'utf-8')

    // Put B and C in the MRU so the chip menu's Recentes section offers both
    // without ever needing the native picker dialog.
    const configPath = path.join(seeded.userData, 'config.json')
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
    config.recentWorkspaces = [workspaceB, workspaceC]
    fs.writeFileSync(configPath, JSON.stringify(config), 'utf-8')

    const app = await launchSeededApp(seeded)

    try {
      const window = await app.firstWindow()
      await window.waitForLoadState('domcontentloaded')

      // --- Boot into A (provisioned, via seeded config.json) ---------------
      await waitForWorkUI(window)
      await expect(window.locator('[id="hds-tree-item-a-only.txt"]')).toBeVisible({
        timeout: 15_000
      })
      await expect(window.locator('.wb-workspace-chip-name')).toHaveText(path.basename(workspaceA))

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
        .poll(() => readConfig(seeded.userData).workspacePath, { timeout: 10_000 })
        .toBe(workspaceB)
      expect(readConfig(seeded.userData).recentWorkspaces[0]).toBe(workspaceB)

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
      await expect(window.getByRole('heading', { name: 'Como você quer trabalhar?' })).toBeVisible({
        timeout: 30_000
      })
      await expect(window.locator('.wb-rail')).toHaveCount(0)

      // --- Assert: config.json reflects C as active + MRU head -------------
      await expect
        .poll(() => readConfig(seeded.userData).workspacePath, { timeout: 10_000 })
        .toBe(workspaceC)
      expect(readConfig(seeded.userData).recentWorkspaces[0]).toBe(workspaceC)
    } finally {
      await app.close()
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
  // The **activity bar**, not the file rail: a workspace with no stored session
  // opens on the chat alone (workspace-session), so `.wb-rail` is collapsed to
  // zero here — `openSidebar` at the end is what brings it back.
  const rail = window.locator('.wb-actionrail')
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
  await openSidebar(window)
}
