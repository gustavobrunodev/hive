# Design — Explorer & Editor UX

Builds on M4's components. Reference reading: `spec.md`, `context.md`,
`src/renderer/src/explorer/Explorer.tsx`, `src/renderer/src/WorkUI.tsx`,
`design-system/src/components/Tree/Tree.tsx`,
`design-system/src/components/Resizable/Resizable.tsx`.

---

## 1. Component / file map (what changes where)

| Area | File | Change |
|---|---|---|
| DS Tree | `design-system/src/components/Tree/Tree.tsx` | Extend selection to be **modifier-aware** (Ctrl/Meta toggle, Shift range) — new `onActivate` signature + anchor tracking. |
| DS Tree tests | `design-system/src/components/Tree/Tree.test.tsx` | Cover the new modifier paths. |
| Editor | `renderer/src/explorer/Explorer.tsx` `FileViewer` | Edit-by-default, `Ctrl+S`, 3-way save-on-close, preview toggle, draft-preview, `.md`/`.html` preview panes. |
| Explorer | `renderer/src/explorer/Explorer.tsx` `FileTree` | Selection set + anchor, Ctrl/Shift handling, bulk delete, bulk drag-move, rename/create **blur-commit**. |
| Markdown | `renderer/src/ui/markdown.tsx` | Replace hand-rolled renderer with a `react-markdown`+`remark-gfm` component. |
| HTML preview | `renderer/src/explorer/HtmlPreview.tsx` (new) | Sandboxed `srcdoc` iframe + auto-reload. |
| Layout | `renderer/src/WorkUI.tsx` | Rail becomes a resizable panel; single persisted `Resizable` group. |
| Styles | `renderer/src/assets/workbench.css` | Rail-resize, selection, markdown/GFM (tables), iframe frame styling. |
| Preload (maybe) | `preload/index.ts` + `env.d.ts` | `openExternal(url)` bridge for UX-R7.3 (only if links are made clickable). |
| i18n | `renderer/src/i18n/pt-BR.ts` | New copy keys (save/discard/cancel, preview/edit, bulk-delete count, resize handle). |
| Deps | `hive-desktop/package.json` | `react-markdown`, `remark-gfm`. |
| E2E | `e2e/*.spec.ts` | UX-R9.3 scenarios. |

---

## 2. DS `Tree` — modifier-aware selection (UX-R3/R4)

**Problem:** today `TreeItem`'s `onClick` calls `onActivate(node.id)` with no
event, and `activate()` in single mode replaces, in multiple mode toggles — it
can't tell a plain click from Ctrl from Shift.

**Change (additive, backward-compatible):**
- Widen the internal activate contract to `onActivate(id, mods)` where
  `mods = { toggle: boolean; range: boolean }`, derived in `TreeItem`'s
  `onClick` from `event.ctrlKey || event.metaKey` (toggle) and `event.shiftKey`
  (range). Keyboard Enter/Space pass `{ toggle:false, range:false }`.
- In `Tree.activate`, when `selection === "multiple"`:
  - `range`: compute the visible-order slice of `enabledFlat` (Tree already has
    it) between the **anchor** and the clicked id, inclusive; set selection to
    that slice (OS "replace with range" semantics). Anchor unchanged.
  - `toggle`: add/remove the id; set **anchor = id**.
  - neither (plain click): replace selection with `[id]`; set **anchor = id**.
  - `selection === "single"` is unchanged (always replace) — existing callers
    unaffected.
- Track `anchorId` in a `useRef`/state inside `Tree`, seeded to the first plain
  selection. Expose nothing new externally beyond selection ids the app already
  controls via `selectedIds`/`onSelectedIdsChange`.

**Why in the DS, not the app:** the visible-flat order + anchor logic lives
where the flattening already is; keeps the app's render-prop dumb and makes the
behavior reusable (context.md R-B). The app keeps owning the selection *value*
(controlled `selectedIds`), so bulk actions read it directly.

**App side:** `FileTree` switches its `<Tree>` to `selection="multiple"`, owns
`selectedIds: string[]` + reconciles it on refresh (drop paths that no longer
exist). Plain-click **file** rows still call `onOpenFile` (open in viewer) via
`onSelectedIdsChange` when the resulting selection is exactly one file; a
Ctrl/Shift change never opens the viewer (UX-R3.2). Directory single-select
still sets `activeDirPath`.

## 3. Editor — edit-by-default, Ctrl+S, save-on-close, preview (UX-R1/R7/R8)

