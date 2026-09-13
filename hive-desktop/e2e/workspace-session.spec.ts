import fs from 'node:fs'
import path from 'node:path'
import { test, expect, launchSeededApp, waitForWorkUI } from './fixtures/workspace'

/**
 * workspace-session — the app reopens where it was left, and the sidebar is
 * something you can put away.
 *
 * Deliberately does NOT go through `waitForWorkUI` for the first-run case:
 * that helper opens the sidebar for every spec written before it could be
 * hidden, which is exactly the state this one is about. The restore case runs
 * against the REAL renderer localStorage inside the real userData, because
 * that is the only place the promise ("close the app, open it, find it as you
 * left it") is actually kept.
 */
test.describe('workspace session (Ctrl+B, primeira execução, restauração)', () => {
  test('@p0 abre só com o chat e volta a mostrar os arquivos no clique da rail', async ({
    seeded
  }) => {
    const app = await launchSeededApp(seeded)
    const window = await app.firstWindow()
    await window.locator('.wb-navbar').waitFor({ state: 'visible', timeout: 45_000 })

    // nav-redesign: a primeira execução abre COM a lateral, na aba Chat — a
    // primeira tela dela é "+ Novo" e as conversas de ontem, não uma árvore de
    // arquivos que ninguém pediu ainda.
    await expect(window.locator('.wb-rail')).toBeVisible()
    await expect(window.getByRole('tab', { name: 'Chat' })).toHaveAttribute('aria-selected', 'true')

    // O botão da navbar guarda o painel — e o nome dele diz o que o próximo
    // clique faz.
    const hide = window.getByRole('button', { name: 'Ocultar barra lateral' })
    await hide.click()
    await expect(window.locator('.wb-pane[data-collapsed]')).toHaveCount(1)
    await expect(window.locator('.wb-rail')).toBeHidden()
    const show = window.getByRole('button', { name: 'Exibir barra lateral' })
    await expect(show).toHaveAttribute('aria-expanded', 'false')

    // E o mesmo botão o traz de volta.
    await show.click()
    await expect(window.locator('.wb-rail')).toBeVisible()
    await expect(hide).toHaveAttribute('aria-expanded', 'true')

    // Ctrl+B é o caminho de teclado para o mesmo gesto.
    await window.keyboard.press('Control+b')
    await expect(window.locator('.wb-rail')).toBeHidden()
    await window.keyboard.press('Control+b')
    await expect(window.locator('.wb-rail')).toBeVisible()

    // A linha do Explorador, dentro da aba Arquivos, é a outra forma de
    // guardar/mostrar a mesma coisa — e também nomeia o que o clique faz.
    await window.getByRole('tab', { name: 'Arquivos' }).click()
    const explorer = window.getByRole('button', { name: 'Ocultar Explorador de arquivos' })
    await expect(explorer).toHaveAttribute('aria-expanded', 'true')
    await explorer.click()
    await expect(window.locator('.wb-rail')).toBeHidden()

    await app.close()
  })

  test('@p0 reabre com os arquivos, as pastas e a lateral como estavam', async ({ seeded }) => {
    fs.writeFileSync(path.join(seeded.workspace, 'notes.md'), 'anotações\n', 'utf-8')
    const docs = path.join(seeded.workspace, 'docs')
    fs.mkdirSync(docs, { recursive: true })
    fs.writeFileSync(path.join(docs, 'PRD.md'), '# PRD\n', 'utf-8')

    const first = await launchSeededApp(seeded)
    const firstWindow = await first.firstWindow()
    await waitForWorkUI(firstWindow)

    // Deixa o workspace num estado concreto: uma pasta aberta e dois arquivos.
    await firstWindow.locator('[id="hds-tree-item-docs"]').click()
    await firstWindow.locator('[id="hds-tree-item-docs/PRD.md"]').dblclick()
    await firstWindow.locator('[id="hds-tree-item-notes.md"]').dblclick()
    await expect(firstWindow.locator('.wb-tab')).toHaveCount(2)
    // Uma escrita do localStorage é síncrona, mas o efeito que a dispara não —
    // esperar a aba aparecer não prova que a gravação já aconteceu.
    await expect
      .poll(async () =>
        firstWindow.evaluate(() => window.localStorage.getItem('hive.workspaceSession'))
      )
      .toContain('notes.md')
    await first.close()

    // Mesmo userData, mesmo workspace: é literalmente reabrir o app.
    const second = await launchSeededApp(seeded)
    const secondWindow = await second.firstWindow()
    await secondWindow.locator('.wb-navbar').waitFor({ state: 'visible', timeout: 45_000 })

    await expect(secondWindow.locator('.wb-rail')).toBeVisible()
    await expect(secondWindow.locator('.wb-tab')).toHaveCount(2)
    await expect(secondWindow.locator('.wb-tab-name').first()).toHaveText('PRD.md')
    // A pasta que estava aberta volta aberta.
    await expect(secondWindow.locator('[id="hds-tree-item-docs"]')).toHaveAttribute(
      'aria-expanded',
      'true'
    )

    await second.close()
  })
})
