# Roadmap — Hive Desktop

Milestones are ordered by dependency. The **MVP is a vertical slice** that proves
the end-to-end axis; breadth comes after the axis is proven.

---

## M0 — Foundations (app shell) ✅ Done (2026-07-10)

Electron + React scaffold, TypeScript, `@hive/design-system` wired in, secure IPC
baseline (contextIsolation, no nodeIntegration in renderer), theming (dark/light
from DS), packaging able to launch.

**Exit criteria:** app launches on the dev machine, renders a DS-styled shell,
main↔renderer IPC round-trips. — met (T1–T3).

---

## M1 — MVP: Vertical Slice ⭐ ✅ Done (2026-07-10)

**Feature:** `mvp-vertical-slice`

The thinnest end-to-end path that proves the product thesis:

1. **First-run onboarding** — pick a workspace → guided visual BMAD install into it.
2. **Workspace file explorer** — browse/open/view files of the chosen workspace.
3. **Agent chat (Claude CLI adapter)** — one working agent, streamed into a
   visual chat (not a raw terminal).
4. **One workflow, guided** — new-session placeholder "Create a PRD" launches the
   corresponding BMAD workflow through the agent.
5. **Artifact in context** — the produced PRD appears in the file explorer and
   is viewable in the app.
6. **Auto-update on subsequent launch** — BMAD is updated before showing the
   workspace (workspace remembered from first run).

**Exit criteria:** a user with no terminal knowledge installs BMAD, asks the agent
to create a PRD, and sees `PRD.md` appear in the explorer — all inside the app.
— met (T0–T20; T16 file attachments, should-have, deferred to M2 per spec's own
"drop if time-boxed" allowance). Real-CLI E2E smoke (`npm run test:e2e`) covers
the BMAD install/update legs against the live CLI; the chat/PRD-generation leg
is covered by scripted-adapter tests + a live UI pass (no real `claude` CLI
available in the build sandbox — see STATE.md Deferred Ideas).

---

## M2 — Chat completeness

Model selection, effort selection, file attachments into context, MCP usage,
conversation history, session resume. All surfaced through the agent-adapter
capability contract so they stay agent-agnostic.

**Feature (first slice): `chat-controls` ✅ Done (2026-07-13)** — a
**pause/interrupt** control that stops the in-flight `claude -p` turn (reusing
`agent.stop()`, keeping partial output) and a **slash-command menu**: typing `/`
in the composer opens a keyboard-navigable, type-to-filter list of the workspace's
discovered BMAD skills (fed by `bmad-help.csv` via a new full-`listSkills`
discovery), each launchable as a workflow turn. The Claude CLI's own slash
commands are unavailable in `-p` mode, so the app supplies its own (agent-agnostic,
sourced from BMAD workspace metadata). Plan in `.specs/features/chat-controls/`.

## M3 — Full workflow catalog

All upstream placeholders (Domain Research, PRD, Brainstorm, Architecture, Story)
wired to BMAD workflows; dynamic discovery of installed BMAD workflows as fallback
to the curated catalog.

## M4 — File editing ✅ Done (2026-07-11)

**Feature:** `file-management`

Promoted the read-only viewer to a real editor (edit/save artifacts in place,
with concurrent-write awareness), plus full workspace file-management: create,
rename, delete (system trash), internal move (drag), and OS-drag import — all
with security (workspace-escape rejection), conflict handling (overwrite/
rename/cancel), and live-refresh awareness of concurrent agent writes.

