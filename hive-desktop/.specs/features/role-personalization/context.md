# Context — Role Personalization & Profile (gray-area decisions)

From the user's discuss answers (2026-07-13) + agent resolutions:

- **RP-C1 — Global profile scope.** (User) Role is app-wide, persisted in
  `ConfigStore.role`. Follows the user across workspaces. Simplest mental model.
  Same scope as the selected agent (AG-C2).

- **RP-C2 — Required first-run role step.** (User) The role picker is a **blocking**
  onboarding step; the user must choose to enter the work UI. Rationale from the
  user: guarantees the commands come already personalized. Once chosen, later
  launches skip it. (Internal `general` default only exists so nothing crashes
  before a role is ever persisted.)

- **RP-C3 — Left action rail is the "second home" for actions.** (User, chosen
  over a ⌘K palette and a topbar dropdown) A slim, always-visible vertical rail on
  the left of the work UI holds the role's action icons + the gear. Chosen for
  maximum discoverability for non-technical target users (PM/UX/QA). It sits
  *outside* the resizable 3-pane body (a fixed chrome column), so it doesn't
  disturb the persisted rail/chat/viewer layout.

- **RP-C4 — Personas map to real BMAD agent skills.** John→`bmad-agent-pm`,
  Winston→`bmad-agent-architect`, Sally→`bmad-agent-ux-designer`, Murat→`bmad-tea`
  (Test Architect), Amelia→`bmad-agent-dev`. Verified against the installed skills
  catalog. "Conversar com <persona>" is a `runWorkflow` turn whose prompt names
  the persona so Claude Code resolves the matching `SKILL.md` (same resolution
  model as B1/B2 lessons — natural-language, no special CLI syntax).

- **RP-C5 — Role actions become genuinely launchable.** This supersedes the MVP's
  "only `prd` is wired, the rest are `planned`" (workflowCatalog.ts). Each role
  action carries a real skill prompt so it launches for real. Verified skill names
  only (deprecated shims like `bmad-create-prd`/`bmad-create-architecture` are
  avoided in favor of `bmad-prd`/`bmad-architecture`, per the existing catalog's
  own notes).

- **RP-C6 — Onboarding order.** First run: workspace pick → **agent step**
  (agent-selection AG-R3.1) → **role step** (RP-R2) → install/update → work UI.
  Agent + role are global one-time steps (skipped when already set); workspace +
  install/update stay per-workspace. A workspace switch re-enters only the
  per-workspace legs, never re-prompts agent/role.

- **RP-C7 — Free to extend the design system.** (User rule) New chrome (action
  rail, role cards, profile sheet) may introduce app-level components or extend DS
  ones; experience trumps staying strictly within existing DS parts. Validate
  visuals via `_electron.launch` (Playwright MCP can't reach this Electron
  renderer — STATE.md T14).
