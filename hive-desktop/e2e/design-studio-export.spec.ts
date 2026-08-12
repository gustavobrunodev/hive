import { test, expect, _electron as electron } from '@playwright/test'
import type { ElectronApplication, Frame, Page } from '@playwright/test'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'
import { exportScreen } from '../src/main/designStudio/exportBundle'
import {
  createWebAwesomeAdapter,
  loadWebAwesomeAssets,
  loadWebAwesomeCatalog
} from '../src/main/designStudio/dsAdapter/webAwesomeAdapter'
import type { ScreenDocument } from '../src/main/designStudio/types'

/**
 * design-studio T7.2 — the Bundle opens offline and renders what the Preview
 * rendered (DS-R14 AC-1/6, D-DS-1).
 *
 * The export is the artifact the user hands to somebody else, on a machine we
 * will never see. Two things can be wrong with it in ways that are invisible
 * here and obvious there: a request it makes that our dev box happens to be
 * able to answer (the Font Awesome CDN — R-1/D-DS-8), and a divergence from the
 * Preview the user approved. Reading the file proves neither.
 *
 * So this spec opens the real file in a real window with **every non-`file:`
 * request aborted**, and compares the rendered stage against the same Screen in
 * the live Preview, pixel by pixel. The icon assertion comes first: a blank page
 * would also make zero requests.
 */

const NONCE_IN_URL = /hive-studio:\/\/preview\/([0-9a-f]{64})\/index\.html/

/** Wide enough to lay out, small enough that a diff is not a wall of pixels. */
const STAGE_WIDTH = 800
const STAGE_HEIGHT = 600

