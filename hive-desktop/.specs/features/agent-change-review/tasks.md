# Tasks — Agent Change Review

**Design:** `design.md` · **Spec:** `spec.md` · **Context:** `context.md`
**Status:** ✅ DONE — all T1–T25 shipped 2026-07-25 on `feat/agent-change-review`
(atomic per-task commits; `npm run verify` green — typecheck + 0 lint errors +
1299 tests; real-Electron E2E under xvfb; 10 Playwright-MCP screenshots dark+light).
See ROADMAP.md M11 + STATE.md D23 for the closeout summary.

Atomic, ordered by dependency. Each task = one focused change + its tests + one
atomic commit. Verification is concrete (a command or an observable). `[P]` = can
run in parallel with siblings once its deps are met.

Prereq every task: `source ~/.nvm/nvm.sh && nvm use` (reads `.nvmrc`; STATE
lesson — nvm doesn't persist across tool calls). A fresh worktree also needs
`@hive/design-system` built first (STATE lesson).

**Tools convention (from the request):** UI tasks use the `impeccable` skill
(product register) + DS role tokens; the visual-validation task uses the
**Playwright MCP** (dark+light). Every UI task keeps all strings in `t()`
(pt-BR) — the existing `noInlineStrings` test is part of its verify.

Legend: **Dep** = task ids that must land first. **ACR-R** = requirement(s).
**Verify** = pass condition.

---

## Execution Plan

```
Phase 0 — Foundation (main snapshot engine + parse helpers)
  T1 [P]  T2 ─→ T3 ─→ T4        (T2 CheckpointService is the spine)

Phase 1 — ReviewService + wiring + IPC (main complete)
  T4 ─→ T5 ─→ T6 ─→ T7 ─→ T8

Phase 2 — First vertical slice UI (DEMOABLE after T12)
  T8 ─→ T9 ─→ T10 ─┬→ T11
                   └→ T12          ◀── demoable: turn→pending set→accept/reject file (bar + panel)

Phase 3 — Inline editor diff + per-hunk precision
  T3,T12 ─→ T13 ─→ T14 ─→ T15

Phase 4 — In-chat card + attribution groundwork
  T12 ─→ T16 [P]
  T8  ─→ T17 [P]   (tool_use → tool event)

Phase 5 — Guards, recoverability, keyboard
  T12 ─→ T18 [P]  T19 [P]  T20 [P]

Phase 6 — impeccable pass · gates · E2E · visual · closeout
  (all) ─→ T21 ─→ T22 ─→ T23 ─→ T24 ─→ T25
```

**Demoable milestone:** after **T12**, a real turn's changes appear in the review
bar + panel and can be accepted (kept) or rejected (reverted) per file, on disk.
Per-hunk (Phase 3) and the chat card (Phase 4) layer on top.

---

## Phase 0 — Foundation

### T1 — Coverage gate for review files  `[P]`
- **Do:** extend `vitest.config.ts` per-file 90/90/90/90 globs to cover this
  feature's gate-able files (`src/main/checkpointService.ts`,
  `src/main/reviewService.ts`, `src/main/gitParse.ts` additions,
  `src/renderer/src/scm/useReview.ts`, `src/renderer/src/scm/inlineDiff.ts`,
  `src/renderer/src/ui/HunkActions.tsx`). Exclude the large shell components
  (`AgentReviewPanel.tsx`, `InlineAgentDiff.tsx`, `ChangeCard.tsx`, `ReviewBar.tsx`)
  following the `SkillStudio`/`McpManager` precedent.
- **Dep:** — · **ACR-R:** R9.2 · **Verify:** `npm run test:coverage` config parses; globs resolve.

