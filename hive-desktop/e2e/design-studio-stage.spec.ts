import { test, expect } from './fixtures/workspace'
import type { Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

/**
 * design-studio T7.6 — the Bancada in the real app, and the one claim jsdom
 * could not make (D-DS-7, DS-R3).
 *
 * **This is the carried debt of T4.6.** Phase 4 could only assert the *cause*
 * of an honest scale — the iframe carries `width: 1440px` with no transform of
 * its own while its container carries `scale(k)`, k < 1 — because jsdom reports
 * the same fixed `innerWidth` for every frame no matter what it is told. The
 * effect is the thing that matters: if the Preview's own window reports the
 * bench's width instead of the device's, every media query in the design system
 * answers the wrong question and the stage lies about the device.
 *
 * So it is measured here, from inside the frame, in the built app: the Preview
 * reports **1440** while the container is scaled below 1. The parent cannot ask
 * — the frame is sandboxed without `allow-same-origin`, so `contentWindow` is
 * cross-origin and `innerWidth` is not readable across it. Playwright can,
 * because it evaluates in the frame's own execution context.
 */

/** A UX Spec the detector recognises — two Telas by `## Tela — …` heading. */
const UX_SPEC = `# Spec de UX

## Tela — Login

O usuário entra com e-mail e senha.

## Tela — Cadastro

Criação de conta.
`

const SPEC_PATH = 'docs/ux-spec.md'

function seedSpec(workspace: string): void {
  fs.mkdirSync(path.join(workspace, 'docs'), { recursive: true })
  fs.writeFileSync(path.join(workspace, SPEC_PATH), UX_SPEC, 'utf-8')
}

/**
 * Gives the active Tela its first Component **through the UI** (T5.5).
 *
 * Seeding the document over the bridge would be shorter and would prove less:
 * the point of this spec is the stage, and a stage fed by a back door is a
 * stage nobody drove. The empty state's own "Adicionar Componente" opens the
 * Árvore's picker — in this band the Árvore is a drawer, so the button brings
 * it into view first, which is exactly the behaviour §3.8 promises.
 */
async function addFirstComponent(window: Page, tag: string): Promise<void> {
  await window
    .locator('.wb-dstudio-bench')
    .getByRole('button', { name: 'Adicionar Componente' })
    .click()
  await window.getByRole('combobox', { name: 'Componente' }).click()
  await window.getByRole('option', { name: tag, exact: true }).click()
  await window.getByRole('button', { name: 'Adicionar', exact: true }).click()
  // The drawer has done its job; the stage is what the rest of this measures.
  await window.keyboard.press('Escape')
  await window.locator('.wb-dstudio-drawer').waitFor({ state: 'detached', timeout: 15_000 })
}

/** Opens the Studio tab through the palette — the app's own second way in. */
async function openStudio(window: Page): Promise<void> {
  await window.keyboard.press('Control+p')
  await window.getByLabel(`Abrir ${SPEC_PATH} no Design Studio`).click()
  await window.locator('.wb-dstudio').waitFor({ state: 'visible', timeout: 30_000 })
}

test.describe('design-studio — the stage tells the truth about the device', () => {
  test('@p0 the Preview reports 1440 while the bench shows it reduced (D-DS-7)', async ({
    seeded,
    hiveApp
  }) => {
    test.setTimeout(180_000)
    const { window } = hiveApp
    seedSpec(seeded.workspace)

    await openStudio(window)

    // The Telas are listed before anything is generated (DS-R1 AC-2).
    await expect(window.locator('.wb-dstudio-screen-count')).toHaveText('2 Telas')

    await addFirstComponent(window, 'wa-card')

    // Desktop is the default preset, and the tab lives in the viewer pane —
    // a column far narrower than 1440, which is the whole point.
    const scaleBox = window.locator('.wb-dstudio-scale')
    await scaleBox.waitFor({ state: 'visible', timeout: 30_000 })
    const scale = Number(await scaleBox.getAttribute('data-scale'))
    expect(scale).toBeGreaterThan(0)
    expect(scale).toBeLessThan(1)

    // …and the readout says so, in the device's real numbers.
    await expect(window.locator('.wb-dstudio-readout')).toHaveText(
      `1440 × 900 · ${Math.round(scale * 100)}%`
    )

    // The frame's own layout box is the device's real size — the transform is
    // on the container above it, never on the frame.
    const frame = window.locator('iframe.wb-dstudio-frame')
    await frame.waitFor({ state: 'attached', timeout: 30_000 })
    expect(await frame.evaluate((node) => getComputedStyle(node).width)).toBe('1440px')
    expect(await frame.evaluate((node) => getComputedStyle(node).transform)).toBe('none')

    // THE CLAIM: inside the Preview, the window is 1440 wide. Asked from the
    // frame's own context, because the sandbox makes it cross-origin to the
    // parent — `contentWindow.innerWidth` is not readable from outside it.
    const inner = await window
      .frameLocator('iframe.wb-dstudio-frame')
      .locator('body')
      .evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }))
    expect(inner.width, 'the Preview must report the device width, not the bench width').toBe(1440)
    expect(inner.height).toBe(900)

    // A mobile preset fits whole, so it is never magnified past 100% and the
    // frame follows the preset rather than the bench.
    await window.getByRole('radio', { name: 'Mobile' }).click()
    await expect(window.locator('.wb-dstudio-readout')).toContainText('390 × 844')
    await expect
      .poll(async () =>
        window
          .frameLocator('iframe.wb-dstudio-frame')
          .locator('body')
          .evaluate(() => window.innerWidth)
      )
      .toBe(390)
  })
})
