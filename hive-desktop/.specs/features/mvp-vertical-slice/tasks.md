# Tasks — MVP Vertical Slice

Atomic tasks with verification criteria, dependencies, and requirement traceability.
Each task is one atomic git commit. **T0 gates all BMAD-touching tasks** (resolves
STATE.md B1). Group order respects the dependency graph.

Status legend: ☐ todo · ◐ in-progress · ☑ done

---

## Phase 0 — De-risk & Scaffold

- ☐ **T0 — Verify BMAD reality (resolves B1).**
  Run `npx bmad-method install` in a throwaway dir; record exact prompts, created
  folder/config path, update command, PRD workflow command, and PRD output path.
  Update design.md §7 and clear STATE.md B1.
  **Verify:** design.md §7 filled with real commands/paths; B1 struck from STATE.md.
  **Deps:** none. **Traces:** context.md A1–A4.

- ☐ **T1 — Electron + React + TS scaffold.**
  Create `hive-desktop/` app: main, preload, renderer; TS strict; dev run script.
  **Verify:** `npm run dev` opens a window rendering a placeholder React tree; typecheck passes.
  **Deps:** none. **Traces:** R1.1.

- ☐ **T2 — Secure IPC baseline.**
  `contextIsolation:true`, `nodeIntegration:false`, sandbox; typed `window.hive`
  bridge via `contextBridge`; one round-trip method (`ping`).
  **Verify:** renderer calls `window.hive.ping()` → main responds; renderer has no
  `require`/`fs`/`child_process` access (assert in a test).
  **Deps:** T1. **Traces:** R1.3.

- ☐ **T3 — Wire `@hive/design-system` + theming.**
  Consume DS ESM bundle + CSS in renderer; render a DS `Button`/`Panel`; dark/light
  theme toggle from DS tokens.
  **Verify:** DS component renders styled; toggling theme swaps tokens; no CSS load
  errors. (Confirms design.md §9 risk.)
  **Deps:** T1. **Traces:** R1.2, R1.4.

- ☐ **T3b — pt-BR strings module + `t()` helper.**
  Create `renderer/i18n/pt-BR.ts` (all UI copy) and a `t(key)` accessor; lint/guard
  against inline UI string literals in components. All later UI tasks (T6, T9, T10,
  T12, T15, T16, T18) consume `t()`.
  **Verify:** a sample DS screen renders pt-BR copy via `t()`; a component using an
  inline literal is flagged; no English UI strings remain in built screens.
  **Deps:** T3. **Traces:** R1.6.

## Phase 1 — Workspace & Config

- ☐ **T4 — ConfigStore.**
  JSON persistence in `userData`: `{workspacePath, provisioned, lastModel, lastEffort}`.
  **Verify:** unit test writes/reads/round-trips; survives app restart.
  **Deps:** T2. **Traces:** R2.2, R3.5.

- ☐ **T5 — WorkspaceService + picker IPC.**
  `chooseWorkspace()` (native dialog), `getWorkspace()`, `isProvisioned()`.
  **Verify:** picking a folder persists it; relaunch returns it without prompt.
  **Deps:** T4. **Traces:** R2.1–R2.3.

- ☐ **T6 — Onboarding: workspace-pick UI.**
  First-run gate: no workspace → picker screen (DS `Empty`/`Dialog`/`Button`).
  **Verify:** fresh config shows picker; after pick, advances to next step.
  **Deps:** T3, T5. **Traces:** R2.1.

## Phase 2 — BMAD Lifecycle

- ☐ **T7 — ProcessRunner.**
  Uniform spawn/stream/kill; pty mode option; injectable for tests (fake runner).
  **Verify:** unit test with fake runner streams scripted stdout and exit code.
  **Deps:** T2. **Traces:** C2.

- ☐ **T8 — BmadService.install() → BmadEvent stream.**
  Drive install into workspace (strategy per T0); parse output into
  step/prompt/progress/done/error events; set `provisioned` on success.
  **Verify:** unit test (fake runner scripting a real-shaped install) emits correct
  BmadEvent sequence and flips provisioned flag; error path emits `error`.
  **Deps:** T5, T7, **T0**. **Traces:** R3.1, R3.3, R3.5.

- ☐ **T9 — Guided install UI.**
  Render `installBmad()` stream as DS `SteppedList`+`Progress`+`Spinner`; prompts
  (if any) as native choices; failure → `Alert` + retry (R3.4).
  **Verify:** scripted success shows steps→done→enters work UI; scripted failure
  shows error + working retry; no raw stack as primary message.
  **Deps:** T6, T8. **Traces:** R3.2–R3.4.

- ☐ **T10 — BmadService.update() + launch gate.**
  On provisioned launch, run update before work UI; visible progress; failure →
  "continue anyway".
  **Verify:** provisioned relaunch shows update progress then work UI; up-to-date
  resolves fast; failure offers continue.
  **Deps:** T8. **Traces:** R4.1–R4.3, R2.3.

## Phase 3 — File Explorer / Viewer

- ☐ **T11 — FsService (scoped) + IPC.**
  `listTree()`, `readFile(path)`, `watchWorkspace()`; reject paths outside workspace
  root.
  **Verify:** unit test lists a fixture tree, reads a file, blocks `../` escape;
  watcher fires on new file.
  **Deps:** T5. **Traces:** R5.1, R5.2, R5.4, R1.3.

