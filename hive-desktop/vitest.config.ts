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
    exclude: [...configDefaults.exclude, '**/*.e2e.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      // Global thresholds stay low/off — this feature (file-management)
      // enforces coverage per-file only on the files it touches; the rest
      // of the codebase isn't held to this gate yet. T1, FM-R8.2.
      thresholds: {
        statements: 0,
        branches: 0,
        functions: 0,
        lines: 0,
        perFile: true,
        'src/main/fsService.ts': { statements: 90, branches: 90, functions: 90, lines: 90 },
        'src/preload/index.ts': { statements: 90, branches: 90, functions: 90, lines: 90 },
        'src/renderer/src/explorer/**': { statements: 90, branches: 90, functions: 90, lines: 90 },
        'src/main/index.ts': { statements: 90, branches: 90, functions: 90, lines: 90 }
      }
    }
  }
})
