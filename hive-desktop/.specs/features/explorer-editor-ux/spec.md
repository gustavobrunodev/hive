# Spec — Explorer & Editor UX (melhorias de experiência)

**Feature dir:** `.specs/features/explorer-editor-ux/`
**Milestone:** new **M7 — Explorer & Editor UX** (ROADMAP.md); builds directly on
**M4 — file-management** (`FileTree`/`FileViewer` in `explorer/Explorer.tsx`,
`WorkUI.tsx`, DS `Tree`/`Resizable`).
**Scope:** Large/Complex — multi-component: DS `Tree` extension (main design-system
package), renderer editor + explorer + app layout, a new markdown dependency, a
new HTML-preview surface, and new tests.
**User decisions:** see `context.md` (C1–C4 + cross-cutting R-A/R-B).

---

## Problem

M4 delivered file management, but the day-to-day editing/organizing flow still
feels like a tool, not a native app:

- Opening a file lands in **read-only**; you must find and click a pencil to
  edit, and there is **no `Ctrl+S`** — the muscle-memory save is dead.
- Closing a file with unsaved edits offers only **discard** — there is no
  "salvar antes de fechar".
- Renaming and then clicking away **throws the rename away** (blur cancels).
- You can only ever select/act on **one** file at a time — no OS-style
  Ctrl/Shift multi-select, so deleting or moving several files is N trips.
- The file rail is a **fixed width** — no way to widen it for deep trees or
  narrow it to reclaim space.
- Markdown renders through a **limited hand-rolled parser** (no tables, links,
  nested lists) and there is **no HTML preview** at all.

## Goal

Make the explorer + editor feel like a first-party desktop editor: files open
ready to edit and save with `Ctrl+S`; edits are never silently lost; selection,
rename, and resize behave the way every OS file manager does; and Markdown/HTML
artifacts can be previewed formatted, live.

---

## Requirements (traceable)

