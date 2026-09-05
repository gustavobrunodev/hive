import { test, expect } from './fixtures/workspace'
import { launchSeededApp, waitForWorkUI } from './fixtures/workspace'
import path from 'node:path'
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'

// The reported bug, end to end: files an agent wrote into brand-new folders
// (`_bmad-output/planning-artifacts/prds/…`, `.playwright-mcp/`) showed up in
// Source Control as **two folder rows** — `_bmad-output` and `.playwright-mcp`
// — instead of the files inside them. Root cause was one missing flag on the
// status command (`--untracked-files=all`; git's `normal` default collapses an
// untracked directory into a single `? dir/` record).
//
// It is asserted here rather than only in unit tests because every layer has to
// agree for the list to be right: the git argv in main, the porcelain parse,
// the IPC payload, and the row rendering.

/** Runs a git command in `cwd`, returning stdout. */
function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf-8' })
}

const PRD_DIR = '_bmad-output/planning-artifacts/prds/prd-teste-hive-2026-09-03'

test.describe('Source Control — untracked folders list their files', () => {
  test('shows every new file, never the folder, and diffs one as all-additions', async ({
    seeded
  }) => {
    test.setTimeout(180_000)
    const { workspace } = seeded

    git(workspace, 'init', '-b', 'main')
    git(workspace, 'config', 'user.email', 'e2e@test')
    git(workspace, 'config', 'user.name', 'E2E')
    // The seeded `_bmad`/`.claude` markers are committed so the change list
    // below contains only what this test puts there.
    fs.writeFileSync(path.join(workspace, 'README.md'), 'inicial\n')
    git(workspace, 'add', '-A')
    git(workspace, 'commit', '-m', 'initial commit')

    // Exactly the reported shape: two folders git has never seen, each holding
    // files an agent session produced.
    fs.mkdirSync(path.join(workspace, PRD_DIR), { recursive: true })
    fs.writeFileSync(
      path.join(workspace, PRD_DIR, 'prd.md'),
      '# PRD\nprimeira linha\nsegunda linha\n'
    )
    fs.writeFileSync(path.join(workspace, PRD_DIR, 'epics.md'), '# Epicos\n')
    fs.mkdirSync(path.join(workspace, '.playwright-mcp'), { recursive: true })
    fs.writeFileSync(path.join(workspace, '.playwright-mcp', 'page.yml'), 'snapshot: 1\n')

    const app = await launchSeededApp(seeded)
    try {
      const window = await app.firstWindow()
      await waitForWorkUI(window)

      await window.getByRole('button', { name: /Controle de versão/ }).click()
      const rows = window.locator('.wb-scm-row')
      await expect(rows.first()).toBeVisible({ timeout: 15_000 })

      // Each file is its own row, named by its basename with its folder beside it.
      for (const [name, dir] of [
        ['prd.md', PRD_DIR],
        ['epics.md', PRD_DIR],
        ['page.yml', '.playwright-mcp']
      ] as const) {
        const row = rows.filter({ hasText: name })
        await expect(row).toHaveCount(1)
        await expect(row.locator('.wb-scm-path-dir')).toHaveText(dir)
      }

      // The bug's signature: a row that is the folder itself. There must be none.
      const titles = await rows
        .locator('.wb-scm-row-open')
        .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('title') ?? ''))
      expect(titles).not.toContain('_bmad-output/')
      expect(titles).not.toContain('.playwright-mcp/')
      expect(titles.some((title) => title.endsWith('/'))).toBe(false)

      // An untracked file's diff is its whole content as additions — plain
      // `git diff` prints nothing for one, so a blank pane here would mean the
      // row leads nowhere.
      await rows.filter({ hasText: 'prd.md' }).locator('.wb-scm-row-open').click()
      await expect(window.locator('.wb-diff')).toBeVisible({ timeout: 15_000 })
      await expect(window.getByText('primeira linha')).toBeVisible()
      await expect(window.getByText('segunda linha')).toBeVisible()

      // The same root cause broke the Explorer's decorations: the only path git
      // reported was `_bmad-output/`, with a trailing slash no tree node has, so
      // nothing was decorated and no folder got a rollup dot. Per-file entries
      // fix both — asserted here because it is the same bug, not a second one.
      await window.getByRole('button', { name: /Explorador/ }).click()
      // Addressed by path, not by text: the pane is narrow enough that the
      // folder's own label renders as `_b…`.
      const bmadFolder = window.locator('[data-tree-path="_bmad-output"]')
      await expect(bmadFolder).toBeVisible({ timeout: 15_000 })
      await expect(bmadFolder.locator('.wb-tree-git-dot')).toHaveCount(1)
      await expect(
        window.locator('[data-tree-path=".playwright-mcp"] .wb-tree-git-dot')
      ).toHaveCount(1)
      await window.getByRole('button', { name: /Controle de versão/ }).click()
      await expect(rows.first()).toBeVisible({ timeout: 15_000 })

      // Staging one row stages that file — not its whole folder.
      const prdRow = rows.filter({ hasText: 'prd.md' })
      await prdRow.hover()
      await prdRow.getByRole('button', { name: 'Preparar', exact: true }).click({ force: true })
      await expect
        .poll(() => git(workspace, 'diff', '--cached', '--name-only').trim().split('\n'), {
          timeout: 15_000
        })
        .toEqual([`${PRD_DIR}/prd.md`])
    } finally {
      await app.close()
    }
  })
})
