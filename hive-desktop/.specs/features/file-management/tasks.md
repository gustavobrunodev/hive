# Tasks — File Management

Atomic, ordered by dependency. Each task = one focused change + its tests + one
atomic commit. Verification is concrete (a command or an observable). `[P]` = can
run in parallel with siblings once its deps are met.

Prereq every task: `source ~/.nvm/nvm.sh && nvm use 22.22.1` (STATE lesson — nvm
doesn't persist across tool calls).

Legend: **Dep** = task ids that must land first. **Verify** = pass condition.

---

### T1 — Coverage tooling & per-file 90% gate  `[P]`
- **Do:** add `@vitest/coverage-v8` (dev). Add `coverage` block to
  `vitest.config.ts` with `provider: 'v8'`, `reporter: ['text','html']`, global
  thresholds low/off, and **per-file 90/90/90/90** globs for the files this
  feature will touch (`src/main/fsService.ts`, `src/preload/index.ts`,
  `src/renderer/src/explorer/**`, `src/main/index.ts`). Add `"test:coverage":
  "vitest run --coverage"` script.
- **Dep:** —  **FM-R:** R8.2
- **Verify:** `npm run test:coverage` runs and reports per-file numbers; existing
  suites still green (`npm test`). Gate currently passes (nothing new to cover yet).

### T2 — E2E harness spike: Playwright + real Electron  `[P]`
- **Do:** add `@playwright/test` (dev). `playwright.config.ts` pointing at an
  `e2e/` dir. One smoke `e2e/app-launch.spec.ts` that `_electron.launch`es the
  built app (`out/main/index.js`) under xvfb, asserts the window opens and
  `window.hive.fs` exists. Add `"test:e2e:app": "playwright test"` (kept
  **separate** from the existing vitest `test:e2e`). Document the run command.
- **Dep:** —  **FM-R:** R8.3
- **Verify:** `npm run build && npm run test:e2e:app` launches Electron headless
  and the smoke passes. If `_electron.launch` is unstable in this env, record the
  finding in STATE and keep it as a local gate (per design §8 risk).

### T3 — FsService: create / move / trash / exists / statFile  `[core]`
- **Do:** extend `fsService.ts` with `createFile`, `createDirectory`, `move`,
  `exists`, `statFile`, `trash` (+ `ConflictError`, name validation, `overwrite`
  handling, `EXDEV` fallback for move). Add `deps?: { trashItem }` DI to
  `createFsService`. Do **not** touch existing read methods.
- **Dep:** —  **FM-R:** R1, R3, R4, R6, R7
- **Verify:** extend `fsService.test.ts` (real temp dir): create file/dir,
  move/rename, exists, statFile, trash via fake `trashItem`, name-validation
  rejections, destination-escape rejections, conflict with/without `overwrite`.
  `npm test` green; touched-file coverage ≥90%.

### T4 — FsService: saveFile with concurrent-write (STALE) detection
- **Do:** add `saveFile(root, rel, content, { expectedMtimeMs })` returning
  `EntryMeta`; throw `ConflictError{code:'STALE'}` when `expectedMtimeMs` is set
  and on-disk mtime differs.
- **Dep:** T3  **FM-R:** R2.2, R2.3
- **Verify:** test writes a file, `statFile`, mutates it out-of-band (bump mtime),
  then `saveFile` with the stale baseline → throws STALE; without baseline →
  overwrites and returns fresh meta. Coverage ≥90%.

### T5 — FsService: importEntry + verify webUtils path resolution
- **Do:** add `importEntry(root, sourceAbs, destRel, {overwrite})` using
  `cpSync({recursive})`; source not root-checked, dest `resolveSafe`-checked.
  Manually verify `webUtils.getPathForFile` returns a real path on a dev drop
  (spike; wired for real in T8).
- **Dep:** T3  **FM-R:** R5, R6.1
- **Verify:** test imports a single file and a nested folder from a second temp
  dir into the workspace; asserts recursive copy + conflict behavior + dest-escape
  rejection. Coverage ≥90%.

### T6 — IPC handlers + main-process wiring
- **Do:** in `main/index.ts` register `fs:statFile|createFile|createDirectory|
  saveFile|move|importEntry|exists|trash`; construct service with
  `{ trashItem: shell.trashItem }`; implement the `CONFLICT:`/`STALE:` message
  convention (design §2).
- **Dep:** T3, T4, T5  **FM-R:** R6, R7
- **Verify:** extend `main/index.test.ts` for handler registration + trash
  injection + error-prefix preservation. `npm test` green; coverage ≥90%.

### T7 — Preload bridge: window.hive.fs.* + pathForFile
- **Do:** add nested `fs` namespace to `preload/index.ts` (all new methods +
  `pathForFile` via `webUtils`), with prefix→typed-error mapping; update
  `index.d.ts`.
- **Dep:** T6  **FM-R:** R1–R7
- **Verify:** extend `preload/index.test.ts`: each method invokes the right
  channel; `CONFLICT`/`STALE` rejections map to typed errors; `pathForFile`
  delegates to `webUtils`. Coverage ≥90%.

### T8 — Renderer: explorer actions (create/rename/delete/move + conflict + OS drop)
- **Do:** in `explorer/Explorer.tsx` add rail actions + row context menu, inline
  create/rename, delete-confirm `Dialog`, internal drag-move, external OS-drop →
  `pathForFile` → `importEntry`, and the `ConflictDialog`
  (Overwrite/Rename/Cancel). i18n keys in `pt-BR.ts`; icons in `ui/icons.tsx`;
  styles in `workbench.css`.
- **Dep:** T7  **FM-R:** R1, R3, R4, R5, R7, R6.2
- **Verify:** extend `Explorer.test.ts` (mocked `window.hive.fs`): create, rename,
  delete+confirm, internal move, synthesized OS `drop`→import, conflict dialog
  each branch. Coverage ≥90% on changed files.

### T9 — Renderer: promote FileViewer → editor (edit/save/dirty/STALE)
- **Do:** add Edit toggle, editable text surface, dirty tracking, Save/Discard,
  baseline via `statFile`, STALE `Dialog` (Recarregar/Sobrescrever), unsaved-guard.
  i18n + styles.
- **Dep:** T7  **FM-R:** R2
- **Verify:** `Explorer.test.ts` editor cases: edit→dirty→save calls `saveFile`
  with baseline; STALE rejection shows dialog and both branches work; discard
  restores. Coverage ≥90%.

### T10 — Regression + full coverage gate green
- **Do:** run full `npm run typecheck && npm run lint && npm run test:coverage`;
  fix any regression; confirm every touched file meets 90/90/90/90.
- **Dep:** T3–T9  **FM-R:** R8.1, R8.2
- **Verify:** all three commands exit 0; coverage report shows ≥90% on each
  created/changed file; no pre-existing test removed or weakened.

### T11 — E2E flows: create/edit/delete/rename/move/import (real Electron)
- **Do:** `e2e/file-management.spec.ts`: launch app on a throwaway workspace,
  drive the UI through create → edit+save → rename → internal move → delete, and
  invoke the import path; assert on-disk result after each. (OS-native drag
  simulated via the import IPC per design §8.)
- **Dep:** T2, T8, T9  **FM-R:** R8.3
- **Verify:** `npm run build && npm run test:e2e:app` passes end-to-end; on-disk
  assertions hold. Update ROADMAP M4 status + STATE lessons.

---

## Dependency graph
```
T1 [P] ┐
T2 [P] ┼─ (infra, independent)
T3 ──┬─► T4 ──┐
     ├─► T5 ──┼─► T6 ─► T7 ─┬─► T8 ─┐
     └────────┘             └─► T9 ─┼─► T10
                                    └─► T11 (needs T2,T8,T9)
```

## Commit plan (atomic)
One commit per task, message form: `feat(fs): <task summary> (T#)` /
`test(fs): …` / `chore(test): coverage gate (T1)`. Branch off `main` before T1
(current branch is `main`; do not commit feature work straight to it).

## Definition of done (feature)
- FM-R1…R7 implemented and demonstrated in the running app (`npm run dev`).
- FM-R8.1 no regression; FM-R8.2 ≥90% per changed file (enforced by T1 gate);
  FM-R8.3 Playwright/Electron E2E green.
- ROADMAP M4 marked done/expanded; STATE updated with any lessons
  (webUtils under sandbox, Playwright-Electron-in-WSL findings).
