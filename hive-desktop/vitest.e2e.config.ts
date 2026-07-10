import { defineConfig } from 'vitest/config'

// Real-CLI E2E smoke (task T20, design.md §8). Separate from vitest.config.ts
// so `npm run test` stays fast/deterministic; run this explicitly via
// `npm run test:e2e` before a release or when BMAD's real install behavior
// might have changed. Longer timeouts: `npx bmad-method install` does real
// package resolution + network I/O.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/main/**/*.e2e.test.ts'],
    testTimeout: 120_000,
    hookTimeout: 120_000
  }
})