### UX-R1 — Edit-by-default, Ctrl+S, save-on-close  *(F1)*
- **UX-R1.1** Opening any editable text file lands **directly in edit mode**
  (the `<textarea>` surface), not read-only. Binary files stay non-editable
  (unchanged from M4's `isEditablePath`).
- **UX-R1.2** **`Ctrl+S` / `Cmd+S`** saves the open file when it is dirty (same
  save + STALE concurrent-write detection M4 already implements). The browser's
  default save dialog is prevented. A no-op when not dirty.
- **UX-R1.3** Closing (or switching away from) a file with **unsaved changes**
  prompts **Salvar / Descartar / Cancelar** (three-way), replacing M4's
  discard-only confirm. *Salvar* runs the same save path (including STALE
  handling) then completes the close/switch; *Cancelar* leaves the file open
  and dirty.
- **UX-R1.4** Preview toggle (UX-R7/UX-R8) is available from edit mode without
  losing the current draft; toggling to preview shows the **draft** content
  (what the user is editing), not the last-saved disk content.

### UX-R2 — Rename auto-commit on blur  *(F2)*
- **UX-R2.1** Editing a file/folder name and then **clicking outside the input
  (blur)** commits the rename (same move + conflict policy FM-R7 as Enter),
  instead of cancelling it. `Escape` still cancels; an empty/invalid name on
  blur cancels (no-op) rather than erroring.
- **UX-R2.2** The same blur-commits behavior applies to the inline **create**
  input (new file/folder): blur with a valid name creates it; blur empty
  cancels.

### UX-R3 — Ctrl/Cmd individual multi-select  *(F3)*
- **UX-R3.1** **Ctrl/Cmd + click** on a row toggles that row's membership in the
  selection without clearing the others (OS behavior). A plain click still
  replaces the selection with just that row.
- **UX-R3.2** The selection is a set of paths; every selected row shows the
  selected treatment. Opening a file in the viewer (plain click on a file) is
  unchanged; Ctrl/Cmd-click does **not** open the file in the viewer, only
  toggles selection.

### UX-R4 — Shift range-select  *(F4)*
- **UX-R4.1** **Shift + click** selects the contiguous range, in **visible
  (rendered) order**, from the selection **anchor** (the last plainly-clicked
  row) to the shift-clicked row inclusive — matching OS file managers.
- **UX-R4.2** A plain click (and a Ctrl/Cmd-click) sets a new anchor; a
  subsequent Shift-click extends from that anchor. Range spans only currently
  **visible** rows (collapsed-folder children are not in the range).

### UX-R5 — Bulk actions over the selection  *(F3/F4 → C3)*
- **UX-R5.1** **Bulk delete:** deleting with a multi-selection trashes **every**
  selected item (recursively, via OS trash) behind **one** confirmation naming
  the count; a per-item failure does not abort the rest (report per-item, like
  FM-R5.3 import).
- **UX-R5.2** **Bulk move (drag):** dragging a row that is part of the current
  selection moves the **entire** selection into the drop-target folder; each
  item honors the conflict policy (FM-R7) and the workspace-containment +
  self/descendant guards (a folder can't be dropped into itself or its own
  descendant). Dragging a row that is **not** in the selection moves just that
  row (and resets selection to it), as today.
- **UX-R5.3** Mutations that consume the selection (delete/move) clear or
  reconcile it afterward so no stale (now-nonexistent) path stays selected.

### UX-R6 — Resizable file-area divider  *(F5)*
- **UX-R6.1** The right edge of the file rail (`wb-rail`) is a **draggable
  divider**: the user can widen/narrow the rail to any size within sane
  min/max bounds. Keyboard-resizable (DS `ResizableHandle` is `role="separator"`
  with arrow-key support) and accessible.
- **UX-R6.2** The chosen rail width **persists** across app launches
  (`localStorage`, via the DS `Resizable` layout-persistence hooks), so the user
  doesn't re-drag every session.
- **UX-R6.3** The chat/viewer split M4 already provides keeps working; the rail
  joins the same resize model without breaking the "viewer only exists while a
  file is open" behavior.

### UX-R7 — Formatted Markdown preview  *(F6 → C2)*
- **UX-R7.1** A `.md` file offers a **preview** toggle that renders the
  **current draft** as formatted Markdown using **`react-markdown` +
  `remark-gfm`**: headings, lists (incl. nested), links, **tables**, task
  lists, blockquotes, inline/fenced code. Replaces `ui/markdown.tsx`'s
  hand-rolled renderer.
- **UX-R7.2** Rendered output is styled with the DS Markdown tokens/classes
  already used (`hds-markdown`) and is theme-aware (dark/light).
- **UX-R7.3** Links in preview do **not** navigate the app/renderer; external
  links open via the OS handler (`shell.openExternal` through the preload
  bridge) or are inert — never an in-app navigation that could break the SPA.

### UX-R8 — HTML live preview  *(F7 → C4)*
- **UX-R8.1** An `.html`/`.htm` file offers a **preview** toggle that renders
  the current draft inside a **sandboxed `<iframe>`** (`srcdoc`, locked-down
  `sandbox` allowlist — scripts allowed, no same-origin escalation).
- **UX-R8.2** **Auto-reload:** when the file changes on disk (agent write, or
  the user's own save), the preview re-renders from the new content without a
  manual refresh (reuse the `watchWorkspace` signal M4 wired).
- **UX-R8.3** Known limitation (documented, per C4): relative asset references
  (`./style.css`, `./app.js`, local images) may not resolve under `srcdoc`; if
  users need them, a local static server is the deferred follow-up.

### UX-R9 — Quality gates (acceptance)
- **UX-R9.1** All pre-existing suites stay green (no regression) — including the
  M4 file-management unit/component suites and the DS `Tree` suite.
- **UX-R9.2** **≥90%** coverage (statements/branches/lines/functions) for every
  file **created or changed** by this feature, matching M4's per-file gate.
- **UX-R9.3** E2E (Playwright driving the real Electron app) exercises: open→edit
  →`Ctrl+S`, close-while-dirty→Salvar, rename-blur-commit, Ctrl multi-select +
  bulk delete, Shift range-select, rail resize persists, `.md` preview renders a
  table, `.html` preview renders + auto-reloads. Extends
  `e2e/file-management.spec.ts` (or a sibling spec).
- **UX-R9.4** Every visual behavior is validated in the running app via the
  **Playwright MCP** during execution (context.md R-A), not asserted blind.

---

## Non-goals (this feature)
- **Split editor+preview** (side-by-side) — toggle only for now (C1).
- **Real local HTTP server** for HTML preview — sandboxed `srcdoc` only (C4);
  relative-asset support is a deferred follow-up.
- **Syntax-highlighted / language-aware code editing** — the editor stays a
  plain `<textarea>` (M4 non-goal unchanged); Markdown/HTML get *preview*, not a
  rich editor.
- **Cross-folder multi-select / multi-workspace** — selection is within the one
  active workspace and its currently-rendered tree.
- **Undo/redo of bulk file operations** — OS trash remains the delete safety net
  (M4 non-goal unchanged).
- **Multi-file open (tabs)** — one viewer pane, one open file, as M4.

## Assumptions
- M4 (`file-management`) is on `main` and its APIs (`window.hive.fs.*`,
  `readFile`, `watchWorkspace`, `saveFile` STALE detection) are the substrate —
  this feature adds no new main-process FS *mechanism* except possibly a
  `shell.openExternal` bridge for UX-R7.3.
- DS `Tree` already supports `selection="multiple"`; it must be **extended** to
  pass pointer modifier keys (Ctrl/Meta/Shift) to its selection logic and to
  compute Shift ranges from its own visible-flat order (context.md R-B).
- `react-markdown@^9` + `remark-gfm@^4` are React-18-compatible (React 18.3.1
  is pinned) and are added to `hive-desktop` (not the DS) unless reused elsewhere.
- `sandbox: true` + `contextIsolation: true` stay on — iframe preview uses
  `srcdoc` (renderer-only), and any `shell.openExternal` routes through preload.

## Traceability
UX-R1…UX-R9 map to design components in `design.md §Traceability` and to atomic
tasks in `tasks.md` (each task lists the UX-Rs it satisfies). This feature
supersedes the original file-management spec's "single-item selection" non-goal
(UX-R3/R4/R5) — noted there is intentional.
