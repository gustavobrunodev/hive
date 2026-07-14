# Feature Spec — Workspace Switching (VsCode-style)

**Milestone:** M8 · **Feature slug:** `workspace-switching` · **Scope:** Large
**Status:** 📝 Planned (2026-07-12)

---

## Summary

Let the user **open/switch to another workspace from within the running app**,
mirroring VsCode's "Open Folder" + "Open Recent" experience, and — on selecting a
workspace — run the correct BMAD lifecycle flow for that folder:

- If the selected folder **does not** have BMAD → run the **guided install** from
  scratch (the existing `GuidedInstall` first-run flow).
- If the selected folder **already** has BMAD → run the **update** flow only (the
  existing `UpdateGate`).

Today the workspace is chosen exactly once (first-run `WorkspacePicker`) and can
never be changed without editing `config.json` by hand. This feature makes the
workspace a runtime-switchable context, keyed on a **disk-based** detection of
BMAD provisioning rather than the current global `config.provisioned` flag.

## Goals (traceability to PROJECT goals)

- Advances **G1 (Zero-terminal BMAD)** and **G3 (Artifacts in context)** — the
  user works across multiple BMAD workspaces without touching a terminal or
  restarting the app.

## Non-Goals (v1 of this feature)

- **Multiple windows.** Switching replaces the current window's context in place
  (context.md C3). One workspace is active at a time.
- **Native OS menu bar (File ▸ Open Folder / Open Recent).** The switch affordance
  lives on the in-app workspace chip menu (context.md C1). A native menu can come
  later without changing the underlying IPC.
- **Reconciling a partially/differently-provisioned BMAD** (e.g. a different BMAD
  version, half-written `_bmad/`). Detection is binary: manifest present ⇒ update,
  absent ⇒ install. Deeper repair is out of scope.
- **Per-workspace window state / layout.** The persisted rail layout
  (`localStorage['hive.workLayout']`) stays global, as today.

---

## Requirements

### WS-R1 — Switch affordance (chip menu)