- ☐ **T12 — Explorer + viewer UI.**
  DS `Tree` for structure; select → viewer; `.md` readable render, code/text in
  `CodeBlock`.
  **Verify:** clicking a tree file shows its contents; markdown renders readably;
  new file from watcher appears without manual reload.
  **Deps:** T3, T11. **Traces:** R5.1–R5.4.

## Phase 4 — Agent Chat

- ☐ **T13 — AgentAdapter interface + ClaudeCliAdapter.**
  Define contract (capabilities/startSession/runWorkflow); implement Claude CLI via
  ProcessRunner; curated models/efforts.
  **Verify:** contract test passes for ClaudeCliAdapter; `capabilities()` returns
  curated model/effort lists; a scripted turn streams token→done events.
  **Deps:** T7. **Traces:** R6.2, R6.3, R6.4 (C1, C5).

- ☐ **T14 — AgentService + chat IPC.**
  Own active adapter; `agent.start/send/runWorkflow`; stream events to renderer.
  **Verify:** unit test: send text → streamed events over IPC; capabilities exposed
  to renderer.
  **Deps:** T13. **Traces:** R6.1–R6.4.

- ☐ **T15 — Chat UI.**
  DS `MessageList`/`ChatMessage`/`PromptInput`/`TypingIndicator`; model & effort
  pickers (`Select`) populated from adapter capabilities.
  **Verify:** user message + streamed agent reply render; typing indicator during
  stream; model/effort options come from adapter (not hardcoded).
  **Deps:** T3, T14. **Traces:** R6.1, R6.4.

- ☐ **T16 [S] — File attachment into context.**
  Attach a workspace file to a turn (DS `Attachment`); adapter forwards it.
  **Verify:** attaching a file includes it in the agent input; visible chip in composer.
  **Deps:** T15, T11. **Traces:** R6.5. *(should-have; drop if time-boxed.)*

## Phase 5 — Guided Intent → Workflow → Artifact

- ☐ **T17 — WorkflowCatalog (curated + fallback).**
  Curated intent→command map (PRD wired; others `planned`); dynamic-discovery hook
  reading installed BMAD where feasible.
  **Verify:** unit test returns catalog with `prd:wired`; discovery hook merges/falls
  back cleanly when BMAD data absent.
  **Deps:** T0. **Traces:** R7.3 (C6).

- ☐ **T18 — New-session intent placeholders.**
  "What do you want to do today?" grid (DS `Empty`+`Command`/`ValueCard`): PRD
  primary; Domain Research/Brainstorm/Architecture/Story visible as secondary.
  **Verify:** new session shows placeholders; PRD is clickable/primary; others render
  as planned.
  **Deps:** T15, T17. **Traces:** R7.1.

- ☐ **T19 — Wire "Create a PRD" → workflow → artifact.**
  Click PRD → `agent.runWorkflow("prd")` drives BMAD PRD workflow; on completion the
  PRD file appears in explorer (via T11 watcher).
  **Verify:** clicking PRD runs the workflow (streamed in chat) and `PRD.md` (real
  BMAD output path) appears in Tree and opens in viewer.
  **Deps:** T10, T12, T14, T17, **T0**. **Traces:** R7.2, R7.4, R5.4.

## Phase 6 — Acceptance

- ☐ **T20 — E2E smoke (R8.1) + impeccable pass.**
  End-to-end on a throwaway workspace: pick → install → new chat → Create a PRD →
  see PRD in explorer. Run every user surface through an `impeccable` review
  (states, a11y, copy, hierarchy).
  **Verify:** the R8.1 scenario passes start-to-finish; relaunch (R8.2) opens
  remembered workspace + updates BMAD with no re-onboarding; impeccable review items
  resolved.
  **Deps:** T9, T10, T12, T15, T19. **Traces:** R8.1, R8.2, R1.5.

---

## Dependency Graph

```
T0 ─────────────┐ (gates T8, T17, T19)
T1 → T2 → T4 → T5 → T6 ─┐
        └─ T3 ──────────┼─→ T9 ─┐
        └─ T7 → T8 ─────┘        │
                 T8 → T10 ───────┼──────────────┐
T5 → T11 → T12 ──────────────────┤              │
T7 → T13 → T14 → T15 → T16       │              │
              T15 ┐              │              │
T0 → T17 ─────────┴→ T18         │              │
T10,T12,T14,T17 ─────→ T19 ──────┴─→ T20 (accept)
```

**Parallelizable after T3+T7:** the BMAD track (T8–T10), the explorer track
(T11–T12), and the agent track (T13–T16) are largely independent; they converge at
T19/T20.

## Coverage Check (every [M] requirement has ≥1 task)

R1.1→T1 · R1.2→T3,T12,T15 · R1.3→T2,T11 · R1.4→T3 · R1.5→T20 · R1.6→T3b (+ all UI tasks consume `t()`) · R2.1→T5,T6 ·
R2.2→T4 · R2.3→T5,T10 · R3.*→T8,T9 · R4.*→T10 · R5.1-4→T11,T12 · R6.1-4→T13,T14,T15 ·
R6.5→T16 · R7.1→T18 · R7.2→T19 · R7.3→T17 · R7.4→T19 · R8.1→T20 · R8.2→T20.
Deferred (R5.5, R6.6-8, R7.5) intentionally untasked → M2–M4.
