import { test, expect, _electron as electron } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'

// T14 — E2E + Playwright MCP validation (explorer-editor-ux, UX-R9.3/9.4).
// Extends the file-management E2E harness (`e2e/file-management.spec.ts`,
// same launch/seed/UpdateGate-race pattern — see that file's header comment
// for the full rationale, not repeated here) to cover the 7 UX improvements
// this feature shipped across T1-T13:
//   1. open-by-default edit mode + Ctrl+S save (asserted on disk)
//   2. close-while-dirty 3-way (Salvar/Descartar/Cancelar) dialog
//   3. rename-on-blur (not just Enter)
//   4. Ctrl-click multi-select -> bulk delete (asserted on disk)
//   5. Shift-click range select
//   6. rail resize -> persisted across a reload
//   7. `.md` table preview + `.html` live preview (edit-by-app reflected
//      instantly, disk-driven reload verified via reopen)
//
// Scenarios 1-5 + 7 share one running app instance/workspace (a `describe.
// serial` block — each test uses its own distinct file names, so state never
// crosses tests) to keep the real update-gate/BMAD-install cost (paid once
// per Electron launch) down; scenario 6 needs its own dedicated launch since
// it explicitly closes and relaunches the app to prove persistence.

test.describe.serial('explorer-editor-ux E2E (real Electron, shared workspace)', () => {
  let tmpRoot: string
  let workspaceDir: string
  let app: ElectronApplication
  let window: Page

  test.beforeAll(async () => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hive-e2e-ux-'))
    workspaceDir = path.join(tmpRoot, 'workspace')
    const userDataDir = path.join(tmpRoot, 'userData')
    fs.mkdirSync(workspaceDir, { recursive: true })
    fs.mkdirSync(userDataDir, { recursive: true })

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

    const appPath = path.join(__dirname, '..', 'out', 'main', 'index.js')
    const launchEnv = { ...process.env }
    delete launchEnv.ELECTRON_RUN_AS_NODE

    app = await electron.launch({
      args: [appPath, `--user-data-dir=${userDataDir}`],
      env: launchEnv
    })
    window = await app.firstWindow()
    await window.waitForLoadState('domcontentloaded')
    await waitForWorkUI(window)
  })

  test.afterAll(async () => {
    await app.close()
    fs.rmSync(tmpRoot, { recursive: true, force: true })
  })

  test('1 — editable file opens in edit mode by default; Ctrl+S saves to disk', async () => {
    test.setTimeout(60_000)
    await createEntry(window, 'Novo arquivo', 'doc1.txt')
    await openFile(window, 'doc1.txt')

    // Edit-by-default (UX-R1.1): the textarea is already visible, no
    // "Editar" click needed.
    const editor = window.getByLabel('Conteúdo do arquivo')
    await expect(editor).toBeVisible()
    await editor.fill('hello from ctrl+s\n')

    await window.keyboard.press('Control+s')
    // The toolbar Save/Discard pair only renders while dirty — it
    // disappearing is itself proof the save round-tripped.
    await expect(window.getByRole('button', { name: 'Salvar' })).toHaveCount(0)

    const onDisk = fs.readFileSync(path.join(workspaceDir, 'doc1.txt'), 'utf-8')
    expect(onDisk).toBe('hello from ctrl+s\n')
  })

  test('2 — closing a dirty file shows the 3-way dialog; Salvar persists then closes', async () => {
    test.setTimeout(60_000)
    await createEntry(window, 'Novo arquivo', 'doc2.txt')
    await openFile(window, 'doc2.txt')

    const editor = window.getByLabel('Conteúdo do arquivo')
    await editor.fill('unsaved edit\n')

    await window.getByRole('button', { name: 'Fechar arquivo' }).click()

    const dialog = window.getByRole('dialog')
    await expect(dialog.getByRole('heading', { name: 'Alterações não salvas' })).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Cancelar' })).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Descartar alterações' })).toBeVisible()
    await dialog.getByRole('button', { name: 'Salvar' }).click()

    // Viewer pane is gone entirely (no longer just disabled) once closed.
    await expect(window.getByRole('button', { name: 'Fechar arquivo' })).toHaveCount(0)
    const onDisk = fs.readFileSync(path.join(workspaceDir, 'doc2.txt'), 'utf-8')
    expect(onDisk).toBe('unsaved edit\n')
  })

  test('3 — rename via inline input + blur (not Enter) persists on disk', async () => {
    test.setTimeout(60_000)
    await createEntry(window, 'Novo arquivo', 'before-blur.txt')

    await window.getByRole('button', { name: 'Mais ações para before-blur.txt' }).click()
    await window.getByRole('menuitem', { name: 'Renomear' }).click()
    const input = window.getByLabel('Novo nome')
    await input.fill('after-blur.txt')
    // Blur by clicking elsewhere in the pane, deliberately NOT pressing Enter.
    await window.getByText('Arquivos', { exact: true }).click()

    await window
      .locator('[id="hds-tree-item-after-blur.txt"]')
      .waitFor({ state: 'visible', timeout: 10_000 })

    expect(fs.existsSync(path.join(workspaceDir, 'before-blur.txt'))).toBe(false)
    expect(fs.existsSync(path.join(workspaceDir, 'after-blur.txt'))).toBe(true)
  })

  test('4 — Ctrl-click multi-select drives bulk delete of every selected file', async () => {
    test.setTimeout(60_000)
    await createEntry(window, 'Novo arquivo', 'bulk-a.txt')
    await createEntry(window, 'Novo arquivo', 'bulk-b.txt')
    await createEntry(window, 'Novo arquivo', 'bulk-c.txt')

    // Ctrl-click every row so the tree never opens a viewer for any of them
    // (design.md/Explorer.tsx: a toggle/range click never calls onOpenFile).
    for (const name of ['bulk-a.txt', 'bulk-b.txt', 'bulk-c.txt']) {
      await window
        .locator(`[id="hds-tree-item-${name}"] .wb-tree-row-content`)
        .click({ modifiers: ['Control'] })
    }
    await expect(window.locator('[aria-selected="true"]')).toHaveCount(3)

    // Row menu on any row that's part of a >1 selection deletes the whole
    // selection (Explorer.tsx: `selectedIds.includes(node.id) && selectedIds.length > 1`).
    await window.getByRole('button', { name: 'Mais ações para bulk-a.txt' }).click()
    await window.getByRole('menuitem', { name: 'Excluir' }).click()
    await expect(window.getByText('3 itens serão movidos para a lixeira do sistema.')).toBeVisible()
    await window.getByRole('button', { name: 'Mover para a lixeira' }).click()

    for (const name of ['bulk-a.txt', 'bulk-b.txt', 'bulk-c.txt']) {
      await expect
        .poll(() => fs.existsSync(path.join(workspaceDir, name)), { timeout: 10_000 })
        .toBe(false)
    }
  })

  test('5 — Shift-click selects the visible range from an anchor', async () => {
    test.setTimeout(60_000)
    await createEntry(window, 'Novo arquivo', 'range-a.txt')
    await createEntry(window, 'Novo arquivo', 'range-b.txt')
    await createEntry(window, 'Novo arquivo', 'range-c.txt')

    // Plain click sets the anchor (Tree.tsx `activate`: anchorIdRef is set
    // on every multi-select click, toggle or not).
    await window.locator('[id="hds-tree-item-range-a.txt"] .wb-tree-row-content').click()
    await window
      .locator('[id="hds-tree-item-range-c.txt"] .wb-tree-row-content')
      .click({ modifiers: ['Shift'] })

    await expect(window.locator('[aria-selected="true"]')).toHaveCount(3)
    for (const name of ['range-a.txt', 'range-b.txt', 'range-c.txt']) {
      await expect(window.locator(`[id="hds-tree-item-${name}"]`)).toHaveAttribute(
        'aria-selected',
        'true'
      )
    }
  })

  test('7 — .md file with a table renders correctly in preview', async () => {
    test.setTimeout(60_000)
    await createEntry(window, 'Novo arquivo', 'table.md')
    await openFile(window, 'table.md')

    const table = '| Nome | Papel |\n| --- | --- |\n| Amelia | Dev |\n| Winston | Arquiteto |\n'
    await window.getByLabel('Conteúdo do arquivo').fill(table)

    // Toggle edit -> preview (IconButton label is "Visualizar" while in edit mode).
    await window.getByRole('button', { name: 'Visualizar' }).click()

    const preview = window.locator('[data-testid="markdown-viewer"]')
    await expect(preview.locator('table')).toBeVisible()
    await expect(preview.locator('thead th')).toHaveText(['Nome', 'Papel'])
    const rows = preview.locator('tbody tr')
    await expect(rows).toHaveCount(2)
    await expect(rows.nth(0).locator('td')).toHaveText(['Amelia', 'Dev'])
    await expect(rows.nth(1).locator('td')).toHaveText(['Winston', 'Arquiteto'])

    // Toggle back to edit (label flips to "Editar"), close without saving.
    await window.getByRole('button', { name: 'Editar' }).click()
    await window.getByRole('button', { name: 'Fechar arquivo' }).click()
    const dialog = window.getByRole('dialog')
    await dialog.getByRole('button', { name: 'Descartar alterações' }).click()
  })

  test('8 — .html file live-previews, reflects app edits instantly, reloads real disk edits on reopen', async () => {
    test.setTimeout(60_000)
    const htmlPath = path.join(workspaceDir, 'page.html')
    fs.writeFileSync(htmlPath, '<p id="content">v1</p>', 'utf-8')

    await window.waitForFunction(
      () => document.querySelector('[id="hds-tree-item-page.html"]') !== null,
      undefined,
      { timeout: 15_000 }
    )
    await openFile(window, 'page.html')
    await window.getByRole('button', { name: 'Visualizar' }).click()

    const frame = window.frameLocator('.wb-html-preview')
    await expect(frame.locator('#content')).toHaveText('v1')

    // Edit via the app (draft, unsaved) -> toggle back to edit, change, then
    // preview again: the iframe reflects the draft instantly, no save
    // needed (HtmlPreview renders `draft`, not last-saved content).
    await window.getByRole('button', { name: 'Editar' }).click()
    await window.getByLabel('Conteúdo do arquivo').fill('<p id="content">v2 from app</p>')
    await window.getByRole('button', { name: 'Visualizar' }).click()
    await expect(frame.locator('#content')).toHaveText('v2 from app')

    // Save, close (clean now), then simulate a real external on-disk edit
    // and reopen: the fetch effect re-reads the file and bumps `reloadKey`
    // (remounting the iframe), proving the "reload on disk change" wiring
    // for a genuinely external writer (an agent/BMAD process), not just the
    // app's own draft state.
    await window.keyboard.press('Control+s')
    await expect(window.getByRole('button', { name: 'Salvar' })).toHaveCount(0)
    await window.getByRole('button', { name: 'Fechar arquivo' }).click()

    fs.writeFileSync(htmlPath, '<p id="content">v3 from disk</p>', 'utf-8')

    await openFile(window, 'page.html')
    await window.getByRole('button', { name: 'Visualizar' }).click()
    await expect(frame.locator('#content')).toHaveText('v3 from disk')
    await window.getByRole('button', { name: 'Fechar arquivo' }).click()
  })
})

