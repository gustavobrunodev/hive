import { test, expect, _electron as electron } from '@playwright/test'
import type { Page } from '@playwright/test'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'

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
  const rail = window.locator('.wb-rail')
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

    // A model file placed exactly where the store keeps them, to prove the
    // protocol serves real bytes from userData (T11's contract).
    const modelDir = path.join(userDataDir, 'whisper-models', 'base')
    fs.mkdirSync(modelDir, { recursive: true })
    fs.writeFileSync(path.join(modelDir, 'config.json'), '{"model_type":"whisper"}')

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
      // typed it — `/second-brain-query <pergunta>`. The transcript renders the
      // command name and its args as SIBLING spans (`CommandInvocation`), and
      // the space between them is flex `gap`, not text — so neither the joined
      // string nor the token's textContent ever matches. Assert each span.
      await expect(question).toBeHidden({ timeout: 10_000 })
      const command = window.locator('.wb-command-token').last()
      await expect(command.locator('.wb-command-token-name')).toHaveText('/second-brain-query', {
        timeout: 20_000
      })
      await expect(command.locator('.wb-command-token-args')).toHaveText('Onde vive o vault?')
      // Reopening offers the question back (SB-R9.4). Target the recent-question
      // control by role: the same text is also on screen in the transcript.
      await window.keyboard.press('Control+Shift+K')
      await expect(
        window.getByRole('button', { name: 'Perguntar de novo: Onde vive o vault?' })
      ).toBeVisible({ timeout: 10_000 })
      await window.keyboard.press('Escape')

      // ── 3. The hive-model: protocol under the production CSP (T11) ───────
      const served = await window.evaluate(async () => {
        const response = await fetch('hive-model://models/base/config.json')
        return { ok: response.ok, body: (await response.text()).trim() }
      })
      expect(served).toEqual({ ok: true, body: '{"model_type":"whisper"}' })

      // M26: the app ships NO weights. The installation carries no
      // `resources/whisper-models/`, so the only place a model can come from is
      // the user's own profile — which is what the two assertions below check
      // from opposite sides.
      expect(fs.existsSync(path.join(__dirname, '..', 'resources', 'whisper-models'))).toBe(false)

      // `base` was seeded into userData above but carries no completion marker,
      // so the store correctly refuses to call it downloaded — a directory of
      // bytes is not a finished model.
      const status = await window.evaluate(async () => window.hive.whisper.modelStatus('base'))
      expect(status).toEqual({ downloaded: false, variant: null })

      // And with nothing installed, the resolved preference says so rather than
      // naming a model whose weights are nowhere on this machine (SB-R7.4).
      const preference = await window.evaluate(async () => window.hive.whisper.preference())
      expect(preference.auto).toBe(true)
      expect(preference.id).toBeNull()
      expect(preference.installed).toEqual([])

      // An unknown store root is refused, not served.
      const refused = await window.evaluate(async () => {
        const response = await fetch('hive-model://secrets/id_rsa')
        return response.status
      })
      expect(refused).toBe(404)

      // The whisper catalog crosses IPC intact.
      const models = await window.evaluate(async () => window.hive.whisper.listModels())
      expect(models.some((m) => m.id === 'base')).toBe(true)

      expect(cspViolations).toEqual([])
    } finally {
      await app.close()
      fs.rmSync(tmpRoot, { recursive: true, force: true })
    }
  })
})
