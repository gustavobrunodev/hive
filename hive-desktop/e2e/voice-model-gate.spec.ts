import { test, expect, _electron as electron } from '@playwright/test'
import type { Page } from '@playwright/test'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'
import { openSidebar } from './fixtures/sidebar'

// The model gate (M26), E2E — the real built Electron app with an **empty**
// userData, which since M26 is what a fresh install genuinely is: the app ships
// no Whisper weights, so there is no model until the user downloads one.
//
// This spec exists because the failure it guards was reported from a real
// session and no test could have caught it: every unit test injects a fake
// preference, and `voice-prompt.spec.ts` drives dictation from a userData that
// (now) has a model. Nothing exercised the one path a new user takes first —
// press the microphone before owning a model — end to end, through main's
// hardware probe, main's model store and the real preload bridge.
//
// What it proves, and why each half matters:
//   1. main resolves "no model" rather than inventing one. `pickAutoModel`
//      answers `null` for an empty disk; a recommendation is not an install.
//   2. Pressing the microphone opens the way to get a model and **never opens
//      the microphone**. A take that records happily and then fails at
//      transcription, minutes of speech later, is the outcome the gate exists
//      to prevent — so `getUserMedia` being untouched is the assertion, not
//      the dialog's presence.
async function waitForWorkUI(window: Page): Promise<void> {
  // The **activity bar**, not the file rail: a workspace with no stored session
  // opens on the chat alone (workspace-session), so `.wb-rail` is collapsed to
  // zero here — `openSidebar` at the end is what brings it back.
  const rail = window.locator('.wb-actionrail')
  const continueAnyway = window.getByRole('button', { name: 'Continuar mesmo assim' })
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

test.describe('voice model gate E2E (real Electron)', () => {
  test('the microphone offers a model instead of recording without one', async () => {
    test.setTimeout(300_000)

    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hive-e2e-gate-'))
    const workspace = path.join(tmpRoot, 'ws')
    const userDataDir = path.join(tmpRoot, 'userData')
    fs.mkdirSync(path.join(workspace, '_bmad', '_config'), { recursive: true })
    fs.mkdirSync(userDataDir, { recursive: true })
    fs.writeFileSync(path.join(workspace, '_bmad', '_config', 'manifest.yaml'), 'version: test\n')
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
        lastEffort: null,
        // M29.1: startup now fetches the model by itself when none is
        // installed, and this test's whole subject is what the gate offers when
        // none is. Left on, the gate would meet a progress bar instead of the
        // offer — a real state, but a different one. This is the app's own
        // opt-out, so what is seeded here is exactly a user who pressed
        // "Remover": no model, and nothing fetching it.
        asrAutoDownload: false
      })
    )
    // Deliberately NO `asr-models/` directory — that absence is the subject.

    const appPath = path.join(__dirname, '..', 'out', 'main', 'index.js')
    const launchEnv = { ...process.env }
    // WSL interop leak: inherited, Electron boots as plain Node (AGENTS.md).
    delete launchEnv.ELECTRON_RUN_AS_NODE

    const app = await electron.launch({
      args: [appPath, `--user-data-dir=${userDataDir}`],
      env: launchEnv
    })

    try {
      const window = await app.firstWindow()
      await window.waitForLoadState('domcontentloaded')
      await waitForWorkUI(window)
      await window
        .getByRole('button', { name: 'Pular tour' })
        .click({ timeout: 20_000 })
        .catch(() => {})
      await window
        .locator('.wb-tour')
        .waitFor({ state: 'hidden', timeout: 10_000 })
        .catch(() => {})

      // ── 1. Main says "no model", through the real bridge ─────────────────
      const readiness = await window.evaluate(() =>
        (
          globalThis as unknown as { hive: { asr: { readiness: () => Promise<unknown> } } }
        ).hive.asr.readiness()
      )
      expect((readiness as { installed: boolean }).installed).toBe(false)
      // The probe still has an opinion — it just decides a thread count now
      // rather than a model, and reading nothing at all is not the same as
      // reading a weak machine.
      expect(
        (readiness as { runtime: { threads: number } }).runtime.threads
      ).toBeGreaterThanOrEqual(1)
      // And the model it would fetch is named, with its cost, because that is
      // what the gate has to put in front of someone.
      expect((readiness as { model: { sizeMB: number } }).model.sizeMB).toBeGreaterThan(0)

      // ── 2. Count microphone opens, so "did it record?" is a fact ─────────
      await window.evaluate(() => {
        const scope = window as unknown as { __mediaOpens: number }
        scope.__mediaOpens = 0
        const devices = navigator.mediaDevices as MediaDevices | undefined
        const real = devices?.getUserMedia?.bind(devices)
        if (devices !== undefined) {
          devices.getUserMedia = (...args: [MediaStreamConstraints?]) => {
            scope.__mediaOpens += 1
            return real !== undefined
              ? real(...args)
              : Promise.reject(new Error('no media devices'))
          }
        }
      })

      const mic = window.getByRole('button', { name: 'Ditar' })
      await expect(mic).toBeVisible()
      await mic.click()

      // ── 3. A way in, not a take ──────────────────────────────────────────
      await expect(window.locator('.wb-vgate')).toBeVisible({ timeout: 15_000 })
      // No longer "escolha um modelo": there is one, so the dialog states the
      // cost and gets out of the way (M29).
      await expect(window.getByText('Baixe o modelo de voz para gravar')).toBeVisible()
      // The download it offers is a real one, with its real size on the button.
      await expect(window.locator('.wb-vgate .wb-vbtn-primary')).toContainText('671 MB')

      const opens = await window.evaluate(
        () => (window as unknown as { __mediaOpens: number }).__mediaOpens
      )
      expect(opens).toBe(0)
      // The transport is what a live take looks like; it is not on screen.
      // (The microphone button itself is not assertable here — the dialog is
      // modal, so Radix marks the rest of the page `aria-hidden`.)
      await expect(window.locator('.wb-dictation')).toHaveCount(0)

      // ── 4. The settings are one link away, and the link opens the sheet ──
      await window.getByRole('button', { name: 'Ver detalhes' }).click()
      await expect(window.getByText('Voz e transcrição')).toBeVisible({ timeout: 15_000 })
      // The same statement the gate made, now with the model's own facts.
      await expect(window.getByText('Parakeet TDT v3')).toBeVisible()
      await expect(window.getByText(/600 M de parâmetros/)).toBeVisible()
    } finally {
      await app.close()
      fs.rmSync(tmpRoot, { recursive: true, force: true })
    }
  })
})