test.describe('explorer-editor-ux E2E — rail resize persistence (dedicated app instance)', () => {
  test('6 — dragging the rail resize handle persists its width across a reload', async () => {
    test.setTimeout(120_000)
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hive-e2e-ux-resize-'))
    const workspaceDir = path.join(tmpRoot, 'workspace')
    const userDataDir = path.join(tmpRoot, 'userData')
    fs.mkdirSync(workspaceDir, { recursive: true })
    fs.mkdirSync(userDataDir, { recursive: true })
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

    const appPath = path.join(__dirname, '..', 'out', 'main', 'index.js')
    const launchEnv = { ...process.env }
    delete launchEnv.ELECTRON_RUN_AS_NODE
    const launchArgs = [appPath, `--user-data-dir=${userDataDir}`]

    let app = await electron.launch({ args: launchArgs, env: launchEnv })
    try {
      let window = await app.firstWindow()
      await window.waitForLoadState('domcontentloaded')
      await waitForWorkUI(window)

      const rail = window.locator('.wb-rail')
      const handle = window.getByRole('separator', { name: 'Redimensionar painéis' }).first()

      const before = await rail.boundingBox()
      if (!before) throw new Error('rail bounding box not found')

      const handleBox = await handle.boundingBox()
      if (!handleBox) throw new Error('resize handle bounding box not found')
      const startX = handleBox.x + handleBox.width / 2
      const startY = handleBox.y + handleBox.height / 2

      await window.mouse.move(startX, startY)
      await window.mouse.down()
      await window.mouse.move(startX + 160, startY, { steps: 12 })
      await window.mouse.up()

      const after = await rail.boundingBox()
      if (!after) throw new Error('rail bounding box not found after drag')
      expect(after.width).toBeGreaterThan(before.width + 50)

      // Give the (debounce-free, but React-state-driven) onLayoutChanged
      // persistence a moment to actually land in localStorage before reload.
      await expect
        .poll(async () => window.evaluate(() => localStorage.getItem('hive.workLayout')))
        .not.toBeNull()

      await app.close()

      app = await electron.launch({ args: launchArgs, env: launchEnv })
      window = await app.firstWindow()
      await window.waitForLoadState('domcontentloaded')
      await waitForWorkUI(window)

      const restoredRail = window.locator('.wb-rail')
      await expect
        .poll(async () => {
          const box = await restoredRail.boundingBox()
          return box?.width ?? 0
        })
        .toBeGreaterThan(before.width + 50)
    } finally {
      await app.close()
      fs.rmSync(tmpRoot, { recursive: true, force: true })
    }
  })
})

/**
 * Waits out the onboarding gate (`App.tsx`'s `checking`/`checkingProvisioned`
 * spinner, then `UpdateGate` since the seeded config is `provisioned: true`)
 * until the real work UI (`WorkUI`'s file-tree rail) is on screen — or, per
 * `e2e/file-management.spec.ts`'s own version of this helper, clicks
 * UpdateGate's "continue anyway" escape hatch if the real `npx bmad-method`
 * update errors out. Duplicated (not imported) to keep this spec
 * self-contained, matching the existing file's own convention.
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

/** Creates a root-level file or folder via the tree toolbar and its inline-name input (Enter-committed — T7's blur-commit path is exercised directly in scenario 3 above). */
async function createEntry(window: Page, toolbarLabel: string, name: string): Promise<void> {
  await window.getByRole('button', { name: toolbarLabel, exact: true }).click()
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
  await window.getByLabel('Fechar arquivo').waitFor({ state: 'visible', timeout: 10_000 })
}
