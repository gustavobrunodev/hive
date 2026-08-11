import { test, expect } from './fixtures/workspace'
import type { Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

/**
 * design-studio T7.7 — DS-R18: the whole module is operable from the keyboard.
 *
 * The other two halves of DS-R18 already have sensors that run in `verify`:
 * `noInlineStrings.test.ts` fails on any UI literal outside `t()`, and
 * `reducedMotion.test.ts` fails on any animated rule in `workbench.css` with no
 * `prefers-reduced-motion` alternative. Keyboard operability had none — it is
 * the one that can only be shown by *driving*.
 *
 * So nothing here clicks. The tab is opened from the palette with the keyboard,
 * the focus order is walked with Tab, and the export picker — the newest
 * surface and the only modal — is opened, operated and dismissed without a
 * pointer. This is also why Move is two buttons rather than a drag (design §4):
 * a drag is the one gesture this test could never make.
 */

const SPEC_PATH = 'docs/ux-spec.md'

function seedSpec(workspace: string): void {
  fs.mkdirSync(path.join(workspace, 'docs'), { recursive: true })
  fs.writeFileSync(
    path.join(workspace, SPEC_PATH),
    '# Spec de UX\n\n## Tela — Login\n\nEntrar.\n\n## Tela — Cadastro\n\nCriar conta.\n',
    'utf-8'
  )
}

/** The focused element, as a user of a screen reader would hear it. */
async function focused(window: Page): Promise<{ name: string; className: string }> {
  return window.evaluate(() => {
    const element = document.activeElement as HTMLElement | null
    return {
      name: element?.getAttribute('aria-label') ?? element?.textContent?.trim().slice(0, 40) ?? '',
      className: typeof element?.className === 'string' ? element.className : ''
    }
  })
}

/**
 * Tabs forward until `matches` accepts the focused element, and leaves the
 * focus there. Bounded, so a control that is genuinely unreachable fails the
 * test instead of hanging it.
 */
async function tabUntil(
  window: Page,
  matches: (focus: { name: string; className: string }) => boolean,
  budget = 80
): Promise<string[]> {
  const seen: string[] = []
  for (let step = 0; step < budget; step++) {
    await window.keyboard.press('Tab')
    const focus = await focused(window)
    seen.push(focus.name)
    if (matches(focus)) return seen
  }
  throw new Error(`never reached the control by Tab; the path was:\n${seen.join('\n')}`)
}

/** Opens the Studio tab from the palette using only the keyboard (DS-R1 AC-1). */
async function openStudioByKeyboard(window: Page): Promise<void> {
  await window.keyboard.press('Control+p')
  await window.locator('[cmdk-root]').waitFor({ state: 'visible', timeout: 15_000 })
  await window.keyboard.type('ux-spec')
  await window.locator('[cmdk-item]').first().waitFor({ state: 'visible', timeout: 15_000 })

  // The palette lists the Spec twice — as a file, and as a Studio destination.
  // Walk down to the second with the arrow keys, exactly as a user would.
  const selectedLabel = async (): Promise<string> =>
    window.evaluate(
      () =>
        document
          .querySelector('[cmdk-item][data-selected="true"], [cmdk-item][aria-selected="true"]')
          ?.getAttribute('aria-label') ?? ''
    )
  let label = await selectedLabel()
  for (let step = 0; step < 12 && !label.endsWith('no Design Studio'); step++) {
    await window.keyboard.press('ArrowDown')
    label = await selectedLabel()
  }
  // Fail here, with the row that was actually highlighted, rather than three
  // assertions later on a tab that opened the file instead of the Studio.
  expect(label, 'the palette never highlighted the Design Studio row').toContain('Design Studio')
  await window.keyboard.press('Enter')
  await window.locator('.wb-dstudio').waitFor({ state: 'visible', timeout: 30_000 })
  await expect(window.locator('[role="dialog"]')).toHaveCount(0)
}

test.describe('design-studio — operable without a pointer (DS-R18)', () => {
  test('@p0 @a11y opens from the palette and reaches every surface by Tab', async ({
    seeded,
    hiveApp
  }) => {
    test.setTimeout(180_000)
    const { window } = hiveApp
    seedSpec(seeded.workspace)

    await openStudioByKeyboard(window)

    // Tab from the top of the app into the tab's own toolbar. The Tela picker
    // is the first control the Bancada offers, and reaching it at all is what
    // proves the tab is in the focus order rather than beside it.
    const path1 = await tabUntil(window, (focus) =>
      focus.className.includes('wb-dstudio-screen-trigger')
    )
    expect(path1.length).toBeGreaterThan(0)

    // Every remaining toolbar control, in order, without a pointer: the device
    // sizes, undo, redo, Modo Foco, the two drawer openers, and Exportar.
    const reachable: string[] = []
    for (let step = 0; step < 40; step++) {
      await window.keyboard.press('Tab')
      const focus = await focused(window)
      reachable.push(focus.name)
      if (focus.name === 'Exportar') break
    }
    for (const control of ['Modo Foco', 'Abrir a Árvore', 'Abrir o Inspetor', 'Exportar']) {
      expect(
        reachable,
        `"${control}" was not reachable by Tab; the path was:\n${reachable.join('\n')}`
      ).toContain(control)
    }

    // Undo and Redo are deliberately *not* in that path: on a Tela nobody has
    // edited they are disabled, and a disabled control belongs out of the tab
    // order. What must hold is that they are disabled for the honest reason —
    // an empty log — rather than missing (T4.4, DS-R9).
    await expect(window.getByLabel('Desfazer')).toBeDisabled()
    await expect(window.getByLabel('Refazer')).toBeDisabled()

    // The device sizes answer to the arrow keys, which is what a radiogroup
    // owes: one Tab stop for the group, arrows to move within it (DS-R3 AC-1).
    await window.getByRole('radio', { name: 'Desktop' }).focus()
    await window.keyboard.press('ArrowLeft')
    await expect(window.getByRole('radio', { name: 'Tablet' })).toHaveAttribute(
      'aria-checked',
      'true'
    )
    await expect(window.getByRole('radio', { name: 'Desktop' })).toHaveAttribute(
      'aria-checked',
      'false'
    )
  })

  test('@p0 @a11y opens, operates and dismisses the export picker by keyboard', async ({
    seeded,
    hiveApp
  }) => {
    test.setTimeout(180_000)
    const { window } = hiveApp
    seedSpec(seeded.workspace)

    await openStudioByKeyboard(window)

    // Reachability is the first test's claim; this one is about *operating*
    // the picker, so the focus is placed on the button and everything from
    // there is keystrokes. (Focusing rather than Tab-walking also keeps the
    // case honest on a narrow window, where the toolbar scrolls and a walk
    // measures the scroll container instead of the keyboard.)
    await window.getByRole('button', { name: 'Exportar' }).focus()
    await window.keyboard.press('Enter')

    const dialog = window.locator('.wb-dstudio-export-dialog')
    await dialog.waitFor({ state: 'visible', timeout: 15_000 })

    // The Tela in view arrives chosen; the other is one Tab and one Space away.
    const other = window.getByLabel('Exportar a Tela Cadastro')
    await expect(other).not.toBeChecked()
    await tabUntil(window, (focus) => focus.name === 'Exportar a Tela Cadastro', 20)
    await window.keyboard.press('Space')
    await expect(other).toBeChecked()

    // Esc closes it, and the picker leaves the document — a dialog that only
    // hides would keep the Telas behind it out of the focus order.
    await window.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
  })
})