### T2 — `CheckpointService` (shadow git snapshot engine)
- **Do:** `src/main/checkpointService.ts` + `.test.ts`. Injected `ProcessRunner` +
  `paths` provider. Methods: `snapshot(ws)→treeOid`, `diffToWorkTree(ws, ref)→
  raw diff`, `fileAtRef(ws, ref, path)`, `revertPath(ws, ref, path)`,
  `applyReverseHunk(ws, path, patch)`. Private `GIT_DIR`/`GIT_INDEX_FILE` under
  `userData/checkpoints/<sha1(ws)>/`; lazy `git init` + `info/exclude`
  (`node_modules/`, `.git/`, `dist/`, `out/`, `coverage/`, `.playwright-mcp/`,
  `*.log`); honors workspace `.gitignore` automatically.
- **Dep:** — · **ACR-R:** R1.1, R1.2, R1.6, R3.1 · **Verify:** `checkpointService.test.ts`
  green against real git in temp dirs — snapshot→edit→diff shows the edit;
  revertPath restores bytes; created→delete; incremental re-snapshot; excludes
  honored. ≥90% coverage.

### T3 — `gitParse` hunk ids + minimal-patch builder
- **Do:** extend `src/main/gitParse.ts`: stable `hunkId` per `GitDiffHunk`
  (index + old/new start from header) and a `buildHunkPatch(diff, hunkId)` that
  reconstructs a minimal, `git apply`-able unified patch for one hunk. Tests in
  `gitParse.test.ts`.
- **Dep:** — · **ACR-R:** R3.1 · **Verify:** round-trip test — parse a diff, rebuild a
  hunk patch, `git apply` it onto the pre-image reproduces the post-image; `-R`
  reverses it. ≥90%.

### T4 — Wire `applyReverseHunk` over the patch builder
- **Do:** compose `CheckpointService.applyReverseHunk` to take a `GitDiffHunk`,
  build its patch (T3), and `git apply -R --unidiff-zero`.
- **Dep:** T2, T3 · **ACR-R:** R3.1 · **Verify:** test rejects one hunk of a two-hunk
  file, leaving the other hunk's bytes intact on disk.

---

## Phase 1 — ReviewService + wiring + IPC

### T5 — `ReviewService` (pending set + decisions)
- **Do:** `src/main/reviewService.ts` + `.test.ts` over the real
  `CheckpointService` (temp git) + injected `FsService` mtime. State =
  `{baseline, turns, changes}`; `beginTurn`/`onFsActivity`(debounced)/`endTurn`;
  `acceptFile`/`rejectFile`/`acceptHunk`/`rejectHunk`/`acceptAll`/`rejectAll`;
  `changes = diff(baseline→now)` invariant (ACR-C5 accumulation). STALE guard
  (ACR-R3.2) via mtime. Emits a `changed` callback.
- **Dep:** T4 · **ACR-R:** R1.1–R1.7, R3.1, R3.2, C5 · **Verify:** lifecycle test — two
  turns accumulate into one set; acceptFile re-baselines (leaves set, keeps
  bytes); rejectFile restores bytes; accept/reject hunk; acceptAll/rejectAll;
  STALE returns `{stale:true}` not a clobber. ≥90%.

### T6 — IPC handlers (`review:*`) + turn wiring
- **Do:** in `src/main/index.ts` register `review:get/acceptFile/rejectFile/
  acceptHunk/rejectHunk/acceptAll/rejectAll` + push `review:changed`. Call
  `reviewService.beginTurn` before a turn spawns and `endTurn` on the terminal
  event; subscribe the existing `watchWorkspace` to `onFsActivity` (gated to
  active-turn-or-nonempty-set). Path-safety on every handler.
- **Dep:** T5 · **ACR-R:** R1.3, R2.5, R9.1 · **Verify:** `index.test.ts` additions —
  handlers dispatch to a fake service; turn start/end call begin/endTurn; no
  change to existing chat/stream handlers. ≥90% on changed index paths.

### T7 — preload bridge (`window.hive.review`)
- **Do:** extend `src/preload/index.ts` + its typings with the `review` namespace
  (request/response + `onChanged` subscription), matching the `git`/`mcp` bridge
  shape.
