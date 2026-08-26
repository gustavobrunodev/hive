import { test, expect, _electron as electron } from '@playwright/test'
import type { Page } from '@playwright/test'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'

// Voice Prompt (M13) E2E, VP-R7.3 — Playwright driving the real built Electron
// app. Same boot recipe as second-brain.spec.ts (STATE.md T2/T11 lessons:
// strip ELECTRON_RUN_AS_NODE, provision via the on-disk manifest marker, skip
// the guided tour before driving the UI).
//
// Scope note: the microphone and the transcriber are stand-ins, injected before
// app code runs (`src/renderer/src/dictation/e2eDictationSeam.ts`). That is not
// convenience — the T1 spike measured that under `xvfb-run` the audio graph's
// render quantum is driven by an output device and there is none, so a live
// AudioContext yields 1 tick in 2 s instead of 63 while reporting
// `state: 'running'`. Real audio cannot flow here, and a real Whisper pass
// would add a 278 MB download and ~4 s per run.
//
// What stays real, and is therefore what this spec uniquely proves: the built
// renderer under the production CSP, the real preload bridge, the real
// segmenter deciding where a phrase ends, the real serial queue, the real join
// and caret restoration, the real PromptInput overlay, and the real teardown.
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

/** Feeds the segmenter `ms` of audio at one level, through the stand-in. */
async function speak(window: Page, ms: number, rms: number): Promise<void> {
  await window.evaluate(
    ({ ms, rms }) => {
      const harness = (
        window as unknown as {
          __hiveDictationE2E?: {
            ticks?: ((tick: { rms: number; samples: Float32Array }) => void)[]
          }
        }
      ).__hiveDictationE2E
      for (let i = 0; i < Math.ceil(ms / 32); i += 1) {
        for (const listener of harness?.ticks ?? []) {
          listener({ rms, samples: new Float32Array(512).fill(rms) })
        }
      }
    },
    { ms, rms }
  )
}

