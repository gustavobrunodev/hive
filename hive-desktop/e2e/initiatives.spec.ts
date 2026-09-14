import fs from 'node:fs'
import path from 'node:path'
import type { Page } from '@playwright/test'
import { test, expect, launchSeededApp, type SeededWorkspace } from './fixtures/workspace'
import { openSidebar } from './fixtures/sidebar'

/**
 * Iniciativas, in the real Electron app against real files on disk.
 *
 * The whole feature rests on one claim the unit suites can only assume: that
 * **the folder is the initiative**. Everything on screen — the tree, the year
 * grouping, the BMAD plan's progress, the context files — is derived from a
 * walk of `docs/iniciativas/`, so the only test that can prove it is one that
 * writes those directories itself and then reads the screen back.
 *
 * It also covers the other direction, which is the half a mock cannot reach:
 * "Nova iniciativa" really has to leave a folder and a manifest behind, or the
 * demand it just opened will be gone on the next launch.
 */

const R1 = path.join('docs', 'iniciativas', 'R1')
const R2 = path.join('docs', 'iniciativas', 'R2')
const R3 = path.join('docs', 'iniciativas', 'R3')
const YEAR = new Date().getFullYear()

/**
 * Writes the demand folders the tree is meant to find.
 *
 * Three, on purpose. `portal-de-cobranca` carries a manifest — the only way its
 * accented title reaches a tree that otherwise has nothing but a slug to read —
 * and two finished stages. `antifraude` carries none, so it is the de-slugged
 * case. `portal-legado` is dated to last year: the section opens the newest year
 * and leaves the rest folded, which has to stay true with an older year present.
 */
function seedInitiatives(seeded: SeededWorkspace): void {
  const portal = path.join(seeded.workspace, R2, 'portal-de-cobranca')
  fs.mkdirSync(portal, { recursive: true })
  fs.writeFileSync(
    path.join(portal, 'iniciativa.json'),
    JSON.stringify({ title: 'Portal de Cobrança', year: YEAR, release: 'R2' })
  )
  fs.writeFileSync(path.join(portal, 'prd.md'), '# PRD\n')
  fs.writeFileSync(path.join(portal, 'pesquisa-dominio.md'), '# Pesquisa\n')

  fs.mkdirSync(path.join(seeded.workspace, R3, 'antifraude'), { recursive: true })

  const legado = path.join(seeded.workspace, R1, 'portal-legado')
  fs.mkdirSync(legado, { recursive: true })
  fs.writeFileSync(
    path.join(legado, 'iniciativa.json'),
    JSON.stringify({ title: 'Portal legado', year: YEAR - 1, release: 'R1' })
  )
}

/** The Iniciativas section, with the sidebar open on Chat & Cowork. */
async function initiatives(window: Page): Promise<void> {
  await openSidebar(window, 'chat')
  await window.locator('.wb-inits-tree').waitFor({ state: 'visible', timeout: 15_000 })
}

