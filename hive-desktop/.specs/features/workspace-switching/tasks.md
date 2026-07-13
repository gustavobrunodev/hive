# Tasks — Workspace Switching (M8)

**STATUS: DONE (2026-07-12) — all 10 tasks (T1-T10) implemented, tested, and
committed on `main`.** T10 (full suite, coverage gate, docs) closed the feature
out: `npm run test` is green (389/389 unit/component tests), `npm run
typecheck` is clean, `npm run lint` has no new errors from this feature's files
(2 pre-existing `Explorer.tsx` set-state-in-effect errors predate this feature,
from T8 of `explorer-editor-ux`), and per-file coverage is ≥90% on every T1-T9
touched file. T9's E2E suite (`npm run build && xvfb-run -a npm run
test:e2e:app`) was already confirmed green in that task. See STATE.md's Todos
for the full completion note.

Atomic tasks with verification + requirement traceability. Order respects
dependencies; `[P]` marks tasks parallelizable with their siblings. Each task is
one focused, committable change. Coverage gate: **≥90% per changed file**
(WS-R8.2). Run env: `source ~/.nvm/nvm.sh && nvm use 22.22.1` before any
`npm run …` (STATE lesson — nvm doesn't persist across tool calls).

Legend: `[ ]` todo · `[x]` done.

---

## [x] T1 — ConfigStore: recentWorkspaces (MRU) `[P]`
**Traces:** WS-R2.1–R2.3
- Add `recentWorkspaces: string[]` to `Config` + `DEFAULT_CONFIG` (`= []`).
- Add `getRecentWorkspaces`, `pushRecentWorkspace` (unshift + dedupe + cap 10 via
  `MAX_RECENT_WORKSPACES`), `removeRecentWorkspace`.
- Comment `provisioned` as retained-but-vestigial-for-routing (design §2/§6).
**Verify:** `configStore.test.ts` new cases — push moves to front, dedupe keeps
one, cap holds at 10, remove prunes, old config without the field back-fills to
`[]`. `npm run test -- configStore` green; per-file coverage ≥90%.

## [x] T2 — WorkspaceService: path-aware detection + openWorkspace `[P]`
**Traces:** WS-R3.1–R3.2, WS-R2.2, WS-R6.3
- Inject `pathExists(p)` + `isDirectory(p)` predicates (DI, like `dialog`).
- `provisionState(path)` → `pathExists(join(path,'_bmad','_config','manifest.yaml'))`.
- `getRecentWorkspaces()` delegates to ConfigStore.
- `openWorkspace(path): OpenResult` — validate existing dir; on ok
  `setWorkspacePath` + `pushRecentWorkspace`; on fail return reason +
  `removeRecentWorkspace`. Route `chooseWorkspace()`'s picked path through the
  same persistence.
**Depends:** T1. **Verify:** `workspaceService.test.ts` — provisionState
true/false by fake map; openWorkspace ok/missing/not-a-dir with MRU side effects;
chooseWorkspace still returns null on cancel and now MRU-pushes on success.
Per-file ≥90%.

## [x] T3 — IPC + preload bridge for new methods
**Traces:** WS-R3.2, WS-R2, WS-R6.3
- `src/main/index.ts`: `workspace:provisionState`, `workspace:recents`,
  `workspace:open` handlers → WorkspaceService.
- `src/preload/index.ts`: `provisionState(path)`, `getRecentWorkspaces()`,
  `openWorkspace(path)` on `window.hive`; types in `src/preload/index.d.ts`.
**Depends:** T2. **Verify:** `preload/index.test.ts` asserts new methods invoke
the right channels; `index.test.ts` (main) covers new handlers; `npm run
typecheck` clean.

## [x] T4 — App.tsx: route detection through provisionState (fixes latent bug)
**Traces:** WS-R3.3
- Replace `isProvisioned()` in the `checkingProvisioned` effect with
  `provisionState(workspacePath)`. First-run pick of an already-provisioned
  folder now routes to `updating`, not `installing`.
**Depends:** T3. **Verify:** `App.test.ts` — provisioned path ⇒ `updating`
screen; unprovisioned ⇒ `installing`. Existing onboarding tests still green.
Per-file ≥90%.

## [x] T5 — App.tsx: runtime switch entry (re-enter gate from WorkUI)
**Traces:** WS-R4.1, WS-R4.4
- Add `handleSwitchWorkspace(path)` setting
  `{ status: 'checkingProvisioned', workspacePath: path }`; pass to `WorkUI`.
- Render `<WorkUI key={workspace} … onSwitchWorkspace={…} />` so a switch fully
  re-mounts the work subtree.
**Depends:** T4. **Verify:** `App.test.ts` — invoking the passed handler with a
new path re-enters the gate and (via provisionState) lands on install/update for
that path; WorkUI remounts (assert fresh mount via key). Per-file ≥90%.

## [x] T6 — FileViewer: expose dirty upward (onDirtyChange)
**Traces:** WS-R5.1 (enablement)
- Add optional `onDirtyChange?(dirty: boolean)` to `FileViewer`; fire in an
  effect on the existing `dirty`. No change to the in-viewer guard behavior.
- (If needed for the "Salvar" branch) add a minimal `requestFlush` imperative
  handle; otherwise defer to T8's simpler block-and-prompt fallback.
**Depends:** none (additive) `[P]` with T1/T2. **Verify:** `Explorer.test.ts` —
`onDirtyChange(true)` fires when draft diverges, `(false)` after save/close.
Existing viewer/guard tests unchanged. Per-file ≥90%.

## [x] T7 — WorkUI: workspace chip menu (Abrir pasta + Recentes)
**Traces:** WS-R1.1–R1.4, WS-R7
- Turn `wb-workspace-chip` into a DS menu trigger (focus-ring per STATE lesson).
- On open, load `getRecentWorkspaces()`; render "Abrir pasta…" + Recentes
  (active path excluded/marked, empty ⇒ omitted; name + full-path tooltip).
- "Abrir pasta…" → `chooseWorkspace()`; recent → its path. Resolved candidate
  path handed to the guard (T8). New i18n keys in `pt-BR.ts`.
**Depends:** T3 (recents IPC). **Verify:** `WorkUI` component tests — menu opens,
lists recents excluding active, empty-omits, "Abrir pasta…" calls chooseWorkspace,
recent select yields the path to the switch pipeline. Per-file ≥90%.

## [x] T8 — WorkUI: switch guard + session teardown + wire to App
**Traces:** WS-R5.1–R5.3, WS-R4.5, WS-R6.3
- Hold `viewerDirty` (from T6). On a candidate switch path: if dirty ⇒ three-way
  dialog (Salvar/Descartar/Cancelar, reuse `explorer.unsavedGuard*` keys);
  Cancelar aborts, Descartar/Salvar proceed. Not dirty ⇒ proceed directly.
- Proceed = `await window.hive.openWorkspace(path)`; on `ok` call
  `onSwitchWorkspace(path)`; on failure show non-fatal error, stay put (WS-R6.3).
  Cancelled picker (null) = no-op (WS-R4.5).
- Confirm `Chat` unmount (via the T5 key remount) tears down its agent session /
  `onEvent` subscription; add `agent:stop`-on-unmount if missing (design §5.2/§8).
**Depends:** T5, T6, T7. **Verify:** component tests for each guard branch;
open-failure keeps prior workspace; a real check (manual/E2E) that no old session
event arrives after switch. Per-file ≥90%.

## [x] T9 — E2E + visual validation
**Traces:** WS-R8.3, WS-R8.4
- `e2e/workspace-switching.spec.ts` (new): fixtures for provisioned workspace B
  (`_bmad/_config/manifest.yaml` present) and unprovisioned C. Boot seeded into A;
  drive switch to B via recents/`openWorkspace` test-hook (native "Abrir pasta…"
  dialog not scriptable — STATE T11/T14); assert work UI rebinds to B and
  `config.json` active + MRU updated; switch to C ⇒ `GuidedInstall` shown.
- `_electron.launch` screenshots: chip menu open (with recents) + post-switch
  work UI (WS-R8.4).
**Depends:** T8. **Verify:** `npm run build && xvfb-run -a npm run test:e2e:app`
green (both existing and new specs).

## [x] T10 — Full suite, coverage gate, docs
**Traces:** WS-R8.1–R8.2
- `npm run test` (all unit/component) green; `npm run typecheck`; `npm run lint`.
- Per-file ≥90% on every changed file.
- Update ROADMAP M8 → Done, STATE decision + any lessons, mark tasks `[x]`.
**Depends:** T9. **Verify:** all gates green; ROADMAP/STATE updated.

---

## Dependency graph

```
T1 ─┬─► T2 ─► T3 ─► T4 ─► T5 ─┐
    │                          ├─► T8 ─► T9 ─► T10
T6 ─┴──────────────► T7 ──────┘
```

T1, T2, T6 can start in parallel. T7 needs T3 (recents IPC). T8 joins T5+T6+T7.
T9/T10 close out.

## Notes
- The install/update **streams are unchanged** — a post-switch install/update is
  the exact first-run/relaunch code path with a new `workspace` arg.
- No file-engine changes (C5). Only `FileViewer` gains an additive `onDirtyChange`
  (+ optional flush handle).
- If T8's listing of steps reveals hidden complexity in session teardown, split it
  (guard vs. teardown) into T8a/T8b per the skill's safety valve.
