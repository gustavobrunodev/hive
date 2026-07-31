import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test, expect } from './fixtures/workspace'

/**
 * P0-001 + P0-002 (test-design-qa.md, risks R-01 score 9 and R-14).
 *
 * The precondition every other E2E rests on: the built app reaches the work UI
 * WITHOUT running `npx bmad-method install`. Before the B-1 seam, every launch
 * fell into the provisioning gate and shelled out for real, so four specs timed
 * out waiting for a screen they could never get to — and the specs that did
 * pass were passing through the gate's "continuar mesmo assim" error path while
 * looking like they tested the happy path.
 *
 * How "no install ran" is asserted without watching the process table: the
 * fixture seeds `_bmad/_config/manifest.yaml` with a sentinel string. A real
 * `bmad-method install` rewrites that file. If the sentinel survives a launch
 * that reached the work UI, no install ran. That is an on-disk assertion, which
 * is the standard this suite already holds itself to.
 */
test.describe('provisioning seam (B-1)', () => {
  test('@p0 reaches the work UI without running the BMAD installer', async ({ hiveApp }) => {
    const { window, seeded } = hiveApp

    // `hiveApp` already waited for the rail; restate it as the assertion.
    await expect(window.locator('.wb-rail')).toBeVisible()

    // The sentinel manifest is untouched → `npx bmad-method install` never ran.
    const manifest = readFileSync(
      join(seeded.workspace, '_bmad', '_config', 'manifest.yaml'),
      'utf-8'
    )
    expect(manifest).toBe('version: test-fixture\n')

    // And the app never parked on either provisioning gate on the way in.
    await expect(window.getByRole('button', { name: 'Continuar mesmo assim' })).toHaveCount(0)
  })

  // The opt-in half of the seam — that WITHOUT `HIVE_E2E` the real gate still
  // runs — is deliberately NOT asserted here. At this level it depends on the
  // network and on npx cache state: with the registry reachable the real
  // install simply succeeds and the gate flashes past, so the test would
  // measure the runner's connectivity, not the product. It is pinned exactly
  // and deterministically in `src/main/bmadService.test.ts` (flag on/off ×
  // seeded/not, asserting `processRunner.calls`), which is the right level for
  // a boolean.

  test('@p0 each case gets its own workspace and userData (R-16 isolation)', async ({ seeded }) => {
    // The fixture contract the rest of the suite depends on: nothing is shared
    // between cases, so one failure can no longer erase its neighbours the way
    // a `beforeAll` failure erased six in `explorer-editor-ux`.
    expect(seeded.workspace).toContain('hive-e2e-')
    expect(seeded.userData).toContain('hive-e2e-')
    const config = JSON.parse(readFileSync(join(seeded.userData, 'config.json'), 'utf-8'))
    expect(config.workspacePath).toBe(seeded.workspace)
    expect(config.provisioned).toBe(true)
  })
})

// P0-002 (diagnostics) is asserted in `src/main/harnessConfig.test.ts`, not
// here. It is a statement about the harness, not about the app, and at this
// level a `--reporter=` CLI flag silently overrides the runtime config — the
// test would measure the invocation instead of the committed configuration.
// The vitest guard reads the config and the CI workflow directly, runs inside
// `verify`, and needs no display server.

/**
 * P0-004 — the four specs that were red purely because of R-01, re-proven over
 * the seam with one workspace per case. The originals stay where they are; this
 * covers the journeys they could not reach, without their shared-state coupling.
 */
test.describe('work UI reachable for the previously-red journeys (P0-004)', () => {
  test('@p0 the explorer lists the seeded workspace and opens a file', async ({ hiveApp }) => {
    const { window, seeded } = hiveApp
    const { writeFileSync } = await import('node:fs')
    writeFileSync(join(seeded.workspace, 'nota.md'), '# conteúdo semeado\n', 'utf-8')

    // The tree picks the file up from a live watch, with no relaunch.
    const row = window.getByText('nota.md')
    await expect(row).toBeVisible({ timeout: 20_000 })
    await row.click()
    await expect(window.getByLabel('Conteúdo do arquivo')).toHaveValue('# conteúdo semeado\n')
  })

  test('@p0 an edit made in the app lands on disk', async ({ hiveApp }) => {
    const { window, seeded } = hiveApp
    const { writeFileSync } = await import('node:fs')
    const target = join(seeded.workspace, 'edita.md')
    writeFileSync(target, 'antes\n', 'utf-8')

    await window.getByText('edita.md').click()
    const editor = window.getByLabel('Conteúdo do arquivo')
    await editor.fill('depois\n')
    // Ctrl+S rather than the toolbar button: the button is present but not
    // reliably actionable right after a fill (UX-R1.1 ships the shortcut as
    // the primary save gesture, and it is what a user in an editor reaches
    // for).
    await editor.press('Control+s')

    // Asserted on disk, not on the DOM — the standard this suite holds.
    await expect.poll(() => readFileSync(target, 'utf-8'), { timeout: 15_000 }).toBe('depois\n')
  })
})