test.describe('voice-prompt E2E (real Electron)', () => {
  test('dictating into the composer, and discarding a take', async () => {
    test.setTimeout(300_000)

    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hive-e2e-voice-'))
    const workspace = path.join(tmpRoot, 'ws')
    const userDataDir = path.join(tmpRoot, 'userData')
    fs.mkdirSync(workspace, { recursive: true })
    fs.mkdirSync(userDataDir, { recursive: true })

    fs.mkdirSync(path.join(workspace, '_bmad', '_config'), { recursive: true })
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

    // M26: the app ships no weights, and every recording surface now passes
    // through the model gate — so a userData with no model installed answers
    // the microphone with a download dialog and this spec never sees a take.
    // The marker alone is enough: `status()` reads only the marker, and the
    // transcriber here is the seam, which never opens a weight file. Acquiring
    // a model is `voice-model-gate.spec.ts`'s subject, not this one's.
    const modelDir = path.join(userDataDir, 'whisper-models', 'base')
    fs.mkdirSync(modelDir, { recursive: true })
    fs.writeFileSync(
      path.join(modelDir, '.hive-complete.json'),
      JSON.stringify({ variant: 'fp32', repo: 'Xenova/whisper-base' })
    )

    const appPath = path.join(__dirname, '..', 'out', 'main', 'index.js')
    const launchEnv = { ...process.env }
    // WSL interop leak: inherited, Electron boots as plain Node and the launch
    // fails with "Process failed to launch!" (AGENTS.md).
    delete launchEnv.ELECTRON_RUN_AS_NODE

    const app = await electron.launch({
      args: [appPath, `--user-data-dir=${userDataDir}`],
      env: launchEnv
    })

    try {
      const window = await app.firstWindow()
      // Armed before any app code runs, which is the only way the seam can be
      // set: the renderer is a sandboxed file:// page loading no remote content.
      await window.addInitScript(() => {
        ;(window as unknown as { __hiveDictationE2E: unknown }).__hiveDictationE2E = {
          transcript: 'arquivo de configuração'
        }
      })
      await window.reload()
      await window.waitForLoadState('domcontentloaded')

      // The production CSP is live; a refused load would surface here.
      const cspViolations: string[] = []
      window.on('console', (message) => {
        const text = message.text()
        if (/Content Security Policy|Refused to/i.test(text)) cspViolations.push(text)
      })

      await waitForWorkUI(window)
      await window
        .getByRole('button', { name: 'Pular tour' })
        .click({ timeout: 20_000 })
        .catch(() => {})
      await window
        .locator('.wb-tour')
        .waitFor({ state: 'hidden', timeout: 10_000 })
        .catch(() => {})

      const composer = window.locator('.hds-prompt-input textarea')
      await composer.waitFor({ state: 'visible', timeout: 30_000 })
      const mic = window.getByRole('button', { name: 'Ditar' })

      // ── 1. The mic control is quiet and unpressed (VP-R1.1) ──────────────
      await expect(mic).toBeVisible()
      await expect(mic).toHaveAttribute('aria-pressed', 'false')

      // ── 2. Enter dictation mode in place (VP-R1.2) ───────────────────────
      await composer.fill('revisa o ')
      const frameBefore = await window.locator('.hds-prompt-input').boundingBox()
      await mic.click()

      await expect(window.locator('.wb-dictation')).toBeVisible()
      await expect(window.locator('.hds-prompt-input')).toHaveAttribute('data-highlighted', 'true')
      // The transport replaced the toolbar cluster rather than joining it.
      await expect(window.getByRole('button', { name: 'Concluir' })).toBeVisible()
      await expect(window.getByRole('button', { name: 'Anexar arquivo' })).toHaveCount(0)
      // No layout shift: the frame is where it was (D-VP-7, VP-R1.2).
      const frameAfter = await window.locator('.hds-prompt-input').boundingBox()
      expect(frameAfter?.width).toBeCloseTo(frameBefore?.width ?? 0, 0)
      expect(frameAfter?.height).toBeCloseTo(frameBefore?.height ?? 0, 0)

      // ── 3. A phrase lands at the caret while capture continues ───────────
      await speak(window, 100, 0.002) // the room, seeding the noise floor
      await speak(window, 2500, 0.4) // speech
      await speak(window, 800, 0.002) // a real pause — the segment is cut

      await expect(composer).toHaveValue('revisa o arquivo de configuração', { timeout: 15_000 })
      // Still live: the words arrived without the take ending (D-VP-2).
      await expect(window.locator('.wb-dictation')).toBeVisible()

      // ── 4. Concluir returns the composer to normal, with the text kept ───
      await window.getByRole('button', { name: 'Concluir' }).click()
      await expect(window.locator('.wb-dictation')).toHaveCount(0)
      await expect(composer).toHaveValue('revisa o arquivo de configuração')
      await expect(window.locator('.hds-prompt-input')).not.toHaveAttribute(
        'data-highlighted',
        'true'
      )
      // The microphone was released on the way out (VP-R4.6).
      const stopsAfterFinish = await window.evaluate(
        () =>
          (window as unknown as { __hiveDictationE2E?: { stops?: number } }).__hiveDictationE2E
            ?.stops ?? 0
      )
      expect(stopsAfterFinish).toBeGreaterThan(0)

      // ── 5. Esc discards and rewinds the draft exactly (VP-R1.5, D-VP-9) ──
      await composer.fill('rascunho intacto')
      await mic.click()
      await expect(window.locator('.wb-dictation')).toBeVisible()
      await speak(window, 100, 0.002)
      await speak(window, 2500, 0.4)
      await speak(window, 800, 0.002)
      await expect(composer).toHaveValue('rascunho intacto arquivo de configuração', {
        timeout: 15_000
      })

      await composer.press('Escape')
      await expect(window.locator('.wb-dictation')).toHaveCount(0)
      await expect(composer).toHaveValue('rascunho intacto')

      expect(cspViolations).toEqual([])
    } finally {
      await app.close()
      fs.rmSync(tmpRoot, { recursive: true, force: true })
    }
  })
})