- **WS-R1.1** The active-workspace chip in the `WorkUI` topbar
  ([WorkUI.tsx:89](../../../src/renderer/src/WorkUI.tsx#L89)) becomes an
  interactive menu trigger (button semantics, keyboard-operable, DS
  `:focus-visible` ring per the STATE lesson on presentational-as-button).
- **WS-R1.2** Activating it opens a menu containing: **"Abrir pasta…"** (opens the
  native directory picker) and a **"Recentes"** section listing recently-opened
  workspaces (WS-R2), most-recent first, each showing folder name + full path (as
  tooltip/secondary text). Selecting a recent entry switches to it.
- **WS-R1.3** When there are no recent workspaces other than the active one, the
  Recentes section is omitted (only "Abrir pasta…" shows).
- **WS-R1.4** The currently-active workspace is visually indicated in the list (or
  omitted from Recentes) so the user never "switches" to where they already are.

### WS-R2 — Recent workspaces (MRU) persistence

- **WS-R2.1** The app persists a **most-recently-used list** of workspace paths in
  `config.json` (`recentWorkspaces: string[]`), newest-first, de-duplicated,
  capped at a fixed maximum (**10**).
- **WS-R2.2** Any successful workspace open (first-run pick, "Abrir pasta…", or a
  recent selection) moves that path to the front of the MRU.
- **WS-R2.3** A recent entry whose folder no longer exists on disk is tolerated:
  selecting a missing folder surfaces a non-fatal error (WS-R6.3) and does not
  crash; it may be pruned from the MRU on that failure.

### WS-R3 — Disk-based provisioning detection

- **WS-R3.1** Provisioning is detected by the **presence of
  `<workspace>/_bmad/_config/manifest.yaml`** on disk (Blocker B1's verified
  marker), evaluated **for the specific selected path** — not from the global
  `config.provisioned` flag.
- **WS-R3.2** A new IPC/`window.hive` method reports provisioning **for an
  arbitrary path** (independent of what is persisted as the active workspace).
- **WS-R3.3** First-run and relaunch routing (`App.tsx`) migrate to this
  path-aware detection so that a first-run pick of an **already-provisioned**
  folder correctly routes to **update**, not a redundant install (a real gap in
  today's flag-only logic).

### WS-R4 — Switch flow (install vs. update, same window)

- **WS-R4.1** Selecting a workspace persists it as the active workspace and as the
  MRU head, then routes the app back through the onboarding gate for the **new**
  path: `checkingProvisioned` → (`installing` | `updating`) → `ready`.
- **WS-R4.2** If the new workspace is **not** provisioned (WS-R3.1 false) → show
  `GuidedInstall` (config form → install stream) for it, exactly as first-run.
- **WS-R4.3** If the new workspace **is** provisioned → show `UpdateGate` (update
  stream, with retry / "continuar mesmo assim" on error) for it, exactly as a
  relaunch.
- **WS-R4.4** The switch happens **in the same window**; the work UI re-mounts
  bound to the new workspace (fresh file tree, fresh chat session, no leaked state
  from the previous workspace).
- **WS-R4.5** Cancelling the native picker (or dismissing the menu) is a no-op —
  the current workspace and work UI remain untouched.

### WS-R5 — Unsaved-work & active-session guard

- **WS-R5.1** If an open file has **unsaved edits** (the `FileViewer` `dirty`
  state) when a switch is initiated, reuse the existing three-way guard
  (**Salvar / Descartar / Cancelar**) before proceeding — consistent with the
  explorer-editor-ux close/switch guard. "Cancelar" aborts the switch.
- **WS-R5.2** The **active agent chat session** for the current workspace is torn
  down cleanly before the new workspace mounts (no orphaned session/streaming
  subscription bound to the old workspace).
- **WS-R5.3** The guard triggers on **all** switch entry points (recent selection
  and "Abrir pasta…").

### WS-R6 — States & errors

- **WS-R6.1** During install/update after a switch, the same progress surfaces as
  first-run/relaunch (`GuidedInstall` step list / `UpdateGate` caption) are shown,
  bound to the new workspace.
- **WS-R6.2** A failed install/update after a switch offers **Retry** and (for
  update) **"continuar mesmo assim"**, matching current behavior — the user is
  never stranded on a dead gate.
- **WS-R6.3** Selecting a workspace that cannot be opened (missing folder, not a
  directory, unreadable) surfaces a clear, non-fatal error and leaves the previous
  workspace active.

### WS-R7 — i18n

- **WS-R7.1** All new UI copy (menu labels, "Abrir pasta…", "Recentes", switch
  guard reuse, errors) is added to `renderer/i18n/pt-BR.ts` via `t()` — no inline
  literals (D10).

### WS-R8 — Quality gates (mirrors prior features)

- **WS-R8.1** No regression: full unit/component suite (`npm run test`) green.
- **WS-R8.2** **≥90% coverage per changed file** (per-file gate, matching M4/M7).
- **WS-R8.3** **E2E** (`e2e/*.spec.ts`, real `_electron.launch`): a scenario that
  boots into workspace A, switches to a **provisioned** workspace B (→ update →
  work UI bound to B) and to an **unprovisioned** workspace C (→ guided install →
  work UI bound to C), asserting the real on-disk / DOM result and that
  `config.json` reflects the new active workspace + MRU.
- **WS-R8.4** Visual validation of the chip menu and switch flow via the same
  `_electron.launch` screenshot approach used for M7 (the Playwright **MCP** tools
  do not reach this Electron renderer — STATE T14 lesson).

---

## Acceptance (feature "done")

A user in workspace A clicks the workspace chip, picks "Abrir pasta…" (or a
recent), and — with no terminal and without restarting — lands in workspace B:
BMAD is **installed** if B lacked it or **updated** if B already had it, the file
tree and chat rebind to B, and B becomes the remembered workspace (and MRU head)
for the next launch. Unsaved edits are guarded first; the old chat session is
gone. WS-R8 gates pass.

---

## Open questions / risks

- **Dirty state is local to `FileViewer`** (Explorer.tsx) — WS-R5.1 requires
  lifting/observing it at `WorkUI`/`App` level (see design.md §5). Low risk,
  additive callback.
- **`config.provisioned` becomes vestigial** once routing is disk-based (WS-R3).
  Design.md §6 decides whether to keep it (harmless, still written by install) or
  remove it; spec requires only that routing no longer *depends* on it.
