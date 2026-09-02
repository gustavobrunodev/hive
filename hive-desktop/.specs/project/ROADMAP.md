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

**Feature (first slice): `npm-distribution` ✅ Implemented (2026-07-22), T17/T18 blocked** — ship the
app to the **public npm registry** under the user's personal account and make a
running install **discover, download and apply new versions by itself**, with no
terminal and no external release server. The registry is both the version source
and the payload host: per-platform packages carry the real electron-builder
installer, the app reads `GET /<pkg>/latest` (custom `hiveRelease` field →
version + release notes + platform map), downloads the tarball directly from
`registry.npmjs.org`, verifies sha512 against `dist.integrity`, extracts and runs
the installer. `electron-updater` is retired: it has no npm provider, and its
`Provider` contract expects a raw installer rather than a `.tgz` — but the
existing `UpdateService`/`UpdateEvent`/`AppInfo` **contract is kept** and only
extended, so IPC/preload/renderer don't churn. Discovery is automatic; consent
never is — the notice is non-blocking, refusable ("Agora não"), and skippable
per-version (persisted), with an ambient dot on the rail gear so declining never
strands the user. UI shaped with `impeccable` (product register): three tiers
(ambient dot → morphing `UpdateNotice` on DS Toast primitives → `UpdateCenter`
sheet), no modal. Windows/NSIS is the implemented apply path in v1. Plan in
`.specs/features/npm-distribution/`.

**Exit criteria:** ND-R1–R6 implemented; ND-R7.1 no regression; ND-R7.2 ≥90%
coverage per changed file; ND-R7.3 updater unit-tested against a fake registry
(no network); ND-R7.4 `npm publish --dry-run` tarball inspection; ND-R7.5
Playwright-MCP visual pass (dark+light, every state). Release gate: the real
Windows end-to-end run (T18), which cannot be validated in WSL2.
**Blocked (publish only):** ND-B1 — npm username + authenticated `npm login`.
**Status (2026-07-22):** T1–T16 + T19 done — 908 unit/component tests green,
typecheck/lint clean, every touched file ≥90% per-file coverage (most 100%),
visual validation done (found and fixed two real defects — see STATE.md).
ND-B1 resolved (real npm scope `@gustavobrunodev`) — but the first real
publish attempt found the payload-hosting mechanism itself doesn't survive
contact with the real registry (`413 Payload Too Large` on a real ~297 MB
installer). **D21 (STATE.md): payload host moves to GitHub Releases**, npm
stays the version source — design.md §2A. The pivot (T20-T23, T25) is
**implemented and verified** (918/918 tests, typecheck/lint clean, every
touched file ≥90% coverage, `--dry-run` confirmed end-to-end). Only two
items remain open: ND-B2 (GitHub token) gates the real release-asset publish
(T24), and T18 (real-Windows E2E) still needs real Windows hardware.

---

## M10 — Source Control ✅ Done (2026-07-24)

**Feature:** `git-management`

Complete in-app git version control for the active workspace, with **VS Code/
Cursor parity** — planned via tlc-spec-driven (spec/context/design/tasks in
`.specs/features/git-management/`). The `ActionRail` becomes a VS Code-style
**activity bar** that switches the left rail between the Explorer and a new
**Source Control** view (rail keeps `id="rail"`, so the persisted layout is
untouched); a new bottom **status bar** makes branch + sync state ambient. P1
(user chose the full set) covers the whole loop: repo detect/`init`, grouped
change list (conflicts/staged/changes) with stage/unstage/discard, inline
commit (amend, stage-all, commit & sync), a new **`DiffView`** (unified +
side-by-side) opened as an editor tab, branches (quick-pick create/switch/
rename/delete with dirty-guard), remote **sync** (fetch/pull/push/publish via
**system credentials only** — no in-app token, D-GIT-1), commit **history**
(timeline + per-file → commit diff), merge **conflict resolution** (accept
current/incoming/both), **stash**, and ambient **decorations** (explorer tree
status badges/colors + editor gutter marks). Engine is the system `git` CLI
driven through the existing `processRunner.ts` (machine formats + pure
fixture-tested parsers in `gitParse.ts`); a per-repo serial queue protects the
index. Shaped with `impeccable` (product register): git-status color as
semantic state, inline-not-modal, every control with all states, motion
150–250ms. Decisions in STATE.md **D22** (D-GIT-1 credentials, D-GIT-2 sidebar,
D-GIT-3 full-P1). Deferred to P2/P3: per-hunk staging, revert/cherry-pick,
tags, branch graph, blame, PR integration.

**Exit criteria:** GIT-R1–R13 implemented and demonstrated in the running app;
GIT-R14.4 no regression; GIT-R14.5 ≥90% coverage per changed file; GIT-R14.6
E2E (real throwaway repo + local bare remote, `_electron.launch`, asserting
`git`/on-disk state through detect→stage→commit→diff→branch→push→pull→conflict→
stash); GIT-R14.7 Playwright-MCP visual pass (dark+light, every SCM state);
GIT-R14.8 all copy pt-BR via `t()`. **Met** — shipped on `feat/git-management`
(T1–T32): `npm run verify` green (73 files / 1180 tests, 0 lint errors, per-file
coverage gates held), real-Electron E2E passing (`e2e/git-management.spec.ts`),
and all SCM states visually validated in both themes via the Playwright MCP.

---

## M11 — Agent Change Review ✅ Done (2026-07-25)

**Feature:** `agent-change-review`