`FileViewer` state changes:
- **`editing` defaults to `true`** for editable files (UX-R1.1); the pencil
  toggle becomes a **`mode`** switch: `edit | preview` (preview only offered for
  `.md`/`.html`; other files: edit-only, or the existing `CodeBlock` read view
  for binary). Rename the concept from "editing on/off" to
  `mode: 'edit' | 'preview'`.
- **Draft is the source of truth for preview** (UX-R1.4/UX-R7.1): preview
  renders `draft`, not `viewerState.content`, so the toggle reflects unsaved
  edits live.
- **`Ctrl/Cmd+S`** (UX-R1.2): a keydown handler on the viewer root (or a
  `window` listener scoped while the viewer is mounted) calls `performSave(false)`
  when `dirty`, `event.preventDefault()`. Reuses the existing STALE flow.
- **Save-on-close/switch (UX-R1.3):** the `pendingDiscard` dialog gains a third
  button. Shape becomes `{ target } ` with actions **Salvar** (→ `performSave`,
  then on success continue to `target`/close; on STALE, surface the existing
  stale dialog and abort the close), **Descartar** (current behavior), **Cancelar**
  (dismiss, stay). Both the close button and the tree-driven `path`-switch guard
  route through it (both already do in M4).
- **Preview panes:**
  - `.md` → `<Markdown source={draft} />` (new component, §5) inside the
    existing `wb-viewer-scroll` / `hds-markdown` container.
  - `.html` → `<HtmlPreview source={draft} reloadKey={...} />` (§6).

## 4. Explorer — rename/create blur-commit + bulk ops (UX-R2/R5)

- **Blur-commit (UX-R2):** the two inline inputs' `onBlur` currently call
  `closeAllInputs()` (cancel). Change to: on blur, **commit** the current value
  through the same path Enter uses (`pendingInput.commit(value)` /
  `submitRename(value)`); an empty/invalid trimmed value falls back to cancel
  (no-op), so blur never errors. Guard against double-commit when Enter already
  fired (a `committedRef` flag cleared in `closeAllInputs`), and against the
  blur that fires when a conflict dialog opens (committing routes into the
  conflict flow, which unmounts the input — fine, but don't re-commit on its
  teardown blur).
- **Bulk delete (UX-R5.1):** the delete action reads `selectedIds`; if >1, the
  confirm dialog names the count (`t('explorer.deleteManyDescription', n)`) and
  `confirmDelete` iterates `window.hive.fs.trash` per item, collecting failures
  (per-item, non-aborting), then `refresh()` + clear selection. Single-select is
  the existing single-item path.
- **Bulk move (UX-R5.2):** `handleRowDragStart` — if the dragged path is in
  `selectedIds`, the drag payload is the whole selection; else it's just that
  row (and selection resets to it). `handleRowDrop`/`moveInternal` iterate the
  payload, each through `performMove` (conflict policy + guards). Skip any item
  where dest === its own parent or dest is self/descendant. Reconcile selection
  after (UX-R5.3).

## 5. Markdown renderer (UX-R7)

- New `renderer/src/ui/markdown.tsx` default export: a `<Markdown>` component
  wrapping `react-markdown` with `remarkPlugins={[remarkGfm]}`. No `rehype-raw`
  (don't render embedded raw HTML from artifacts — safer; GFM covers tables/
  task-lists/strikethrough).
- Keep the `hds-markdown` class wrapper so existing DS Markdown styling applies;
  add table styling to `workbench.css` (the DS token set already has the base).
- **Links (UX-R7.3):** pass a custom `a` component that calls
  `window.hive.openExternal(href)` (new preload bridge → `shell.openExternal`)
  on click and `preventDefault()`, so a link never navigates the renderer SPA.
  If we choose inert links instead, render `<span>` — decide at task time; the
  bridge is the better UX.
- Old `renderMarkdown()` callers (`FileViewer`) switch to `<Markdown>`. The old
  function + its unit test are removed (or the test repurposed to the new
  component). Watch the `i18n/noInlineStrings` test — markdown content is data,
  not UI copy, so it's exempt the same way file contents already are.

## 6. HTML preview (UX-R8)

- New `renderer/src/explorer/HtmlPreview.tsx`:
  ```
  <iframe
    className="wb-html-preview"
    title={t('explorer.htmlPreviewLabel')}
    sandbox="allow-scripts"          // no allow-same-origin ⇒ opaque origin, can't touch app
    srcDoc={source}
  />
  ```