- **Dep:** T6 · **ACR-R:** R2.5 · **Verify:** `preload` typecheck; a renderer test can
  call `window.hive.review.get` against the mock. ≥90%.

### T8 — `useReview()` store
- **Do:** `src/renderer/src/scm/useReview.ts` + `.test.ts` (styled on `useGit.ts`).
  Loads via `review.get`, subscribes to `onChanged`, exposes `changes`, `turns`,
  `pendingCount`, `byStatus`, `isStale`, and the accept/reject actions. Lifted in
  `WorkUI` + shared by context.
- **Dep:** T7 · **ACR-R:** R2.5 · **Verify:** store test with a fake `window.hive` —
  event updates state; actions call IPC; `pendingCount` derives correctly. ≥90%.

---

## Phase 2 — First vertical slice UI (DEMOABLE)

### T9 — `HunkActions` + `DiffView` per-hunk actions (DS extension)
- **Do:** `src/renderer/src/ui/HunkActions.tsx` (the ✓/✗ + count control) and
  extend `DiffViewProps` with optional `onHunkAccept/onHunkReject` rendering a
  per-hunk control strip (backward compatible — M10 callers unaffected).
- **Dep:** T3 · **ACR-R:** R1.4, R3.1, G3 · **Verify:** `DiffView.test.ts` — existing
  tests unchanged; new test shows per-hunk controls only when handlers passed and
  fires with the right `hunkId`. `HunkActions` unit test. ≥90% (HunkActions).

### T10 — `ReviewBar` (persistent ambient bar)
- **Do:** `src/renderer/src/ui/ReviewBar.tsx` + `.test.ts`. Shown only when
  `pendingCount>0`; `● N mudanças pendentes · [Rejeitar tudo] [Aceitar tudo] ·
  Revisar →`. Reject-all confirms. i18n strings in `pt-BR.ts`.
- **Dep:** T8 · **ACR-R:** R2.3, R1.7 · **Verify:** component test — hidden when clean,
  shows count, accept-all/reject-all call the store (reject-all after confirm).

### T11 — `AgentReviewPanel` sidebar view + `SidebarHost` third view
- **Do:** `src/renderer/src/scm/AgentReviewPanel.tsx` + `.test.ts`; add a third
  view to `ui/SidebarHost.tsx` (Explorer ⇄ Source Control ⇄ Revisão) with a rail
  toggle carrying a `pendingCount` badge. Grouped list (Criados/Modificados/
  Removidos) reusing `ChangeGroups`; per-row `+/-`, `✗`/`✓`, click → `DiffTab`
  with per-hunk controls (T9); bulk actions; empty state (ACR-R1.8).
- **Dep:** T8, T9 · **ACR-R:** R2.4, R1.4–R1.8 · **Verify:** component test — groups
  render, per-row accept/reject call the store, empty state renders, badge shows
  count. Sidebar switch test.

### T12 — Mount slice in `WorkUI` + demo the loop
- **Do:** lift `useReview` in `WorkUI`, provide via context, mount `ReviewBar`
  (above composer) + the panel view. Wire the watcher-driven live update.
- **Dep:** T10, T11 · **ACR-R:** R2.3, R2.4, R2.5, R9.1 · **Verify:** `npm run verify`
  green; **manual/E2E demo:** a scripted-adapter turn that writes 3 files →
  bar reads "3", panel lists them, accept one (bytes kept, leaves set), reject
  one (bytes restored) — asserted on disk in the T23 E2E, exercised manually now.

---

## Phase 3 — Inline editor diff + per-hunk precision

### T13 — `inlineDiff.ts` (overlay model)
- **Do:** `src/renderer/src/scm/inlineDiff.ts` + `.test.ts` — pure mapping from a
  `GitDiff` + the open file's lines to an inline render model (removed/added rows
  anchored per hunk), plus hunk navigation (prev/next) state.
