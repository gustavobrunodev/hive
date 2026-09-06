import { test, expect, _electron as electron } from '@playwright/test'
import type { Page } from '@playwright/test'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'
import { openSidebar } from './fixtures/sidebar'

// Second Brain (M12) E2E, SB-R8.3 — Playwright driving the real built Electron
// app. Same boot recipe as agent-change-review.spec.ts (STATE.md T2/T11
// lessons: strip ELECTRON_RUN_AS_NODE, provision via the on-disk manifest
// marker, skip the guided tour before driving the UI).
//
// Scope note: transcription is deliberately NOT exercised here. It needs a real
// model download (hundreds of MB) and a GPU/WASM session, neither of which
// belongs in an E2E run; the decode math, the pipeline orchestration and the
// transcript→ingest wiring each have their own unit tests. What a real launch
// uniquely proves — and what this spec asserts — is the parts that only exist
// once Electron, IPC, the preload bridge and the renderer are all real:
//   1. the Second Brain activity-bar view switches in over a real on-disk vault,
//   2. the FAB → paste → Ingerir path writes a real file to the real disk and
//      launches the agent turn (SB-R3.2), and
//   3. the `hive-model:` protocol serves model bytes to the sandboxed renderer
//      under the production CSP (SB-R4.1's foundation), with escapes refused.

async function waitForWorkUI(window: Page): Promise<void> {
  // The **activity bar**, not the file rail: a workspace with no stored session
  // opens on the chat alone (workspace-session), so `.wb-rail` is collapsed to
  // zero here — `openSidebar` at the end is what brings it back.
  const rail = window.locator('.wb-actionrail')
  const continueAnyway = window.getByRole('button', { name: 'Continuar mesmo assim' })
  // The provisioning gate has TWO steps (BMAD, then second-brain), each
  // shelling out to a real network-backed CLI, and each offering "Continuar
  // mesmo assim" (SB-R1.3). Loop rather than clicking once, so a stalled or
  // failing step never leaves the app parked on the gate.
  for (let step = 0; step < 2; step++) {
    await Promise.race([
      rail.waitFor({ state: 'visible', timeout: 200_000 }),
      continueAnyway.waitFor({ state: 'visible', timeout: 200_000 })
    ])
    if (await rail.isVisible().catch(() => false)) break
    if (await continueAnyway.isVisible().catch(() => false)) {
      await continueAnyway.click()
      await window.waitForTimeout(300)
    }
  }
  await rail.waitFor({ state: 'visible', timeout: 60_000 })
  await openSidebar(window)
}

