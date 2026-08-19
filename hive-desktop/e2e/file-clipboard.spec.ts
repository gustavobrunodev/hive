import type { Page } from '@playwright/test'
import path from 'node:path'
import fs from 'node:fs'
import { test, expect } from './fixtures/workspace'

/**
 * file-clipboard, end to end against the real Electron app.
 *
 * Two things can only be proven here.
 *
 * The first is the clipboard itself. In the packaged app
 * `navigator.clipboard.writeText()` rejects — the session's permission
 * handler is deny-by-default and the async Clipboard API also wants a focused
 * document — which is exactly why every "Copiar caminho" in the Explorer used
 * to surface "Não foi possível concluir a ação. Tente novamente.". No
 * component test can see that: jsdom has no permission handler and a stubbed
 * `writeText` always resolves. Here the app really writes, and the assertion
 * reads the real system clipboard back through Electron's `clipboard` module.
 *
 * The second is that cut/copy/paste move bytes. The specs below assert on
 * disk after every step (FM-R8.3), not on DOM state.
 */
test.describe('file clipboard E2E (real Electron, throwaway workspace)', () => {
  test('@p0 "Copiar caminho" really reaches the system clipboard', async ({ hiveApp }) => {
    const { app, window, seeded } = hiveApp
    fs.writeFileSync(path.join(seeded.workspace, 'alvo.md'), '# alvo\n', 'utf-8')
    await waitForRow(window, 'alvo.md')

    // Poison the clipboard first, so "it already said that" cannot pass.
    await app.evaluate(({ clipboard }) => clipboard.writeText('__nada__'))

    await rowMenu(window, 'alvo.md')
    await window.getByRole('menuitem', { name: 'Copiar caminho relativo' }).click()
    await expect
      .poll(() => app.evaluate(({ clipboard }) => clipboard.readText()), { timeout: 10_000 })
      .toBe('alvo.md')

    // The error banner is the symptom this bug produced; its absence is part
    // of the assertion, not decoration.
    await expect(
      window.getByText('Não foi possível concluir a ação. Tente novamente.')
    ).toHaveCount(0)

    await rowMenu(window, 'alvo.md')
    await window.getByRole('menuitem', { name: 'Copiar caminho', exact: true }).click()
    await expect
      .poll(() => app.evaluate(({ clipboard }) => clipboard.readText()), { timeout: 10_000 })
      .toBe(path.join(seeded.workspace, 'alvo.md'))
  })

  test('@p0 Ctrl+C / Ctrl+V copies on disk, and pasting in place duplicates as "cópia"', async ({
    hiveApp
  }) => {
    const { window, seeded } = hiveApp
    const ws = seeded.workspace
    fs.writeFileSync(path.join(ws, 'nota.md'), 'conteudo\n', 'utf-8')
    fs.mkdirSync(path.join(ws, 'destino'))
    await waitForRow(window, 'nota.md')
    await waitForRow(window, 'destino')

    // Copy, then paste into a different folder.
    await window.locator('[data-tree-path="nota.md"]').click()
    await window.locator('.wb-tree-body').press('Control+c')
    await window.locator('[data-tree-path="destino"]').click()
    await window.locator('.wb-tree-body').press('Control+v')

    const copied = path.join(ws, 'destino', 'nota.md')
    await expect.poll(() => fs.existsSync(copied), { timeout: 10_000 }).toBe(true)
    expect(fs.readFileSync(copied, 'utf-8')).toBe('conteudo\n')
    // A copy is not a move.
    expect(fs.existsSync(path.join(ws, 'nota.md'))).toBe(true)

    // Copy again and paste with the source's own folder as the destination:
    // the duplicate case, which must not stop to ask.
    await window.locator('[data-tree-path="nota.md"]').click()
    await window.locator('.wb-tree-body').press('Control+c')
    await window.locator('.wb-tree-body').press('Control+v')

    await expect
      .poll(() => fs.existsSync(path.join(ws, 'nota cópia.md')), { timeout: 10_000 })
      .toBe(true)
    await expect(window.getByText('Já existe um item com esse nome')).toHaveCount(0)
  })

  test('@p0 Ctrl+X / Ctrl+V moves on disk, and the tray names the destination', async ({
    hiveApp
  }) => {
    const { window, seeded } = hiveApp
    const ws = seeded.workspace
    fs.writeFileSync(path.join(ws, 'mover.md'), 'x\n', 'utf-8')
    fs.mkdirSync(path.join(ws, 'destino'))
    await waitForRow(window, 'mover.md')
    await waitForRow(window, 'destino')

    await window.locator('[data-tree-path="mover.md"]').click()
    await window.locator('.wb-tree-body').press('Control+x')

    // The staged row ghosts, and the tray says what is staged and where it
    // would land — the two things a bare dimmed row cannot.
    await expect(window.locator('[data-tree-path="mover.md"][data-tree-cut]')).toHaveCount(1)
    await expect(window.locator('.wb-tree-clipboard')).toContainText('mover.md')

    await window.locator('[data-tree-path="destino"]').click()
    await expect(window.locator('.wb-tree-clipboard')).toContainText('Colar em destino')
    await window.locator('.wb-tree-clipboard-paste').click()

    await expect
      .poll(() => fs.existsSync(path.join(ws, 'destino', 'mover.md')), { timeout: 10_000 })
      .toBe(true)
    expect(fs.existsSync(path.join(ws, 'mover.md'))).toBe(false)
    // The staged paths are gone, so the tray goes with them.
    await expect(window.locator('.wb-tree-clipboard')).toHaveCount(0)
  })

  test('@p0 Escape abandons a pending cut without touching the filesystem', async ({ hiveApp }) => {
    const { window, seeded } = hiveApp
    const ws = seeded.workspace
    fs.writeFileSync(path.join(ws, 'intocado.md'), 'x\n', 'utf-8')
    fs.mkdirSync(path.join(ws, 'destino'))
    await waitForRow(window, 'intocado.md')

    await window.locator('[data-tree-path="intocado.md"]').click()
    await window.locator('.wb-tree-body').press('Control+x')
    await expect(window.locator('.wb-tree-clipboard')).toHaveCount(1)

    await window.locator('.wb-tree-body').press('Escape')
    await expect(window.locator('.wb-tree-clipboard')).toHaveCount(0)
    await expect(window.locator('[data-tree-cut]')).toHaveCount(0)

    // Paste after the abandon must be a no-op, not a delayed move.
    await window.locator('[data-tree-path="destino"]').click()
    await window.locator('.wb-tree-body').press('Control+v')
    await window.waitForTimeout(500)
    expect(fs.existsSync(path.join(ws, 'intocado.md'))).toBe(true)
    expect(fs.existsSync(path.join(ws, 'destino', 'intocado.md'))).toBe(false)
  })
})

/** Waits for a root-level row to appear in the tree. */
async function waitForRow(window: Page, name: string): Promise<void> {
  await window.locator(`[data-tree-path="${name}"]`).waitFor({ state: 'visible', timeout: 15_000 })
}

/** Opens a row's `...` menu and waits for it. */
async function rowMenu(window: Page, name: string): Promise<void> {
  await window.getByRole('button', { name: `Mais ações para ${name}` }).click()
  await window.getByRole('menuitem', { name: 'Renomear' }).waitFor({ timeout: 10_000 })
}
