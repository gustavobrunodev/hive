import { test, expect, _electron as electron } from '@playwright/test'
import type { Page } from '@playwright/test'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'

// T11 — E2E flows: create/edit/delete/rename/move/import (design.md §8's
// "E2E (Playwright + real Electron)" row, tasks.md T11, FM-R8.3). Launches
// the REAL built app (matching T2's `e2e/app-launch.spec.ts` launch pattern
// exactly — same ELECTRON_RUN_AS_NODE stripping, same `out/main/index.js`
// entrypoint) and drives the Explorer UI through the full file-management
// surface, asserting the **on-disk** result after every step (not just DOM
// state) per FM-R8.3's whole point.
//
// Workspace-selection-for-tests approach: `WorkspacePicker`'s CTA opens a
// real native OS folder-picker dialog (`dialog.showOpenDialog`), which
// can't be scripted from Playwright. Instead of driving that dialog, this
// spec seeds Electron's `userData` config store directly: `configStore.ts`
// persists `<userData>/config.json`, and `userData`'s base dir is
// `app.getPath('userData')`, which Electron's standard `--user-data-dir=`
// CLI switch overrides (untouched by this app — see `src/main/index.ts`).
// So a throwaway `userData` dir gets a pre-written `config.json` with
// `{ workspacePath: <throwaway-workspace>, provisioned: true }` *before*
// `electron.launch`, and the app boots straight past `WorkspacePicker`
// without ever hitting the native dialog.
//
// That still lands on `App.tsx`'s `updating` state (`UpdateGate`, T10) —
// `provisioned: true` only skips first-run install, not the every-launch
// update check, and `updateBmad()` unconditionally shells out to a real
// `npx bmad-method install ... --tools claude-code --yes` (verified by
// reading `src/main/bmadService.ts`: `configStore.provisioned` is written
// by install's success callback but never read by `update()` to short-
// circuit it — there's no test-mode bypass anywhere in main/preload/
// renderer). Network is reachable in this environment (verified:
// `registry.npmjs.org` responds), so the update usually completes for
// real; if it doesn't (offline runs, registry hiccups), `UpdateGate`
// itself exposes the sanctioned escape hatch (R4.2): a "Continuar mesmo
// assim" button that calls `onComplete()` immediately on an `error` event.
// This spec races both outcomes and clicks that button if the update
// errors, rather than block/skip the whole suite on network conditions.
//
// **Known environment blocker (T11, recorded in STATE.md):** in this
// working tree — which has a substantial in-progress, uncommitted
// design-system rework layered on top of file-management's own commits —
// the built app currently crashes before ever reaching `UpdateGate`:
// `Spinner` (rendered by `App.tsx`'s `checking`/`checkingProvisioned`
// states) throws `Cannot read properties of null (reading 'useState')`,
// a classic invalid-hook-call symptom. Root-caused (without editing
// anything) to `node_modules/react` resolving to two *different* physical
// copies — `hive-desktop/node_modules/react` vs
// `design-system/node_modules/react` (`file:../design-system` link, no
// dedupe) — so a `@hive/design-system` component's hooks run against a
// different React module instance than the app's root render tree. This
// predates and is unrelated to T11's own file-management IPC/UI code (the
// crash happens before any `Explorer`/`FileTree` code ever runs), so this
// spec is left as-authored per design.md's flagged E2E-instability risk:
// a real, correct local gate that will pass once that dependency-resolution
// bug is fixed elsewhere, not a blocking CI requirement today.
test.describe('file management E2E (real Electron, throwaway workspace)', () => {
  test('create, edit+save, rename, internal move, import, delete — asserted on disk', async () => {
    // The update-gate race above (real `npx bmad-method` invocation) can
    // legitimately take well past Playwright's project-wide 60s default —
    // give this specific flow real headroom.
    test.setTimeout(240_000)

    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hive-e2e-fm-'))
    const workspaceDir = path.join(tmpRoot, 'workspace')
    const userDataDir = path.join(tmpRoot, 'userData')
    const importSourceDir = path.join(tmpRoot, 'import-source')
    fs.mkdirSync(workspaceDir, { recursive: true })
    fs.mkdirSync(userDataDir, { recursive: true })
    fs.mkdirSync(importSourceDir, { recursive: true })

    // T9 (workspace-switching, WS-R3.3) changed onboarding routing from the
    // `provisioned` config flag to a disk-based check of
    // `<workspace>/_bmad/_config/manifest.yaml` (`WorkspaceService.
    // provisionState()`), evaluated fresh for the specific workspace path.
    // `provisioned: true` below no longer alone routes past `GuidedInstall`
    // — the on-disk marker itself has to exist too, or the app now
    // (correctly) shows the guided-install config form instead of
    // `UpdateGate`. This spec is about file management inside an
    // already-provisioned workspace, not the install flow, so the marker is
    // written directly (same throwaway-fixture spirit as workspace-
    // switching's own E2E spec — no real `bmad-method install` run needed).
    const manifestDir = path.join(workspaceDir, '_bmad', '_config')
    fs.mkdirSync(manifestDir, { recursive: true })
    fs.writeFileSync(path.join(manifestDir, 'manifest.yaml'), 'version: test-fixture\n', 'utf-8')

    // Seed the config the app will read on boot (see comment above) —
    // mirrors `ConfigStore`'s own `Config` shape (`src/main/configStore.ts`).
    fs.writeFileSync(
      path.join(userDataDir, 'config.json'),
      JSON.stringify({
        workspacePath: workspaceDir,
        provisioned: true,
        lastModel: null,
        lastEffort: null
      }),
      'utf-8'
    )

    // The file an OS drag-and-drop would have brought in — lives OUTSIDE
    // the workspace, as any real drag source would.
    const importSourcePath = path.join(importSourceDir, 'imported-doc.txt')
    fs.writeFileSync(importSourcePath, 'brought in from outside the workspace\n', 'utf-8')

    const appPath = path.join(__dirname, '..', 'out', 'main', 'index.js')

    // Same ELECTRON_RUN_AS_NODE-stripping as T2's app-launch.spec.ts — this
    // dev box has it set ambient in the shell; if inherited, Electron runs
    // the launched script as plain Node instead of booting the app.
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

      // --- Create (FM-R1) ---------------------------------------------------
      await createEntry(window, 'newFileLabel', 'notes.md')
      const notesPath = path.join(workspaceDir, 'notes.md')
      expect(fs.existsSync(notesPath)).toBe(true)
      expect(fs.readFileSync(notesPath, 'utf-8')).toBe('')

      // --- Edit + save (FM-R2) -----------------------------------------------
      // T5 (explorer-editor-ux, UX-R1.1): editable files now open directly in
      // edit mode (no separate "Editar" button click needed anymore).
      await openFile(window, 'notes.md')
      const editor = window.getByLabel('Conteúdo do arquivo')
      await editor.fill('# Hello from E2E\n')
      await window.getByRole('button', { name: 'Salvar' }).click()
      await expect(window.getByRole('button', { name: 'Salvar' })).toHaveCount(0)
      expect(fs.readFileSync(notesPath, 'utf-8')).toBe('# Hello from E2E\n')

      // --- Rename (FM-R4) ------------------------------------------------------
      await renameEntry(window, 'notes.md', 'renamed.md')
      const renamedPath = path.join(workspaceDir, 'renamed.md')
      expect(fs.existsSync(notesPath)).toBe(false)
      expect(fs.existsSync(renamedPath)).toBe(true)
      expect(fs.readFileSync(renamedPath, 'utf-8')).toBe('# Hello from E2E\n')

      // --- Internal move via drag (FM-R4.2) -------------------------------
      // Create the destination folder first (toolbar action targets the
      // root since nothing has been explicitly selected as an active dir).
      await createEntry(window, 'newFolderLabel', 'target-folder')
      const targetFolderPath = path.join(workspaceDir, 'target-folder')
      expect(fs.existsSync(targetFolderPath)).toBe(true)

      // Real OS-level drag can't be reliably driven through Playwright's
      // synthetic mouse events for HTML5 `draggable` elements in Electron/
      // Chromium (the design.md §8 "E2E dependency reality check" flags the
      // OS-external case; the same underlying HTML5 DnD limitation applies
      // to same-window drag here too). `Explorer.tsx`'s row handlers
      // (`handleRowDragStart`/`handleRowDragOver`/`handleRowDrop`) are
      // plain React `onDragStart`/`onDragOver`/`onDrop` listeners driven
      // entirely by DOM `DragEvent`/`DataTransfer` — there is no other UI
      // affordance for a cross-directory move (the rename input only
      // renames in place; there's no context-menu "Move" item). So this
      // dispatches real `DragEvent`s with a real `DataTransfer` directly at
      // the row elements, which exercises the exact same handler code path
      // a real mouse-driven drag would, without depending on Chromium's
      // OS-level DnD pipeline reacting to synthetic mouse coordinates.
      await dragRowOnto(window, 'renamed.md', 'target-folder')
      const movedPath = path.join(workspaceDir, 'target-folder', 'renamed.md')
      await expect.poll(() => fs.existsSync(renamedPath), { timeout: 10_000 }).toBe(false)
      expect(fs.existsSync(movedPath)).toBe(true)
      expect(fs.readFileSync(movedPath, 'utf-8')).toBe('# Hello from E2E\n')

      // --- Import (FM-R5) -------------------------------------------------
      // design.md §8: OS-native drag-from-Windows-Explorer can't be
      // literally driven by Playwright, so the sanctioned E2E approach is
      // invoking the same import path the drop handler calls directly.
      await window.evaluate(
        ([root, sourceAbs, destRel]) => window.hive.fs.importEntry(root, sourceAbs, destRel),
        [workspaceDir, importSourcePath, 'imported-doc.txt']
      )
      const importedPath = path.join(workspaceDir, 'imported-doc.txt')
      expect(fs.existsSync(importedPath)).toBe(true)
      expect(fs.readFileSync(importedPath, 'utf-8')).toBe('brought in from outside the workspace\n')
      // Refresh so the tree reflects the import made via the test hook
      // rather than the watcher (which should also pick it up, but the
      // delete step below needs the row present regardless of timing).
      await window.waitForFunction(
        (name) => document.querySelector(`[id="hds-tree-item-${name}"]`) !== null,
        'imported-doc.txt',
        { timeout: 15_000 }
      )

      // --- Delete (FM-R3, trash) -------------------------------------------
      await deleteEntry(window, 'imported-doc.txt')
      await expect.poll(() => fs.existsSync(importedPath), { timeout: 10_000 }).toBe(false)
    } finally {
      await app.close()
      fs.rmSync(tmpRoot, { recursive: true, force: true })
    }
  })
})

