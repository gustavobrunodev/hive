import { test, expect, _electron as electron } from '@playwright/test'
import type { Page } from '@playwright/test'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'

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
  const rail = window.locator('.wb-rail')
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
        lastEffort: null
      })
    )
    // Deliberately NO `whisper-models/` directory — that absence is the subject.

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
      const preference = await window.evaluate(() =>
        (
          globalThis as unknown as { hive: { whisper: { preference: () => Promise<unknown> } } }
        ).hive.whisper.preference()
      )
      expect((preference as { id: string | null }).id).toBeNull()
      // The probe still has an opinion — a recommendation is not an install,
      // and conflating the two is what put a microphone on a machine that
      // could not transcribe.
      expect(
        (preference as { recommendation: { recommendedId: string } }).recommendation.recommendedId
      ).toBeTruthy()

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
      await expect(window.getByText('Escolha um modelo para gravar')).toBeVisible()
      // The download it offers is a real one, sized for this machine.
      await expect(window.locator('.wb-vgate .wb-vbtn-primary')).toBeVisible()

      const opens = await window.evaluate(
        () => (window as unknown as { __mediaOpens: number }).__mediaOpens
      )
      expect(opens).toBe(0)
      // The transport is what a live take looks like; it is not on screen.
      // (The microphone button itself is not assertable here — the dialog is
      // modal, so Radix marks the rest of the page `aria-hidden`.)
      await expect(window.locator('.wb-dictation')).toHaveCount(0)

      // ── 4. The full library is one link away, and it opens the sheet ─────
      await window.getByRole('button', { name: 'Ver todos os modelos' }).click()
      await expect(window.getByText('Voz e transcrição')).toBeVisible({ timeout: 15_000 })
      await expect(window.getByText('Nenhum modelo de voz ainda')).toBeVisible()
    } finally {
      await app.close()
      fs.rmSync(tmpRoot, { recursive: true, force: true })
    }
  })
})
