# Design — File Management

Builds strictly on the existing layering (main service → IPC → preload bridge →
renderer), mirroring how `FsService`/`AgentService` are already wired. No new
architectural pattern is introduced; this feature *widens* the FS surface from
read-only to read-write and adds two host-OS capabilities (trash, dropped-path
resolution) through the same bridge.

```
 Windows/OS ──drag──▶ Renderer (Explorer/Editor)
                          │  window.hive.fs.*  (typed bridge)
                          ▼
                    preload/index.ts  ──ipc──▶  main/index.ts (fs:* handlers)
                                                     │
                                                     ▼
                                              main/fsService.ts
                                    (resolveSafe on every destination)
                                                     │
                                     ┌───────────────┴───────────────┐
                                 node:fs                     injected trashItem
                                                             (shell.trashItem)
```

---

## §1 — FsService (main/fsService.ts) — extend

Keep the existing `resolveSafe`, `listDir`, `joinRelative`, and read methods
untouched (regression surface). Add write methods, all routed through
`resolveSafe` for their **destination**. Switch new I/O to the existing sync
style for consistency with the current file (sync `fs`), *except* trash which is
inherently async.

New/changed exported surface:

```ts
export interface EntryMeta { mtimeMs: number; size: number }

export interface FsService {
  // --- existing (unchanged) ---
  listTree(root, relativePath?): TreeNode[]
  readFile(root, relativePath): string
  watchWorkspace(root, onChange): () => void

  // --- new ---
  /** Stat a file for the edit baseline (FM-R2.3). Throws if outside root / not a file. */
  statFile(root: string, relativePath: string): EntryMeta

  /** Create an empty file (FM-R1.1). `overwrite=false` throws EEXIST-like if target exists. */
  createFile(root: string, relativePath: string, opts?: { overwrite?: boolean }): void
  /** Create a directory, recursive (FM-R1.2). No-op-safe if it already exists. */
  createDirectory(root: string, relativePath: string): void

  /**
   * Save text content (FM-R2.2/R2.3). If `expectedMtimeMs` is given and the
   * on-disk mtime differs, throws a ConflictError (discriminable `code`) instead
   * of writing — the renderer turns that into the reload-vs-overwrite prompt.
   * Returns the new EntryMeta so the editor can refresh its baseline.
   */
  saveFile(root, relativePath, content, opts?: { expectedMtimeMs?: number }): EntryMeta

  /** Rename/move within the workspace (FM-R4). Both ends resolveSafe-checked. */
  move(root, fromRel, toRel, opts?: { overwrite?: boolean }): void

  /** Copy an arbitrary OS path INTO the workspace, recursive for dirs (FM-R5). */
  importEntry(root, sourceAbsPath: string, destRel: string, opts?: { overwrite?: boolean }): void

  /** Does a workspace-relative path already exist? (conflict pre-check, FM-R7) */
  exists(root, relativePath): boolean

  /** Delete to OS trash (FM-R3). Async — trashItem is async. */
  trash(root, relativePath): Promise<void>
}
```

**Design decisions**
- **DI for trash (C2):** `createFsService(deps?: { trashItem?: (abs: string) => Promise<void> })`.
  Default is unset; `main/index.ts` injects `shell.trashItem`. Tests inject a
  fake (records the path) — keeps `fsService.ts` Electron-free per its contract.
- **ConflictError:** a small `class ConflictError extends Error { code = 'CONFLICT' }`
  (or `{ code: 'STALE' }` for the mtime-drift case) so IPC/renderer can branch on
  `code` rather than parsing messages. Serialize `code` across IPC (see §3).