test.describe('second-brain E2E (real Electron)', () => {
  test('the Second Brain view, FAB ingestion to real disk, and the hive-model: protocol', async () => {
    test.setTimeout(300_000)

    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hive-e2e-brain-'))
    const workspace = path.join(tmpRoot, 'ws')
    const userDataDir = path.join(tmpRoot, 'userData')
    fs.mkdirSync(workspace, { recursive: true })
    fs.mkdirSync(userDataDir, { recursive: true })

    // Provisioned marker so the app boots straight into the work UI.
    fs.mkdirSync(path.join(workspace, '_bmad', '_config'), { recursive: true })
    fs.writeFileSync(path.join(workspace, '_bmad', '_config', 'manifest.yaml'), 'version: test\n')

    // A vault, as the skill's own wizard would scaffold it. Seeded before
    // launch so the app boots straight into the configured panel — a vault
    // created mid-session is now picked up on its own (the store watches the
    // workspace tree), which `useSecondBrain.test.ts` covers directly.
    fs.mkdirSync(path.join(workspace, 'second-brain', 'raw'), { recursive: true })

    // The four skills the pack really installs. They are what the workspace
    // skill catalog is built from, and that catalog is the oracle deciding
    // whether `/second-brain-query …` reads as an invocation in the transcript
    // or as ordinary prose — a workspace with a vault but no skills answers the
    // wrong question.
    for (const key of [
      'second-brain',
      'second-brain-ingest',
      'second-brain-lint',
      'second-brain-query'
    ]) {
      const skillDir = path.join(workspace, '.claude', 'skills', key)
      fs.mkdirSync(skillDir, { recursive: true })
      fs.writeFileSync(
        path.join(skillDir, 'SKILL.md'),
        `---\nname: ${key}\ndescription: Test fixture for ${key}.\n---\n\n# test fixture\n`,
        'utf-8'
      )
    }

    // A partial model in the store's own directory: bytes on disk with no
    // completion marker, which the assertions below use to prove that a
    // directory of bytes is not a finished model.
    const modelDir = path.join(userDataDir, 'asr-models', 'parakeet-tdt-0.6b-v3-int8')
    fs.mkdirSync(modelDir, { recursive: true })
    fs.writeFileSync(path.join(modelDir, 'tokens.txt'), 'partial')

    fs.writeFileSync(
      path.join(userDataDir, 'config.json'),
      JSON.stringify({
        workspacePath: workspace,
        provisioned: true,
        recentWorkspaces: [],
        agent: 'claude',
        agents: ['claude'],
        role: 'dev',
        lastModel: null,
        lastEffort: null
      })
    )

    const appPath = path.join(__dirname, '..', 'out', 'main', 'index.js')
    const launchEnv = { ...process.env }
    delete launchEnv.ELECTRON_RUN_AS_NODE

    const app = await electron.launch({
      args: [appPath, `--user-data-dir=${userDataDir}`],
      env: launchEnv
    })

    try {
      const window = await app.firstWindow()
      await window.waitForLoadState('domcontentloaded')

      // Any CSP violation from the production policy would show up here.
      const cspViolations: string[] = []
      window.on('console', (message) => {
        const text = message.text()
        if (/Content Security Policy|Refused to/i.test(text)) cspViolations.push(text)
      })

      await waitForWorkUI(window)

      // Dismiss the first-run guided tour (its overlay intercepts clicks).
      await window
        .getByRole('button', { name: 'Pular tour' })
        .click({ timeout: 20_000 })
        .catch(() => {})
      await window
        .locator('.wb-tour')
        .waitFor({ state: 'hidden', timeout: 10_000 })
        .catch(() => {})

      // ── 1. The Second Brain activity-bar view (SB-R2.1/2.3/2.4) ──────────
      // The seeded vault is detected on disk, so the panel shows its populated
      // state: the vault name and the three action launchers. (The no-vault
      // empty state is covered by SecondBrainPanel's unit tests — a single
      // launch can only be in one of the two states.)
      // `exact` matters: the floating button carries a near-identical name
      // ("Base de conhecimento — perguntar ou capturar").
      await window.getByRole('button', { name: 'Bases de conhecimento', exact: true }).click()
      await expect(window.getByRole('button', { name: /Ingerir/ }).first()).toBeVisible({
        timeout: 15_000
      })
      await expect(window.getByText('Perguntar à base')).toBeVisible()
      await expect(window.getByText('Revisar', { exact: true })).toBeVisible()
      // SB-R10.1: a fresh vault's cadence renders from the real main-process
      // ledger (no ingests recorded yet on this brand-new userData dir).
      await expect(window.getByText('0 de 10 ingestões')).toBeVisible()

      // ── 2. FAB → paste → Ingerir writes a REAL file (SB-R3.2) ────────────
      await window
        .getByRole('button', { name: 'Base de conhecimento — perguntar ou capturar' })
        .click()
      await window.getByRole('menuitem', { name: 'Escrever' }).click()

      const knowledge = 'Decisão da squad: o vault vive no workspace, versionado no git.'
      await window.getByRole('textbox').fill(knowledge)
      await window.getByRole('button', { name: 'Ingerir', exact: true }).click()

      // The assertion that matters: a real Markdown file, with the real bytes,
      // in the real vault inbox — written through main over real IPC.
      const rawDir = path.join(workspace, 'second-brain', 'raw')
      await expect
        .poll(() => fs.readdirSync(rawDir).filter((f) => f.endsWith('.md')).length, {
          timeout: 20_000
        })
        .toBe(1)

      const staged = fs.readdirSync(rawDir).find((f) => f.endsWith('.md'))!
      expect(staged).toMatch(/^ingest-\d{8}-\d{6}-[a-z0-9]+\.md$/)
      expect(fs.readFileSync(path.join(rawDir, staged), 'utf-8')).toBe(knowledge)

      // The vault bridge reports the staged item back (drives the rail badge).
      const vault = await window.evaluate(
        async (ws) => window.hive.secondBrain.getVault(ws),
        workspace
      )
      expect(vault).toMatchObject({ name: 'second-brain', rawPending: 1 })

      // ── 2b. The ingest advanced the REAL health ledger (SB-R10.2) ────────
      // Written by main into this run's throwaway userData, then read back —
      // the whole cadence contract over real IPC, not a mock.
      await expect
        .poll(
          async () =>
            (await window.evaluate(async (ws) => window.hive.secondBrain.getHealth(ws), workspace))
              .ingestsSinceLint,
          { timeout: 15_000 }
        )
        .toBe(1)
      await expect(window.getByText('1 de 10 ingestões')).toBeVisible({ timeout: 10_000 })

      // ── 2c. Ctrl+Shift+K asks the base, question inside the command (SB-R9) ─
      await window.keyboard.press('Control+Shift+K')
      const question = window.getByRole('textbox', { name: 'Sua pergunta' })
      await expect(question).toBeVisible({ timeout: 10_000 })
      await question.fill('Onde vive o vault?')
      await window.getByRole('button', { name: 'Perguntar', exact: true }).click()
      // The dialog closes and the chat carries the turn as the user would have
      // typed it — `/second-brain-query <pergunta>` — in an ordinary user
      // bubble, with only the command run marked. It used to be promoted out
      // of the bubble into a two-part object whose halves were siblings
      // separated by flex `gap` rather than by text, so the message never read
      // back as the sentence that was sent; now it does, which is what this
      // asserts.
      await expect(question).toBeHidden({ timeout: 10_000 })
      const bubble = window.locator('.hds-chat-message-user').last()
      await expect(bubble).toContainText('/second-brain-query Onde vive o vault?', {
        timeout: 20_000
      })
      // The workspace really has this skill (the fixture installs the pack), so
      // the leading run is marked as the invocation it is.
      await expect(bubble.locator('mark[data-kind="command"]')).toHaveText('/second-brain-query')
      // Reopening offers the question back (SB-R9.4). Target the recent-question
      // control by role: the same text is also on screen in the transcript.
      await window.keyboard.press('Control+Shift+K')
      await expect(
        window.getByRole('button', { name: 'Perguntar de novo: Onde vive o vault?' })
      ).toBeVisible({ timeout: 10_000 })
      await window.keyboard.press('Escape')

      // ── 3. The model store, through the real bridge (M29) ────────────────
      //
      // The `hive-model:` protocol this section used to exercise is gone. It
      // existed only so a sandboxed renderer could read weights it could not
      // fetch; inference moved to a native utility process, and the renderer
      // never sees a weight file. Its absence is now the assertion.
      const modelSchemeReachable = await window.evaluate(async () => {
        try {
          await fetch('hive-model://models/base/config.json')
          return true
        } catch {
          return false
        }
      })
      expect(modelSchemeReachable).toBe(false)

      // The app ships NO weights: the installation carries no bundled model
      // directory, so the only place one can come from is the user's profile.
      expect(fs.existsSync(path.join(__dirname, '..', 'resources', 'asr-models'))).toBe(false)
      expect(fs.existsSync(path.join(__dirname, '..', 'resources', 'whisper-models'))).toBe(false)

      // Bytes were seeded into userData above but carry no completion marker,
      // so the store correctly refuses to call the model installed — a
      // directory of bytes is not a finished model.
      const readiness = await window.evaluate(async () => window.hive.asr.readiness())
      expect(readiness.installed).toBe(false)
      // And it still names what it would fetch, with the cost, because that is
      // what every recording surface needs in order to offer the download.
      expect(readiness.model.id).toBe('parakeet-tdt-0.6b-v3-int8')
      expect(readiness.model.sizeMB).toBeGreaterThan(0)
      expect(readiness.runtime.threads).toBeGreaterThanOrEqual(1)

      expect(cspViolations).toEqual([])
    } finally {
      await app.close()
      fs.rmSync(tmpRoot, { recursive: true, force: true })
    }
  })
})
