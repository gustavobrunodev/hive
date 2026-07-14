# Design — Workspace Switching

**Feature:** `workspace-switching` (M8) · **Scope:** Large
Traces spec.md WS-R1…WS-R8 and context.md C1…C5.

---

## 1. Approach

Reuse everything already built for first-run/relaunch onboarding and re-enter it
from *inside* the running app for a newly-selected path. The core changes are:

1. **Detection becomes disk-based and path-aware** (C4/WS-R3): a new
   `provisionState(path)` in the main process checks
   `<path>/_bmad/_config/manifest.yaml`, exposed as a new `window.hive` method.
2. **The onboarding gate becomes re-enterable at runtime** (WS-R4): `App.tsx`'s
   existing state machine already flows `checkingProvisioned → installing |
   updating → ready`. We add a way to *re-trigger* that flow with a new path
   while the work UI is mounted, and route detection through the new path-aware
   check instead of the flag.
3. **A chip menu in `WorkUI`** (C1/WS-R1) surfaces "Abrir pasta…" + Recentes and
   calls a lifted `onSwitchWorkspace(path | pick)` handler in `App`.
4. **An MRU list** (`recentWorkspaces`) is added to `ConfigStore`
   (WS-R2) and maintained on every open.
5. **A switch guard** (C2/WS-R5): `WorkUI` observes the viewer's `dirty` state and
   the active session, running the existing three-way dialog before the switch.

No new agent, no new file engine (C5). Additive to `ConfigStore`,
`WorkspaceService`, `App`, `WorkUI`, preload, and i18n.

---

## 2. Data & persistence (ConfigStore)

Extend `Config` (`src/main/configStore.ts`):

```ts
export interface Config {
  workspacePath: string | null
  provisioned: boolean          // retained; still written by install() success.
                                //  No longer the source of truth for routing (C4).
  recentWorkspaces: string[]    // NEW — MRU, newest-first, deduped, capped at 10.
  lastModel: string | null
  lastEffort: string | null
}
```

- `DEFAULT_CONFIG.recentWorkspaces = []`. The `{ ...DEFAULT_CONFIG, ...parsed }`
  merge already back-fills the field for older config files — no migration code.
- New `ConfigStore` methods (mirroring the existing thin setters):
  - `getRecentWorkspaces(): string[]`
  - `pushRecentWorkspace(path: string): void` — unshift, dedupe (case-exact),
    cap at `MAX_RECENT_WORKSPACES = 10`.
  - `removeRecentWorkspace(path: string): void` — for WS-R2.3 pruning.
- `provisioned`: **kept** (harmless; still set by `install()` success), but
  routing no longer reads it. Documented as vestigial in the interface comment so
  a future cleanup is intentional, not accidental.

**Testability:** unchanged — `configStore.test.ts` already drives a real store on
a temp dir. New cases: MRU push/dedupe/cap/remove, and old-config back-fill.

---

## 3. Detection: path-aware provisioning (main)

`WorkspaceService` (`src/main/workspaceService.ts`) gains a disk check. It has no
`electron`/`fs` coupling today, so inject an `fs`-like predicate the same way
`dialog` is injected (keeps the module unit-testable without touching disk):

```ts
export interface WorkspaceService {
  chooseWorkspace(): Promise<string | null>          // now also pushes MRU
  getWorkspace(): string | null
  isProvisioned(): boolean                            // legacy flag reader — kept
  provisionState(path: string): boolean               // NEW — disk check, per path
  getRecentWorkspaces(): string[]                      // NEW
  openWorkspace(path: string): Promise<OpenResult>     // NEW — validate + persist + MRU
  // ...
}
```

- **Marker:** `existsSync(join(path, '_bmad', '_config', 'manifest.yaml'))`
  (Blocker B1). Injected as `pathExists(p): boolean` so tests pass a fake map.
- `openWorkspace(path)` (WS-R4/WS-R6.3): validate the path is an existing
  directory (`OpenResult = { ok: true; path } | { ok: false; reason }`); on
  success `setWorkspacePath` + `pushRecentWorkspace`; on failure (missing / not a
  dir) return the reason and `removeRecentWorkspace(path)` so a dead MRU entry
  self-prunes. `chooseWorkspace()` routes its picked path through the same
  `openWorkspace` persistence path.