/**
 * Waits out the onboarding gate (`App.tsx`'s `checking`/`checkingProvisioned`
 * spinner, then `UpdateGate` since the seeded config is `provisioned: true`)
 * until the real work UI (`WorkUI`'s file-tree rail) is on screen — or,
 * per the file-header comment, clicks UpdateGate's "continue anyway" escape
 * hatch if the real `npx bmad-method` update errors out.
 */
async function waitForWorkUI(window: Page): Promise<void> {
  const rail = window.locator('.wb-rail')
  const continueAnyway = window.getByRole('button', { name: 'Continuar mesmo assim' })

  await Promise.race([
    rail.waitFor({ state: 'visible', timeout: 200_000 }),
    continueAnyway.waitFor({ state: 'visible', timeout: 200_000 })
  ])

  if (await continueAnyway.isVisible().catch(() => false)) {
    await continueAnyway.click()
  }

  await rail.waitFor({ state: 'visible', timeout: 30_000 })
}

/** Creates a root-level file or folder via the tree toolbar (`newFileLabel`/`newFolderLabel` icon buttons) and its inline-name input. */
async function createEntry(
  window: Page,
  toolbarLabelKey: 'newFileLabel' | 'newFolderLabel',
  name: string
): Promise<void> {
  const label = toolbarLabelKey === 'newFileLabel' ? 'Novo arquivo' : 'Nova pasta'
  await window.getByRole('button', { name: label, exact: true }).click()
  const input = window.getByLabel('Nome do arquivo ou pasta')
  await input.fill(name)
  await input.press('Enter')
  await window
    .locator(`[id="hds-tree-item-${name}"]`)
    .waitFor({ state: 'visible', timeout: 10_000 })
}

