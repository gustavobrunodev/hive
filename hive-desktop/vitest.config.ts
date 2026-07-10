import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/main/**/*.test.ts', 'src/preload/**/*.test.ts', 'src/renderer/src/**/*.test.ts'],
    // `*.e2e.test.ts` files hit real CLIs (network, npx resolution) and are
    // slow/non-deterministic — excluded from the fast default suite, run
    // separately via `npm run test:e2e` (vitest.e2e.config.ts). Task T20,
    // design.md §8 "one integration/E2E smoke ... gated in CI as it needs
    // the real CLIs".
    exclude: [...configDefaults.exclude, '**/*.e2e.test.ts']
  }
})
