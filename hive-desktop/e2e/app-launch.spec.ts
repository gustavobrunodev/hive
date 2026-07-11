import { test, expect, _electron as electron } from '@playwright/test'
import path from 'node:path'

// T2 — E2E harness spike (design.md §8, tasks.md T2). Smoke-only: proves
// Playwright can drive the REAL built Electron app (main + preload + renderer
// + contextBridge) in this environment, not any particular feature.
//
// `window.hive.fs` does NOT exist yet at this point in the task sequence —
// checked src/preload/index.ts (T2 time): `hive` only exposes top-level
// `ping`/`chooseWorkspace`/`getWorkspace`/`isProvisioned`/`listTree`/
// `readFile`/`watchWorkspace` plus the `agent`/`workflows` namespaces. The
// nested `fs` namespace (design.md §3) is added later by T7. So this smoke
// asserts `window.hive` exists (and a couple of its current top-level
// methods) rather than `window.hive.fs`, per the task instructions — revisit
// this assertion once T7 lands and change it to `window.hive.fs`.
test('app launches and exposes the window.hive preload bridge', async () => {
  const appPath = path.join(__dirname, '..', 'out', 'main', 'index.js')

  // This dev box has ELECTRON_RUN_AS_NODE=1 set ambient in the shell (WSL2/
  // WSLENV interop with the host harness) — if inherited, the electron binary
  // runs the launched script as plain Node instead of the Electron main
  // process (electron.app is undefined, launch fails). Strip it here so the
  // test is self-contained and doesn't depend on the caller's shell env.
  // See playwright.config.ts header + STATE.md lessons for the full story.
  const launchEnv = { ...process.env }
  delete launchEnv.ELECTRON_RUN_AS_NODE

  const app = await electron.launch({ args: [appPath], env: launchEnv })
  try {
    const window = await app.firstWindow()
    await window.waitForLoadState('domcontentloaded')

    const title = await window.title()
    expect(title).toBeTruthy()

    const hiveShape = await window.evaluate(() => {
      const hive = (globalThis as unknown as { hive?: Record<string, unknown> }).hive
      return {
        hasHive: typeof hive !== 'undefined',
        hasFsNamespace: typeof hive?.fs !== 'undefined',
        hasListTree: typeof hive?.listTree === 'function'
      }
    })

    expect(hiveShape.hasHive).toBe(true)
    expect(hiveShape.hasListTree).toBe(true)
    // Documented, not asserted true: fs namespace lands in T7.
    expect(hiveShape.hasFsNamespace).toBe(false)
  } finally {
    await app.close()
  }
})