- **Dep:** T3 · **ACR-R:** R2.1 · **Verify:** unit test — a known diff maps to the
  expected inline row model; nav wraps correctly. ≥90%.

### T14 — `InlineAgentDiff.tsx` (Cursor-tier in-editor diff)
- **Do:** `src/renderer/src/scm/InlineAgentDiff.tsx` + `.test.ts`, layered on the
  gutter (`scm/gutter.ts`/`useGutter`). Renders the inline diff for the open
  pending file with per-hunk `HunkActions` (T9) + `‹ n de m ›` nav.
- **Dep:** T9, T13 · **ACR-R:** R2.1, R3.1, R2.5 · **Verify:** component test — inline
  rows render for a pending open file, per-hunk accept/reject call the store,
  nav moves between hunks. (Shell component — ungated like siblings.)

### T15 — Wire inline diff into the editor + live re-diff
- **Do:** mount `InlineAgentDiff` in the editor pane when the open file is in the
  pending set; re-diff on `review:changed` (accepting a hunk elsewhere updates
  the open file live).
- **Dep:** T14 · **ACR-R:** R2.1, R2.5, R3.1 · **Verify:** `npm run verify` green;
  accepting a hunk in the panel updates the open file's inline diff (component/
  integration test with a fake store).

---

## Phase 4 — In-chat card + attribution groundwork

### T16 — `ChangeCard.tsx` (Claude-Desktop-tier chat card)  `[P]`
- **Do:** `src/renderer/src/chat/ChangeCard.tsx` + `.test.ts`, rendered in the
  transcript for a turn that changed files (keyed off `TurnMark`). File list with
  `+/-` + status dots, expand → `DiffView` per file, `✗`/`✓` for the turn's
  files; accepted files check off live; fully-reviewed → quiet "revisado".
- **Dep:** T12 · **ACR-R:** R2.2, R2.5 · **Verify:** component test — card lists the
  turn's files, expand shows diff, accept/reject call the store, reviewed state
  renders. Rendered in `Chat.tsx` (Chat.test additions). (Shell — ungated.)

### T17 — `tool_use` → `tool` event (attribution plumbing)  `[P]`
- **Do:** extend `src/main/cliAdapterCore.ts` stdout parser to recognize
  `assistant` `tool_use` blocks for `Write|Edit|MultiEdit` and emit
  `{ type: 'tool', name, detail: file_path, turnId }` (type already exists,
  currently unpopulated). Collect per-turn `paths`/`attribution` in
  `AgentService`/`endTurn`. **Plumbing only** — no attribution UI in v1.
- **Dep:** T6 · **ACR-R:** R3.3, C7 · **Verify:** `cliAdapterCore` test — a stream with
  a Write `tool_use` emits a `tool` event with the file path; token streaming
  unchanged. `endTurn` receives the paths. ≥90% on the parser change.

---

## Phase 5 — Guards, recoverability, keyboard

### T18 — STALE concurrent-edit guard UI  `[P]`
- **Do:** when accept/reject returns `{stale:true}` (T5), surface a choice
  (manter minhas edições / usar a do agente / cancelar) reusing the M4 STALE
  dialog convention; wire from `useReview`.
- **Dep:** T12 · **ACR-R:** R3.2, G4 · **Verify:** test — a stale result opens the
  dialog; each choice calls the right action; no silent clobber.

### T19 — Workspace-switch guard for pending set  `[P]`
- **Do:** on workspace switch / close with `pendingCount>0`, prompt (aceitar /
  rejeitar / sair mantendo pendentes) reusing the M8 unsaved-guard; tear down the
  `ReviewService` state cleanly.
- **Dep:** T12 · **ACR-R:** R4.3, G4 · **Verify:** test — switch with pending prompts;
  each choice routes correctly; teardown leaves no stale listeners.

