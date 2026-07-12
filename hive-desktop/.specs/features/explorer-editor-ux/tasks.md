# Tasks — Explorer & Editor UX

**STATUS: DONE (2026-07-12) — all 14 tasks (T1-T14) implemented, tested, and
committed on `main`.** T14 (E2E + Playwright MCP validation) closed the feature
out: `npm run build && xvfb-run -a npm run test:e2e:app` is green (10/10, both
`file-management.spec.ts` and the new `explorer-editor-ux.spec.ts`), `npm run
test` is green (330/330 unit tests), and a real defect found while validating
T11's rail-resize scenario (see STATE.md Lessons) was fixed, not worked around.
See STATE.md's Todos for the full completion note.

Atomic, independently-committable tasks. Each lists the UX-Rs it satisfies, its
dependencies, and a concrete verification. **Every task carries its own tests**
and must keep the per-file **≥90%** coverage gate green (UX-R9.2) — same rule as
M4. Node floor: `source ~/.nvm/nvm.sh && nvm use 22.22.1` before any
build/test/lint (STATE.md). Commit prefix suggestions in each task.

Prereq for visual/E2E tasks (UX-R9.3/R9.4) — **RESOLVED 2026-07-11:** the
React-duplication crash that blocked the app from reaching the work UI is fixed
(`renderer.resolve.dedupe: ['react','react-dom']` in `electron.vite.config.ts`,
STATE.md Lessons). The app now renders past `#root`, so Playwright-MCP + E2E
checks can run. Re-confirm with `npm run build && xvfb-run -a npm run
test:e2e:app` when reaching T14.

---

## Track A — foundations (parallelizable)

### [x] T1 — Markdown renderer via react-markdown + remark-gfm  *(UX-R7.1/7.2)*
- Add `react-markdown@^9` + `remark-gfm@^4` to `hive-desktop/package.json`
  (`npm install --install-links`).
- Replace `renderer/src/ui/markdown.tsx`: export a `<Markdown source>` component
  wrapping `react-markdown` with `remarkPlugins={[remarkGfm]}`, wrapped in the
  `hds-markdown` container. No `rehype-raw`.
- Add table + task-list styling to `workbench.css`; verify dark/light.
- Update `FileViewer`'s `.md` branch to render `<Markdown source={draft} />`.
  Remove old `renderMarkdown` + repurpose/remove its unit test.
- **Verify:** unit-render a doc with a table, nested list, link, task list, code
  fence → correct tags. `npm run build` succeeds with the new dep.
- **Depends:** none. **Commit:** `feat(md): react-markdown+gfm formatted preview (T1)`

### [x] T2 — DS Tree modifier-aware selection  *(UX-R3.1, UX-R4.1/4.2)*
- In `design-system/src/components/Tree/Tree.tsx`: widen the internal activate
  path to `onActivate(id, { toggle, range })`; derive from `ctrlKey||metaKey`
  (toggle) and `shiftKey` (range) in `TreeItem.onClick`; Enter/Space pass both
  false. Track an `anchorId`. In `activate` (multiple mode): plain→replace+set
  anchor; toggle→add/remove+set anchor; range→visible-order slice of
  `enabledFlat` anchor→id inclusive. Single mode unchanged.
- **Verify:** `Tree.test.tsx` — plain click replaces; Ctrl toggles keeping
  others; Shift selects the visible range from anchor; single-mode unaffected.
  All existing DS Tree tests stay green (UX-R9.1).
- **Depends:** none (DS package). **Commit:** `feat(tree): modifier-aware ctrl/shift selection (T2)`

### [x] T3 — Preload openExternal bridge  *(UX-R7.3)*
- Add `openExternal(url)` `ipcMain.handle` → `shell.openExternal`, validating
  `http(s):`/`mailto:` only; expose on `window.hive` + `env.d.ts`.
