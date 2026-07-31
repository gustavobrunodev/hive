import fs from 'node:fs'
import path from 'node:path'
import type { Page } from '@playwright/test'
import { test, expect, launchSeededApp, waitForWorkUI } from './fixtures/workspace'

// P1-009 (WS-R) — switching workspace with unsaved editor changes must offer
// the three-way guard, and each way has to mean what it says **on disk**.
// `workspace-switching.spec.ts` proves the switch itself (rebind, MRU, routing);
// this is the branch it never takes: a dirty editor at the moment of the switch.
//
// The three ways are split across two cases (one workspace and one app each,
// R-16) because a completed switch rebinds the app to the other workspace and
// there is no dirty editor left to guard.

/** Seeds a second, provisioned workspace next to the fixture's, and puts it in the MRU. */
function seedSibling(seeded: { root: string; userData: string }, name: string): string {
  const sibling = path.join(seeded.root, name)
  fs.mkdirSync(path.join(sibling, '_bmad', '_config'), { recursive: true })
  fs.writeFileSync(
    path.join(sibling, '_bmad', '_config', 'manifest.yaml'),
    'version: test-fixture\n',
    'utf-8'
  )
  fs.writeFileSync(path.join(sibling, `${name}-only.txt`), 'do outro workspace\n', 'utf-8')

  const configPath = path.join(seeded.userData, 'config.json')
  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as Record<string, unknown>
  config.recentWorkspaces = [sibling]
  fs.writeFileSync(configPath, JSON.stringify(config), 'utf-8')
  return sibling
}

/** Opens `notes.md` and leaves it dirty (typed, unsaved). */
async function dirtyTheEditor(window: Page, text: string): Promise<void> {
  await window.locator('[id="hds-tree-item-notes.md"]').click()
  const editor = window.getByLabel('Conteúdo do arquivo')
  await editor.waitFor({ state: 'visible', timeout: 15_000 })
  await editor.fill(text)
  // The Salvar affordance appearing IS the dirty state — no timer involved.
  await window.getByRole('button', { name: 'Salvar' }).waitFor({ state: 'visible' })
}

async function requestSwitchTo(window: Page, name: string): Promise<void> {
  await window.locator('.wb-workspace-chip').click()
  await window.getByRole('menuitem', { name }).click()
}

test.describe('workspace switch guard (P1-009)', () => {
  test('@p0 @destructive Cancelar mantém tudo; Salvar grava e só então troca', async ({
    seeded
  }) => {
    const notesPath = path.join(seeded.workspace, 'notes.md')
    fs.writeFileSync(notesPath, 'original\n', 'utf-8')
    const sibling = seedSibling(seeded, 'workspace-b')

    const app = await launchSeededApp(seeded)
    const window = await app.firstWindow()
    await waitForWorkUI(window)

    await dirtyTheEditor(window, 'editado, ainda não salvo\n')

    // --- Cancelar: the switch never happened -------------------------------
    await requestSwitchTo(window, 'workspace-b')
    await expect(window.getByRole('heading', { name: 'Alterações não salvas' })).toBeVisible({
      timeout: 15_000
    })
    await window.getByRole('button', { name: 'Cancelar' }).click()

    await expect(window.getByRole('heading', { name: 'Alterações não salvas' })).toHaveCount(0)
    expect(fs.readFileSync(notesPath, 'utf-8')).toBe('original\n')
    await expect(window.locator('.wb-workspace-chip-name')).toHaveText(
      path.basename(seeded.workspace)
    )
    // Still dirty: cancelling must not have quietly resolved the edit either way.
    await expect(window.getByRole('button', { name: 'Salvar' })).toBeVisible()

    // --- Salvar: the bytes land, then the switch proceeds -------------------
    await requestSwitchTo(window, 'workspace-b')
    await expect(window.getByRole('heading', { name: 'Alterações não salvas' })).toBeVisible({
      timeout: 15_000
    })
    await window.getByRole('button', { name: 'Salvar', exact: true }).last().click()

    await expect
      .poll(() => fs.readFileSync(notesPath, 'utf-8'), { timeout: 20_000 })
      .toBe('editado, ainda não salvo\n')
    await waitForWorkUI(window)
    await expect(window.locator('.wb-workspace-chip-name')).toHaveText('workspace-b')
    await expect
      .poll(
        () =>
          (
            JSON.parse(fs.readFileSync(path.join(seeded.userData, 'config.json'), 'utf-8')) as {
              workspacePath: string
            }
          ).workspacePath,
        { timeout: 15_000 }
      )
      .toBe(sibling)

    await app.close()
  })

  test('@p0 @destructive Descartar troca de workspace e deixa o disco como estava', async ({
    seeded
  }) => {
    const notesPath = path.join(seeded.workspace, 'notes.md')
    fs.writeFileSync(notesPath, 'original\n', 'utf-8')
    seedSibling(seeded, 'workspace-b')

    const app = await launchSeededApp(seeded)
    const window = await app.firstWindow()
    await waitForWorkUI(window)

    await dirtyTheEditor(window, 'esta edição vai ser jogada fora\n')

    await requestSwitchTo(window, 'workspace-b')
    await expect(window.getByRole('heading', { name: 'Alterações não salvas' })).toBeVisible({
      timeout: 15_000
    })
    await window.getByRole('button', { name: 'Descartar alterações' }).click()

    await waitForWorkUI(window)
    await expect(window.locator('.wb-workspace-chip-name')).toHaveText('workspace-b')
    // Discard means discard: the file on disk never took the edit. The
    // assertion is deliberately after the switch settled — a save racing the
    // rebind would show up here and nowhere else.
    expect(fs.readFileSync(notesPath, 'utf-8')).toBe('original\n')
    await expect(window.locator('[id="hds-tree-item-workspace-b-only.txt"]')).toBeVisible({
      timeout: 15_000
    })

    await app.close()
  })
})
