import { test, expect, _electron as electron } from '@playwright/test'
import type { Page } from '@playwright/test'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'

/**
 * design-studio T3.8 — the zero-network proof (R-1, AD-5).
 *
 * This is the test that catches the failure nobody would see. Phase 2 measured
 * that `wa-icon` resolves every icon through `fetch()` against a Font Awesome
 * CDN, and the whole icon mitigation (T2.6) plus the CSP (T3.2) exist to stop
 * that. Both of those are things you can read and believe; neither is something
 * you can see. An icon that quietly reaches the network looks *identical* to
 * one that resolved locally — until the user is offline, or opens an exported
 * Bundle on a machine that never had the CDN.
 *
 * So the assertion is made against real traffic, from the real built app, with
 * the real production CSP: while the Preview renders a Screen containing an
 * icon, **no request leaves `hive-studio:`**. And because "zero requests"
 * would also be true of a frame that rendered nothing at all, the spec first
 * proves the icon actually resolved.
 *
 * Boot recipe follows the other real-Electron specs (STATE.md T2/T11 lessons:
 * strip ELECTRON_RUN_AS_NODE, provision via the on-disk manifest marker, skip
 * the guided tour before driving the UI).
 */

const NONCE_IN_URL = /hive-studio:\/\/preview\/([0-9a-f]{64})\/index\.html/

/** The Screen the Preview renders: a card, a button, and an icon inside it. */
const SCREEN = {
  screenId: 'e2e',
  root: {
    id: 'n1',
    tag: 'wa-card',
    props: { appearance: 'outlined' },
    children: [
      {
        id: 'n2',
        tag: 'wa-button',
        props: { variant: 'brand' },
        children: [
          {
            id: 'n3',
            tag: 'wa-icon',
            slot: 'start',
            props: { name: 'right-to-bracket' },
            children: []
          }
        ]
      }
    ]
  }
}

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

test.describe('design-studio Preview E2E (real Electron)', () => {
  test('the Preview renders with icons and emits no request outside hive-studio:', async () => {
    test.setTimeout(300_000)

    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hive-e2e-studio-'))
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

      // The production CSP refusing the frame, the bundle or an icon would
      // surface here rather than as a silently empty Preview.
      const cspViolations: string[] = []
      window.on('console', (message) => {
        const text = message.text()
        if (/Content Security Policy|Refused to/i.test(text)) cspViolations.push(text)
      })

      await waitForWorkUI(window)
      await window
        .getByRole('button', { name: 'Pular tour' })
        .click({ timeout: 20_000 })
        .catch(() => undefined)

      // Everything the page (and every subframe of it) asks for from here on.
      const requests: string[] = []
      window.on('request', (request) => requests.push(request.url()))

      const previewUrl = await window.evaluate(async () => {
        const hive = (
          globalThis as unknown as { hive: { designStudio: { openPreview(): Promise<string> } } }
        ).hive
        const url = await hive.designStudio.openPreview()
        const frame = document.createElement('iframe')
        frame.id = 'e2e-preview'
        // The isolation under test: scripts, but no same-origin (AC-1).
        frame.setAttribute('sandbox', 'allow-scripts')
        frame.style.cssText = 'position:fixed;left:0;bottom:0;width:600px;height:400px;z-index:9999'
        frame.src = url
        document.body.appendChild(frame)
        return url
      })

      expect(previewUrl).toMatch(NONCE_IN_URL)
      const nonce = NONCE_IN_URL.exec(previewUrl)![1]

      const preview = await window.waitForSelector('#e2e-preview')
      const previewFrame = await preview.contentFrame()
      expect(previewFrame).not.toBeNull()

      // The receiver announces itself, then the Screen goes in. Posting on a
      // poll rather than once: the frame's modules load asynchronously, and a
      // `render` that arrives before the receiver is listening is dropped.
      await expect
        .poll(
          async () => {
            await window.evaluate(
              ({ document: screen, nonce: sessionNonce }) => {
                const frame = document.getElementById('e2e-preview') as HTMLIFrameElement
                frame.contentWindow?.postMessage(
                  { type: 'render', nonce: sessionNonce, document: screen },
                  '*'
                )
              },
              { document: SCREEN, nonce }
            )
            return previewFrame!.evaluate(
              () => document.querySelector('#hive-stage')?.children.length ?? 0
            )
          },
          { timeout: 30_000, intervals: [250] }
        )
        .toBeGreaterThan(0)

      // The custom elements really upgraded — otherwise the tags below are
      // inert markup and the icon assertion would be meaningless.
      await expect
        .poll(
          () =>
            previewFrame!.evaluate(
              () => !!document.querySelector('wa-button')?.shadowRoot?.querySelector('slot')
            ),
          { timeout: 30_000, intervals: [250] }
        )
        .toBe(true)

      // R-1, the point of the whole exercise: the icon resolved to real SVG
      // from the embedded library, under `connect-src data:` (D-DS-4). With
      // `'none'`, or without T2.6, this stays false forever and every icon in
      // the product is quietly blank.
      await expect
        .poll(
          () =>
            previewFrame!.evaluate(
              () => !!document.querySelector('wa-icon')?.shadowRoot?.querySelector('svg')
            ),
          { timeout: 30_000, intervals: [250] }
        )
        .toBe(true)

      // The proof. Anything the frame fetched is in `requests`; a CDN call for
      // an icon, a webfont, or a stylesheet would be a non-hive-studio entry.
      console.log(
        '[T3.8] observed requests:',
        requests.length,
        JSON.stringify([...new Set(requests)], null, 1)
      )
      const foreign = requests.filter((url) => !url.startsWith('hive-studio://'))
      expect(foreign, `requests outside hive-studio: ${foreign.join(', ')}`).toEqual([])
      expect(
        requests.length,
        'no requests observed at all — the network probe itself is not working'
      ).toBeGreaterThan(0)
      expect(requests.some((url) => url.includes('fontawesome'))).toBe(false)

      expect(cspViolations, cspViolations.join('\n')).toEqual([])
    } finally {
      await app.close()
      fs.rmSync(tmpRoot, { recursive: true, force: true })
    }
  })
})