test.describe('iniciativas', () => {
  test('reads the demand folders off disk, grouped by year and release', async ({
    seeded,
    hiveApp
  }) => {
    seedInitiatives(seeded)
    // The panel watches the workspace, so the folders written after launch
    // arrive on their own — no reload, which is the behaviour under test.
    const { window } = hiveApp
    await openSidebar(window, 'chat')

    // The two demand rows the current year opens on: one keeping its accents
    // (manifest) and one read back from its own folder name.
    await expect(window.getByText('Portal de Cobrança')).toBeVisible({ timeout: 15_000 })
    await expect(window.getByText('Antifraude')).toBeVisible()
    await expect(window.getByRole('treeitem', { name: new RegExp(`^${YEAR}`) })).toHaveAttribute(
      'aria-expanded',
      'true'
    )

    // Last year is there and folded: the year you are working in opens, the
    // archive waits to be asked for.
    const previous = window.getByRole('treeitem', { name: new RegExp(`^${YEAR - 1}`) })
    await expect(previous).toHaveAttribute('aria-expanded', 'false')
    await expect(window.getByText('Portal legado')).toHaveCount(0)
    await previous.click()
    await expect(window.getByText('Portal legado')).toBeVisible()
  })

  test('opens a demand beside the transcript, with its plan read from the files', async ({
    seeded,
    hiveApp
  }) => {
    seedInitiatives(seeded)
    const { window } = hiveApp
    await initiatives(window)

    await window.getByText('Portal de Cobrança').click()

    await expect(window.locator('.wb-initctx')).toBeVisible()
    // The demand names itself INSIDE its own panel. It used to rename the work
    // pane's header — a strip that also spans the transcript, which left the
    // demand's ✕ on one background and the panel it closes on another.
    await expect(window.locator('.wb-initctx-name')).toHaveText('Portal de Cobrança')
    // The composer is still there: the demand's rail sits beside the chat, it
    // does not replace it.
    await expect(window.getByPlaceholder('Escreva uma mensagem…')).toBeVisible()

    // `prd.md` and `pesquisa-dominio.md` exist; nothing else does. The plan is
    // an answer about the folder, not a stored status — and the arrow lands on
    // Arquitetura: brainstorming and UX are above it and still unrun, but both
    // are optional, and nobody is behind for having skipped them.
    await expect(window.locator('.wb-initctx-count')).toHaveText('2 de 8 etapas')
    await expect(window.getByRole('button', { name: 'Abrir PRD' })).toBeVisible()
    await expect(
      window.getByRole('button', { name: 'Iniciar Brainstorming, Opcional' })
    ).toBeVisible()
    await expect(window.locator('.hds-stage[aria-current="step"]')).toContainText('Arquitetura')
    // The four phases are the view the plan is read in.
    await expect(window.locator('.hds-stage-group')).toHaveCount(4)
  })

  test('opens an artifact from the plan into the editor', async ({ seeded, hiveApp }) => {
    seedInitiatives(seeded)
    const { window } = hiveApp
    await initiatives(window)
    await window.getByText('Portal de Cobrança').click()

    await window.getByRole('button', { name: 'Abrir PRD' }).click()
    await expect(window.locator('.wb-tabs')).toContainText('prd.md')
  })

  test('creates the folder and its manifest, then opens what it created', async ({
    seeded,
    hiveApp
  }) => {
    const { window } = hiveApp
    await openSidebar(window, 'chat')

    await window.getByRole('button', { name: 'Nova iniciativa' }).click()
    await window.getByLabel('Nome da demanda').fill('Régua de Cobrança')
    await window.getByRole('radio', { name: 'R4' }).click()
    await window.getByRole('button', { name: 'Criar iniciativa' }).click()

    const folder = path.join(seeded.workspace, 'docs', 'iniciativas', 'R4', 'regua-de-cobranca')
    await expect
      .poll(() => fs.existsSync(path.join(folder, 'iniciativa.json')), { timeout: 15_000 })
      .toBe(true)
    const manifest: unknown = JSON.parse(
      fs.readFileSync(path.join(folder, 'iniciativa.json'), 'utf-8')
    )
    expect(manifest).toMatchObject({ title: 'Régua de Cobrança', release: 'R4' })

    // Creating one and then having to go find it is the repair left half-done.
    await expect(window.locator('.wb-initctx-name')).toHaveText('Régua de Cobrança')
  })

  test('refuses to create a second demand over an existing folder', async ({ seeded, hiveApp }) => {
    fs.mkdirSync(path.join(seeded.workspace, R2, 'portal-de-cobranca'), { recursive: true })
    const { window } = hiveApp
    await openSidebar(window, 'chat')

    await window.getByRole('button', { name: 'Nova iniciativa' }).click()
    await window.getByLabel('Nome da demanda').fill('Portal de Cobrança')
    await window.getByRole('radio', { name: 'R2' }).click()
    await window.getByRole('button', { name: 'Criar iniciativa' }).click()

    await expect(window.getByRole('alert')).toHaveText(
      'Já existe uma demanda com esse nome nessa release.'
    )
  })

  test('reopens the demand the app was closed on', async ({ seeded, hiveApp }) => {
    seedInitiatives(seeded)
    await initiatives(hiveApp.window)
    await hiveApp.window.getByText('Portal de Cobrança').click()
    await expect(hiveApp.window.locator('.wb-initctx')).toBeVisible()
    await hiveApp.app.close()

    const relaunched = await launchSeededApp(seeded)
    const window = await relaunched.firstWindow()
    await expect(window.locator('.wb-initctx-name')).toHaveText('Portal de Cobrança', {
      timeout: 30_000
    })
    await relaunched.close()
  })
})
