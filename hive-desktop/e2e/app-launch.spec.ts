import { test, expect, _electron as electron } from '@playwright/test'
import path from 'node:path'

// T2 — E2E harness spike (design.md §8, tasks.md T2). Smoke-only: proves
// Playwright can drive the REAL built Electron app (main + preload + renderer
// + contextBridge) in this environment, not any particular feature.
//
// At T2 time `window.hive.fs` did not exist yet — checked src/preload/
// index.ts then: `hive` only exposed top-level `ping`/`chooseWorkspace`/
// `getWorkspace`/`isProvisioned`/`listTree`/`readFile`/`watchWorkspace` plus
// the `agent`/`workflows` namespaces. T7 has since added the nested `fs`
// namespace (design.md §3), so the assertion below now checks for its
// presence — this smoke stays otherwise unchanged (still just proving the
// bridge exists, not exercising any fs method).
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
    // T7 has since landed (this spike originally predated it and asserted
    // `false` here, documenting the not-yet-built state at T2 time) — the
    // nested `fs` namespace is now part of the preload bridge (T11).
    expect(hiveShape.hasFsNamespace).toBe(true)
  } finally {
    await app.close()
  }
})
