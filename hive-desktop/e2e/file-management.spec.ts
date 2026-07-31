import type { Page } from '@playwright/test'
import path from 'node:path'
import fs from 'node:fs'
import { test, expect } from './fixtures/workspace'

// T11 — E2E flows: create/edit/delete/rename/move/import (design.md §8's
// "E2E (Playwright + real Electron)" row, tasks.md T11, FM-R8.3). Drives the
// Explorer UI through the full file-management surface, asserting the
// **on-disk** result after every step (not just DOM state) per FM-R8.3.
//
// Seeding and launch now come from `./fixtures/workspace` (P0-001/P0-004): one
// throwaway workspace + `userData` per case, the B-1 seam armed so the app
// reaches the work UI without a real `npx bmad-method install`, and teardown
// owned by the fixture. This spec previously carried ~60 lines of its own
// seeding plus a race against the real provisioning gate — including a click
// on "Continuar mesmo assim", which meant it was quietly testing the gate's
// ERROR path while looking like the happy path. That is what made it one of
// the four known-red specs (R-01).

test.describe('file management E2E (real Electron, throwaway workspace)', () => {
  test('@p0 create, edit+save, rename, internal move, import, delete — asserted on disk', async ({
    hiveApp
  }) => {
    const { window, seeded } = hiveApp
    const workspaceDir = seeded.workspace

    // The file an OS drag-and-drop would have brought in — lives OUTSIDE the
    // workspace, as any real drag source would.
    const importSourcePath = path.join(seeded.outside, 'imported-doc.txt')
    fs.writeFileSync(importSourcePath, 'brought in from outside the workspace\n', 'utf-8')

    {
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
    }
  })
})

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
