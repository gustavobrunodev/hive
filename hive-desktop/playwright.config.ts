import { defineConfig } from '@playwright/test'

// E2E harness spike (T2, design.md §8 risk: "Playwright + Electron in
// WSL2/xvfb"). Drives the REAL built Electron app via `_electron.launch`
// (out/main/index.js) — separate from vitest.config.ts (component/unit) and
// vitest.e2e.config.ts (real-CLI node smoke, T20). Run with:
//   npm run build && xvfb-run -a npm run test:e2e:app
// `xvfb-run -a` is required in this WSL2 dev environment — no real display
// server, same as the other Electron smokes in this repo. Each spec is also
// responsible for stripping ELECTRON_RUN_AS_NODE from the launched process's
// env (see e2e/app-launch.spec.ts) — see STATE.md lessons for why.
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  retries: 0,
  reporter: 'list',
  workers: 1
})
