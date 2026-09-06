import fs from 'node:fs'
import path from 'node:path'
import { test, expect, launchSeededApp, waitForWorkUI } from './fixtures/workspace'

/**
 * "Os atalhos padrão do papel têm que poder sair" — against the real
 * `config.json`, which is the half no mocked pass can prove.
 *
 * The unit tests cover the picker's own contract and the headless pass
 * (`tools/visual/shortcut-removal-pass.mjs`) covers the gesture end to end
 * against a fake bridge. What only the real app answers is whether the removal
 * SURVIVES: the selection is a global preference written to disk, and the
 * behaviour that made this a bug was a resolver that read that file, decided it
 * could not be validated, and quietly handed back the role defaults instead.
 * So this spec removes a default, closes the app, opens it again, and looks.
 */
test.describe('atalhos do papel (remoção)', () => {
  test('@p0 remove um atalho padrão e ele não volta na próxima abertura', async ({ seeded }) => {
    const first = await launchSeededApp(seeded)
    const firstWindow = await first.firstWindow()
    await waitForWorkUI(firstWindow)

    const heroPills = firstWindow.locator('.wb-hero .wb-pill:not(.wb-pill-customize)')
    const before = await heroPills.allInnerTexts()
    expect(before.length).toBeGreaterThan(0)
    const doomed = before[0].trim()

    await firstWindow.getByRole('button', { name: 'Personalizar atalhos' }).first().click()
    await firstWindow.locator('.wb-sc-dialog').waitFor({ state: 'visible' })
    // The set on screen is the control: the chip removes the shortcut it draws,
    // role default or not.
    await firstWindow.getByRole('button', { name: `Remover atalho: ${doomed}` }).click()
    await expect(firstWindow.getByText('Personalizado')).toBeVisible()
    await firstWindow.getByRole('button', { name: 'Concluído' }).click()

    // Gone from the surface, not only from the dialog.
    await expect(heroPills).toHaveCount(before.length - 1)
    expect((await heroPills.allInnerTexts()).map((text) => text.trim())).not.toContain(doomed)

    await first.close()

    // And gone from disk: the selection is what `config.json` now carries.
    const config = JSON.parse(
      fs.readFileSync(path.join(seeded.userData, 'config.json'), 'utf-8')
    ) as { shortcuts?: { start?: { skills: string[]; agents: string[] } | null } }
    expect(config.shortcuts?.start).not.toBeNull()

    const second = await launchSeededApp(seeded)
    const secondWindow = await second.firstWindow()
    await waitForWorkUI(secondWindow)
    const reopened = secondWindow.locator('.wb-hero .wb-pill:not(.wb-pill-customize)')
    await expect(reopened).toHaveCount(before.length - 1)
    expect((await reopened.allInnerTexts()).map((text) => text.trim())).not.toContain(doomed)

    await second.close()
  })

  test('@p0 esvazia o conjunto inteiro e restaura o padrão do papel', async ({ seeded }) => {
    const app = await launchSeededApp(seeded)
    const window = await app.firstWindow()
    await waitForWorkUI(window)

    const heroPills = window.locator('.wb-hero .wb-pill:not(.wb-pill-customize)')
    const before = await heroPills.count()

    await window.getByRole('button', { name: 'Personalizar atalhos' }).first().click()
    await window.locator('.wb-sc-dialog').waitFor({ state: 'visible' })
    await window.getByRole('button', { name: 'Remover todos' }).click()
    // An empty set is a legitimate choice, and the stage says what it means.
    await expect(window.locator('.wb-sc-stage-empty')).toBeVisible()
    await window.getByRole('button', { name: 'Concluído' }).click()
    await expect(heroPills).toHaveCount(0)
    // The way back in survives an empty set — it is the only one left.
    await expect(window.getByRole('button', { name: 'Personalizar atalhos' })).toBeVisible()

    await window.getByRole('button', { name: 'Personalizar atalhos' }).first().click()
    await window.getByRole('button', { name: 'Restaurar padrão' }).click()
    await window.getByRole('button', { name: 'Concluído' }).click()
    await expect(heroPills).toHaveCount(before)

    await app.close()
  })
})
