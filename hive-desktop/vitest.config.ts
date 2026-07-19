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
        'src/main/index.ts': { statements: 90, branches: 90, functions: 90, lines: 90 },
        // T10 regression pass: pt-BR.ts and icons.tsx are also touched by
        // this feature (T8/T9 added file-management copy/icons to them) and
        // design.md's coverage note calls for 90/90/90/90 on every touched
        // file — T1 missed these two. `preload/index.d.ts` (types only, no
        // runtime) and `assets/workbench.css` (not JS/TS) aren't
        // instrumentable by v8 coverage, so they have no glob here.
        'src/renderer/src/i18n/pt-BR.ts': {
          statements: 90,
          branches: 90,
          functions: 90,
          lines: 90
        },
        'src/renderer/src/ui/icons.tsx': { statements: 90, branches: 90, functions: 90, lines: 90 },
        // T13 (explorer-editor-ux, M7): new/changed files from this feature.
        // `src/renderer/src/explorer/**` above already covers Explorer.tsx
        // (T1/T5-T10) and the new HtmlPreview.tsx (T4); `src/main/index.ts`
        // and `src/preload/index.ts` above already cover T3's openExternal
        // handler/bridge. Tree.tsx (T2) lives in design-system, a separate
        // package with its own coverage gate (global 90% threshold over all
        // src/**/*.{ts,tsx}) — no entry needed here.
        'src/renderer/src/ui/markdown.tsx': {
          statements: 90,
          branches: 90,
          functions: 90,
          lines: 90
        },
        'src/renderer/src/WorkUI.tsx': { statements: 90, branches: 90, functions: 90, lines: 90 },
        'src/renderer/src/chat/Chat.tsx': {
          statements: 90,
          branches: 90,
          functions: 90,
          lines: 90
        },
        // shortcut-customization: files this feature added/touched.
        'src/main/workflowCatalog.ts': { statements: 90, branches: 90, functions: 90, lines: 90 },
        'src/main/configStore.ts': { statements: 90, branches: 90, functions: 90, lines: 90 },
        'src/main/roleCatalog.ts': { statements: 90, branches: 90, functions: 90, lines: 90 },
        'src/renderer/src/ui/roleVisuals.ts': {
          statements: 90,
          branches: 90,
          functions: 90,
          lines: 90
        },
        'src/renderer/src/ui/ShortcutCustomizer.tsx': {
          statements: 90,
          branches: 90,
          functions: 90,
          lines: 90
        },
        'src/renderer/src/chat/IntentGrid.tsx': {
          statements: 90,
          branches: 90,
          functions: 90,
          lines: 90
        },
        'src/renderer/src/ui/shortcutSearch.ts': {
          statements: 90,
          branches: 90,
          functions: 90,
          lines: 90
        },
        // mcp: the MCP-server module's logic files. The service (parallel to
        // the gated fsService) and the pure form helpers are held to the full
        // bar; the presentational `McpManager.tsx` follows its sibling
        // `SkillStudio.tsx` (also ungated) — it's covered by McpManager.test
        // at ~99% statements/lines, but its many tiny render-callback arrows
        // make a 90% *function* gate noise, not signal.
        'src/main/mcpService.ts': { statements: 90, branches: 90, functions: 90, lines: 90 },
        'src/renderer/src/ui/mcpForm.ts': { statements: 90, branches: 90, functions: 90, lines: 90 }
      }
    }
  }
})