**Exit criteria:** FM-R1–R7 implemented and demonstrated in the running app;
FM-R8.1 no regression; FM-R8.2 ≥90% coverage per changed file; FM-R8.3
Playwright/Electron E2E. — met (T1–T11). Unit/component coverage (main,
preload, renderer) is green. The T11 E2E spec (`e2e/file-management.spec.ts`)
drives the real Electron app through create → edit+save → rename → internal
move (synthetic `DragEvent`s at the row elements — real OS-level HTML5 DnD
isn't reliably drivable via Playwright/Electron) → import (via the sanctioned
`window.hive.fs.importEntry` test-hook call, per design.md §8, since OS-native
drag-from-Windows can't be simulated) → delete, asserting the **on-disk**
result after each step. It currently cannot complete end-to-end in this dev
sandbox for a reason unrelated to file-management itself — see STATE.md's
T11 lesson (a duplicate-React-module crash from the in-flight, uncommitted
design-system rework blocks the app from ever reaching the work UI at all
right now). Kept as a local/manual gate rather than a blocking CI requirement
until that's resolved, per design.md's flagged E2E-instability risk allowance.

## M7 — Explorer & Editor UX 📝 Planned (2026-07-11)

**Feature:** `explorer-editor-ux`

Seven UX improvements on top of M4's file management, planned via tlc-spec-driven
(spec/design/tasks in `.specs/features/explorer-editor-ux/`): (F1) files open
already editable with `Ctrl+S` save + three-way save-on-close; (F2) rename/create
auto-commit on blur; (F3) `Ctrl`-click individual multi-select; (F4) `Shift`-click
range-select; (F5) resizable, persisted file-rail divider; (F6) formatted Markdown
preview via `react-markdown`+`remark-gfm`; (F7) sandboxed HTML live preview with
disk auto-reload. Full OS-like multi-select drives bulk delete + bulk drag-move
(supersedes M4's single-item non-goal). User decisions captured in `context.md`
(C1–C4). Requires the DS `Tree` extended for modifier-aware selection.

**Exit criteria:** UX-R1–R8 implemented and demonstrated in the running app;
UX-R9.1 no regression; UX-R9.2 ≥90% coverage per changed file; UX-R9.3 E2E +
UX-R9.4 Playwright-MCP visual validation. **Prereq (RESOLVED 2026-07-11):** the
React-duplication render-blocker is fixed (`renderer.resolve.dedupe` in
`electron.vite.config.ts`) — the app reaches the work UI, so E2E/MCP checks run.

## M8 — Workspace Switching ✅ Done (2026-07-12)

**Feature:** `workspace-switching`

VsCode-style "open/switch workspace" from inside the running app: the topbar
workspace chip becomes a menu ("Abrir pasta…" + a persisted **Recentes** MRU
list), and selecting a workspace re-enters the BMAD onboarding gate for that
path — **guided install** if the folder lacks BMAD, **update** if it already has
it. Detection moves from the global `config.provisioned` flag to a **disk-based,
per-path** check of `_bmad/_config/manifest.yaml` (Blocker B1's marker), which
also fixes a latent first-run bug (picking an already-provisioned folder wrongly
reinstalled). Switch is same-window (context replaced in place), guarded by the
existing three-way save dialog for unsaved edits and a clean agent-session
teardown. Engine stays bespoke — evaluated and explicitly **not** swapped for a
VsCode/Monaco engine (context.md C5). Planned via tlc-spec-driven
(spec/context/design/tasks in `.specs/features/workspace-switching/`).

**Exit criteria:** WS-R1–R7 implemented and demonstrated in the running app;
WS-R8.1 no regression; WS-R8.2 ≥90% coverage per changed file; WS-R8.3 E2E
(switch to provisioned → update, to unprovisioned → install, asserting on-disk
config/MRU); WS-R8.4 `_electron.launch` visual validation. — met (T1–T10).
Full unit/component suite green (389/389), `npm run typecheck` clean, `npm run
lint` has no new errors from this feature's files, per-file coverage ≥90% on
every T1-T9 touched file (ConfigStore, WorkspaceService, main/index.ts,
preload/index.ts, App.tsx, WorkUI.tsx, Chat.tsx, agentService.ts, pt-BR.ts).
T9's `e2e/workspace-switching.spec.ts` (`npm run build && xvfb-run -a npm run
test:e2e:app`) confirmed the switch-to-provisioned→update and
switch-to-unprovisioned→install flows on-disk, plus `_electron.launch`
screenshots of the chip menu and post-switch work UI.

## M5 — Second agent adapter

Add a second agent CLI (e.g. Devin) to prove the decoupling from M1 in practice.

**Feature (first slice): `agent-selection` ✅ Done (2026-07-13)** — proves G2
at the product surface: an **adapter registry** (`claude-cli` available; `devin`
and others as declared `available:false` placeholders), a **globally persisted
selection**, a re-bindable `AgentService`, and a **picker** at first-run setup +
in the profile sheet. No real Devin adapter (no such CLI in this environment —
it's a cloud agent, not a local `-p` CLI); the selection path is built and
Claude stays functional, so a genuine second adapter drops in later as one
registry entry. Plan in `.specs/features/agent-selection/`.

## M9 — Personalization & Profile ✅ Done (2026-07-13)

**Feature:** `role-personalization`

The app adapts to *who the user is*. A **role** (Product Manager, Tech Lead, UX
Designer, QA, Developer) is chosen in a **required** first-run step (global,
persisted) and drives a **role→action catalog** — BMAD workflows plus a "Conversar
com <persona>" action bound to the role's BMAD specialist agent (John=PM,
Winston=Architect, Sally=UX, Murat=QA/`bmad-tea`, Amelia=Dev, all verified skills).
The role's actions render in the "O que você quer fazer hoje?" hero (all launchable,
superseding the MVP's single-wired-PRD catalog), in a **persistent left action
rail** available at any time (the user-chosen "second home" for the shortcuts, over
a ⌘K palette / topbar menu), and are re-configurable via a **profile/settings gear**
(a right-side Sheet) that also switches the agent. Shaped with `impeccable`
(product register). Onboarding order: workspace → agent step → role step →
install/update → work UI (agent+role are one-time global steps, skipped on later
launches / workspace switches). Plan in `.specs/features/role-personalization/`.

## M6 — Polish & packaging

Impeccable-driven UX pass, error/empty/loading states hardened, signed installers
for distribution, auto-update of the app itself.

---

## Dependency Graph

```
M0 ──► M1 (MVP) ──► M2 ──► M4
                 └─► M3
                 └─► M5
                 M2+M3+M4+M5 ──► M6
```

M2, M3, M5 can proceed in parallel after M1. M6 gates release.
