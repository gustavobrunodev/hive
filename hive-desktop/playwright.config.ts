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
// B-2 (test-design-architecture.md): a failing E2E used to leave no trace —
// no trace/screenshot/video, `retries: 0`, and a CI upload pointing at
// `playwright-report/`, a directory the `list` reporter never creates. That is
// the mechanism by which four red specs stayed invisible. Everything below is
// diagnostics; none of it changes what the tests assert.
const isCI = !!process.env.CI

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  // One retry in CI only — locally a retry hides the flake you are debugging.
  retries: isCI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  workers: 1,
  // Artifacts land here; the CI job uploads both this and playwright-report/.
  outputDir: 'test-results',
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  }
})
