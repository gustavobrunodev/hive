# Context — Agent Selection (gray-area decisions)

- **AG-C1 — Scope: registry + UI + persistence now; real Devin adapter later.**
  Agent-resolved: no Devin (or other) CLI exists in this environment, and Devin
  is a cloud agent, not a local `-p`-style CLI. Building the selection *path*
  (registry, global persistence, picker UI, session re-bind) with Claude
  functional and others as `available: false` placeholders proves G2's decoupling
  at the product surface without fabricating a non-working integration. A genuine
  second adapter stays M5's later work. The user's brief ("selecionar o agente…
  Devin, Claude code, etc.") is satisfied by the visible, extensible selector.

- **AG-C2 — Global, not per-workspace.** Matches the user's profile-scope
  decision (2026-07-13): one selected agent app-wide, persisted in `ConfigStore`.

- **AG-C3 — Required first-run step, changeable later.** Per the user's
  onboarding decision (role is a required init step); the agent picker rides the
  same first-run setup and is re-editable via the profile gear (RP-R6). Once set,
  later launches don't re-prompt.

- **AG-C4 — Changing agent re-binds the active session.** The selected adapter
  feeds `AgentService.startSession`; a change restarts the current chat session
  against the new adapter (capabilities/model/effort re-read from it).
