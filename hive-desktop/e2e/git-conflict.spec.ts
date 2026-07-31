import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import type { Page } from '@playwright/test'
import { test, expect, launchSeededApp, waitForWorkUI } from './fixtures/workspace'

// P1-017 (GIT-R12) — conflict resolution was the last of M10's thirteen
// requirements with no E2E: `conflictParse`/`ConflictView` are unit-tested, but
// nothing proved that the three choices, driven through the real app against a
// real conflicted repo, produce the right **bytes on disk** and let the merge
// finish. That gap matters because every one of these gestures rewrites a file
// the user is in the middle of merging.
//
// A real merge conflict is manufactured with the system git (the M10 engine),
// not simulated: two branches touching the same lines.

/** Runs a git command in `cwd`, returning stdout. */
function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf-8' })
}

/**
 * Turns the seeded workspace into a repo whose `main` is mid-merge with a
 * conflict in `notes.md`: ours = `ATUAL`, theirs = `RECEBIDO`.
 */
function seedConflictedRepo(workspace: string): void {
  git(workspace, 'init', '-b', 'main')
  git(workspace, 'config', 'user.email', 'e2e@test')
  git(workspace, 'config', 'user.name', 'E2E')
  fs.writeFileSync(path.join(workspace, 'notes.md'), 'topo\nBASE\nrodapé\n', 'utf-8')
  git(workspace, 'add', '-A')
  git(workspace, 'commit', '-m', 'base')

  git(workspace, 'checkout', '-b', 'feature')
  fs.writeFileSync(path.join(workspace, 'notes.md'), 'topo\nRECEBIDO\nrodapé\n', 'utf-8')
  git(workspace, 'commit', '-am', 'feature muda a linha')

  git(workspace, 'checkout', 'main')
  fs.writeFileSync(path.join(workspace, 'notes.md'), 'topo\nATUAL\nrodapé\n', 'utf-8')
  git(workspace, 'commit', '-am', 'main muda a mesma linha')

  // Expected to fail: that failure IS the fixture.
  try {
    git(workspace, 'merge', 'feature')
    throw new Error('esperava um conflito de merge e o merge passou limpo')
  } catch (error) {
    if (!fs.readFileSync(path.join(workspace, 'notes.md'), 'utf-8').includes('<<<<<<<')) throw error
  }
}

/** Flips to Source Control and opens the conflicted file's resolution view. */
async function openConflict(window: Page): Promise<void> {
  await window.getByRole('button', { name: /Controle de versão/ }).click()
  const row = window.locator('.wb-scm-row', { hasText: 'notes.md' })
  await expect(row).toBeVisible({ timeout: 20_000 })
  await row.locator('.wb-scm-row-open').click()
  await expect(window.getByLabel('Conflito 1')).toBeVisible({ timeout: 15_000 })
}

const CONFLICT_CASES = [
  { cta: 'Aceitar atual', expected: 'topo\nATUAL\nrodapé\n' },
  { cta: 'Aceitar recebido', expected: 'topo\nRECEBIDO\nrodapé\n' },
  { cta: 'Aceitar ambos', expected: 'topo\nATUAL\nRECEBIDO\nrodapé\n' }
] as const

test.describe('git conflict resolution (P1-017)', () => {
  for (const { cta, expected } of CONFLICT_CASES) {
    test(`@p1 "${cta}" grava o resultado certo em disco e libera o merge`, async ({ seeded }) => {
      const notesPath = path.join(seeded.workspace, 'notes.md')
      seedConflictedRepo(seeded.workspace)

      const app = await launchSeededApp(seeded)
      const window = await app.firstWindow()
      await waitForWorkUI(window)

      await openConflict(window)

      // The choice is held in the view; the file is only rewritten when the
      // user commits to it — so disk must NOT move yet. That ordering is the
      // whole safety of this surface, and it is asserted, not assumed.
      await window.getByRole('button', { name: cta }).click()
      expect(fs.readFileSync(notesPath, 'utf-8')).toContain('<<<<<<<')
      await expect(window.locator('.wb-conflict-bar')).toContainText('Sem conflitos neste arquivo')

      await window
        .locator('.wb-conflict-bar')
        .getByRole('button', { name: 'Marcar como resolvido' })
        .click()

      // The bytes, not the DOM: markers gone, the chosen side kept.
      await expect
        .poll(() => fs.readFileSync(notesPath, 'utf-8'), { timeout: 20_000 })
        .toBe(expected)

      await expect
        .poll(() => git(seeded.workspace, 'diff', '--name-only', '--diff-filter=U'), {
          timeout: 20_000
        })
        .toBe('')

      await app.close()
    })
  }
})
