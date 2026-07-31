import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import type { Page } from '@playwright/test'
import { test, expect, launchSeededApp, waitForWorkUI } from './fixtures/workspace'

// P2-007 (GIT-R10) — stash *pop* and *drop*. `git-management.spec.ts` drives
// stash creation only, and `StashPanel.test.ts` covers the three buttons
// against a mocked `useGit`. Neither proves what these two gestures do to a
// real repository, and they are the pair that can lose work:
//
//   - Pop is apply + drop in one step. If the apply half lands and the drop
//     half does not, the user silently keeps a duplicate; if the drop half
//     lands and the apply half does not, the edit is gone with no undo.
//   - Drop is irreversible by design (hence the confirm). The property worth
//     locking is that it discards the *stash* without resurrecting its edit
//     into the working tree — a drop that also restored the change would be
//     indistinguishable from a pop at the UI, and destroy the user's model of
//     which one is safe.
//
// Both are asserted against `git stash list` and the file bytes, never the DOM.

/** Runs a git command in `cwd`, returning stdout. */
function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf-8' })
}

const COMMITTED = 'linha original\n'
const EDITED = 'linha editada\n'

/**
 * Turns the seeded workspace into a repo with one committed file and one
 * uncommitted edit to it — the state a stash is taken from.
 */
function seedRepoWithEdit(workspace: string): string {
  git(workspace, 'init', '-b', 'main')
  git(workspace, 'config', 'user.email', 'e2e@test')
  git(workspace, 'config', 'user.name', 'E2E')
  const notes = path.join(workspace, 'notes.md')
  fs.writeFileSync(notes, COMMITTED, 'utf-8')
  git(workspace, 'add', '-A')
  git(workspace, 'commit', '-m', 'base')

  fs.writeFileSync(notes, EDITED, 'utf-8')
  return notes
}

/** Flips the sidebar to Source Control. */
async function openSourceControl(window: Page): Promise<void> {
  await window.getByRole('button', { name: /Controle de versão/ }).click()
  await expect(window.locator('.wb-stash')).toBeVisible({ timeout: 20_000 })
}

/** Drives the create-stash dialog, then waits for the stash to exist on disk. */
async function createStash(window: Page, workspace: string, message: string): Promise<void> {
  await window.getByRole('button', { name: 'Guardar alterações', exact: true }).click()
  await window.getByPlaceholder('Mensagem (opcional)').fill(message)
  await window.getByRole('button', { name: 'Guardar', exact: true }).click()

  await expect.poll(() => git(workspace, 'stash', 'list'), { timeout: 20_000 }).toContain(message)
}

test.describe('git stash pop and drop (P2-007)', () => {
  test('@p2 Pop restaura a edição em disco e consome o stash', async ({ seeded }) => {
    const notes = seedRepoWithEdit(seeded.workspace)

    const app = await launchSeededApp(seeded)
    const window = await app.firstWindow()
    await waitForWorkUI(window)
    await openSourceControl(window)

    await createStash(window, seeded.workspace, 'trabalho em voo')

    // Stashing reverted the working tree — the precondition for the pop below
    // meaning anything.
    expect(fs.readFileSync(notes, 'utf-8')).toBe(COMMITTED)

    const item = window.locator('.wb-stash-item', { hasText: 'trabalho em voo' })
    await expect(item).toBeVisible({ timeout: 20_000 })
    await item.getByRole('button', { name: 'Pop', exact: true }).click()

    // Both halves: the edit is back in the file...
    await expect.poll(() => fs.readFileSync(notes, 'utf-8'), { timeout: 20_000 }).toBe(EDITED)
    // ...and the stash was consumed, not left behind as a duplicate.
    await expect.poll(() => git(seeded.workspace, 'stash', 'list'), { timeout: 20_000 }).toBe('')

    await app.close()
  })

  test('@p2 @destructive Descartar remove o stash sem devolver a edição', async ({ seeded }) => {
    const notes = seedRepoWithEdit(seeded.workspace)

    const app = await launchSeededApp(seeded)
    const window = await app.firstWindow()
    await waitForWorkUI(window)
    await openSourceControl(window)

    await createStash(window, seeded.workspace, 'descartável')

    const item = window.locator('.wb-stash-item', { hasText: 'descartável' })
    await expect(item).toBeVisible({ timeout: 20_000 })
    await item.getByRole('button', { name: 'Descartar', exact: true }).click()

    // The confirm lives in the alert dialog and carries the same word as the
    // row button that opened it — scoping to the dialog is what keeps this
    // click off the row.
    const dialog = window.getByRole('alertdialog')
    await expect(dialog).toContainText('Descartar stash?')
    await dialog.getByRole('button', { name: 'Descartar', exact: true }).click()

    await expect.poll(() => git(seeded.workspace, 'stash', 'list'), { timeout: 20_000 }).toBe('')
    // The discard did NOT quietly behave like a pop.
    expect(fs.readFileSync(notes, 'utf-8')).toBe(COMMITTED)

    await app.close()
  })

  test('@p2 @destructive cancelar o Descartar mantém o stash intacto', async ({ seeded }) => {
    seedRepoWithEdit(seeded.workspace)

    const app = await launchSeededApp(seeded)
    const window = await app.firstWindow()
    await waitForWorkUI(window)
    await openSourceControl(window)

    await createStash(window, seeded.workspace, 'preservável')

    const item = window.locator('.wb-stash-item', { hasText: 'preservável' })
    await item.getByRole('button', { name: 'Descartar', exact: true }).click()

    const dialog = window.getByRole('alertdialog')
    await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click()

    await expect(dialog).toBeHidden({ timeout: 15_000 })
    expect(git(seeded.workspace, 'stash', 'list')).toContain('preservável')
    await expect(item).toBeVisible()

    await app.close()
  })
})