- **Verify:** main unit test rejects `file://`/`javascript:`, forwards `https:`.
- **Depends:** none. Skip only if T5-md links are made inert instead (design §8).
- **Commit:** `feat(ipc): openExternal bridge for preview links (T3)`

---

## Track B — editor (depends on Track A where noted)

### [x] T4 — HTML live preview component  *(UX-R8.1/8.2/8.3)*
- New `renderer/src/explorer/HtmlPreview.tsx`: sandboxed `srcDoc` iframe
  (`sandbox="allow-scripts"`, no same-origin), `reloadKey` remount on disk
  change. Style the frame in `workbench.css`.
- **Verify:** component test asserts `sandbox` value + `srcDoc` reflects source;
  changing `source`/`reloadKey` re-renders. Playwright MCP: an `.html` file
  renders visibly and updates after an on-disk edit.
- **Depends:** none (uses M4 watch). **Commit:** `feat(html): sandboxed live preview (T4)`

### [x] T5 — Editor: edit-by-default + mode toggle + draft-preview  *(UX-R1.1, UX-R1.4, wires R7/R8)*
- `FileViewer`: replace `editing` boolean with `mode: 'edit'|'preview'`; editable
  files default to `edit`. Preview offered only for `.md`/`.html`, renders
  **draft**. Pencil/eye toggles mode. Binary files keep the read `CodeBlock`.
- **Verify:** opening a `.txt`/`.md` lands in the textarea; toggling `.md` to
  preview shows unsaved edits rendered; binary stays read-only. Component tests +
  Playwright MCP snapshot of both modes.
- **Depends:** T1 (Markdown), T4 (HtmlPreview). **Commit:** `feat(editor): edit-by-default + preview toggle (T5)`

### [x] T6 — Ctrl+S + three-way save-on-close  *(UX-R1.2, UX-R1.3)*
- Add `Ctrl/Cmd+S` handler (scoped while viewer mounted) → save when dirty,
  `preventDefault`. Extend the unsaved-changes dialog to **Salvar / Descartar /
  Cancelar**; *Salvar* runs `performSave` then continues the close/switch (abort
  + show stale dialog on STALE); wire both close-button and tree `path`-switch.
- **Verify:** component tests: Ctrl+S saves dirty/no-op clean; close-while-dirty
  → Salvar persists then closes, Cancelar keeps open+dirty, Descartar drops.
  Playwright MCP: real Ctrl+S saves.
- **Depends:** T5. **Commit:** `feat(editor): ctrl+s and save-on-close prompt (T6)`

---

## Track C — explorer selection & bulk ops

### [x] T7 — Rename/create blur auto-commit  *(UX-R2.1/2.2)*
- Flip both inline inputs' `onBlur` from cancel to **commit** (same path as
  Enter); invalid/empty → cancel; `committedRef` guard against double-commit and
  the conflict-teardown blur; `Escape` still cancels.
- **Verify:** component tests: blur commits a valid rename/create; blur empty
  cancels; Enter-then-blur commits once; Escape cancels. Playwright MCP: rename,
  click elsewhere, name persists on disk.
- **Depends:** none. **Commit:** `feat(explorer): rename/create commit on blur (T7)`

### [x] T8 — Explorer multi-select wiring  *(UX-R3.2, UX-R4.2 app side)*
- `FileTree`: `<Tree selection="multiple">`; own `selectedIds: string[]`;
  reconcile on refresh (drop vanished paths). Open viewer only when the
  resulting selection is exactly one **file** (plain click); Ctrl/Shift never
  open. Directory single-select still sets `activeDirPath`. Selected rows get
  selected styling.
- **Verify:** component tests: Ctrl-click builds a set without opening; plain
  file click opens; refresh drops a deleted path from selection. Playwright MCP:
  Ctrl/Shift multi-highlight.
- **Depends:** T2. **Commit:** `feat(explorer): ctrl/shift multi-selection (T8)`

### [x] T9 — Bulk delete  *(UX-R5.1, UX-R5.3)*
- Delete action reads `selectedIds`; >1 → one confirm naming the count, iterate
  `fs.trash` per item (non-aborting, per-item error report), refresh + clear
  selection.