**IPC (`src/main/index.ts`) + preload (`src/preload/index.ts`):**

| `window.hive` method | channel | returns |
|---|---|---|
| `provisionState(path)` | `workspace:provisionState` (invoke) | `boolean` |
| `getRecentWorkspaces()` | `workspace:recents` (invoke) | `string[]` |
| `openWorkspace(path)` | `workspace:open` (invoke) | `OpenResult` |

`chooseWorkspace()`/`getWorkspace()`/`isProvisioned()` stay. The install/update
streaming channels (`bmad:install:*`, `bmad:update:*`) are **unchanged** — they
already take `workspace` as an argument, so they just get the new path.

---

## 4. App-level routing (App.tsx)

Today `App` computes provisioning via `window.hive.isProvisioned()` (the flag).
Two changes:

1. **Path-aware detection everywhere** (WS-R3.3): the `checkingProvisioned`
   effect calls `window.hive.provisionState(workspacePath)` instead of
   `isProvisioned()`. This alone fixes the latent first-run bug (picking an
   already-provisioned folder now updates instead of reinstalling).

2. **Runtime switch entry** (WS-R4): add a handler passed down to `WorkUI`:

```ts
const handleSwitchWorkspace = useCallback((path: string) => {
  // path already validated + persisted + MRU-pushed by WorkUI via
  // window.hive.openWorkspace(); App just re-enters the gate for it.
  setOnboarding({ status: 'checkingProvisioned', workspacePath: path })
}, [])
```

Re-entering `checkingProvisioned` reruns the existing detection → `installing`
(`GuidedInstall`) or `updating` (`UpdateGate`) → `ready` (`WorkUI`) for the new
path. Because `WorkUI` is keyed by workspace (see §5), it fully re-mounts on the
new path (WS-R4.4 — fresh tree, fresh chat, no leaked state).

State machine (unchanged shape, new inbound edge from `ready`):

```
checking ─► picker ─► checkingProvisioned ─► installing ─► ready ─┐
                              ▲                    │               │
                              │                    └► (fresh WS)   │
                              └──────── switch (from WorkUI) ◄──────┘
                                          ▲
                          checkingProvisioned ─► updating ─► ready
```

---

## 5. WorkUI: chip menu + switch guard

### 5.1 Chip menu (WS-R1, C1)
- The `wb-workspace-chip` `<span>` becomes a DS menu trigger. Prefer the DS
  `Command`/menu primitive already used elsewhere; if no plain dropdown-menu
  primitive fits, use DS `Dialog`/`Popover`-style component or a small bespoke
  menu with the DS focus-ring pattern (`chat/IntentGrid.css` per the STATE
  presentational-as-button lesson).
- Menu content: **"Abrir pasta…"** → `window.hive.chooseWorkspace()`; **Recentes**
  → `window.hive.getRecentWorkspaces()` (loaded when the menu opens), excluding /
  marking the active path (WS-R1.4), each entry name + full-path tooltip. Empty
  Recentes ⇒ section omitted (WS-R1.3).
- Selecting either resolves to a **candidate path**, then goes through the guard
  (§5.2) before calling `onSwitchWorkspace(path)`.

### 5.2 Switch guard (WS-R5, C2)
The `dirty` flag currently lives **inside `FileViewer`** (Explorer.tsx:1253) and
is not visible to `WorkUI`. Lift visibility with an additive callback:

- `FileViewer` gains `onDirtyChange?(dirty: boolean)` and calls it in an effect on
  `dirty`. `WorkUI` holds `const [viewerDirty, setViewerDirty] = useState(false)`
  and passes the setter down. (No behavior change to the existing in-viewer
  guard; this only *exposes* the bit upward.)
- On a switch request with `viewerDirty === true`, `WorkUI` shows the same
  three-way dialog (reuse the DS `Dialog` + the existing
  `explorer.unsavedGuard*` i18n keys, or feature-scoped equivalents): **Salvar**
  (save the open file, then switch), **Descartar** (switch, drop edits),
  **Cancelar** (abort). Saving reuses the existing `window.hive.fs.saveFile`
  path already wired in `FileViewer`; simplest is to route the "save" branch by
  asking the viewer to flush (a `requestSave`/imperative handle) OR gate the
  switch on the user first saving — chosen approach: **lift a `requestFlush`ref**
  from `FileViewer` (small `useImperativeHandle`) so `WorkUI` can trigger save
  then continue. If that proves heavy, fall back to: block the switch and prompt
  the user to save/close first (still WS-R5-compliant, simpler).