- **Import source validation (FM-R6.1):** `sourceAbsPath` is NOT `resolveSafe`-d
  against root (it's outside by definition) — but `destRel` is. Use
  `fs.cpSync(sourceAbsPath, resolveSafe(root,destRel), { recursive: true, errorOnExist: !overwrite, force: overwrite })`.
- **Move across dirs:** `fs.renameSync`; on `EXDEV` fall back to `cpSync` + `rmSync`
  (unlikely within one workspace, but cheap to be correct).
- **Name validation (FM-R1.3):** reject `''`, names containing `/` or `\`, and
  `.`/`..` at the create/rename entry points (before `resolveSafe`, for a clearer
  error than "escapes root").

## §2 — IPC handlers (main/index.ts) — add

Follow the existing `fs:listTree`/`fs:readFile` request/response pattern
(`ipcMain.handle`). Inject `shell.trashItem` when constructing the service:

```ts
import { shell } from 'electron'
const fsService = createFsService({ trashItem: (abs) => shell.trashItem(abs) })

ipcMain.handle('fs:statFile',       (_e, root, rel) => fsService.statFile(root, rel))
ipcMain.handle('fs:createFile',     (_e, root, rel, opts) => fsService.createFile(root, rel, opts))
ipcMain.handle('fs:createDirectory',(_e, root, rel) => fsService.createDirectory(root, rel))
ipcMain.handle('fs:saveFile',       (_e, root, rel, content, opts) => fsService.saveFile(root, rel, content, opts))
ipcMain.handle('fs:move',           (_e, root, from, to, opts) => fsService.move(root, from, to, opts))
ipcMain.handle('fs:importEntry',    (_e, root, src, dest, opts) => fsService.importEntry(root, src, dest, opts))
ipcMain.handle('fs:exists',         (_e, root, rel) => fsService.exists(root, rel))
ipcMain.handle('fs:trash',          (_e, root, rel) => fsService.trash(root, rel))
```

**Error serialization:** `ipcMain.handle` already rejects the renderer promise on
throw, but the thrown `Error`'s custom `code` is lost across the structured-clone
boundary (only `message`/`name` survive). Wrap handlers that can throw
`ConflictError` so the `code` is preserved — e.g. rethrow as
`new Error(JSON.stringify({ code, message }))` and parse in the bridge, **or**
simpler: prefix the message (`CONFLICT: …` / `STALE: …`) and have the bridge map
prefix→typed rejection. Pick the prefix approach (least ceremony, already how the
codebase reasons about errors in `bmadService`). Document the chosen convention
inline.

## §3 — Preload bridge (preload/index.ts) — add

Group new methods under a nested `fs` namespace on `window.hive` (the flat
top-level `listTree`/`readFile` predate the namespacing convention that
`agent`/`workflows` now follow; new methods adopt the namespace, existing ones
stay put for zero regression). Add the two host-OS helpers:

```ts
fs: {
  statFile, createFile, createDirectory, saveFile, move, importEntry, exists, trash,
  // Turn a dropped renderer File into its absolute OS path. webUtils is
  // main/preload-only under sandbox:true — this is the ONLY way the renderer
  // can learn a dropped file's path (FM-R5). Electron ≥32.
  pathForFile: (file: File): string => webUtils.getPathForFile(file),
}
```

Each `fs.*` invoke method maps a `CONFLICT:`/`STALE:`-prefixed rejection back to
a typed error (`{ code: 'CONFLICT' | 'STALE' }`) so the renderer branches cleanly.
`index.d.ts` updated to type the new `window.hive.fs` surface.

## §4 — Renderer: Explorer (explorer/Explorer.tsx) — extend

`FileTree` gains **actions** and **drag-and-drop**; `FileViewer` becomes an
**editor**. New small pieces kept inside `explorer/**` (T12's touch scope) plus a
reusable confirm/conflict dialog.

- **Toolbar / context actions:** rail header buttons "New file" / "New folder"
  (create at root or selected folder), and a per-row context menu (right-click /
  kebab `IconButton`) with New, Rename, Delete. Reuse DS `Command`/`Dialog`
  primitives; new icons added to `ui/icons.tsx`.
- **Inline rename:** selected row swaps its label for a text input (Enter commit /
  Esc cancel); commit calls `fs.move(root, old, newInSameDir)`.
- **Create flow:** action → inline "new item" input row → `fs.createFile/createDirectory`.
- **Delete flow:** DS `Dialog` confirm ("Mover para a Lixeira?") → `fs.trash`.
- **Internal drag-drop (FM-R4.2):** tree rows draggable; dropping onto a directory
  row calls `fs.move`. Guard against dropping a folder into its own descendant.
- **External OS drop (FM-R5):** `onDrop` on folder rows / rail. For each
  `e.dataTransfer.files` item → `window.hive.fs.pathForFile(file)` → `fs.importEntry`.
  Prevent default; show a drop-target highlight on `dragover`.
- **Conflict handling (FM-R7):** before create/move/import, `fs.exists(target)`;
  if true, open a `ConflictDialog` (Overwrite / Rename / Cancel). "Rename" opens
  the inline name input. On Overwrite, re-call with `{ overwrite: true }`. A
  multi-item drop resolves conflicts item-by-item.
- Live refresh (FM-R6.2) already handled by the existing `watchWorkspace` effect;
  mutations that the watcher may miss (rare) trigger an explicit `refreshToken` bump.

## §5 — Renderer: Editor (promote FileViewer)

- Add an **Edit** toggle in the viewer header (text files only; binary/unknown
  stays read-only). Editing shows an editable text surface (a controlled
  `<textarea>` styled to match the DS code/markdown surface — no new dep).
- **Baseline:** on open, capture `EntryMeta` via `fs.statFile`. Track `dirty`
  (content ≠ last-saved). Header shows a dirty dot; **Save** and **Discard**
  actions appear when dirty.
- **Save (FM-R2.2/2.3):** `fs.saveFile(root, path, content, { expectedMtimeMs })`.
  On `STALE` rejection → `Dialog`: "O arquivo mudou no disco" with
  **Recarregar** (drop edits, re-read) / **Sobrescrever** (`saveFile` without
  `expectedMtimeMs`). On success, refresh baseline from returned `EntryMeta`.
- Unsaved-changes guard when switching files / closing the viewer.

## §6 — i18n (i18n/pt-BR.ts)
All new copy (button labels, menu items, dialog titles/bodies, error/empty
states) added as `t()` keys under an `explorer.*` / `fs.*` namespace — no inline
literals (D10). Includes conflict, trash-confirm, and stale-file strings.

## §7 — Styling (assets/workbench.css)
Context menu, drag-over highlight, inline-input row, editor surface, dirty
indicator — reuse DS tokens (`--ink`/`--bg`/`--focus`) per the T20 lesson;
add a `:focus-visible` ring for any presentational-clickable rows (IntentGrid.css
lesson).

## §8 — Testing strategy

| Layer | File(s) | What it proves | FM-R |
|-------|---------|----------------|------|
| Unit (main) | `fsService.test.ts` (extend) | Each new op against a **real temp dir**: create/save/move/import/exists/statFile; **security** (destination escape rejection for create/save/move/import target); name validation; conflict (`overwrite` on/off); **STALE** detection (mutate mtime between statFile and saveFile); trash via **injected fake** `trashItem` (asserts the resolved abs path). Recursive folder import. | R1–R6 |
| Unit (main) | `index.test.ts` (extend) | New `fs:*` handlers wired; `shell.trashItem` injection; `CONFLICT`/`STALE` message convention preserved across the handler boundary. | R6 |
| Unit (preload) | `index.test.ts` (extend) | `fs.*` bridge methods invoke the right channels; prefix→typed-error mapping; `pathForFile` delegates to `webUtils`. | R5,R7 |
| Component (renderer) | `Explorer.test.ts` (extend) | jsdom + mocked DS + mocked `window.hive.fs`: create/rename/delete(+confirm)/internal-move; **OS drop** (synthesize a `drop` event with a fake `dataTransfer.files` + stubbed `pathForFile`) → `importEntry`; **conflict dialog** (exists→Overwrite/Rename/Cancel); **editor** save + **STALE** reload/overwrite branch; dirty-guard. | R1–R7 |
| Coverage | `vitest.config.ts` + `@vitest/coverage-v8` | Per-file **≥90%** stmts/branches/lines/funcs on every touched file; `npm run test:coverage`. | R8.2 |
| **E2E (Playwright + real Electron)** | `e2e/file-management.spec.ts`, `playwright.config.ts` | `_electron.launch` the built app on a throwaway workspace; drive UI to create → edit+save → rename → internal move → delete, and simulate an OS import; **assert on-disk** results each step. New `test:e2e:app` script (distinct from the vitest node `test:e2e`). | R8.3 |

**Coverage config note:** vitest `coverage.thresholds` supports per-glob entries.
Set global `off`/low and add explicit 90/90/90/90 entries for each touched file
glob (`src/main/fsService.ts`, `src/preload/index.ts`, `src/renderer/src/explorer/**`,
etc.) so the gate grades only changed files (FM-R8.2's exact wording).

**E2E dependency reality check:** the app builds and launches headlessly under
`xvfb-run` (proven in the T20 lesson). Playwright's Electron support drives the
real main+renderer+IPC+FS path — no `claude`/`bmad` CLI needed for these flows
(pure FS), so unlike `bmadCli.e2e.test.ts` there's **no external-CLI gap** here.
OS-native drag from Windows Explorer can't be literally driven by Playwright, so
FM-R5 is E2E-covered by invoking the same import path the drop handler calls
(`window.hive.fs.importEntry` via a test hook / evaluate), with the *drop-event →
pathForFile* wiring covered at the component layer.

---

## §Traceability (requirement → component/task)

| Requirement | Design | Task(s) |
|-------------|--------|---------|
| FM-R1 Create | §1 create*, §4 actions | T3, T7 |
| FM-R2 Edit/save/concurrency | §1 statFile/saveFile, §5 editor | T4, T9 |
| FM-R3 Delete (trash) | §1 trash + DI, §2, §4 | T3, T7 |
| FM-R4 Rename/Move | §1 move, §4 inline+drag | T3, T8 |
| FM-R5 Import (OS drop) | §1 importEntry, §3 pathForFile, §4 drop | T5, T8 |
| FM-R6 Security/live | §1 resolveSafe, §4 refresh | T3, T6, T10 |
| FM-R7 Conflict policy | §1 overwrite/exists, §4 ConflictDialog | T3, T7, T8 |
| FM-R8 Quality gates | §8 | T1, T2, T10, T11 |

## Risks / watch-items
- **Watcher double-fire:** programmatic mutations trigger the `watchWorkspace`
  refresh AND the explicit refresh — ensure idempotent (refresh is a re-`listTree`,
  so double is harmless, just avoid fl:00 loops).
- **`webUtils.getPathForFile` availability** under sandbox: verify in a real
  `npm run dev` drop early (T5) — it's the linchpin of FM-R5.
- **Playwright + Electron in WSL2/xvfb** headless flakiness: budget a
  spike at T2; if `_electron.launch` proves unstable in CI, fall back to
  documenting it as a `test:e2e:app` gate run locally (like the existing node
  smoke), not deleted.
- Keep `fsService.ts` Electron-free (DI) — the moment it imports `electron`,
  its whole no-fakes-needed test story breaks.
