# Spec — File Management (Gerenciamento completo de arquivos)

**Feature dir:** `.specs/features/file-management/`
**Milestone:** promotes & expands **M4 — File editing** (ROADMAP.md); adds create/
delete/rename/move/import on top of it.
**Scope:** Large/Complex (multi-component: main FsService + IPC + preload bridge +
renderer explorer/editor + new test infra).

---

## Problem

The explorer today is **read-only** (`fsService.ts` exposes only `listTree` /
`readFile` / `watchWorkspace`; `Explorer.tsx` only browses and views). A user
who wants to organize their workspace — create a doc, fix a typo in a generated
artifact, delete a stale file, or pull a reference file in from Windows — has to
leave the app and use a terminal or Explorer. This breaks the product thesis
("a user with no terminal knowledge …") the MVP established.

## Goal

Full in-app file management for the active workspace: **create, edit, delete,
rename, move, and import (drag from Windows/OS into any workspace folder)**, with
the tree staying correct and live after every operation, and the same
workspace-containment security guarantee the read paths already enforce.

---

## Requirements (traceable)

### FM-R1 — Create
- **FM-R1.1** Create an empty file at any workspace-relative directory (root or
  any subfolder), via a tree/toolbar action.
- **FM-R1.2** Create a new (empty) folder at any workspace-relative directory.
- **FM-R1.3** Reject empty/invalid names (path separators, `.`/`..`, names that
  escape the root). On name-already-exists, apply the conflict policy (FM-R7).

### FM-R2 — Edit
- **FM-R2.1** Promote the read-only viewer to an editor: edit a text file's
  content in-app with dirty-state tracking (unsaved-changes indicator, discard).
- **FM-R2.2** Save edited content back to disk.
- **FM-R2.3** **Concurrent-write awareness:** if the agent/BMAD (or anything
  else) modified the file on disk after it was opened, saving must detect the
  drift (mtime/size baseline captured at open) and warn before overwriting,
  offering reload-vs-overwrite. Never silently clobber an agent write.

### FM-R3 — Delete
- **FM-R3.1** Delete a file or folder (recursively) via the OS trash
  (recoverable), always behind an explicit confirmation dialog.

### FM-R4 — Rename & Move
- **FM-R4.1** Rename a file/folder in place.
- **FM-R4.2** Move a file/folder to another workspace folder via internal
  drag-and-drop within the tree.
- **FM-R4.3** Renames/moves honor the conflict policy (FM-R7) when the target
  name already exists, and are rejected if the target escapes the root.

### FM-R5 — Import from OS (drag from Windows)
- **FM-R5.1** Dropping one or more files from the host OS (Windows Explorer /
  Finder) onto a workspace folder copies them into that folder.
- **FM-R5.2** Dropping a folder copies it in **recursively**.
- **FM-R5.3** Imports honor the conflict policy (FM-R7); a failed item must not
  abort the rest of a multi-item drop (report per-item).

### FM-R6 — Correctness & security (invariants)
- **FM-R6.1** Every mutation's **destination** is resolved and contained within
  the workspace root (reuse/extend `resolveSafe`); escapes throw and are
  surfaced as errors, never executed. Import **sources** may be arbitrary OS
  paths (they're being copied in), but the write target is always contained.
- **FM-R6.2** After any successful mutation the tree reflects reality without a
  manual reload (the existing `watchWorkspace` refresh path must cover
  programmatic mutations too; add an explicit refresh only if a mutation isn't
  reliably caught by the watcher).

### FM-R7 — Conflict policy (cross-cutting, per user decision)
- On any create/import/move whose target already exists, **prompt per item**:
  **Overwrite / Rename / Cancel**. No silent overwrite, no silent auto-rename.
  The service layer stays mechanism-only (exists-check + explicit
  overwrite/target-name); the policy/prompt lives in the renderer.

### FM-R8 — Quality gates (acceptance)
- **FM-R8.1** All pre-existing test suites stay green (no regression).
- **FM-R8.2** **≥90%** coverage in **statements, branches, lines, and functions**
  for every file **created or changed** by this feature, enforced by tooling
  (`@vitest/coverage-v8` with per-file thresholds on the touched files).
- **FM-R8.3** **E2E** coverage (Playwright driving the **real Electron app**
  against a throwaway workspace) exercises create, edit+save, delete, rename,
  internal move, and OS import, asserting the on-disk result.

---

## Non-goals (this feature)
- Multi-file/multi-select bulk operations beyond a single OS drop (single-item
  selection model kept; a dropped multi-file set is the one batch case).
- Rich text / WYSIWYG editing, syntax-aware code editing, or binary-file
  editing (text/UTF-8 editor only; binary files remain view-or-import only).
- Undo/redo of file operations inside the app (OS trash is the delete safety
  net; other ops are not journaled).
- Cross-workspace operations; everything is scoped to the one active workspace.
- Cloud sync (already a deferred idea in STATE.md).

## Assumptions
- Electron ≥ 39 (present) → `shell.trashItem` and `webUtils.getPathForFile`
  are available for trash and dropped-path resolution respectively.
- `sandbox: true` + `contextIsolation: true` stay on → all privileged FS access
  and `webUtils`/`shell` access route through the preload bridge (renderer can't
  import `electron`).
- Single active workspace at a time (matches `WorkspaceService`).

## Traceability
Requirements FM-R1…FM-R8 are mapped to design components in `design.md §Traceability`
and to atomic tasks in `tasks.md` (each task lists the FM-Rs it satisfies).
