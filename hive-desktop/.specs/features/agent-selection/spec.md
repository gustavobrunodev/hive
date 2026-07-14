# Feature: Agent Selection

**Milestone:** M5 (Second agent adapter — decoupling proof, first slice)
**Status:** 📝 Planned (2026-07-13)

Let the user choose which agent CLI drives their chat (Claude today; Devin and
others as declared-but-not-yet-available options), proving G2's agent-agnostic
promise in the UI and plumbing — not just in the adapter interface.

---

## Problem

The `AgentAdapter` contract is decoupled (G2, D5), but the app hardwires a single
`createClaudeCliAdapter(...)` in `main/index.ts`. There is no way for a user to
see or pick an agent, and no registry to add one. G2 ("any agent CLI can be
plugged in without touching the UI") is unproven at the product surface.

## Solution

- An **adapter registry** in the main process: adapters registered by `id`, with
  an `available` flag (Claude = available; Devin/others = declared placeholders).
- The **selected agent** is a global, persisted preference; `AgentService` uses
  the selected adapter when starting sessions.
- A **selection UI** at first-run setup (a required onboarding step, alongside
  role — see role-personalization) and re-editable later in the profile/settings
  surface. Unavailable agents render as **"Em breve"** (disabled) so the roadmap
  is visible without pretending they work.

---

## Requirements

### AG-R1 — Adapter registry
- **AG-R1.1** A registry maps agent `id → { adapter, displayName, available }`.
  Claude (`claude-cli`) is `available: true`; at least one placeholder
  (`devin`) is registered `available: false` with no functional adapter required.
- **AG-R1.2** `AgentService` starts sessions using the **currently selected**
  adapter; switching selection affects subsequent `startSession` calls. Only an
  `available` adapter can be selected as active.
- **AG-R1.3** `agent.capabilities()` reflects the selected adapter (models/efforts
  come from whichever agent is active — already adapter-driven per C5).

### AG-R2 — Persisted global selection
- **AG-R2.1** The chosen agent id is persisted in app config
  (`ConfigStore`, global — not per-workspace) and restored on launch.
- **AG-R2.2** If the persisted id is unknown/unavailable at launch, the app falls
  back to the first available adapter (Claude) without crashing.

### AG-R3 — Selection UI
- **AG-R3.1** First-run setup presents the agent choices as cards: available ones
  selectable, unavailable ones shown disabled with an "Em breve" marker and a
  one-line description. (This is a **required** first-run step per the user's
  onboarding decision; skipped on later launches once set — see
  role-personalization onboarding flow.)
- **AG-R3.2** The same choice is changeable at any time from the profile/settings
  surface (role-personalization RP-R6). Changing the agent restarts the active
  chat session against the new adapter.
- **AG-R3.3** The active agent is surfaced somewhere in the work UI (e.g. a small
  label near the model picker or in the topbar) so the user always knows who
  they're talking to.

### AG-R4 — Quality gates
- **AG-R4.1** No regression (test/typecheck/lint), ≥90% per-file coverage on
  changed files, all copy via `t()` (pt-BR), visual pass via `_electron.launch`.

---

## Non-Goals
- A real, working Devin (or other) adapter. No such CLI is available in this
  environment; placeholders prove the registry/UI/persistence path. A real second
  adapter remains M5's later work.
- Per-workspace agent selection (global only, matching the profile-scope decision).
- Per-adapter auth flows — agent CLIs manage their own auth (design principle).