### T20 — Keyboard flow + undo-accept toast  `[P]`
- **Do:** keyboard accept/reject/next/prev for the focused change (ACR-R4.1) with
  tooltips; a brief "desfazer" toast after an accept (ACR-R4.2) — or, if the
  baseline advance is made immediately final, drop R4.2 to a follow-up and keep
  only the keyboard flow (OQ4, design's call at build time).
- **Dep:** T12 · **ACR-R:** R4.1, R4.2 · **Verify:** test — keys fire the store
  actions; undo toast (if kept) restores within its window.

---

## Phase 6 — impeccable pass · gates · E2E · visual · closeout

### T21 — `impeccable` polish pass (all surfaces)
- **Do:** load `impeccable`; run the hierarchy/spacing/token/motion/copy pass over
  inline diff, chat card, review bar, panel, empty + confirm states; finalize
  `workbench.css` review styles + `pt-BR.ts` copy. Respect `prefers-reduced-motion`.
- **Dep:** T15, T16, T18, T19, T20 · **ACR-R:** G5, R9.3 · **Verify:** `noInlineStrings`
  green; no token/hardcoded-color regressions; self-review against the impeccable
  checklist recorded in the commit.

### T22 — Full gate: verify + coverage + lint
- **Do:** `npm run verify` (typecheck + unit/component + lint) + `npm run
  test:coverage`; fix any per-file coverage misses on gated files.
- **Dep:** T21 · **ACR-R:** R9.1, R9.2, R9.3 · **Verify:** all green; gated files ≥90/
  90/90/90; 0 new lint errors.

### T23 — Real-flow E2E
- **Do:** `e2e/agent-change-review.spec.ts` (`_electron.launch`): scripted-adapter
  turn writes/edits/deletes real files → assert pending set → `acceptFile` keeps
  bytes, `rejectFile` restores bytes, `rejectAll` restores all — **on disk**.
- **Dep:** T22 · **ACR-R:** R9.4 · **Verify:** `npm run build && xvfb-run -a npm run
  test:e2e:app` passes the new spec (kept as a local/manual gate if the sandbox
  E2E instability from prior milestones recurs).

### T24 — Visual validation (Playwright MCP, dark + light)
- **Do:** via the static-build + `window.hive`-mock recipe, drive every review
  state in the **Playwright MCP** browser and capture screenshots to
  `.playwright-mcp/`: inline diff w/ per-hunk controls, chat card, review bar,
  panel grouped list, empty state, reject-all confirm, STALE dialog — dark+light.
- **Dep:** T22 · **ACR-R:** R9.5, G5 · **Verify:** screenshots saved; each state reads
  correctly + legibly in both themes; issues fixed and re-shot.

### T25 — Closeout: STATE + ROADMAP + memory
- **Do:** mark M11 done in `ROADMAP.md`; add decision **D23** + any lessons to
  `STATE.md`; update the `hive-desktop-*` memory index entry. Summarize the
  shipped loop.
- **Dep:** T23, T24 · **ACR-R:** — · **Verify:** docs updated; `git log` shows the
  atomic per-task commits on the feature branch.

---

## Notes & risks

- **R1 — Snapshot cost on large trees.** Mitigated by `info/exclude` + honoring
  `.gitignore` (T2). If a target workspace still snapshots slowly, revisit the
  exclude set (OQ2) — do **not** fall back to a racy lazy capture.
- **R2 — Per-hunk patch math** is the trickiest correctness surface — T3/T4
  isolate it with round-trip `git apply` tests before any UI depends on it.
- **R3 — E2E sandbox instability** (seen in M4/M7) may make T23 a local gate;
  T24 (MCP visual) is the always-runnable confidence net, per prior milestones.
- **R4 — Attribution (T17)** is deliberately plumbing-only in v1 (ACR-C7); don't
  let it grow into a P2 UI mid-stream.
- **Branch:** implement on a new `feat/agent-change-review` branch (do not reuse
  `feat/git-management`).
```