- **Auto-reload (UX-R8.2):** `source` is `draft` (edits) and the file's on-disk
  content is already re-read by `FileViewer`'s load effect when `watchWorkspace`
  bumps the parent (M4 wiring). Changing `srcDoc` re-renders the iframe. If a
  forced remount is needed to reset iframe internal state, key the iframe on a
  monotonic `reloadKey` bumped on each disk-change load.
- **Security:** `allow-scripts` **without** `allow-same-origin` gives the frame
  an opaque origin — scripts run but can't reach `window.parent`, cookies, or
  the workspace. No `allow-top-navigation`. Matches `sandbox:true` posture.
- **Limitation (UX-R8.3):** `srcdoc` has no base URL, so `./asset` refs 404 —
  documented; local-server follow-up deferred.

## 7. Layout — resizable rail (UX-R6)

- `WorkUI` wraps the **whole body** in one horizontal DS `Resizable` group with
  panels `[rail, chat, viewer?]`:
  ```
  <Resizable orientation="horizontal" onLayoutChanged={persist} defaultLayout={restore()}>
    <ResizablePanel id="rail"  minSize={12} maxSize={40} defaultSize={22}> …FileTree… </ResizablePanel>
    <ResizableHandle withGrip />
    <ResizablePanel id="chat"  minSize={30} defaultSize={53}> …Chat… </ResizablePanel>
    {openPath && <><ResizableHandle/><ResizablePanel id="viewer" minSize={24} defaultSize={25}>…Viewer…</ResizablePanel></>}
  </Resizable>
  ```
- **Persistence (UX-R6.2):** DS `Resizable` exposes `defaultLayout`/
  `onLayoutChanged` (see its doc comment) — persist the layout array to
  `localStorage['hive.workLayout']`, restore on mount. The M4 note in
  `WorkUI.tsx` about Chat reconciling in place by `id` still holds (panels keyed
  by stable `id`; viewer joins/leaves).
- The rail's `wb-pane-header` + toolbar stay inside the rail panel.

## 8. Preload addition (only for UX-R7.3)

`openExternal(url: string): Promise<void>` → main `shell.openExternal` behind an
`ipcMain.handle`, mirrored in `env.d.ts`'s `window.hive` type. Validate the arg
is an `http(s):`/`mailto:` URL in main before opening (don't hand arbitrary
`file://`/`javascript:` to the OS). Skip this task entirely if links are made
inert instead.

---

## 9. Risks / watch-items

- **DS Tree is a shared package** — extending its selection contract must keep
  all existing `Tree` consumers (its stories/tests, any other app usage) green
  (UX-R9.1). Keep the change additive (new optional modifier path; single-mode
  untouched).
- **Blur-commit vs conflict/Escape races** — the trickiest bit; the
  `committedRef` guard + "invalid → cancel" rule (§4) must be unit-tested for:
  Enter-then-blur, Escape, blur-empty, blur-into-conflict-dialog.
- **`react-markdown` bundle in electron-vite renderer** — ESM, should bundle
  fine (DS already bundles ESM), but verify `npm run build` + a real render
  (Playwright MCP) — it's a new runtime dep in a sandboxed renderer.
- **React-duplication render-blocker — RESOLVED (2026-07-11).** The crash that
  kept the app from mounting past `#root` is fixed via
  `renderer.resolve.dedupe: ['react','react-dom']` in `electron.vite.config.ts`
  (STATE.md Lessons). UX-R9.3/R9.4 visual + E2E validation can now run against
  the real app.
- **Ctrl-click opening files** — ensure the "plain click on a single file opens
  viewer" path keys off *the resulting selection shape*, not the raw click, so
  Ctrl/Shift never trigger an open (UX-R3.2).

---

## Traceability

| Requirement | Design section | Primary files |
|---|---|---|
| UX-R1 edit-default/Ctrl+S/save-on-close | §3 | `Explorer.tsx` FileViewer, `pt-BR.ts` |
| UX-R2 rename/create blur-commit | §4 | `Explorer.tsx` FileTree |
| UX-R3 Ctrl multi-select | §2 | DS `Tree.tsx`, `Explorer.tsx` |
| UX-R4 Shift range-select | §2 | DS `Tree.tsx` |
| UX-R5 bulk delete + move | §4 | `Explorer.tsx` FileTree |
| UX-R6 resizable rail + persist | §7 | `WorkUI.tsx`, `workbench.css` |
| UX-R7 markdown preview (GFM) | §5, §8 | `ui/markdown.tsx`, preload, `workbench.css` |
| UX-R8 HTML live preview | §6 | `HtmlPreview.tsx`, `Explorer.tsx` |
| UX-R9 quality gates | all | tests, coverage config, e2e |
