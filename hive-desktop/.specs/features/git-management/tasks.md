# Tasks — Git Management

**Design:** `.specs/features/git-management/design.md` · **Spec:** `spec.md` ·
**Context:** `context.md`
**Status:** DONE — all tasks T1–T32 complete. Full loop (detect→stage→commit→
diff→branch→sync→history→conflict→stash) shipped on `feat/git-management`;
`npm run verify` green (73 files / 1180 tests, 0 lint errors), real-Electron E2E
passing, all SCM states visually validated in dark + light.

Atomic, ordered by dependency. Each task = one focused change + its tests + one
atomic commit. Verification is concrete (a command or an observable). `[P]` = can
run in parallel with siblings once its deps are met.

Prereq every task: `source ~/.nvm/nvm.sh && nvm use` (reads `.nvmrc`; STATE
lesson — nvm doesn't persist across tool calls). A fresh worktree also needs
`@hive/design-system` built first (STATE lesson).

**Tools convention (from the request):** UI tasks use the `impeccable` skill
(product register) and DS role tokens; the visual-validation task uses the
**Playwright MCP**. Every UI task keeps all strings in `t()` (pt-BR) — the
existing `noInlineStrings` test is part of its verify.

Legend: **Dep** = task ids that must land first. **GIT-R** = requirement(s).
**Verify** = pass condition.

---

## Execution Plan

```
Phase 0 — Foundation (main/service/IPC, mostly parallel)
  T1 [P]  T2 [P]  T3 ─→ T4 ─┬→ T5  T6  T7  T8  T9  T10   ─→ T11 ─→ T12 ─→ T13
                            └ (all service methods [P] after T4)

Phase 1 — Sidebar + first vertical slice (DEMOABLE after T20)
  T2 ─→ T14 ─→ T15 ─→ T16 ─┬→ T17
  T13 ┘                    ├→ T18
  T13 ─→ T19 ─→ T20        ┘        ◀── demoable: detect→status→stage→commit→diff

Phase 2 — Branch · sync · status bar (parallel after slice)
  T21 [P]  T22 [P]  T23 [P]

Phase 3 — History · conflicts · stash (parallel)
  T24 [P]  T25 [P]  T26 [P]

Phase 4 — Ambient awareness (parallel)
  T27 [P]  T28 [P]

Phase 5 — Gates & closeout (sequential)
  T29 ─→ T30 ─→ T31 ─→ T32
```

---

## Phase 0 — Foundation

### ✅ T1 — Coverage gate for git files  `[P]`
- **Do:** extend `vitest.config.ts`'s per-file 90/90/90/90 coverage globs to
  cover the files this feature adds (`src/main/gitService.ts`,
  `src/main/gitParse.ts`, `src/renderer/src/scm/**`, `src/renderer/src/ui/DiffView.tsx`,
  `src/renderer/src/ui/StatusBar.tsx`, `src/renderer/src/ui/SidebarHost.tsx`).
  No behavior change.
- **Dep:** —  **GIT-R:** R14.5
- **Verify:** `npm run test:coverage` runs, reports per-file numbers, existing
  suites green.

### ✅ T2 — Git icons  `[P]`
- **Do:** add to `ui/icons.tsx`: `SourceControlIcon`, `BranchIcon`, `CommitIcon`,
  `MergeIcon`, `SyncIcon`, `StashIcon`, `CheckCircleIcon`, `DiscardIcon`,
  `ArrowDownIcon` — same stroke/size/viewBox conventions as the existing set.
- **Dep:** —  **GIT-R:** R6, R7, R9, R10, R13
- **Verify:** `icons.test.ts` extended (each renders an `<svg>`); typecheck clean.

### ✅ T3 — `gitParse.ts` pure parsers + tests  `[core]`
- **Do:** create `main/gitParse.ts` with pure functions: `parseStatusV2`
  (porcelain=v2 `-z`, branch header, ahead/behind, index+worktree codes, rename,
  untracked, conflict), `parseLog` (`%H%x1f…%x1f%s` `-z` records), `parseBranches`
  (`for-each-ref` format), `parseStashList`, `parseNumstat`, `parseDiff` (unified
  → hunks/lines). No `ProcessRunner` here.
- **Dep:** —  **GIT-R:** R2, R4, R6, R8, R10
- **Verify:** `gitParse.test.ts` over captured real-git fixtures (incl. renames,
  conflicts UU/AA, untracked, empty repo); ≥90% per-file; `npm test` green.

### ✅ T4 — `gitService`: detect / init / status + serial queue + `git()` helper + errors  `[core]`
- **Do:** create `main/gitService.ts` — `createGitService({ processRunner, trashItem })`
  with a `git(args,{cwd})` wrapper (`-c core.quotepath=false`,
  `GIT_TERMINAL_PROMPT=0`, `GitError{code,stderr,command}` on non-zero), a
  per-repo FIFO mutation queue (§3.3), and `detect`, `init`, `status` (via
  `parseStatusV2`). Export the `GitStatus`/`GitFileChange` types.
- **Dep:** T3  **GIT-R:** R1, R2, R14.1, R14.2, R14.3
- **Verify:** `gitService.test.ts` scripts `createFakeProcessRunner`: asserts exact
  argv, `cwd` containment, env flags, queue serialization order, `GitError` on
  non-zero. ≥90% per-file.

### ✅ T5 — `gitService`: stage / unstage / discard / commit  `[P after T4]`
- **Do:** add `stage`, `unstage`, `discard` (tracked → `restore`; staged →
  `restore --staged`; **untracked → `trashItem`**, never `clean -f`), `commit`
  (`--file` for message, `amend`, `stageAll`).
- **Dep:** T4  **GIT-R:** R3, R5
- **Verify:** unit tests assert argv per branch, untracked-discard calls the fake
  `trashItem` (not git), amend/stageAll flags. ≥90%.

### ✅ T6 — `gitService`: branches  `[P after T4]`
- **Do:** `branches` (`for-each-ref` + `symbolic-ref`, detached detection),
  `createBranch` (`switch -c`), `checkout` (`switch`; surface refusal as
  `GitError`), `renameBranch` (`branch -m`), `deleteBranch` (`-d`/`-D`).
- **Dep:** T4  **GIT-R:** R6
- **Verify:** unit tests for argv + `parseBranches` integration + dirty-checkout
  error passthrough. ≥90%.

### ✅ T7 — `gitService`: remotes (fetch/pull/push/sync/publish)  `[P after T4]`
- **Do:** `fetch`, `pull` (`--ff`), `push`, `sync` (pull then push), publish
  (`push -u origin <branch>` when no upstream). Progress surfaced via the
  `busy` label path. Auth failures propagate `GitError` with raw stderr (D-GIT-1).
- **Dep:** T4  **GIT-R:** R7, R14.3
- **Verify:** unit tests for argv, no-upstream→publish branch, error passthrough,
  no secret in logs. ≥90%.

### ✅ T8 — `gitService`: log / diff / commitDiff  `[P after T4]`
- **Do:** `log({file,skip,limit})`, `diff(path, 'working'|'staged')`,
  `commitDiff(hash)` (numstat + `show`). Uses `parseLog`/`parseDiff`.
- **Dep:** T3, T4  **GIT-R:** R4, R8
- **Verify:** unit tests: argv incl. `--` file scoping, pagination, binary/tooLarge
  flags in parsed diff. ≥90%.

### ✅ T9 — `gitService`: conflicts + merge continue/abort  `[P after T4]`
- **Do:** `conflicts()` (derive from status), `resolveConflict(path, 'current'|
  'incoming'|'both')` (`checkout --ours/--theirs` or marker rewrite + stage),
  `mergeContinue`, `mergeAbort`.
- **Dep:** T4  **GIT-R:** R9
- **Verify:** unit tests for each choice's argv + continue/abort. ≥90%.

### ✅ T10 — `gitService`: stash  `[P after T4]`
- **Do:** `stash({message,untracked})`, `stashList` (`parseStashList`),
  `stashApply(index,pop?)`, `stashDrop(index)`.
- **Dep:** T4  **GIT-R:** R10
- **Verify:** unit tests for argv incl. `-u`, `stash@{n}` indexing. ≥90%.

### ✅ T11 — IPC handlers `git:*` + `git:changed` stream
- **Do:** in `main/index.ts` register `ipcMain.handle('git:<name>', …)` for every
  method; construct `createGitService({ processRunner: real, trashItem:
  shell.trashItem })`; add the `git:changed` event channel (start/stop pair, per
  the `fs:watch` pattern) fired on mutation completion; add the `GIT:` message
  prefix for `GitError` crossing IPC.
- **Dep:** T4–T10  **GIT-R:** R1–R10, R14
- **Verify:** `index.test.ts` extended — each handler routes to the service; the
  stream registers/tears down. `npm test` green.

### ✅ T12 — preload `window.hive.git` namespace + `GitBridgeError`
- **Do:** add the full `git` namespace to `preload/index.ts` per design §4;
  `withTypedGit` wrapper turning `GIT:`-prefixed rejections into `GitBridgeError`
  carrying `.stderr`; the `onChanged` subscribe/unsubscribe.
- **Dep:** T11  **GIT-R:** R1–R10, R14
- **Verify:** `preload/index.test.ts` extended — namespace shape, prefix→typed
  error, unsubscribe removes listener. Typecheck clean.

### ✅ T13 — `useGit(workspace)` store hook + status/decoration types  `[core]`
- **Do:** create `scm/useGit.ts` — owns `repo`/`status`/`busy`/`decorations`,
  debounced `refresh` (fs-watch + focus + `git:changed`), all action wrappers
  (optimistic where safe), resets on workspace change; a small context provider
  so `FileTree`/`FileViewer` read decorations. `gitStatusColor()` map + status
  types in `scm/gitStatus.ts`.
- **Dep:** T12  **GIT-R:** R2, R11, R14.2
- **Verify:** hook tests over a mocked `window.hive.git`: refresh coalescing,
  workspace-reset, decoration map derivation. ≥90%.

---

## Phase 1 — Sidebar + first vertical slice

### ✅ T14 — `ActionRail` → activity-bar view switcher
- **Do:** add Explorer + Source Control **view** entries (active state, left
  accent bar, filled icon) and a change-count `Badge` on Source Control; keep
  the existing tool buttons + gear. New props: `activeView`, `onSelectView`,
  `changeCount`. Skill: `impeccable`.
- **Dep:** T2  **GIT-R:** R13
- **Verify:** `ActionRail.test.ts` — entries toggle, badge shows count, a11y
  names; `noInlineStrings` green.

### ✅ T15 — `SidebarHost` + WorkUI wiring + `Ctrl+Shift+G` + persistence
- **Do:** create `ui/SidebarHost.tsx` swapping the rail body on `activeView`
  (explorer ⇄ scm); rail `ResizablePanel` keeps `id="rail"` (layout untouched).
  In `WorkUI`: `activeView` state persisted to `localStorage['hive.sidebarView']`,
  `Ctrl/Cmd+Shift+G` → scm + focus commit box, `PaneHeader` title follows view.
- **Dep:** T14  **GIT-R:** R13, D-GIT-2
- **Verify:** component test: switch preserves pane `id`/width; shortcut opens
  scm. Regression: `hive.workLayout`/`paneOrder` tests still green.

### ✅ T16 — `SourceControlPanel` shell + `ChangeGroups` + empty states
- **Do:** create `scm/SourceControlPanel.tsx` + `scm/ChangeGroups.tsx`: grouped
  (Conflitos / Alterações prontas / Alterações), counts, path + status glyph +
  color rows, virtualized scroll; empty states (not-a-repo → Inicializar; clean →
  branch name; git-missing). Skill: `impeccable`.
- **Dep:** T13, T15  **GIT-R:** R1, R2
- **Verify:** component tests for every state over mocked `useGit`; init empty
  state calls `git.init`. ≥90%; `noInlineStrings` green.

### ✅ T17 — Row + group actions (stage/unstage/discard + ContextMenu)
- **Do:** inline hover/focus actions (Stage/Unstage/Discard/Open diff) + section
  Stage-all/Unstage-all/Discard-all; DS `ContextMenu` on rows (incl. View history,
  Copy path); discard confirm via `AlertDialog`; untracked discard messaging.
- **Dep:** T16  **GIT-R:** R3
- **Verify:** tests: each action calls the right `useGit` action; discard confirms
  first. ≥90%.

### ✅ T18 — `CommitBox` (message + split-button)
- **Do:** create `scm/CommitBox.tsx`: multiline `Textarea` (subject/body), primary
  split-button **Commit** with `▾` menu (amend, stage-all & commit, commit & sync);
  Ctrl/Cmd+Enter; disabled+reason when empty/nothing staged; "Preparar tudo e
  commitar" path. Skill: `impeccable`.
- **Dep:** T16  **GIT-R:** R5
- **Verify:** tests: commit clears input; empty→disabled; nothing-staged→offer
  stage-all; amend prefill. ≥90%.

### ✅ T19 — `DiffView` component + tests
- **Do:** create `ui/DiffView.tsx` per design §6.1: unified + side-by-side toggle,
  add/del/context coloring (semantic tokens, contrast-verified), old/new line
  numbers, hunk headers, binary/image + too-large affordances, own `overflow`
  scroll. Skill: `impeccable`.
- **Dep:** T13  **GIT-R:** R4
- **Verify:** tests render both modes from a `GitDiff` fixture incl. binary/large;
  contrast asserted via token usage. ≥90%.

### ✅ T20 — `EditorTab.kind` + route diff/conflict tabs into the viewer pane  *(◀ demoable slice complete)*
- **Do:** extend `EditorTab` with `kind: 'file'|'diff'|'conflict'` + `git`
  descriptor in `useEditorTabs.ts` (preview-slot logic unchanged; synthetic keys
  for diff/conflict); in `WorkUI` viewer pane, render `DiffView` for `kind:'diff'`
  (`git.diff`) — opening a change row opens its diff tab.
- **Dep:** T19, T16  **GIT-R:** R4
- **Verify:** clicking a change row opens a "(working tree)" diff tab; file tabs
  unaffected; `useEditorTabs` tests green. **Checkpoint:** detect→status→stage→
  commit→diff demoable end-to-end.

---

## Phase 2 — Branch · sync · status bar

### T21 — `StatusBar` component + WorkUI mount  `[P]`
- **Do:** create `ui/StatusBar.tsx` (branch pill, ↑↓ sync, changes count, busy
  spinner; not-a-repo → Inicializar); mount at the bottom of `WorkUI`'s shell on
  `--surface`. Clicks route (branch→picker, sync→sync, changes→scm view). Skill:
  `impeccable`.
- **Dep:** T13, T15  **GIT-R:** R12
- **Verify:** tests for each cluster's state + click routing + busy spinner; a11y
  labels. ≥90%.

### T22 — Branch quick-pick + dirty guard  `[P]`
- **Do:** `scm/BranchPicker.tsx` on DS `Command` (local+remote, filter, create,
  checkout, rename, delete-with-confirm); opened from status-bar pill + SCM
  header; dirty switch reuses the three-way unsaved guard; detached-HEAD affordance.
- **Dep:** T13, T16  **GIT-R:** R6
- **Verify:** tests: list/filter/create/checkout/delete-confirm; dirty→guard. ≥90%.

### T23 — Sync actions wired  `[P]`
- **Do:** wire fetch/pull/push/sync/publish from status bar + SCM header overflow;
  `busy` drives the spinner; success `Toast`; `GitError`→error toast + "Detalhes"
  (raw stderr, D-GIT-1); no-remote/no-upstream states.
- **Dep:** T21, T13  **GIT-R:** R7
- **Verify:** tests: each action calls `useGit`; auth error shows Detalhes; no
  remote→disabled. ≥90%.

---

## Phase 3 — History · conflicts · stash

### T24 — `HistoryPanel` (timeline) + commit diff  `[P]`
- **Do:** `scm/HistoryPanel.tsx` — commit list (short hash/subject/author/relative
  date, load-more), select→changed files→open commit diff in `DiffView`; per-file
  history entry point (from ContextMenu T17). Reuse DS Timeline spine where it
  fits. Skill: `impeccable`.
- **Dep:** T16, T19  **GIT-R:** R8
- **Verify:** tests: list newest-first, load-more, commit→diff, file-scoped log.
  ≥90%.

### T25 — `ConflictView` + conflict group + resolve + merge continue/abort  `[P]`
- **Do:** `ui/ConflictView.tsx` (kind:'conflict' tab): per-block Aceitar atual/
  recebido/ambos + compare; Marcar resolvido (stage) when clean; merge
  Continuar/Abortar in SCM header; conflict group already grouped by T16. Skill:
  `impeccable`.
- **Dep:** T16, T19, T20  **GIT-R:** R9
- **Verify:** tests: each accept choice calls resolve; resolved→stage enabled;
  continue/abort wired. ≥90%.

### T26 — `StashPanel` + stash actions  `[P]`
- **Do:** `scm/StashPanel.tsx` — collapsible stash list (Aplicar/Pop/Descartar),
  header "Stash" action (message + include-untracked); apply-conflict routes into
  ConflictView (T25 reuse). Skill: `impeccable`.
- **Dep:** T16  **GIT-R:** R10
- **Verify:** tests: stash→clean+listed; pop→removed; drop-confirm. ≥90%.

---

## Phase 4 — Ambient awareness

### T27 — Explorer tree decorations  `[P]`
- **Do:** `FileTree` `renderLabel` consumes `useGit().decorations`: status badge +
  color per row, ignored dimmed, folder rollup dot; `gitStatusColor` shared map.
  No DS `Tree` change (renderLabel suffices). Skill: `impeccable`.
- **Dep:** T13  **GIT-R:** R11
- **Verify:** `Explorer.test.ts` extended: rows carry status badge/color; folder
  rollup; ignored dimmed; no regression to existing tree tests. ≥90%.

### T28 — Editor gutter marks  `[P]`
- **Do:** `FileViewer` gutter strip (added/modified/deleted) vs HEAD baseline
  (`git.diff` baseline + `fast-diff` for live draft), debounced/idle off the
  keystroke path; large-file cap. Skill: `impeccable`.
- **Dep:** T13, T19  **GIT-R:** R11.2
- **Verify:** tests: gutter marks match a known edit; updates on draft change;
  disabled for untracked/large. ≥90%.

---

## Phase 5 — Gates & closeout

### T29 — i18n completeness + no-inline-strings audit
- **Do:** consolidate the `git.*` key group in `pt-BR.ts`; ensure every new
  surface uses `t()`; fill any gaps.
- **Dep:** T14–T28  **GIT-R:** R14.8
- **Verify:** `noInlineStrings.test.ts` + `pt-BR.test.ts` green; typecheck/lint clean.

### T30 — E2E: real repo + local bare remote ✅
- **Done:** `e2e/git-management.spec.ts` drives the built app (real `_electron.launch`
  under xvfb) against a throwaway repo + bare remote through flip→diff→stage→commit→
  sync(push)→stash, asserting real git/on-disk state at each step. Passes in 5.6s.
- **Do:** `e2e/git-management.spec.ts` — build a throwaway repo + `git init --bare`
  origin; `_electron.launch` the built app; drive detect→stage→commit→diff→branch→
  push→pull→conflict→resolve→stash/pop; assert `git`/on-disk state. Add to the
  e2e config. Mirror `workspace-switching.spec.ts`.
- **Dep:** T20–T28  **GIT-R:** R14.6
- **Verify:** `npm run build && xvfb-run -a npm run test:e2e:app` passes (or, if
  Electron launch is unstable here, record in STATE + keep as local gate, per the
  file-management T11 precedent).

### T31 — Playwright-MCP visual validation (dark + light) ✅
- **Done:** booted the built renderer via the Playwright MCP with a full `window.hive`
  mock (rich git fixtures: merge in progress, all 3 change groups, 2 stashes, branch
  list, history, conflict-with-markers). Captured + validated overview, diff, branch
  picker, history, and conflict-resolution views. No visual defects — the shared git
  status token vocabulary reads correctly in both themes (overview + diff + conflict
  shot in dark **and** light). Artifacts in `.playwright-mcp/` (gitignored).
- **Do:** drive the running app via the **Playwright MCP** (window.hive mock
  recipe in memory); capture + validate every SCM state in both themes: empty/
  clean/dirty(all groups)/diff(unified+side-by-side)/conflict/history/stash/
  status bar/explorer decorations/gutter. Fix real visual defects found. Skill:
  `impeccable`; MCP: `playwright`.
- **Dep:** T16–T28  **GIT-R:** R14.7
- **Verify:** screenshots captured for each state × theme; defects fixed and
  re-shot; summary logged in STATE.

### T32 — Closeout ✅
- **Done:** `npm run verify` green (typecheck + lint 0 errors + 73 files / 1180 tests);
  per-file coverage gates for every touched `scm/**` + `ui/*` file held under vitest's
  gated globs. ROADMAP M10 + STATE (decisions/lessons) + spec traceability updated.
- **Do:** confirm full-suite green (`npm run verify`), per-file coverage ≥90% on
  every touched file, typecheck/lint clean; update ROADMAP M10 status + STATE
  (decisions/lessons); mark spec traceability rows Verified.
- **Dep:** T29–T31  **GIT-R:** R14.4, R14.5
- **Verify:** `npm run verify` green; `npm run test:coverage` per-file ≥90%;
  ROADMAP/STATE updated.

---

## Granularity check

| Task | Scope | OK? |
| --- | --- | --- |
| T3 gitParse | pure parsers, 1 file | ✅ |
| T4–T10 service methods | 1 cohesive method-group each | ✅ (split by domain) |
| T16 SCM panel + change groups | 2 tightly-coupled files | ⚠️ cohesive — acceptable |
| T19 DiffView | 1 component | ✅ |
| T20 tab-kind + routing | 1 model change + 1 wiring | ⚠️ cohesive — acceptable |

**Requirement coverage:** GIT-R1…R14 each map to ≥1 task above (see per-task
**GIT-R**). No unmapped requirements.