/** A card, a button, and an icon — the icon is the whole reason for the exercise. */
const SCREEN: ScreenDocument = {
  screenId: 'login',
  title: 'Login',
  root: {
    id: 'n1',
    tag: 'wa-card',
    props: { appearance: 'outlined' },
    children: [
      {
        id: 'n2',
        tag: 'wa-button',
        props: { variant: 'brand', size: 'large' },
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

function seedUserData(root: string): { workspace: string; userDataDir: string } {
  const workspace = path.join(root, 'ws')
  const userDataDir = path.join(root, 'userData')
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
  return { workspace, userDataDir }
}

/** The exported Screen, painted in its own window with the network cut. */
async function openExportOffline(
  app: ElectronApplication,
  file: string
): Promise<{ page: Page; requests: string[] }> {
  const before = app.windows().length
  // `about:blank` first, on purpose: the window has to exist as a page before
  // the request probe and the route can be attached, and attaching them after
  // `loadFile` would be attaching them after the very requests under test.
  await app.evaluate(
    async ({ BrowserWindow }, size) => {
      const win = new BrowserWindow({
        width: size.width,
        height: size.height,
        useContentSize: true,
        show: true,
        webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false }
      })
      ;(globalThis as unknown as { __exportWindow: unknown }).__exportWindow = win
      await win.loadURL('about:blank')
    },
    { width: STAGE_WIDTH, height: STAGE_HEIGHT }
  )
  await expect.poll(() => app.windows().length, { timeout: 30_000 }).toBeGreaterThan(before)
  const page = app.windows()[app.windows().length - 1]

  const requests: string[] = []
  page.on('request', (request) => requests.push(request.url()))
  // The offline part, and it is real interception rather than a promise: any
  // scheme that could reach a server never leaves the process.
  await page.route('**/*', async (route) => {
    if (route.request().url().startsWith('file:')) await route.continue()
    else await route.abort()
  })

  await app.evaluate(async (_electronApi, target) => {
    const win = (
      globalThis as unknown as { __exportWindow: { loadFile(file: string): Promise<void> } }
    ).__exportWindow
    await win.loadFile(target)
  }, file)
  await page.waitForLoadState('domcontentloaded')
  return { page, requests }
}

/** The stage as a data URL, from either a Page or a Frame — both can find it. */
async function stageShot(host: Page | Frame): Promise<string> {
  const element = await host.waitForSelector('#hive-stage')
  return `data:image/png;base64,${(await element.screenshot()).toString('base64')}`
}

test.describe('design-studio Export E2E (real Electron)', () => {
  test('the exported Bundle opens with the network off and matches the Preview', async () => {
    test.setTimeout(300_000)

    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hive-e2e-export-'))
    const { userDataDir } = seedUserData(tmpRoot)
    const outDir = path.join(tmpRoot, 'bundles')

    // The Bundle itself, produced by the very code the app runs (T7.1/T7.2).
    const resourcesRoot = path.join(__dirname, '..', 'resources')
    const adapter = createWebAwesomeAdapter(loadWebAwesomeCatalog(resourcesRoot), () =>
      loadWebAwesomeAssets(resourcesRoot)
    )
    const exported = exportScreen(adapter, SCREEN, outDir)
    expect(fs.readdirSync(outDir)).toEqual(['login.html'])

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
      await waitForWorkUI(window)
      await window
        .getByRole('button', { name: 'Pular tour' })
        .click({ timeout: 20_000 })
        .catch(() => undefined)

      // ---- the live Preview, same Screen ----
      const previewUrl = await window.evaluate(
        async (size) => {
          const hive = (
            globalThis as unknown as { hive: { designStudio: { openPreview(): Promise<string> } } }
          ).hive
          const url = await hive.designStudio.openPreview()
          const frame = document.createElement('iframe')
          frame.id = 'e2e-preview'
          frame.setAttribute('sandbox', 'allow-scripts')
          frame.style.cssText =
            `position:fixed;left:0;top:0;border:0;z-index:9999;background:#fff;` +
            `width:${size.width}px;height:${size.height}px`
          frame.src = url
          document.body.appendChild(frame)
          return url
        },
        { width: STAGE_WIDTH, height: STAGE_HEIGHT }
      )
      const nonce = NONCE_IN_URL.exec(previewUrl)![1]

      const previewHandle = await window.waitForSelector('#e2e-preview')
      const previewFrame = (await previewHandle.contentFrame())!

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
            return previewFrame.evaluate(
              () => !!document.querySelector('wa-icon')?.shadowRoot?.querySelector('svg')
            )
          },
          { timeout: 60_000, intervals: [250] }
        )
        .toBe(true)

      // ---- the exported file, offline ----
      const { page: exportPage, requests } = await openExportOffline(app, exported.file)

      // DS-R14 AC-1/6 and D-DS-8 in one assertion: the icon resolved with every
      // non-file request aborted, so it came from the embedded library. Without
      // T2.6 this never becomes true, and every icon in every Bundle is blank.
      await expect
        .poll(
          () =>
            exportPage.evaluate(
              () => !!document.querySelector('wa-icon')?.shadowRoot?.querySelector('svg')
            ),
          { timeout: 60_000, intervals: [250] }
        )
        .toBe(true)
      expect(
        await exportPage.evaluate(
          () => !!document.querySelector('wa-button')?.shadowRoot?.querySelector('slot')
        )
      ).toBe(true)

      const foreign = requests.filter((url) => !url.startsWith('file:'))
      expect(foreign, `the Bundle asked for something off disk: ${foreign.join(', ')}`).toEqual([])
      expect(
        requests.length,
        'no request observed at all — the probe itself is not working'
      ).toBeGreaterThan(0)

      // ---- the two pictures ----
      const previewShot = await stageShot(previewFrame)
      const exportShot = await stageShot(exportPage)

      const diff = await window.evaluate(
        async ([a, b]: string[]) => {
          const load = (src: string): Promise<HTMLImageElement> =>
            new Promise((resolve, reject) => {
              const image = new Image()
              image.onload = () => resolve(image)
              image.onerror = () => reject(new Error('decode failed'))
              image.src = src
            })
          const [first, second] = await Promise.all([load(a), load(b)])
          if (first.width !== second.width || first.height !== second.height) {
            return {
              size: `${first.width}x${first.height} vs ${second.width}x${second.height}`,
              ratio: 1
            }
          }
          const pixels = (image: HTMLImageElement): Uint8ClampedArray => {
            const canvas = document.createElement('canvas')
            canvas.width = image.width
            canvas.height = image.height
            const context = canvas.getContext('2d')!
            context.drawImage(image, 0, 0)
            return context.getImageData(0, 0, image.width, image.height).data
          }
          const [left, right] = [pixels(first), pixels(second)]
          let differing = 0
          for (let index = 0; index < left.length; index += 4) {
            const delta =
              Math.abs(left[index] - right[index]) +
              Math.abs(left[index + 1] - right[index + 1]) +
              Math.abs(left[index + 2] - right[index + 2])
            if (delta > 12) differing++
          }
          return {
            size: `${first.width}x${first.height}`,
            ratio: differing / (left.length / 4)
          }
        },
        [previewShot, exportShot]
      )

      console.log('[T7.2] stage diff:', JSON.stringify(diff))
      // Same size, and not one pixel differing beyond the `delta > 12` band
      // above — which is where the antialiasing of two compositors lives, and
      // is the only tolerance in play. Measured 0 on every run; the exact-zero
      // assertion is deliberate, because spec.md and the M18 exit criteria
      // claim a pixel-exact Bundle, and a `< 1%` gate would let the docs claim
      // more than the test enforces. Anything structural — a missing icon, an
      // unstyled component, a dropped prop — moves this by whole percent.
      expect(diff.size).not.toContain('vs')
      expect(diff.ratio).toBe(0)
    } finally {
      await app.close()
      fs.rmSync(tmpRoot, { recursive: true, force: true })
    }
  })
})