- **Session teardown (WS-R5.2):** `Chat` is remounted by the workspace re-key
  (§5.3), which unmounts the old `Chat`. Ensure `Chat`'s unmount tears down its
  `agent.onEvent` subscription / any running session (verify `Chat`'s cleanup
  already does this on unmount; if a session is process-backed in main, add an
  `agent:stop`-on-unmount if missing). This is the one place to double-check in
  implementation.

### 5.3 Re-mount on switch (WS-R4.4)
`App` already swaps the `WorkUI` element when `workspacePath` changes, but to
guarantee a clean remount (no stale `openPath`, layout, session), render
`<WorkUI key={workspace} ... />` in `App` (or key the inner body on workspace).
Keying forces React to unmount the old subtree and mount fresh — the cheapest,
most reliable reset.

---

## 6. What is NOT changing

- **BmadService** (`install`/`update` streams) — already path-parameterized; no
  change. A post-switch install/update is the same code path as first-run.
- **File engine** (Explorer/FsService) — bespoke, kept (C5). Only `FileViewer`
  gains the additive `onDirtyChange` (and possibly a `requestFlush` handle).
- **Persisted layout** (`hive.workLayout`) — stays global (non-goal).
- **`provisioned` config flag** — kept, written by install success, no longer
  routed on.

---

## 7. Testing strategy (WS-R8)

- **Unit (main):** `configStore.test.ts` — MRU push/dedupe/cap/remove, old-config
  back-fill. `workspaceService.test.ts` — `provisionState` true/false by injected
  `pathExists`, `openWorkspace` success/missing-dir/not-a-dir + MRU side effects.
- **Component (renderer):** `App.test.ts` — `checkingProvisioned` now calls
  `provisionState` and routes install vs update by its result; switch handler
  re-enters the gate. New `WorkUI` menu tests — menu opens, lists recents, "Abrir
  pasta…" calls `chooseWorkspace`, selecting a recent invokes the guard then
  `onSwitchWorkspace`. Guard tests — dirty ⇒ dialog; Salvar/Descartar/Cancelar
  branches. `preload/index.test.ts` — new bridge methods shape.
- **E2E (`e2e/workspace-switching.spec.ts`, new):** seed `userData/config.json`
  pointing at provisioned workspace A (fixture with `_bmad/_config/manifest.yaml`),
  boot past the gate, open the chip menu, "Abrir pasta…" is not scriptable
  (native dialog — same limitation as M4/M7, see STATE T11 lesson), so drive the
  switch via a **recents selection** and/or a sanctioned test hook
  (`window.hive.openWorkspace(pathB)` + `onSwitchWorkspace`) mirroring
  `importEntry`'s test-hook approach. Assert: work UI rebinds to B, `config.json`
  active workspace + MRU updated; then switch to unprovisioned C (fixture with no
  `_bmad/`) and assert `GuidedInstall` appears. Real install/update against the
  live CLI is already covered by `bmadCli.e2e.test.ts`; this spec focuses on the
  **switch/routing/MRU** legs (mock or reuse the update short-circuit as needed).
- **Per-file 90% coverage** on all changed files (WS-R8.2).
- **Visual:** `_electron.launch` screenshots of the chip menu (open, with
  recents) and the post-switch work UI (WS-R8.4).

---

## 8. Risks & mitigations

- **Session teardown on remount (WS-R5.2)** — the one behavior to verify hands-on
  (does `Chat` unmount actually stop a live agent session in main?). Mitigation:
  explicit check in the switch task; add `agent:stop`-on-unmount if absent.
- **Dirty-state lifting** — additive callback, low risk. Keep the in-viewer guard
  intact; only expose the bit.
- **Native picker not E2E-scriptable** — reuse the established test-hook pattern
  (STATE T11/T14 lessons); don't try to automate the OS dialog.
- **`.code-workspace` / multi-root expectations** — out of scope (non-goal),
  called out so a reviewer doesn't expect VsCode parity beyond the interaction
  model.