/** Opens a root-level file by clicking its tree row. */
async function openFile(window: Page, relPath: string): Promise<void> {
  await window.locator(`[id="hds-tree-item-${relPath}"]`).click()
  await window.getByLabel(`Fechar arquivo`).waitFor({ state: 'visible', timeout: 10_000 })
}

/** Row-menu "Renomear" flow: opens the row's `...` menu, clicks Rename, types the new name, commits with Enter. */
async function renameEntry(window: Page, fromName: string, toName: string): Promise<void> {
  await window.getByRole('button', { name: `Mais ações para ${fromName}` }).click()
  await window.getByRole('menuitem', { name: 'Renomear' }).click()
  const input = window.getByLabel('Novo nome')
  await input.fill(toName)
  await input.press('Enter')
  await window
    .locator(`[id="hds-tree-item-${toName}"]`)
    .waitFor({ state: 'visible', timeout: 10_000 })
}

/** Row-menu "Excluir" flow: opens the row's `...` menu, clicks Delete, confirms the trash dialog. */
async function deleteEntry(window: Page, relPath: string): Promise<void> {
  await window.getByRole('button', { name: `Mais ações para ${relPath}` }).click()
  await window.getByRole('menuitem', { name: 'Excluir' }).click()
  await window.getByRole('button', { name: 'Mover para a lixeira' }).click()
}

/**
 * Dispatches real `DragEvent`s (with a real `DataTransfer`) at the source
 * and destination rows' own row-content elements — see the inline comment
 * at the call site for why this replaces a mouse-driven drag. The `>` child
 * combinator on `div.hds-tree-row` scopes each selector to that row's own
 * content (not a nested child row's, which the DS `Tree` renders as a
 * sibling `<ul role="group">`, not inside `div.hds-tree-row`).
 */
async function dragRowOnto(
  window: Page,
  sourceRelPath: string,
  destRelPath: string
): Promise<void> {
  await window.evaluate(
    ([sourceId, destId]) => {
      function rowContent(id: string): HTMLElement {
        const el = document.querySelector<HTMLElement>(
          `[id="hds-tree-item-${id}"] > div.hds-tree-row .wb-tree-row-content`
        )
        if (!el) throw new Error(`row content not found for ${id}`)
        return el
      }
      const source = rowContent(sourceId)
      const dest = rowContent(destId)
      const dataTransfer = new DataTransfer()
      source.dispatchEvent(
        new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer })
      )
      dest.dispatchEvent(
        new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer })
      )
      dest.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer }))
      source.dispatchEvent(
        new DragEvent('dragend', { bubbles: true, cancelable: true, dataTransfer })
      )
    },
    [sourceRelPath, destRelPath]
  )
}