- **Verify:** component tests: 3-selection → one dialog → 3 trash calls; one
  failing item doesn't abort the rest; selection cleared. Playwright MCP:
  multi-delete from the UI.
- **Depends:** T8. **Commit:** `feat(explorer): bulk delete selection (T9)`

### [x] T10 — Bulk drag-move  *(UX-R5.2, UX-R5.3)*
- Drag of a selected row carries the whole selection; drag of an unselected row
  carries just it (resets selection). Iterate `performMove` per item (conflict
  policy + containment + self/descendant guards); reconcile selection after.
- **Verify:** component tests: dragging one of 3 selected moves all 3; dragging
  an unselected row moves only it; self/descendant drop skipped. Playwright MCP
  (synthetic DragEvents, per M4's E2E note).
- **Depends:** T8. **Commit:** `feat(explorer): bulk drag-move selection (T10)`

---

## Track D — layout

### [x] T11 — Resizable file-area divider + persistence  *(UX-R6.1/6.2/6.3)*
- `WorkUI`: wrap body in one horizontal `Resizable` `[rail, chat, viewer?]`;
  rail `minSize/maxSize/defaultSize`; `ResizableHandle withGrip`. Persist layout
  to `localStorage['hive.workLayout']` via `onLayoutChanged`/`defaultLayout`;
  restore on mount. Keep viewer's conditional join/leave by `id`.
- **Verify:** component test: layout persists to/reads from a mocked
  `localStorage`. Playwright MCP: drag rail divider, reload app, width restored;
  open/close viewer still works.
- **Depends:** none. **Commit:** `feat(layout): resizable persisted file rail (T11)`

---

## Track E — copy + gates

### [x] T12 — i18n copy  *(supports UX-R1/R2/R5/R6/R7/R8)*
- Add pt-BR keys: save/discard/cancel-on-close, preview/edit toggle labels,
  bulk-delete count description, resize-handle label, html/md preview labels,
  external-link. Keep the `noInlineStrings` test green. (Fold into the owning
  task's commit if preferred — listed separately for traceability.)
- **Depends:** interleaves with T5–T11. **Commit:** `i18n(ux): explorer/editor copy (T12)`

### [x] T13 — Coverage gate for changed files  *(UX-R9.1/9.2)*
- Add the new/changed files to the per-file 90% threshold list (mirror M4's
  vitest config pattern). Ensure full suite green.
- **Verify:** `npm run test` + coverage passes at ≥90% per changed file; no
  regression in M4/DS suites.
- **Depends:** T1–T11. **Commit:** `test(ux): per-file coverage gate (T13)`

### [x] T14 — E2E + Playwright MCP validation  *(UX-R9.3/9.4)*
- Extend the Playwright/Electron E2E: open→edit→Ctrl+S; close-dirty→Salvar;
  rename-blur; Ctrl multi-select→bulk delete; Shift range; rail resize persists;
  `.md` table renders; `.html` renders + auto-reloads — asserting on-disk /
  DOM results. Run the Playwright **MCP** pass over each visual behavior
  (context.md R-A). Note the STATE.md render-blocker prereq.
- **Verify:** `npm run build && xvfb-run -a npm run test:e2e:app` (once the
  render-blocker is resolved); MCP screenshots attached to the task notes.
- **Depends:** all. **Commit:** `test(e2e): explorer/editor ux flows (T14)`

---

## Dependency graph

```
T1 ─┐
T4 ─┼─► T5 ─► T6
T3 ─┘
T2 ─► T8 ─┬─► T9
          └─► T10
T7  (independent)
T11 (independent)
T1..T11 ─► T13 ─► T14   (T12 interleaves)
```

Parallelizable up front: **T1, T2, T3, T4, T7, T11**. T5 gates the editor
chain; T8 gates the bulk chain. T13/T14 close it out.
