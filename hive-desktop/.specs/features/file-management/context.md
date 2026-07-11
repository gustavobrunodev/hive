# Context — File Management (user decisions for gray areas)

Captured from the Discuss step (2026-07-11). These are binding for design/tasks.

| # | Gray area | Decision | Consequence |
|---|-----------|----------|-------------|
| C1 | **E2E strategy** | **Playwright driving the real Electron app** (packaged/`_electron.launch`), against a throwaway workspace, asserting on-disk results. | New test infra: `@playwright/test`, `playwright.config.ts`, `e2e/` dir, a `test:e2e:app` script kept **separate** from the existing vitest node smoke (`test:e2e`). Highest fidelity, biggest infra add. |
| C2 | **Delete semantics** | **OS trash (`shell.trashItem`) + confirmation dialog.** Recoverable. | `FsService` must stay Electron-free (its own doc-contract) → inject a `trashItem` fn into `createFsService` (same DI pattern as `WorkspaceService`'s `DialogLike`). Renderer shows a DS `Dialog` confirm before calling. |
| C3 | **Conflict (target exists)** | **Prompt per item: Overwrite / Rename / Cancel.** No silent overwrite or auto-rename. | Service layer = mechanism only (exists-check + explicit `overwrite`/target name). Policy/prompt lives in the renderer. A multi-item drop prompts per conflicting item. |
| C4 | **Edit depth** | **Editor with save + concurrent-write awareness.** | Promote `FileViewer` → editor with dirty tracking; capture an mtime/size baseline at open; on save, if disk drifted (agent/BMAD wrote under it) warn with reload-vs-overwrite. Realizes ROADMAP M4's "awareness of concurrent agent writes." |

## Derived design constraints
- **Security asymmetry (FM-R6.1):** import *sources* are arbitrary OS paths;
  write *targets* are always `resolveSafe`-contained. Two different validations,
  don't conflate them.
- **Sandbox boundary:** `webUtils.getPathForFile` (to turn a dropped `File` into
  an absolute OS path) and `shell.trashItem` are main/preload-only under
  `sandbox:true` — both must be surfaced through `window.hive`, never imported
  in the renderer.
- **Coverage scope (FM-R8.2):** 90% is required on *changed/created files only*,
  so thresholds are configured per-file (globs) rather than as a single global
  gate that would wrongly grade untouched files.
