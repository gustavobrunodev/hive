import { coverageConfigDefaults, configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  // npm-distribution T11: `@hive/design-system` is a `file:../design-system`
  // link that ships its own `node_modules/react`(-dom) — a *different
  // physical copy* than this package's own react. Rendering a real (not
  // `vi.mock`'d) DS component that itself calls a hook (e.g. Toast's
  // `ToastProvider`, which `UpdateNotice.tsx` composes directly per
  // design.md §5.1) then throws "invalid hook call" — the DS component's
  // `useState` runs against a React module instance that never rendered the
  // tree. `electron.vite.config.ts` already carries the identical fix for the
  // real app bundle; vitest has its own separate config/resolution, so it
  // needs the same `dedupe` here.
  resolve: {
    dedupe: ['react', 'react-dom']
  },
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
      // agent-change-review (M11): the two large shell components live under
      // `scm/` and would otherwise be caught by the `src/renderer/src/scm/**`
      // 90/90/90/90 glob below. They follow the `SkillStudio`/`McpManager`
      // precedent (presentational shells, ungated) — excluded from coverage
      // collection so the directory glob only gates the module's logic files
      // (`useReview.ts`, `inlineDiff.ts`). Their behavior is still exercised by
      // their `.test.tsx` siblings; only the numeric gate is lifted. T1, R9.2.
      exclude: [
        ...coverageConfigDefaults.exclude,
        // P0-011 / R-04 (test-design-architecture.md). The global number was an
        // artifact of the denominator, not a measure of this codebase: the
        // report instrumented the BUILD OUTPUT. Measured 2026-07-30 —
        // out/renderer/assets/transformers.web-*.js (33,521 statements),
        // out/renderer/assets/index-*.js (32,760), out/renderer/assets/pdf-*.js
        // (27,417), out/main/index.js (4,820), out/preload/index.js (579) — all
        // at 0%, together ~98.5k of 120,430 total statements. That is what
        // produced a "16.31%" global. Bundled vendor output is not source and
        // was never going to be tested; measuring it just measured bundle size.
        // Sanitising this is a precondition for any aggregate target meaning
        // anything, which is why it lands before the per-file cleanup.
        'out/**',
        'dist/**',
        'dist-npm/**',
        'scripts/**',
        'e2e/**',
        '*.config.ts',
        '*.config.mjs',
        'src/renderer/src/scm/AgentReviewPanel.tsx',
        'src/renderer/src/scm/InlineAgentDiff.tsx'
      ],
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
        // The shortcut strip's overflow affordances. Its whole job is a state
        // machine over measurements the eye can't check (which edge is hiding
        // something, how far one press moves), so it carries the full bar.
        'src/renderer/src/ui/ScrollableRow.tsx': {
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
        'src/renderer/src/ui/mcpForm.ts': {
          statements: 90,
          branches: 90,
          functions: 90,
          lines: 90
        },
        // npm-distribution: main-process discovery/download/apply modules (T3/T4/T5).
        'src/main/npmRegistry.ts': { statements: 90, branches: 90, functions: 90, lines: 90 },
        'src/main/updateDownload.ts': { statements: 90, branches: 90, functions: 90, lines: 90 },
        'src/main/updateApply.ts': { statements: 90, branches: 90, functions: 90, lines: 90 },
        // npm-distribution Phase 4 (D21 pivot) T20: GitHub Releases payload
        // resolution, replacing npmRegistry.ts's retired fetchPayload.
        'src/main/githubReleases.ts': { statements: 90, branches: 90, functions: 90, lines: 90 },
        // npm-distribution T6: the rewired update state machine + its real
        // fetch-based RegistryClient/Downloader implementations.
        'src/main/updateService.ts': { statements: 90, branches: 90, functions: 90, lines: 90 },
        // npm-distribution T11: the Tier 2 announcement toast (design.md §5).
        'src/renderer/src/ui/UpdateNotice.tsx': {
          statements: 90,
          branches: 90,
          functions: 90,
          lines: 90
        },
        // npm-distribution T11: the shared event -> renderer-state reducer
        // (split out of UpdateNotice.tsx by the react-refresh lint rule;
        // UpdateCenter, T13, reuses it too).
        'src/renderer/src/ui/updateFlow.ts': {
          statements: 90,
          branches: 90,
          functions: 90,
          lines: 90
        },
        // npm-distribution T12: the rail's ambient update dot — this file's
        // first dedicated test file (previously only exercised indirectly
        // through WorkUI.test.ts).
        'src/renderer/src/ui/ActionRail.tsx': {
          statements: 90,
          branches: 90,
          functions: 90,
          lines: 90
        },
        // npm-distribution T13: UpdateCenter, the redesigned AppSettingsSheet
        // (design.md §5 Tier 3).
        'src/renderer/src/ui/UpdateCenter.tsx': {
          statements: 90,
          branches: 90,
          functions: 90,
          lines: 90
        },
        // npm-distribution T14: the shared update-flow hook — launch/periodic
        // checks, skip suppression, and the Tier 1 dot's pending derivation.
        'src/renderer/src/ui/useUpdateFlow.ts': {
          statements: 90,
          branches: 90,
          functions: 90,
          lines: 90
        },
        // git-management (M10): the new source-control surfaces. The main-side
        // service + pure parsers, the whole `scm/` renderer module (panel,
        // store hook, status/color helpers), and the three app-local UI
        // components (`DiffView`, `StatusBar`, `SidebarHost`). `main/index.ts`
        // and `preload/index.ts` already carry the full-bar gate above, so the
        // new `git:*` handlers/bridge are covered by their existing entries.
        'src/main/gitService.ts': { statements: 90, branches: 90, functions: 90, lines: 90 },
        'src/main/gitParse.ts': { statements: 90, branches: 90, functions: 90, lines: 90 },
        // `scm/**` covers gitStatus/useGit/ChangeGroups/…/gutter/useGutter etc.
        'src/renderer/src/scm/**': { statements: 90, branches: 90, functions: 90, lines: 90 },
        'src/renderer/src/ui/DiffView.tsx': {
          statements: 90,
          branches: 90,
          functions: 90,
          lines: 90
        },
        'src/renderer/src/ui/StatusBar.tsx': {
          statements: 90,
          branches: 90,
          functions: 90,
          lines: 90
        },
        'src/renderer/src/ui/SidebarHost.tsx': {
          statements: 90,
          branches: 90,
          functions: 90,
          lines: 90
        },
        'src/renderer/src/ui/ConflictView.tsx': {
          statements: 90,
          branches: 90,
          functions: 90,
          lines: 90
        },
        'src/renderer/src/ui/GitOpToast.tsx': {
          statements: 90,
          branches: 90,
          functions: 90,
          lines: 90
        },
        'src/renderer/src/ui/UnsavedGuardDialog.tsx': {
          statements: 90,
          branches: 90,
          functions: 90,
          lines: 90
        },
        // agent-change-review (M11): the shadow-git snapshot engine + the
        // pending-set/decision service (main), and the ✓/✗ per-hunk control
        // (renderer). `gitParse.ts` (hunk-id + patch builder, T3) and the whole
        // `scm/**` module (`useReview.ts`, `inlineDiff.ts`, T8/T13) are already
        // gated above; `main/index.ts`/`preload/index.ts` cover the new
        // `review:*` handlers/bridge (T6/T7). The larger renderer shells
        // (`AgentReviewPanel`, `InlineAgentDiff`, `ChangeCard`, `ReviewBar`)
        // follow the `SkillStudio`/`McpManager` precedent (ungated). T1, R9.2.
        'src/main/checkpointService.ts': {
          statements: 90,
          branches: 90,
          functions: 90,
          lines: 90
        },
        'src/main/reviewService.ts': { statements: 90, branches: 90, functions: 90, lines: 90 },
        // harness (P3): the contrast probe behind docs/visual-validation.md.
        'src/renderer/src/ui/contrast.ts': {
          statements: 90,
          branches: 90,
          functions: 90,
          lines: 90
        },
        'src/renderer/src/ui/HunkActions.tsx': {
          statements: 90,
          branches: 90,
          functions: 90,
          lines: 90
        },
        // R-06/P0-003: the scripted-agent seam. It decides which binary the app
        // executes, so it is held to the full bar like its B-1 sibling.
        'src/main/e2eAgentSeam.ts': { statements: 90, branches: 90, functions: 90, lines: 90 },
        // P1-004/P1-010/P1-011/P1-013/P1-024 (R-03, R-15): the surfaces that had
        // no co-located test. Onboarding was the weakest module in the project
        // (F 72.7 / B 80.6) and it is the first thing a user touches; the agent
        // picker/switcher, the profile sheet and the Ctrl+P palette are the rest
        // of the untested set — `FileSearchDialog` did not even appear in the
        // coverage report, because nothing loaded it. Gated now so they cannot
        // drift back.
        'src/renderer/src/onboarding/**': {
          statements: 90,
          branches: 90,
          functions: 90,
          lines: 90
        },
        'src/renderer/src/ui/AgentPicker.tsx': {
          statements: 90,
          branches: 90,
          functions: 90,
          lines: 90
        },
        'src/renderer/src/ui/AgentSwitcher.tsx': {
          statements: 90,
          branches: 90,
          functions: 90,
          lines: 90
        },
        'src/renderer/src/ui/ChoiceCard.tsx': {
          statements: 90,
          branches: 90,
          functions: 90,
          lines: 90
        },
        'src/renderer/src/ui/ProfileSheet.tsx': {
          statements: 90,
          branches: 90,
          functions: 90,
          lines: 90
        },
        'src/renderer/src/ui/FileSearchDialog.tsx': {
          statements: 90,
          branches: 90,
          functions: 90,
          lines: 90
        },
        // agent-activity + agent-approvals: the logic files this work added.
        // `approvalService.ts` is the permission bridge (a blocked turn hangs
        // on it, so it is held to the full bar); `toolActivity.ts` is the pure
        // activity reducer. The two presentational components
        // (`ToolActivityFeed.tsx`, `ApprovalCard.tsx`) are exercised through
        // Chat.test and follow the ungated `SkillStudio.tsx` precedent — their
        // many tiny render-callback arrows make a 90% *function* gate noise,
        // not signal. `useSmoothStream.ts` is rAF-driven presentation with no
        // branch worth gating; its grapheme handling is covered by its own test.
        'src/main/approvalService.ts': { statements: 90, branches: 90, functions: 90, lines: 90 },
        // chat-timing / chat-queue / session-usage: the three pure modules
        // behind the execution readouts, the send queue and the context meter.
        // Each is a decision table whose failure modes are all silent —
        // durations that lie, a queue that fires into the wrong conversation,
        // token snapshots summed into a number four times too large — so they
        // carry the full bar. Their components (`TurnMeter.tsx`,
        // `QueuedMessages.tsx`, `ContextMeter.tsx`) are exercised through
        // Chat.test, following the `ToolActivityFeed.tsx` precedent above.
        'src/renderer/src/chat/turnTiming.ts': {
          statements: 90,
          branches: 90,
          functions: 90,
          lines: 90
        },
        'src/renderer/src/chat/sessionUsage.ts': {
          statements: 90,
          branches: 90,
          functions: 90,
          lines: 90
        },
        'src/renderer/src/chat/messageQueue.ts': {
          statements: 90,
          branches: 90,
          functions: 90,
          lines: 90
        },
        'src/renderer/src/chat/toolActivity.ts': {
          statements: 90,
          branches: 90,
          functions: 90,
          lines: 90
        },
        // brand-identity + third theme + provisioning gate. `theme.ts` is the
        // theme vocabulary (persistence, the guard that rejects a value an
        // older build wrote, and the swatch table the picker paints from);
        // `ThemePicker.tsx` and `ProvisionScene.tsx` are small enough that the
        // full bar is signal rather than noise, and the gate screens are the
        // one surface where a regression is invisible until a first run.
        // `HiveHoneycomb.tsx` earns it too: its geometry is arithmetic no
        // screenshot review reliably catches (the first cut scaled a unit hex
        // and turned every hairline into a slab).
        'src/renderer/src/ui/theme.ts': { statements: 90, branches: 90, functions: 90, lines: 90 },
        'src/renderer/src/ui/ThemePicker.tsx': {
          statements: 90,
          branches: 90,
          functions: 90,
          lines: 90
        },
        'src/renderer/src/ui/HiveLogo.tsx': {
          statements: 90,
          branches: 90,
          functions: 90,
          lines: 90
        },
        'src/renderer/src/onboarding/ProvisionScene.tsx': {
          statements: 90,
          branches: 90,
          functions: 90,
          lines: 90
        },
        'src/renderer/src/onboarding/HiveHoneycomb.tsx': {
          statements: 90,
          branches: 90,
          functions: 90,
          lines: 90
        },
        // voice-prompt (M13): the dictation module's logic files. The pure ones
        // (segmenter/transcriptJoin/dictationCopy/composerBackdrop) carry 100 —
        // they are the modules whose defects are invisible on screen and only a
        // test can see (a segment cut on a breath, a doubled space, a backdrop
        // drifting out of alignment with the value it shadows). The
        // presentational `DictationBar.tsx` follows the ungated
        // `SkillStudio`/`McpManager` precedent and is exercised by its sibling
        // test; `LevelMeter` lives in design-system, under that package's own
        // gate.
        'src/renderer/src/dictation/segmenter.ts': {
          statements: 100,
          branches: 100,
          functions: 100,
          lines: 100
        },
        'src/renderer/src/dictation/transcriptJoin.ts': {
          statements: 100,
          branches: 100,
          functions: 100,
          lines: 100
        },
        'src/renderer/src/dictation/dictationCopy.ts': {
          statements: 100,
          branches: 100,
          functions: 100,
          lines: 100
        },
        'src/renderer/src/dictation/phase.ts': {
          statements: 100,
          branches: 100,
          functions: 100,
          lines: 100
        },
        'src/renderer/src/dictation/micCapture.ts': {
          statements: 90,
          branches: 90,
          functions: 90,
          lines: 90
        },
        'src/renderer/src/dictation/useDictation.ts': {
          statements: 90,
          branches: 90,
          functions: 90,
          lines: 90
        },
        'src/renderer/src/dictation/useDictationSink.ts': {
          statements: 90,
          branches: 90,
          functions: 90,
          lines: 90
        },
        'src/renderer/src/dictation/transcriptionQueue.ts': {
          statements: 90,
          branches: 90,
          functions: 90,
          lines: 90
        },
        // The backdrop composition lives on the Chat side (dictation may not
        // import from `chat/`), and its contract is character-exact: a single
        // character of drift misaligns every highlight after it, invisibly.
        'src/renderer/src/chat/composerBackdrop.ts': {
          statements: 100,
          branches: 100,
          functions: 100,
          lines: 100
        },
        'src/renderer/src/dictation/useComposerDictation.ts': {
          statements: 90,
          branches: 90,
          functions: 90,
          lines: 90
        },
        // The E2E stand-in for the microphone and the transcriber. Held to the
        // full bar for the same reason as `e2eAgentSeam.ts`: its whole contract
        // is "off unless armed", and a seam that leaked into a real run would
        // replace the user's microphone with silence.
        'src/renderer/src/dictation/e2eDictationSeam.ts': {
          statements: 100,
          branches: 100,
          functions: 100,
          lines: 100
        },
        // mcp-logs: the MCP console's logic. `mcpLogParse.ts` carries 100 — it
        // is a classification table over free text the CLI can reword at any
        // release, and every failure mode is silent (a connection failure
        // filed as a debug notice still *renders*, just in the wrong place and
        // the wrong colour). `mcpLogService.ts` and the two renderer logic
        // files carry the full bar for the same reason as their `gitService`/
        // `turnTiming` precedents: a tail that re-sends history, a filter that
        // drops a class of errors, and a duration bar scaled to the wrong
        // maximum all look correct on screen. The presentational
        // `McpConsole.tsx` / `McpStatusCluster.tsx` follow the ungated
        // `SkillStudio`/`McpManager` precedent — covered by `McpConsole.test`,
        // but their many render-callback arrows make a function gate noise.
        'src/main/mcpLogParse.ts': {
          statements: 100,
          branches: 100,
          functions: 100,
          lines: 100
        },
        'src/main/mcpLogService.ts': { statements: 90, branches: 90, functions: 90, lines: 90 },
        // agent-patch: the diff engine behind the in-chat snippet. Carries 100
        // for the same reason as `mcpLogParse.ts` — every one of its failure
        // modes is silent. A misaligned LCS still *renders*, as a patch that
        // claims the agent replaced lines it never touched; a word-pairing
        // threshold set too loose still renders, as confetti; an off-by-one in
        // the line numbers still renders, pointing the reader at the wrong line
        // of their own file. None of that shows up as an error, so a test is
        // the only thing that can see it. The presentational `PatchSnippet.tsx`
        // follows its sibling `ToolActivityFeed.tsx` (ungated) — covered by
        // `PatchSnippet.test`, but its render-callback arrows make a function
        // gate noise rather than signal.
        'src/main/toolPatch.ts': {
          statements: 100,
          branches: 100,
          functions: 100,
          lines: 100
        },
        'src/renderer/src/mcpLogs/logConsole.ts': {
          statements: 100,
          branches: 100,
          functions: 100,
          lines: 100
        },
        'src/renderer/src/mcpLogs/useMcpLogs.ts': {
          statements: 90,
          branches: 90,
          functions: 90,
          lines: 90
        },
        // agent-onboarding (M17). `cliEnv.ts` is the one that most needs the
        // gate: its whole job is the cases the dev machine doesn't have (a
        // thin GUI `PATH`, Windows `PATHEXT`, an npm `.cmd` shim), so an
        // untested branch here is a branch nobody will ever exercise by hand.
        'src/main/cliEnv.ts': { statements: 90, branches: 90, functions: 90, lines: 90 },
        'src/main/agentInstaller.ts': { statements: 90, branches: 90, functions: 90, lines: 90 },
        'src/main/agentRegistry.ts': { statements: 90, branches: 90, functions: 90, lines: 90 },
        // design-studio (M18): the reducer that is the *only* mutation of a
        // screen (AD-2). It carries 100 for the same reason as `toolPatch.ts`
        // — every failure mode is silent. A move that drops a subtree, an
        // insert that lands at the wrong index, a `SetProp` that writes to a
        // sibling: all of them still produce a document, just the wrong one,
        // and then undo replays the wrong one faithfully forever.
        'src/main/designStudio/screenDocument.ts': {
          statements: 100,
          branches: 100,
          functions: 100,
          lines: 100
        },
        // The persisted session. Full bar for the same reason as its
        // `chatHistoryStore` mold: every failure mode costs the user work
        // they already did — a key that collides across workspaces, a
        // corrupt file that throws instead of opening fresh, a rename that
        // leaves a half-written session behind.
        'src/main/designStudio/sessionStore.ts': {
          statements: 90,
          branches: 90,
          functions: 90,
          lines: 90
        }
        // `AgentPicker.tsx` and `AgentSetup.tsx` are already gated above (the
        // multi-agent and onboarding entries) — a second glob for the same file
        // is a duplicate key, not a stricter gate.
      }
    }
  }
})
