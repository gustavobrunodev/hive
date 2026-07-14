# Context — Workspace Switching

User decisions captured during Specify's discuss phase (2026-07-12). These
resolve the gray areas that shaped the spec/design.

---

## C1 — Switch entry point: chip menu with "Abrir pasta…" + Recentes

The active-workspace chip in the `WorkUI` topbar becomes a **menu trigger**.
The menu offers **"Abrir pasta…"** (native directory picker) and a **Recentes**
(MRU) section. No native OS menu bar (File ▸ Open Folder) in v1 — it can be added
later over the same IPC without rework.

**Why:** Closest to VsCode's model while staying inside our DS chrome; the chip
already shows the active workspace, so it's the natural affordance. Recents make
repeat-switching between a squad's few workspaces fast.

## C2 — Guard on switch: reuse the three-way save dialog + tear down session

Switching with **unsaved edits** shows the existing **Salvar / Descartar /
Cancelar** guard (the explorer-editor-ux close/switch guard) before proceeding;
"Cancelar" aborts the switch. The **active agent chat session** is torn down
cleanly before the new workspace mounts.

**Why:** Consistent with how closing/switching a file already behaves; avoids
silent data loss and orphaned sessions bound to the old workspace.

## C3 — Same window (replace context in place)

Switching **replaces the current window's** workspace context; the work UI
re-mounts bound to the new path. No multi-window / new-window-per-workspace.

**Why:** Single-window Electron app; in-place replacement is simple, coherent,
and enough for the squad workflow. Multi-window is a large, separable effort.

## C4 — Detection is disk-based on `_bmad/_config/manifest.yaml`, not the config flag

Install-vs-update for a selected folder is decided by the **on-disk presence of
`<workspace>/_bmad/_config/manifest.yaml`** (Blocker B1's verified marker),
evaluated per-path — replacing reliance on the global `config.provisioned` flag,
which is meaningless for an arbitrary newly-selected folder.

**Why (technical, but user-visible):** Without this, picking a folder that already
has BMAD would wrongly re-run a full install, and the global flag can be stale
from a previous workspace. This also fixes the same latent bug in the existing
first-run/relaunch routing (WS-R3.3).

## C5 — Engine stays bespoke (no VsCode-engine swap)

Explicitly evaluated mid-planning: **do not** replace the file/editor engine with
a VsCode-based one (code-oss/Theia/Monaco). Keep the DS-native M4/M7 engine; this
feature borrows VsCode's **workspace interaction model** (open folder, recents,
in-place switch), not its codebase. Monaco (editor-only) was **not** adopted and
was **not** queued as a spike — revisit only if a future need for code-editor
features arises.

**Why:** A full engine swap contradicts G5 / "first-party Hive product, not a
wrapper", discards validated M4/M7 work, and the desired VsCode-like UX is
achievable as a thin layer over the existing engine. User decision.