A Cursor/Claude-Desktop-style review flow for the changes the **agent** makes to
workspace files. The agent writes to disk optimistically (`--permission-mode
acceptEdits` unchanged); the app takes a **race-free pre-turn checkpoint** via an
app-managed **shadow-git store** (its own `GIT_DIR`, invisible to and independent
of the user's git — works even in non-repo folders), and surfaces the resulting
changes as a single **pending set** the user reviews and **accepts (keeps)** or
**rejects (reverts)** at **hunk / file / set** granularity. The set lives across
four synchronized surfaces: an **inline editor diff** with per-hunk ✓/✗ (Cursor
tier, on the M10 gutter), an **in-chat change card** per turn (Claude Desktop
tier), a **persistent review bar** ("N pendentes" + accept/reject-all), and a
switchable **"Revisão do agente" sidebar view** (sibling of Source Control via
`SidebarHost`). Diffs reuse M10's `DiffView`/`gitParse`; guards reuse M4 STALE +
M8 unsaved-guard. Capture is **adapter-agnostic** (observes the filesystem, not
the agent); Claude `tool_use` attribution is best-effort P2 plumbing.

Planned via tlc-spec-driven (spec/context/design/tasks in
`.specs/features/agent-change-review/`). Gray-area decisions (context.md, from
the user 2026-07-24): **ACR-C1** optimistic apply+revert (gated pre-approval
rejected), **ACR-C2** app-managed git-independent snapshots via a shadow
checkpoint store (user-git working-tree rejected — would conflate the user's
edits with the agent's), **ACR-C3** tiered surface. Derived: **ACR-C4** hunk+file
+set granularity, **ACR-C5** one accumulating pending set, **ACR-C6** impeccable +
Playwright MCP, **ACR-C7** attribution as enrichment only. Shaped with `impeccable`
(product register); STATE.md **D23**.

**Exit criteria:** ACR-R1–R4 implemented and demonstrated in the running app;
ACR-R9.1 no regression; ACR-R9.2 ≥90% coverage per changed non-UI file; ACR-R9.4
E2E (`_electron.launch`, scripted-adapter turn → assert pending set → accept keeps
bytes / reject restores bytes **on disk**); ACR-R9.5 Playwright-MCP visual pass
(dark+light, every review state); ACR-R9.3 all copy pt-BR via `t()`. Implement on
a new `feat/agent-change-review` branch.

**Shipped (2026-07-25, T1–T25 on `feat/agent-change-review`, not yet merged):**
all 25 tasks landed as atomic commits. Spine: `CheckpointService` (shadow-git
snapshot engine, real git in temp dirs) + `gitParse` hunk-id/patch-builder (real
`git apply` round-trip) + `ReviewService` (single accumulating pending set,
accept advances the baseline tree via a scratch index, reject reverts, STALE
mtime guard). IPC `review:*` + turn wiring (checkpoint before the CLI spawns,
`tool_use` → `tool` event attribution) + preload bridge + `useReview` store.
Four synchronized surfaces: `HunkActions`/`DiffView` per-hunk ✓/✗, `ReviewBar`,
`AgentReviewPanel` (third `SidebarHost` view + rail badge), `InlineAgentDiff`
(Cursor-tier, over `inlineDiff` model, keyboard A/R/J/K) opened as a `review`
`DiffTab`, `ChangeCard` in the chat transcript. Guards: `StaleGuardDialog`
(ACR-R3.2), `ReviewSwitchDialog` (ACR-R4.3). `npm run verify` green (typecheck +
0 lint errors + 1299 unit/component tests); every changed non-UI file ≥90%.
E2E: real-Electron surface smoke passes under xvfb (the on-disk accept/reject/
reject-all round-trip is asserted against **real git** in `reviewService.test.ts`
— the turn checkpoint can't be driven deterministically in the sandbox). Visual:
10 Playwright-MCP screenshots (panel, inline diff, card ±expanded, bar, empty,
reject-all confirm, STALE) in dark + light, first-party quality. STATE.md **D23**
updated; OQ4 resolved (undo-accept toast deferred — accept is immediately final).

---

## M12 — Second Brain ✅ Done (2026-07-26)

**Feature:** `second-brain`

A squad knowledge base the team grows by feeding it raw material — typed,
pasted, or **spoken** — and an agent that files it into a structured,
cross-linked Markdown wiki living in the workspace and versioned in git
(D-SB-2). Four capabilities:

1. **Auto-provisioning** — the `second-brain` skill pack installs on first open
   and updates on every launch, as a second step of the same "Preparando o
   workspace" gate BMAD already uses, fail-soft throughout (SB-R1).
2. **A "Second Brain" activity-bar view** — sibling of Explorer / Source Control
   / Revisão via `SidebarHost`: an inviting empty state that launches the
   `/second-brain` wizard, or the vault's wiki index + lazily-expanding tree,
   plus Ingerir / Consultar / Organizar launchers and a staged-raw badge (SB-R2).
3. **Floating ingestion** — a quiet accent FAB anywhere in the work UI opens one
   sheet with three capture modes (paste / audio file / record) sharing ONE
   editable field and ONE **Ingerir**, which writes the content to the vault's
   `raw/` inbox and launches `/second-brain-ingest` (SB-R3, D-SB-5).
4. **Embedded, offline Whisper** — Transformers.js in the renderer (WebGPU when
   a real adapter answers, else WASM), models downloaded on demand into
   `userData` by **main** and served back over a privileged `hive-model:`
   protocol so the renderer never touches the network, plus an in-app recorder
   and a model manager with a hardware-aware recommendation (SB-R4/R5/R7).

Planned via tlc-spec-driven (spec/context/design/tasks in
`.specs/features/second-brain/`). Locked decisions (context.md, from the user
2026-07-25): **D-SB-1** Transformers.js over whisper.cpp (zero native toolchain,
no ffmpeg — WebAudio decodes/resamples), **D-SB-2** vault in the workspace,
git-versioned, **D-SB-3** P1 = FAB **plus** management view, **D-SB-4** models
download on demand, `base` first. Derived: D-SB-5…9. STATE.md **D24**.

**Exit criteria:** SB-R1–R7 implemented and demonstrated in the running app;
SB-R8.1 no regression; SB-R8.2 ≥90% coverage per changed non-UI file; SB-R8.3
real-Electron E2E; SB-R8.4 Playwright-MCP visual pass (dark+light); SB-R8.5 all
copy pt-BR via `t()`. **Met** — shipped on `feat/second-brain` (T1–T22):
`npm run verify` green (typecheck + **0 lint errors** + **1507** tests, vs the
1299 baseline), every changed non-UI file ≥90% (most 100%), E2E passing under
xvfb, 11 screenshots in both themes.

Both spikes ran against reality before anything was built on them, and both
corrected the design: the skill repo ships **four** skills (so `--skill '*'`,
not `--skill second-brain`), and the Whisper stack needed four pinned
corrections — `corsEnabled`, a **host-based** scheme, **same-origin** ORT
assets, and **fp32 on WASM**. Deferred to P2/P3: a rendered query-**answer**
surface, speaker diarization, word-level transcript editing, Obsidian graph.

### M12.1 — Ask + health cadence ✅ Done (2026-07-27)

A post-M12 increment (T23–T26, same branch), both halves from the user:

5. **Perguntar à base (SB-R9)** — `Ctrl/Cmd+Shift+K` anywhere, the panel's
   primary action, or the floating button's first menu item opens a one-field
   ask surface; the question rides inside `/second-brain-query <pergunta>` so
   the transcript shows what was asked and the agent's synthesis lands in the
   chat. Remembers the workspace's recent questions; teaches openers when there
   are none; admits when staged material hasn't reached the wiki yet.
6. **Health-check cadence (SB-R10)** — the app keeps the skill's own practice
   ("after every 10 ingests or monthly"): a health card in the panel, an ambient
   reminder above the floating button when it comes due, a persistent dot on the
   activity-bar entry, and "Depois" for a week of quiet that never pretends the
   check ran. The ledger lives in `userData`, never in the shared vault.

**Met:** `npm run verify` green (typecheck + 0 lint errors + **1569** tests),
Playwright-MCP pass in both themes — which caught a duplicate CTA, two
sub-4.5:1 text colors in light theme, wrong guard copy, and a narrow-rail
button squeeze. STATE.md **D25**.

---

## M13 — Voice Prompt ✅ Done (2026-08-05)

**Feature:** `voice-prompt` · branch `feat/voice-prompt`, **off
`feat/second-brain`** (the Whisper stack it consumes lives only there).

Speak a prompt straight into the chat composer: press once, talk, and watch the
words land **while you are still talking** — offline, pt-BR, without leaving the
field. M12 gave the app ears (embedded Whisper for the second brain); this gives
it a mouth in the one place every request already passes through.

1. **In-place dictation (VP-R1)** — a quiet mic in the composer toolbar puts the
   composer into a dictation mode where it already is: accent ring, the toolbar's
   left cluster replaced by a transport, the textarea keeping its value, caret
   and geometry. `Esc` restores the draft exactly; submitting finalizes first.
2. **Streaming by pause (VP-R2)** — silence cuts a segment, the segment is
   transcribed in the background while capture continues, and the text lands at
   the caret in spoken order. Pending segments are shown as a **count**, never as
   guessed words.
3. **The first press never waits (VP-R3)** — capture starts before the engine is
   ready and the audio is buffered; the transport shows real download progress
   with an explicit promise that nothing is being lost, and the queue drains the
   moment the pipeline warms. The engine pre-warms on pointer/focus intent, never
   at app start.
4. **Honest states (VP-R4)** — silence notice, auto-stop with a visible
   countdown, permission-denied distinguished from no-device, a failed segment
   that stays retryable from its buffered audio, and a microphone released on
   every exit path.

Planned via tlc-spec-driven (spec/context/design/tasks in
`.specs/features/voice-prompt/`). Locked decisions (context.md, from the user
2026-08-04): **D-VP-1** Whisper only — **Windows Voice Typing cut** after
validation (no public API, Azure-cloud, un-instrumentable, no guaranteed pt-BR;
evidence in context.md), **D-VP-2** streaming by pause over one block at the end,
**D-VP-3** chat composer first on a reusable hook + DS primitives, **D-VP-4**
pt-BR fixed, no selector. Derived: D-VP-5…10. Renderer + design system only —
**zero new main-process code and zero new IPC**.

**Exit criteria and the verdict on each (2026-08-05, T1–T17 all landed):**

| Criterion | Met? |
| --- | --- |
| VP-R1–R6 implemented and demonstrated in the running app | **Yes.** Driven end to end in the real built app by `e2e/voice-prompt.spec.ts` and looked at in both themes (screenshots in `.playwright-mcp/`). |
| VP-R7.1 no regression against the baseline | **Yes** — with the baseline corrected. The planned "1570" was M12's number and `feat/second-brain` grew afterwards; measured on the real branch base (`59bfbca`) in a clean worktree: **1959 tests / 135 files**. Now **2118 / 146**, `npm run verify` green, 0 lint errors. |
| VP-R7.2 ≥90% per changed non-UI file, inherited 14-file list not growing | **Yes.** Every new module is gated in `vitest.config.ts`; the six pure ones (`segmenter`, `transcriptJoin`, `dictationCopy`, `phase`, `composerBackdrop`, `e2eDictationSeam`) sit at 100%. The coverage gate is part of `verify` and it passes, so the inherited list did not grow. |
| VP-R7.3 real-Electron E2E | **Yes.** `e2e/voice-prompt.spec.ts` passes under `xvfb-run`. The one failure in the app suite (`agent-change-review.spec.ts`) was confirmed **pre-existing** by building the branch base in a clean worktree and watching it fail identically. |
| VP-R7.4 visual pass, dark + light | **Yes**, with a deviation: the Playwright **MCP** was not connected in the session, so the same recipe ran on the installed Playwright library — same browser, same init-script injection, same probe. It found two real defects (see STATE.md). `contrast.spec.ts` now also sweeps with the transport open, across all three themes. |
| VP-R7.5 all copy pt-BR via `t()` | **Yes.** `noInlineStrings` green. |

**Deferred, unchanged from the plan:** the global push-to-talk hotkey, dictation
in other fields (the hook and transport carry no Chat coupling, so it is wiring),
and insert-position control.

T1 was a spike, per the M12 precedent, and it earned its place: it closed OQ1
(a real 16 kHz `AudioContext` — the resample fallback was never built), OQ2
(`AudioWorklet` loads under this CSP from `file://` — the `ScriptProcessorNode`
fallback was never built) and OQ3 with numbers that **changed the design**
(`minSpeechMs` 1200 → 2000). Full measurements in STATE.md.

---

## M14 — Turn Instrumentation ✅ Done (2026-08-06)

**Feature:** `turn-instrumentation` · branch `feat/voice-prompt` (continues M13).

Three things a Claude Code user has and a Hive user did not: **how long this is
taking**, **somewhere to put the follow-up you already thought of**, and **how
much room is left before the agent starts forgetting**. All three are the same
gap — the app orchestrated long agent runs while telling the user nothing about
their cost in time, attention or context.

1. **Execution times, live and settled (TI-R1)** — every step on the activity
   rail carries its own clock, ticking while it runs; every turn ends on a meter
   that counts the phase and elapsed while live (`Executando · 1min 12s ·
   3 passos · 8,4 mil tokens de contexto`) and settles into a receipt
   (`Concluído em 1min 12s · 3 passos · 1,2 mil tokens gerados · US$ 0,09`).
   The meter **replaced the typing dots**: the dots could only say "something is
   happening" and only when nothing else was; the meter always has something
   truer to say. Durations are measured in the renderer off the adapter's own
   events — the number a user wants is *time since I pressed Enter* — while the
   CLI's own `duration_api_ms` is shown separately, labelled as what it is.
2. **A send queue (TI-R2)** — the composer stays open while a turn runs. Enter
   (or the primary button, now a queue glyph) parks the message in a strip
   docked to the composer's top edge, and it goes out on its own when the turn
   finishes. **A stop or a failure holds the queue** instead of draining it —
   firing three more messages into a session someone just interrupted is the
   opposite of what Stop meant — with one control to resume. A queue is parked
   with its conversation, not discarded, when the pane moves. The interrupt
   moved out of the send button into its own control beside it, so the primary
   button keeps one job: commit what was typed.
3. **Context-window usage (TI-R3)** — a meter on the composer's footer strip
   (`▬▬ 38% de contexto`) opening a sheet with the real breakdown: what the model
   read on its last call, split into reused-from-cache / written-to-cache /
   sent-fresh plus free space, then the session's totals (runtime, API time,
   turns, tokens generated, cost). Past 80% it turns advisory and offers the one
   real remedy. The numbers are the model's own accounting, parsed off the CLI's
   `stream-json` `usage` blocks — nothing is estimated.

**New in the adapter contract:** a `usage` `AgentEvent` (per assistant message,
plus a `final` one off the CLI's `result` line) and `contextWindow` on
`AgentOption`. An adapter that declares neither degrades honestly: absolute
token counts with no percentage, or no meter at all.

**Exit criteria and the verdict on each (2026-08-06):**

| Criterion | Met? |
| --- | --- |
| TI-R1–R3 implemented and demonstrated in the running app | **Yes.** `e2e/chat-timing.spec.ts` drives all three in the real built Electron app against a stand-in CLI printing real `stream-json` — so the parser, the `usage` event, the IPC bridge and the meter are all production code inside the test. |
| No regression against the baseline | **Yes.** `npm run verify` green: **2172 tests / 149 files** (was 2118 / 146), 0 lint errors. |
| ≥90% per changed non-UI file | **Yes.** `turnTiming`, `sessionUsage` and `messageQueue` are gated in `vitest.config.ts`; all three sit at 100% statements. |
| Real-Electron E2E | **Yes.** The three new specs pass; the two failures in the full app suite (`agent-change-review.spec.ts:54`, one `git-conflict.spec.ts` variant) were confirmed **pre-existing** by running the same suite on `HEAD` in a clean worktree — it fails identically there. |
| Visual pass, all three themes | **Yes.** Dark, light and hive, driven through `tools/visual/chat-timing.mjs`, with `tools/visual/timing-contrast.mjs` sweeping 25 selectors per theme. It caught four sub-4.5:1 colours (see STATE.md **L-TI-1**). |
| Second Brain (M12/M12.1) intact | **Yes.** Vault detection, ingest counter, health card, wiki tree and `Ctrl+Shift+K` ask-flow all exercised in the visual pass; `e2e/second-brain.spec.ts` green. |
| All copy pt-BR via `t()` | **Yes.** `noInlineStrings` green. |

**Deferred:** reordering the queue by drag (removal + retype covers it), editing
a queued message in place, and per-conversation persistence of the queue across
app restarts (it is live-only, like the turn timeline it sits under).

---

## M15 — MCP Console ✅ Done (2026-08-07)

**Feature:** `mcp-logs` · branch `feat/voice-prompt` (continues M13/M14).

The MCP module could already answer *"can this server connect?"* — a one-shot
handshake we start ourselves (`mcpProbe.ts`). It could not answer the question
people actually ask, which is *"what did this server just do, and why is the
turn slow?"* The record of that already existed and the app was ignoring it:
the Claude Code CLI writes a per-server diagnostic log for every workspace it
runs in, at `<cache>/claude-cli-nodejs/<slug(cwd)>/mcp-logs-<server>/*.jsonl`,
covering every connection, every tool call and its duration, and everything the
server printed to stderr — while the agent works. Since `cliAdapterCore` starts
the CLI with `cwd: workspace`, the slug for the open workspace *is* the
directory to read. No second copy of the truth, no instrumentation to add.

1. **A typed event stream, not a log dump (ML-R1)** — `mcpLogParse.ts` recovers
   structure from the CLI's free text: 16 kinds, four levels, and the facts
   worth their own column (tool, duration, transport, server version).
   Unrecognized wording degrades to a verbatim `notice` rather than to a blank
   console. `PRODUCT.md` names "log-dump UIs" as an anti-reference, and this is
   what makes obeying it possible.
2. **A dock, not a dialog (ML-R2)** — the console lives under the work area,
   resizable, with a maximize that takes the pane and adds a per-server rail
   (calls, errors, median and peak latency, whether it's connected, and whether
   it's even in this workspace's `.mcp.json`). A modal would cover the
   transcript you're asking about. Reachable from the status bar, from
   `Ctrl+Shift+M`, and from "Ver logs de uso" in the MCP manager.
3. **An ambient signal while it's closed (ML-R3)** — the status bar carries the
   last server that spoke, a live pulse, and the error tally. That is the whole
   reason to dock rather than hide: you learn MCP is working without opening
   anything.
4. **Duration bars scaled to the view (ML-R4)** — timed tool rows draw a
   hairline meter against the slowest call currently in view, so "which call ate
   the turn" is a column you scan rather than numbers you compare. Drawn with
   `transform: scaleX()`; a rescale never touches layout.
5. **A live tail (ML-R5)** — only appended bytes are parsed, so a turn in flight
   streams in without re-sending history. Follows the tail when pinned; offers
   `N eventos novos` when you've scrolled away.

**New in the design system:** `SegmentedControl` — a single-select filter with
optional toned counts, exposed as a `radiogroup` (one tab stop, arrows move,
Home/End for the ends) with an indicator positioned from measured geometry.

**Exit criteria and the verdict on each (2026-08-07):**

| Criterion | Met? |
| --- | --- |
| ML-R1–R5 implemented and demonstrated | **Yes.** Driven in the served renderer against fixtures whose every sentence is the CLI's real wording; the filters, search, disclosure, rail scoping, follow-pill and live tail were each exercised. |
| Classification holds against real logs | **Yes.** `mcpLogCorpus.test.ts` runs the table over whatever real CLI logs exist on the machine and fails if over 2% land unclassified. It found 30% on the first pass — including connection *failures* filed as debug notices — and is what drove the table to its current shape. |
| No regression against the baseline | **Yes.** `npm run verify` green: **2401 tests / 155 files** (was 2262 / 152), 0 lint errors. Design system: 670 tests, typecheck clean. |
| Coverage on new logic files | **Yes.** `mcpLogParse.ts` and `logConsole.ts` at 100/100/100/100; `mcpLogService.ts` and `useMcpLogs.ts` gated at 90. All four added to `vitest.config.ts`. |
| Visual pass, all three themes | **Yes.** `tools/visual/mcp-console-contrast.mjs` sweeps 26 selectors per theme and reports PASS on dark, light and hive — after finding 6 light-theme and 2 hive-theme failures (see STATE.md **L-ML-2**). |

**Deferred:** clearing a server's log files from the console (destructive, and
the folder is one click away), correlating a console event with the chat turn
that caused it (the CLI's `sessionId` is there, but the app does not yet store
its own turn boundaries against it), and persisting the dock's height across
restarts (live-only, like the chat's send queue).

---

## M16 — Shortcut Scopes ✅ Done (2026-08-08)

**Feature:** `shortcut-scopes` · branch `feat/voice-prompt` (continues M13–M15).

Two settings had drifted into the wrong shape. The **role** was both a required
first-run step and an editable control in the profile sheet — a control over
something *derived*, since re-picking it silently rewrote the shortcuts the user
had been working with, from a place where that consequence is invisible. And the
**shortcuts** were one selection serving two moments that want opposite things:
the hero, where a broad menu is how a conversation starts, and the strip docked
over a live conversation, where those same seven launchers are noise.

1. **The role is chosen once (SS-R1)** — `RoleSetup` is unchanged; the profile
   sheet now states the active role (icon, name, focus line) with no affordance
   to change it, plus the sentence that says where it was decided. It stays
   visible because it's what "Padrão do papel" refers to.
2. **Two independent sets (SS-R2/R3)** — `start` keeps the existing per-role
   catalog; `during` defaults to `bmad-party-mode` for the PM and to **nothing**
   for everyone else. Each is customized, badged and restored on its own;
   `Config.shortcuts` became `{ start, during }` and migrates the pre-split flat
   shape into `start` on read.
3. **The picker shows the difference instead of explaining it** — a DS
   `SegmentedControl` with per-scope counts switches sets, and under it a
   miniature of the surface the active set lands on: the *real* `.wb-pill` /
   `.wb-shortcut-chip` classes over a stand-in composer, centered for the hero
   and docked-left for the strip. The empty state teaches too ("a barra acima
   do campo de mensagem some").
4. **A third way in (SS-R4)** — the profile sheet gained a "Seus atalhos"
   section: both sets with live counts, and one button into the picker. It
   closes the sheet on the way (a dialog over a sheet traps focus twice, and
   the live hero/strip behind the picker is its second preview).
5. **An empty in-conversation set renders no strip (SS-R5)** — not even the
   customize control. Mid-thread chrome is earned, not assumed.

**New in the app:** `PartyModeIcon`, and an app-level `.hds-badge-muted`
override in `assets/theme.css` — the DS ships a hardcoded bordo fill that
measures 2.35:1 against its own text on a white dialog (STATE.md **L-SS-3**).

**Exit criteria and the verdict on each (2026-08-08):**

| Criterion | Met? |
| --- | --- |
| SS-R1–R5 implemented and demonstrated | **Yes.** Driven in the served renderer across all three themes: both scopes of the picker, the empty-set state, the profile sheet, and the strip in a real conversation. |
| The role has no write path outside onboarding | **Yes.** `onRoleChange` is gone from `App`, `WorkUI` and `ProfileSheet`; the sheet's own test asserts there is no radiogroup and no second role on screen. |
| The scopes never write over each other | **Yes.** Gated at both layers — `configStore.test.ts` (per-scope writes preserve the other), `roleCatalog.test.ts` (per-scope resolution), `ShortcutCustomizer.test.ts` (a toggle writes the visible scope and never the other). |
| Old configs keep their shortcuts | **Yes.** `sanitizeShortcutSettings` lifts the flat pre-split shape into `start`, with a test naming that migration. |
| No regression against the baseline | **Yes.** `npm run verify` green: **2499 tests / 157 files** (was 2401 / 155), 0 lint errors. |
| Visual pass, all three themes | **Yes.** `tools/visual/shortcuts-pass.mjs` sweeps 22 selectors × 5 states × 3 themes, all PASS — after fixing 4 failures, 2 of them pre-existing (STATE.md **L-SS-1/2/4**). Now gated in `e2e/contrast.spec.ts` against the real app. |

**Deferred:** reordering shortcuts inside a set (selection order is still append
order), a third scope, and per-workspace sets (prefs stay global, as before).

## M17 — Agent Onboarding ✅ Done (2026-08-09)

**Feature:** `agent-onboarding` · branch `feat/voice-prompt` (continues M13–M16).

One user report, two causes. *"Instalei o Claude Code CLI, fechei e abri o app,
e ele continua dizendo que não está instalado"* — and, separately, *"a
experiência de escolha de agentes na inicialização não está legal"*. The first
was a process-execution bug in three parts; the second was a screen that could
only say "install this yourself, in a terminal" — the one place where G1
("zero-terminal BMAD") wasn't true, on the very first screen a new user sees.

1. **The app looks where CLIs actually are (AO-R1)** — `cliEnv.ts` widens
   `PATH` with the login shell's own value plus every well-known install
   prefix (nvm versions, `~/.local/bin`, volta/bun/deno/yarn, Homebrew, and —
   measured, not guessed — the Windows npm prefix seen from WSL). On Windows
   it resolves `PATHEXT`, skipping npm's extension-less POSIX shim that
   `CreateProcess` cannot run, and routes a resolved `.cmd` through
   `cmd.exe /d /s /c` with both of cmd's parsing passes escaped. Applied in
   `createProcessRunner`, so probes, turns, git, BMAD and the MCP probe all
   inherit it.
2. **Detection is repeatable and evidenced (AO-R2)** — `detect(refresh)`
   re-probes; the picker has a scan strip that says what the last sweep found
   and a "Procurar de novo" control. A detected agent shows the command that
   answered and its version (`claude` · `2.1.226 (Claude Code)`) instead of a
   green dot the user has to take on faith.
3. **Hive installs the agent for you (AO-R3)** — `agentInstaller.ts` runs the
   vendor's own `npm install -g <package>` from the card, streams npm's output
   into the row, and **re-probes** before calling it done. Failures are
   diagnosed, not dumped: `npm-missing`, `permission`, `network`,
   `not-detected`, plus npm's last lines behind a disclosure, with retry and
   "copiar comando".
4. **Honest about what it can't do (AO-R4)** — Devin needs an account and a
   browser login, so its row keeps the docs link and gains no button Hive
   couldn't honour.
5. **The screen is a decision, not a report (AO-R5)** — three groups in the
   order a user asks the questions: *Prontos para usar* → *O Hive instala para
   você* → *Instalação pelo fornecedor*. The empty state teaches the way out
   instead of announcing the failure.

**Exit criteria and the verdict on each (2026-08-09):**

| Criterion | Met? |
| --- | --- |
| AO-R1–R6 implemented and demonstrated | **Yes.** Driven in the served renderer across all three themes: nothing-detected, install running, install failed (with npm's output open), installed-and-adopted, and a re-scan that finds one. |
| The reported bug is actually fixed | **Yes**, and measured on the machine that reported it: the real `detect()` under `PATH=/usr/local/bin:/usr/bin:/bin` returned `available:false` for all three agents before, and `claude-cli available:true, version "2.1.226 (Claude Code)"` after. |
| Detection and execution can't disagree | **Yes.** The repair is in `ProcessRunner`, not the probe; the installer trusts `refreshOne()` rather than npm's exit code (`not-detected` is its own reason). |
| No regression against the baseline | **Yes.** `npm run verify` green: **2548 tests / 159 files** (was 2499 / 157), 0 lint errors, coverage gates passing. |
| Visual pass, all three themes | **Yes.** `tools/visual/agent-setup.mjs` sweeps 24 selectors × 5 states × 3 themes, all PASS. It found two defects no test could: an inherited `align-items: center` centring the install block, and a scan strip wrapping its own control onto a second line. |
| The new surface is gated | **Yes.** `e2e/contrast.spec.ts` opens the picker in the profile sheet and sweeps it in all three themes (3/3 green against the real app). |

**Deferred:** installing an agent from anywhere but the picker; a package
manager other than npm; and driving the *transient* install states in the app
E2E — the button runs a real global install, so those two states are measured
by the visual probe instead (STATE.md **L-AO-7**).

---

## M18 — Design Studio ✅ Done (2026-08-10)

**Feature:** `design-studio` · branch `feat/voice-prompt` (continues M13–M17) ·
**Contrato canônico:** `_bmad-output/specs/spec-design-studio/` (SPEC + AD-1..AD-11) ·
**Plano:** `.specs/features/design-studio/` (spec/context/design/tasks)

Uma Spec de UX do fluxo `bmad-ux` deixou de ser só texto. Ela abre como aba
`design-studio` no painel viewer, vira Telas navegáveis renderizadas com web
components reais (**Web Awesome 3.11**, MIT), editáveis por Inspetor, Árvore de
Componentes e um Chat de Iteração Visual — e sai como Bundle HTML autocontido
para o Figma Agent. O trabalho de Figma passa a começar *depois* da ideia
pressão-testada, não antes.

1. **O documento é command-sourced (F1)** — `Add/Remove/Move/SetProp` num
   reducer puro que **não valida**, log linear por Tela com `groupId`, e undo
   por *replay desde a origem* em vez de snapshot. Um turno de chat de N
   comandos desfaz como um passo só, e desfazê-lo não toca nas edições manuais
   feitas depois.
2. **Trocar de design system é configuração (F2)** — o catálogo é **derivado**
   do `custom-elements.json` do pacote (70 componentes, com o *tipo* de cada
   prop) e congelado em build; `validate()` é a única porta entre qualquer
   superfície e o documento. Um teste de fronteira falha se algo fora de
   `dsAdapter/` importar o pacote.
3. **O Preview é isolado de verdade (F3)** — `sandbox="allow-scripts"` **sem**
   `allow-same-origin`, servido por `hive-studio://` com CSP por resposta; o pai
   só aceita mensagem cujo `event.source` é o frame **e** cujo nonce bate
   (D-DS-4 — sob origem opaca, casar `event.origin` seria teatro).
4. **A Bancada (F4)** — o Preview como objeto sobre um palco, não como painel:
   três camadas de superfície e zero `box-shadow`, escala honesta (o iframe fica
   no tamanho real do dispositivo, o contêiner é que encolhe) e Modo Foco para
   quando 44% da janela não bastam.
5. **Editar à mão (F5)** e **iterar em português (F6)** — Inspetor derivado do
   *tipo* que o catálogo declara, Árvore com adicionar/remover/mover, e um chat
   cujo lote é tudo-ou-nada: um comando inválido no meio e **nenhum** é aplicado.
6. **O Bundle (F7)** — um `.html` por Tela, com bundle, CSS e ícones embutidos,
   produzido pelo mesmo adaptador que desenha o Preview (AD-6). Falha de uma
   Tela não derruba as outras.

**Exit criteria and the verdict on each (2026-08-10):**

| Criterion | Met? |
| --- | --- |
| DS-R1–R18 implementados e demonstrados | **Yes**, os 18. Rastreados um a um na tabela de `spec.md`; cada fase fechou com seus próprios testes e um passe pelo app real. |
| Uma Spec abre, gera, edita e exporta sem terminal | **Yes, com uma ressalva honesta.** O fluxo inteiro roda contra o app buildado — mas a Spec é semeada pelo E2E, porque **nenhuma Spec real deste repositório usa `## Tela —`**. O R-8 continua **aberto**: a heurística de detecção nunca viu uma Spec de verdade. |
| Guards de fronteira | **Yes**, três, todos em `moduleBoundaries.test.ts` e no `verify`: só `dsAdapter/` importa o pacote de DS; nenhuma camada muta o documento fora do reducer; `exportBundle.ts` não constrói markup próprio. |
| O Bundle abre sem rede e bate com o Preview | **Yes, medido.** `e2e/design-studio-export.spec.ts` abre o `.html` numa janela própria com **toda requisição não-`file:` abortada**, prova que os ícones resolveram da biblioteca embutida e diffa o palco contra o Preview vivo: **0 pixels diferentes, 0 requisições estranhas**. |
| O palco não mente sobre o dispositivo (D-DS-7) | **Yes**, e esta era a dívida carregada da F4: jsdom reporta um `innerWidth` fixo para qualquer frame, então a fase 4 só pôde afirmar a *causa*. Medido agora de dentro do frame, no app buildado: **1440 × 900** enquanto a bancada mostra a 14%. |
| No regression against the baseline | **Yes.** `npm run verify` verde: **3346 testes / 202 arquivos** (era 2548 / 159), 0 erros de lint, gates de cobertura passando. |
| Passe visual, todos os temas | **Yes.** `tools/visual/design-studio.mjs` varre 37 amostras × 7 estados × **3** temas, todas PASS — depois de corrigir 5 defeitos que nenhum teste pegaria (STATE.md **L-DS-1..5**). Gated no `e2e/contrast.spec.ts` contra o app real. |
| Piso do app (DS-R18) | **Yes**, e agora com sensor nos três eixos: `noInlineStrings` (i18n) e `reducedMotion` já rodavam no `verify`; a operabilidade por teclado ganhou `e2e/design-studio-keyboard.spec.ts`, que abre a aba, percorre o foco e opera o seletor de export **sem um único clique**. |
| `build:unpack` | **Yes** — e foi ele que pegou o defeito mais caro da milestone: `asarUnpack` põe `resources/**` em `app.asar.unpacked/`, então a raiz via `process.resourcesPath` 404'ava o bundle, o receptor e o catálogo **só no app empacotado**. Corrigido e provado contra o binário (catálogo com 70 componentes, DS carregado dentro do Preview). |

**Limitações conhecidas, registradas em vez de escondidas:** a biblioteca de
ícones é um conjunto **fixo de 136** (123 solid + 13 brands) — um ícone fora
dela não renderiza e, por decisão (D-DS-8), nunca cai para o CDN; e `connect-src`
é **`data:`**, não `'none'` (D-DS-4/D32) — o egresso de rede continua zero, o que
mudou foi a letra da AC, não a propriedade.

**Verificação independente (2026-08-10/11).** Um Verificador que não escreveu
nada disto releu a milestone contra a spec: **51/51 ACs localizados com evidência
`file:line`**, 9 mutações de comportamento injetadas em cópia descartável e
**9 mortas**, `verify` e os E2E reproduzidos, e o D33 reprovado contra um binário
recém-empacotado em vez de contra uma string de caminho. Veredito **PASS**, com
5 achados — relatório completo em `.specs/features/design-studio/validation.md`.

Um deles era real e ficou por corrigir depois do fechamento acima: a Edge Case
*"a Spec mudou em disco → manter a sessão **e sinalizar que a origem mudou**"*
não tinha implementação nenhuma. A primeira metade valia por acidente (nada relê
a Spec) e o sinal não existia — nenhum watcher, nenhum estado, nenhum teste. Ela
estava num bloco de Edge Cases em vez de virar AC numerado, e por isso não entrou
em nenhuma das 52 tarefas: a lacuna veio da quebra de tarefas herdar o formato da
spec, não da execução. Corrigido em `0d94fc0`; a sessão continua deliberadamente
intocada e os testes afirmam isso como **negativas** (nada de reler, despachar,
desfazer ou escrever sessão), porque um reload passaria num teste que só
procurasse o aviso.

Também: o diff do Bundle afirmava `< 1%` enquanto a spec e os critérios acima
alegavam pixel-exato — o portão foi **apertado para `toBe(0)`** em vez de a
alegação ser abrandada (`13b4837`), depois de medir 0 em quatro execuções.

**Números finais:** `npm run verify` verde, **3361 testes / 203 arquivos**
(baseline da milestone: 2548 / 159).

**Aberto, por decisão:** o R-8 acima; a metade "sem mudança de código ao trocar
de DS" de DS-R12 AC-5, que não tem observável sem um segundo adaptador; e
**4 specs E2E instáveis ou já quebrados que não são da M18** — bissetados contra
o baseline pré-M18 e registrados em `validation.md` (F6). Nenhuma regressão da
M18; todo spec do design-studio passou em toda execução.

**Deferred:** achatar o shadow DOM para o Figma Agent (aditivo, um segundo método
no mesmo adaptador — D-DS-1/R-4); multi-seleção de Componentes; migrar Telas ao
trocar de DS; e histórico entre sessões.

---

## M19 — MCP Visibility ✅ Done (2026-08-13)

**Feature:** `mcp-visibility` · branch `feat/voice-prompt` (continues M13–M18).

**O relato que originou a milestone.** Um usuário pediu ao agente para usar o
MCP do Playwright. O agente usou — navegou, digitou, tirou screenshot — e o app
não disse nada sobre MCP em lugar nenhum: nem quais servidores existiam, nem se
algum tinha subido, e o Console MCP ficou vazio o turno inteiro. Três lacunas
distintas atrás de uma mesma queixa.

**As três causas, todas medidas e não inferidas:**

1. **A linha `system`/`init` da CLI era lida só pelo `session_id`.** Ela carrega
   `mcp_servers: [{name, status}]` e a lista `tools` inteira — a **única** fonte
   em que "conectou" é fato e não inferência, e chega *antes* de o agente poder
   chamar qualquer coisa. Verificado contra a CLI real (`claude 2.1.226`).
2. **O watcher do console morria quando o diretório de cache ainda não existia.**
   `attach()` retornava cedo em `!existsSync(root)` e **nunca tentava de novo**.
   Um console aberto num workspace novo — o caso ordinário, e exatamente quando
   alguém está olhando — nunca via a pasta ser criada. Agora um watcher de
   bootstrap fica no ancestral mais próximo até o alvo aparecer.
3. **Nada dizia de onde os logs estavam sendo lidos.** A CLI deriva cache root e
   slug da *sua* plataforma e da *sua* visão do cwd. Nesta máquina o `claude` do
   PATH é o shim do **Windows** (`/mnt/c/Users/…/AppData/Roaming/npm/claude`,
   posto lá de propósito por `cliEnv.wslWindowsBinDirs`), então ele grava em
   `%LOCALAPPDATA%` sob um slug `\\wsl.localhost\…` enquanto o app, um processo
   Linux com um caminho POSIX, lê `~/.cache`. Ninguém erra, nada estoura, e o
   console aponta para um diretório que nunca terá nada.

**O que foi construído:** um evento `mcp` no contrato do adapter (roster por
turno, com status tipado e ferramentas por servidor), e **um** roster no
renderer (`mcpRoster.ts`) fundindo as três fontes que discordam — `.mcp.json` (o
pedido), o handshake (o agora) e os logs (o passado) — renderizado em três
alturas: a **barra de status** (resposta permanente, com card por hover *e*
foco), o **transcript** (só quando muda — assinatura de roster), e a **faixa do
console**, presente mesmo com stream vazio.

| Critério | Evidência |
|---|---|
| O app diz quais MCPs o turno tem | **Yes.** `readMcpRoster` parseia a linha real da CLI; 6 testes de unidade cobrem o pareamento `hive-approvals` ⇄ `mcp__hive_approvals__*`, cada palavra de status, e as entradas malformadas. |
| O app diz se subiu ou falhou | **Yes.** Estado tipado, três canais redundantes (palavra, ponto, tom) nas três superfícies; um servidor `failed` é o único caso que pinta a barra. |
| O console mostra uso em tempo real | **Yes** — o dead-start está corrigido, com dois testes que reproduzem o bug (workspace sem cache, servidor novo no meio da sessão) contra um diretório temporário de verdade. |
| Console vazio deixou de mentir | **Yes.** A faixa de servidores existe sem log nenhum, e o estado vazio nomeia o diretório lido e diz se ele existe. |
| Sem regressão | **Yes.** `npm run verify` verde: **3419 testes / 205 arquivos** (baseline da M18: 3361 / 203) — 58 testes novos, 2 arquivos novos (`mcpRoster.test.ts`, `McpTurnNotice.test.ts`), o resto acrescentado às suítes existentes. |
| Passe visual, três temas | **Yes.** `tools/visual/mcp-visibility.mjs`: 5 estados × 3 temas, 0 reprovações e 0 amostras puladas — depois de corrigir **3 defeitos que o contraste verde não pegou** (rótulo truncado, nomes truncados, colunas desalinhadas por grid-por-linha). |
| No gate E2E, mesmo commit | **Yes.** `@p0 @a11y the MCP roster surfaces` roda um turno real pelo CLI stand-in com `mcp_servers` na init — mede o `readMcpRoster` de produção, nos três temas. Verde. |

**Limitação registrada:** o roster do transcript nasce do handshake, então uma
conversa restaurada do disco não o traz de volta (blocos não são persistidos, o
mesmo contrato das trilhas de atividade). A barra de status continua respondendo
"quais servidores existem" nesse caso, via catálogo e logs.

---

## M20 — Agent Terminal ✅ Done (2026-08-14)

**Feature:** `agent-terminal` · branch `feat/voice-prompt` (continues M13–M19).

**O pedido.** "Poder escolher/configurar o terminal que o agente vai utilizar,
entre os disponíveis no sistema (Windows: PowerShell, Git Bash, cmd)" — com
**cmd como padrão no Windows**.

**O que já acontecia sem ninguém escolher.** O app nunca decidia o shell:
`spawn(command, args)` ia direto, com o `PATH` alargado do `cliEnv.ts`. A única
exceção era o caso em que o Node se recusa a rodar sem shell — um shim `.cmd` do
npm no Windows, que já ia por `cmd.exe /d /s /c`. Ou seja: **o Windows já rodava
o agente dentro do cmd**, por acidente de empacotamento, sem nada na tela dizer
isso e sem como escolher diferente.

**As duas medições que definiram o desenho** (nenhuma adivinhada):

1. **As regras da CLI, lidas do binário** (`claude 2.1.226`, `strings` sobre
   `bin/claude.exe`): `CLAUDE_CODE_SHELL` só vale para um caminho com
   `bash`/`zsh`; o Windows executa `Bash` pelo Git Bash
   (`CLAUDE_CODE_GIT_BASH_PATH`); `CLAUDE_CODE_USE_POWERSHELL_TOOL=1` liga a
   ferramenta PowerShell; e **não existe executor `cmd`**.
2. **O `powershell.exe` 5.1 real corrompe argumentos em silêncio**: sem
   pré-escape, o prompt `{"json": "sim"}` chegou ao processo alvo como
   `{json: sim}`. O escape em estilo CRT foi escrito depois da medição.

**O que foi construído:** um catálogo de shells reais da máquina
(`shellCatalog.ts`), a escolha persistida por id (`config.agentShell`, `null` =
automático → cmd no Windows, `$SHELL` em POSIX), o turno do agente lançado
**dentro** do shell escolhido (`cmd /d /s /c` · `powershell -NoProfile
-NonInteractive` · `<shell> -c 'exec …'`), a tradução por adapter
(`AgentAdapter.shellBinding`, para que a UI e o runner nunca conheçam
`CLAUDE_CODE_*`), e um seletor no perfil que **diz o que a escolha muda para
cada agente habilitado**.

| Critério | Evidência |
|---|---|
| Lista só o que existe na máquina | **Yes.** `detectShells` sobre um filesystem injetado cobre as máquinas que esta suíte não é (Windows sem pwsh, container sem `/etc/shells`, distro com `/bin/bash` simbólico); cada linha mostra o caminho absoluto encontrado. |
| A escolha vale no lançamento | **Yes.** Verificado no processo real: com `exec`, o pid que seguramos é o pid da CLI (o botão "parar" continua parando), o prompt com `$( )`, `&&`, aspas e quebra de linha volta idêntico, e nenhum rc é lido. |
| A escolha vale no agente | **Yes.** `claudeShellBinding` mapeia as quatro famílias segundo o binário real; o E2E lê o `shellEnv` que o **processo recebeu**, não o que a tela mostra. |
| Padrão do Windows = cmd | **Yes** (D-AT-2), com a ressalva na tela: o Claude não executa comandos no cmd, e o seletor diz isso na hora da escolha em vez de prometer o que a CLI não faz. |
| Sem regressão | **Yes.** `npm run verify` verde: **3514 testes / 209 arquivos** (baseline M19: 3419 / 205) — 3 arquivos novos (`shellCatalog.test.ts`, `shellService.test.ts`, `ShellPicker.test.ts`). Suíte E2E inteira verde: **63/63**. |
| Passe visual, três temas | **Yes.** `tools/visual/shell-contrast.mjs`: 3 estados × 3 temas, 57 medições, 0 reprovações — depois de corrigir **3 defeitos que o contraste verde não pegou** (frase em monoespaçada truncada, status repetido a 40px da linha que já dizia o mesmo, `:hover` tão marcado quanto o selecionado). |
| No gate E2E, mesmo commit | **Yes.** `e2e/agent-terminal.spec.ts` (2 casos): escolher → `config.json` → o turno seguinte roda dentro do shell e chega ao fim. |

**Limitações registradas:** só o **turno do agente** passa pelo shell escolhido
(D-AT-1 — `git`, `npx bmad-method` e os probes seguem com spawn direto, porque
cada um depende do stdout exato e nenhum é "o terminal do agente"); e Copilot e
Devin não publicam variável equivalente, então para eles a escolha é só de
lançamento — o que a tela diz, por agente.

---

## M21 — Identidade: `@` para arquivos, e o app chamado Hive ✅ Done (2026-08-16)

**Feature:** `product-identity` · branch `feat/voice-prompt` (continua M13–M20).

**O pedido.** Quatro itens: trocar `#` por `@` na menção de arquivos do chat
(igual ao Claude Code); o instalador `.exe` com logo e fluxo HIVE; o ícone do
aplicativo ser o logo do HIVE; e o nome do aplicativo ser **Hive**, não "Hive
Desktop".

### O sigilo

`@` só abre depois de espaço, então `contato@exemplo.com` continua sendo um
e-mail — a regra que `#` nunca precisou e que agora tem teste próprio. O menu
foi refeito no caminho: os caracteres que a busca casou aparecem marcados (em
ambas as linhas, com os ranges medidos **uma vez sobre o caminho inteiro**, para
que o realce nunca discorde do ranking), o cabeçalho admite quando a página de
8 esconde mais (`8 de 14`), o estado vazio ensina a saída, e `Tab` insere junto
com `Enter`. As linhas viraram **uma só** — nome, depois a pasta — porque em
duas linhas o menu mostrava 4 dos 8 resultados.

### O nome

Renomear o produto move o `userData` (o Electron o deriva de `app.name`), e
dentro dele vivem config, histórico de conversas, o ledger do second brain e os
modelos do Whisper. `userDataMigration.ts` move o diretório antigo por `rename`
— atômico, no mesmo pai — antes de qualquer store abrir seu arquivo, e recusa
migrar por cima de um diretório que já tem dados reais (a "sujeira" que o
Chromium escreve sozinho não conta). `appIdentity.ts` guarda nome e `appId` para
o dev; `appIdentity.test.ts` falha se eles divergirem do `electron-builder.yml`.

### O ícone e o instalador

`scripts/gen-brand-artwork.mjs` deriva **tudo** (`.ico` multi-resolução,
`.icns`, os PNGs, os quatro BMP do NSIS) do mesmo `current_logo_mark.svg`. Os
tamanhos pequenos **não são o grande reduzido**: medido a 7× sobre os rasters
reais, o cérebro de traços fecha abaixo de 48px e vira uma rosca, então 16–40
carregam a célula hexagonal (a mesma marca pequena que o hero do chat já usa) e
48+ carregam o cérebro. O instalador é assistido (`oneClick: false`) com página
de boas-vindas própria, sidebar bordô/coral, cabeçalho com o lockup, ícones
próprios e cópia em pt-BR (`build/installer.nsh`).

| Critério | Evidência |
|---|---|
| `@` abre o menu e `#` não | **Yes.** 27 testes em `composerMentions.test.ts`, incluindo o e-mail que não vira menção e o `#` que virou texto comum. |
| O menu diz por que a linha está ali | **Yes.** `matchRanges` + `highlightParts` com o contrato "sempre remonta a entrada exata"; o teste do Chat afere as marcas renderizadas. |
| O menu não esconde resultado | **Yes.** `8 de 14` no cabeçalho e os 8 visíveis sem rolagem (linha única, `max-height` 356px) — os dois defeitos vieram do screenshot, não de um teste. |
| Nome = Hive, sem perder dados | **Yes.** 7 testes em `userDataMigration.test.ts` contra um diretório temporário real, incluindo "não sobrescreve o que já está lá" e "não migra por cima de dados reais". |
| Config e código não divergem | **Yes.** `appIdentity.test.ts` lê o `electron-builder.yml` e compara. |
| O ícone lê a 16px | **Yes.** Contact sheet e zoom 7× sobre os rasters reais; o piso do cérebro (48px) e o do hexágono contornado (32px) foram medidos, não estimados. |
| O instalador é o fluxo HIVE | **Yes** — e visto rodando: o `.exe` foi executado sob Wine num Xvfb com `-fbdir`, e a página de boas-vindas aparece com a sidebar bordô, o cérebro coral, o wordmark e a cópia em pt-BR. O screenshot também pegou um defeito de cópia ("Avançar" ≠ o rótulo real do botão, `Próximo`). |
| Sem regressão | **Yes.** `npm run verify` verde. |
| Passe visual, três temas | **Yes.** `tools/visual/mention-pass.mjs`: 3 estados × 3 temas, 42 medições. Corrigiu **4 defeitos que nenhum teste veria** — rodapé e dica do menu em `--faint` (4.18:1 no escuro, 3.71:1 no claro), a pílula do composer em 1.30:1 no tema `hive`, os ícones de tipo de arquivo do tema `hive` caindo na rampa clara (2.57:1), e o menu mostrando 4 de 8. |

**Correção pós-entrega (mesmo dia).** A primeira instalação real no Windows
travou em "Não é possível fechar o Hive. Feche a janela do Hive e clique em
Repetir" — sem nenhuma janela aberta e com o Repetir em laço. A checagem padrão
do electron-builder casa `$_.Path.StartsWith('$INSTDIR')`, um prefixo de string
sem separador e sem nome de executável: ela achava o `claude.exe` que o app
empacota dentro da própria pasta e que sobrevive a um turno, e o prefixo
`…\Programs\Hive` ainda casava com `…\Programs\hive-desktop` da instalação
anterior. `build/installer.nsh` passou a definir `customCheckAppRunning` —
match em `$INSTDIR\` (diretório, não string), kill forçado já na primeira
passada, e uma mensagem que **nomeia** o que sobrou em vez de apontar para uma
janela inexistente. Ver L-PI-7 e L-PI-8 no `STATE.md`.

**Limitações registradas:** o `appId` mudou de `com.electron.app` para
`dev.gustavobruno.hive` — correto, mas só é seguro porque o app nunca foi
publicado; as páginas do instalador *depois* da de boas-vindas não foram
clicadas (o Wine desta máquina não tem `xdotool`), então valem pela compilação
do NSIS e pelas macros padrão do MUI, não por screenshot; e a causa a montante
do travamento continua aberta — o app **não encerra o CLI do agente ao sair**
(L-PI-8), então o processo órfão volta a aparecer, só que agora o instalador o
mata em vez de parar.

---

## M23 — Whisper embutido e a transcrição como rascunho ✅ Done (2026-08-19)

**Feature:** `second-brain` (Fase 9) · branch `feat/voice-prompt` (continua
M13–M22; o M22 — `mcp-probe-path` + `approval-session` — vive só no STATE, D36).

**O pedido.** Dois itens: os três primeiros modelos do Whisper embutidos no
aplicativo, sem download, com o mais adequado detectado e escolhido pelo
hardware da pessoa; e, em Bases de conhecimento, a transcrição sempre visível
numa caixa editável — para áudio enviado, depois que o modelo processa tudo;
para áudio gravado na hora, **aparecendo em tempo real enquanto a pessoa fala**.

### O que estava errado antes

O app pedia um download de 278 MB antes de conseguir ouvir qualquer coisa, e
depois transcrevia com o mesmo `base` fixo em toda máquina — a recomendação de
hardware existia desde o M12, era desenhada como badge e **nada agia sobre
ela**. No gravador, o take inteiro era capturado, parava, e só então a busca
por palavras começava: a espera era a experiência, e não havia nada para
corrigir até acabar.

### O que mudou

`tiny`, `base` e `small` viajam em `resources/whisper-models/` em fp32 — a
única precisão que cria sessão no backend WASM. São buscados no momento do
empacotamento (`npm run models:fetch`, ligado aos `build:*`) e ficam fora do
git: ~1,3 GB de ONNX imutável pertence ao instalador, não a todo clone. O
`hive-model:` passou a resolver por **caminho de busca** — cópia baixada
primeiro, cópia embutida depois — então um modelo que o usuário baixe por conta
própria sombreia o de fábrica, e apagá-lo volta para ele.

A escolha virou decisão de verdade: `whisper:preference` resolve no main (pin do
usuário quando ainda serve, resposta da sonda caso contrário) e **só responde
com modelo embutido** — uma escolha automática nunca pode implicar download,
propriedade afirmada sobre toda a matriz RAM×GPU×núcleos.

"Gravar áudio" virou **"Ditar ao vivo"**: microfone, segmentador e motor rodam
juntos, as frases são cortadas no silêncio e transcritas enquanto a próxima é
falada, cada uma caindo no documento com o trecho recém-escrito marcado. É o
`useDictation` do M13 reaproveitado inteiro — ele nunca importou de `chat/`,
então isto foi fiação, não uma segunda implementação. Enviar áudio ganhou o
passo que faltava: os arquivos ficam numa lista removível e **um botão** começa
a passagem, em vez de minutos de CPU que ninguém pediu.

### Exit criteria

| Critério | Veredito |
|---|---|
| Três modelos utilizáveis sem rede, em instalação limpa | **Sim.** E2E real busca `hive-model://models/tiny/config.json` com userData descartável e recebe o arquivo; `modelStatus` responde `{downloaded, fp32, bundled}`. |
| O modelo é escolhido pelo hardware e aplicado | **Sim.** `preference.auto` verdadeiro no E2E, id sempre entre os três embutidos. |
| Transcrição de arquivo revisável antes de ingerir | **Sim** — e agora só começa quando pedida. |
| Transcrição do ditado aparecendo em tempo real | **Sim.** Testes dirigem a costura de ditado e afirmam texto no campo **durante** o take; medido também no navegador (frase em campo com o take ainda "Ouvindo…"). |
| Sem regressão | **Sim.** `npm run verify` verde: typecheck, 0 erros de lint, **3678** testes. |
| Passe visual, claro + escuro | **Sim.** 34 alvos × 2 temas, **34/34 PASS** em cada; dois contrastes reais corrigidos, um deles virando token novo do DS (`--success-tint-ink`). |

### O que ficou aberto

O instalador cresce ~1,3 GB (decisão do usuário: fp32 nos três, sem verificar
q8 antes). `medium` e `large-v3*` seguem como download opcional. O E2E completo
tem `second-brain.spec.ts` estourando o timeout de 300 s **sob a suíte inteira
em paralelo** enquanto passa em 12 s sozinho — contenção da máquina, não
regressão da feature, mas não foi isolado.

---

## M25 — Voz e transcrição: um modelo, dois lugares, e o perfil por escopo ✅ Done (2026-08-21)

Duas coisas, e a segunda existe porque a primeira precisava de um lugar.

**1. A escolha do modelo virou global de verdade.** Ela sempre *foi* global — o
`whisper:preference` mora no `configStore` e é resolvido no main — mas vivia no
rodapé da folha de ingestão, onde lia como uma opção daquela ingestão. E o
compositor do chat, que é onde as pessoas de fato ditam, **nunca consultava a
preferência**: passava nenhum `model` e caía no `DEFAULT_MODEL`. O ajuste
existia e a superfície mais usada não estava coberta por ele.

Agora as duas resolvem a mesma preferência, e o padrão automático mudou de
ladrilho: **`small` → `tiny` → `base`** (decisão do usuário) — o modelo mais
preciso onde ele de fato roda (GPU dedicada + ≥ 8 GB), o mais rápido quando não,
e `base` só quando a sonda não conseguiu medir nada. Sem GPU o pipeline roda
fp32 numa única thread WASM (M12.3), onde `small` leva minutos por trecho: a GPU
é o portão, e não é negociável.

**2. A folha de perfil virou drill-down.** Cinco seções empilhadas mediam
**1771 px** num painel de 900 — o seletor de terminal e o tour viviam abaixo da
dobra, sem nada na tela dizendo que existiam. Agora ela abre num índice cujas
linhas **carregam os valores vivos** (qual agente, quantos atalhos, qual modelo,
qual terminal), e cada uma abre exatamente um escopo. O `Escape` volta um nível
antes de fechar, que é o que o botão de voltar já promete.

O escopo "Voz e transcrição" é onde o modelo é escolhido: a leitura do hardware
que a sonda fez (GPU / memória / núcleos), o seletor com os três modelos
embutidos, e o catálogo dos que são download de verdade — **inline**, não num
segundo modal por cima da folha.

### Veredito

| Critério | Veredito |
|---|---|
| Um modelo, valendo no chat **e** na ingestão | **Sim.** Ambos resolvem `useTranscriptionModel`; teste no `Chat.test.ts` afirma que o ditado roda com o modelo escolhido, não com o default do engine. |
| `small` por padrão onde o hardware aguenta | **Sim.** 18 testes de ladrilho em `whisperHardware.test.ts`, incluindo o piso exato de 8 GB e o caso "GPU sem memória". |
| Baixar/excluir modelos fora da folha de ingestão | **Sim.** Catálogo inline no perfil, com progresso, cancelamento (o `unsubscribe` **é** o cancel) e falha que não se apaga sozinha. |
| Perfil organizado por escopo | **Sim.** Índice + 5 escopos; 0 px de scroll no índice contra 871 px antes. |
| Rádio do modelo alinhado | **Sim**, e medido: `centreDelta` 0,00 nas quatro linhas, anel e preenchimento concêntricos (`.playwright-mcp/m25-dot-proof.png`). |
| Sem regressão | **Sim.** `npm run verify` verde: typecheck, 0 erros de lint, **3703** testes. |
| Passe visual, três temas | **Sim.** 5 estados × 3 temas, 0 reprovações e 0 amostras `missing`; mais 9 sweeps de contraste no Electron real. |

### O que ficou aberto

A segunda ordem do ladrilho é uma troca de qualidade que o usuário pediu
explicitamente: uma máquina sem GPU dedicada que hoje recebia `base` passa a
receber `tiny`. É mais rápido e menos preciso — está registrado em D-VS-1 para
não ser "corrigido" por engano numa próxima rodada.

## M26 — Modelos de voz: baixados, em segundo plano, e anunciados ✅ Done (2026-08-23)

O M23 pôs `tiny`/`base`/`small` **dentro** do app: ~1,3 GB em todo instalador
para pré-responder uma escolha que a maioria faz uma vez. O M26 desfaz isso e
resolve o que a desfeita expõe.

**O que mudou**

1. **Nada mais viaja no app.** `resources/whisper-models/`,
   `scripts/fetchWhisperModels.mjs` e `npm run models:fetch` deixaram de
   existir. Todo modelo é um download do usuário, em `userData/whisper-models/`.
2. **O download é do main, não da janela.** Ele sobrevive a fechar a folha,
   roda vários ao mesmo tempo, retoma de onde parou (`Range` por arquivo),
   tenta de novo com backoff em falha de transporte, recusa antes de começar
   quando não cabe no disco, e reporta **byte a byte** — não uma vez por
   arquivo, que era o que fazia um download de 2,8 GB parecer travado.
3. **Toda superfície de gravação passa por uma guarda.** Sem modelo, o
   microfone abre o caminho para conseguir um — e a gravação que o usuário
   pediu começa sozinha quando ele chega.
4. **O fim é anunciado onde o usuário está**: no app enquanto o Hive está na
   tela, e pelo sistema operacional quando não está.
5. **O Estúdio escolhe o construtor.** Como a construção *é* uma conversa, o
   agente escolhido é também com quem o usuário continua falando — e as
   capacidades (modelo, esforço) seguem o agente.

**D-VM-1 — "Automático" nunca arredonda para cima.** Entre o que está no disco,
a resposta é o modelo mais pesado que ainda não passa da recomendação. Arredondar
para cima é como o automático entregaria a um notebook sem GPU o `medium` de
2,8 GB baixado para outra máquina — e depois levaria minutos por frase.

**D-VM-2 — "Automático" nunca escolhe um modelo `.en`.** Este squad trabalha em
pt-BR (D-SB-6), e um modelo só-inglês não recusa português: ele o transcreve em
absurdo confiante, o que é muito pior do que ser lento. O usuário ainda pode
fixar um de propósito.

**D-VM-3 — a memória da guarda acaba quando o diálogo acaba.** Um microfone que
abre sozinho dez minutos depois, sem nada na tela explicando por quê, é pior do
que um clique a mais. O aviso de conclusão cobre esse caso — e oferece o
*modelo*, não a gravação.

---

## M26.1 — Correções de voz: o que a máquina aguenta, e o que a tela conta ✅ Done (2026-08-23)

Seis defeitos vindos de uma sessão real, todos nas superfícies do M26.

1. **O catálogo oferecia modelos que este computador não consegue carregar.**
   O renderer lê cada arquivo de pesos num único `ArrayBuffer`, e o V8 recusa
   qualquer alocação de 2 GiB ou mais — **medido aqui**: 2040 MiB aloca, 2047
   MiB estoura com `Array buffer allocation failed`, exatamente a frase que o
   usuário viu. `large-v3-turbo` (arquivo de 2,4 GB) e `large-v3` (3,4 GB) em
   fp32 são impossíveis em qualquer máquina; `medium` cabe nos arquivos mas
   pede ~4,6 GB de memória de uma vez. A biblioteca agora diz isso na linha do
   modelo, com o motivo, em vez de oferecer um download de horas que termina
   em erro.
2. **A biblioteca lia progresso pedindo, e pedir custava o dobro.** Passar
   `progress_callback` faz o Transformers.js v4 sondar cada arquivo com um GET
   **inteiro que ele nunca lê**, só para olhar o `Content-Length` — dois
   pedidos por `.onnx`, um pendurado até a janela fechar. Agora o progresso é
   medido no próprio fluxo de bytes (`installLoadMeter`): mesmos números, um
   pedido por arquivo.
3. **Um download que terminava não saía da "Biblioteca"** até fechar e reabrir
   o app — a folha de perfil não ouvia o fim do download, só a guarda ouvia.
4. **Excluir não perguntava** (o desfazer é um download de gigabytes) e não
   atualizava a tela quando a própria exclusão falhava.
5. **Os cartões de "Seus modelos" estavam desalinhados**: o `justify-content:
   center` do rádio do DS nunca foi apagado pelo M26, então cada linha flutuava
   na sobra de largura.
6. **A guarda do microfone já estava certa** — verificada no app real com
   `userData` vazio: `getUserMedia` nunca é chamado. O que faltava era o teste;
   agora existe (`e2e/voice-model-gate.spec.ts`), e ele expôs que o
   `voice-prompt.spec.ts` estava **vermelho** nesta branch desde o M26.

**D-VM-4 — o que não roda não se oferece.** O piso é medido, não estimado: um
arquivo de pesos ≥ 2 GiB é impossível, e um carregamento que pede mais da
metade da memória da máquina é recusado com o número na tela. Uma biblioteca
que deixa alguém gastar uma hora de download em algo que não pode funcionar não
é uma biblioteca, é uma armadilha.

---

## M29 — Parakeet substitui o Whisper: transcrição nativa ✅ Done (2026-09-02)

Ditado lento, pesado e impreciso — e as três queixas com uma causa estrutural
cada, todas sobre **onde** a inferência rodava, não sobre o Whisper.

O pedido citava o [Handy](https://github.com/cjpais/Handy). Ele **não é
embutível**: app Tauri standalone, sem API, que entrega texto colando no campo
com foco do SO. O que se adota é o motor dele — NVIDIA **Parakeet TDT 0.6b v3**
— via `sherpa-onnx-node`, com ONNX Runtime **nativo** num `utilityProcess`.

**Por que trocar o motor e não afinar o antigo.** `whisperEnv.ts` fixava
`numThreads = 1` porque um renderer `file://` não tem `SharedArrayBuffer`; os
pesos tinham de ser fp32 porque o decoder q8 não cria sessão no
onnxruntime-web; e o heap WASM só cresce, que foi o `std::bad_alloc` do M28.
Nenhuma das três propriedades existe em ONNX Runtime nativo.

**Medido** (spike, 8 núcleos): **12,6× tempo real**, **WER 9,55% em pt-BR**
(FLEURS; 4 de 8 clipes em zero), **671 MB** de download — menor que o `small`
(923 MB) que rodava antes, com 600 M de parâmetros contra 244 M. O ponto fraco
medido são nomes próprios estrangeiros e jargão em inglês, não o português.

**D-ASR-1 — uma escolha que ninguém deveria fazer não se apresenta melhor, se
apaga.** O catálogo de dez modelos, a escada de recomendação, o calculador de
aderência e os medidores existiam para ajudar alguém a resolver o trade do
Whisper: rápido e errado, ou preciso e grande demais. Parakeet é os dois lados,
então a tela perde o seletor inteiro e fica com um fato e uma ação.

**D-ASR-2 — o esquema mais seguro é o que não existe.** `hive-model:` servia
pesos a um renderer que não podia buscá-los. Com a inferência num processo
nativo o renderer não vê um arquivo de peso, e o esquema sai — com a entrada
`connect-src` do CSP junto.

**Falta:** reafinar `segmenter`/`livePass` (calibrados para a janela de 30 s do
Whisper) e validar em uso real, com a voz do usuário.

---

## Dependency Graph

```
M0 ──► M1 (MVP) ──► M2 ──► M4
                 └─► M3
                 └─► M5
                 M2+M3+M4+M5 ──► M6
```

M2, M3, M5 can proceed in parallel after M1. M6 gates release.
