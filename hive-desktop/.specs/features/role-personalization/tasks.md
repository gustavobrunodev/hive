# Tasks — Role Personalization & Profile

Atomic tasks: implement → verify → atomic commit. Requirement IDs traced.
Coverage ≥90% per changed file. Env: `source ~/.nvm/nvm.sh && nvm use 22.22.1`.

Shares onboarding-gate + ProfileSheet with agent-selection (AS-T4/T5) — those
land jointly at RP-T4 / RP-T8.

---

- [x] **RP-T1 — Role catalog + prompts** (RP-R1.2, R3.1/3.2, RP-C4/C5)
  `main/roleCatalog.ts` (+ test): `RoleId`, `RoleDef`, `ROLE_CATALOG` encoding the
  spec's table with **verified** skill names; `resolveRoleActions(role)` →
  `{ key, kind, command: WorkflowCommand }[]` with per-action prompts (workflow +
  persona). Verify: test asserts every role's actions/skills/prompts + persona
  mapping; ≥90%; typecheck.

- [x] **RP-T2 — Config.role** (RP-R1.1)
  `configStore.ts`: `role: RoleId|null` default `null` + `getRole`/`setRole`
  (+ test). Verify: round-trip test green ≥90%; typecheck.

- [x] **RP-T3 — `profile` IPC (role half) + resolved actions** (RP-R3)
  `main/index.ts`: `profile.getRole`/`setRole`/`roleActions(role)` (resolves via
  roleCatalog). `preload/index.ts` + `.d.ts`: add to the `profile` namespace.
  Verify: index + preload tests green ≥90%; typecheck.

- [x] **RP-T4 — Onboarding gate: required agent + role steps** (RP-R2, RP-C6; AG-R3.1)
  `App.tsx`: insert `setupAgent` → `setupRole` states after `picker`/`chooseWorkspace`
  and before `checkingProvisioned`; shown only when `getAgent`/`getRole` unset
  (skip when set / on workspace switch). Add `RoleSetup.tsx` (+ `RoleCard.tsx`) and
  wire `AgentSetup` (AS-T4). Lift `role`+`agent` into `App`, load post-onboarding,
  pass to `WorkUI`. Copy in `pt-BR.ts`. Verify: `App.test` (routes through both
  steps when unset; skips when set; switch never re-prompts), RoleSetup/RoleCard
  component tests (required pick, persists, a11y radiogroup) green ≥90%;
  noInlineStrings; typecheck; lint.

- [x] **RP-T5 — Icons for role actions** (design §3)
  `ui/icons.tsx`: add the action/role/persona icons (DS line style) + test entry.
  Verify: `icons.test` green; typecheck.

- [x] **RP-T6 — Personalized intent grid** (RP-R4)
  `Chat.tsx`: load `profile.roleActions(role)` for the hero; `IntentGrid.tsx`:
  render role actions all-live, persona action distinct (`data-persona`), role
  greeting. `launchAction(action)` shared handler (grid + rail). Copy + styles
  (`workbench.css`: persona pill variant). Verify: IntentGrid/Chat tests (renders
  role actions, persona distinction, launch calls runWorkflow) green ≥90%;
  noInlineStrings; typecheck; lint.

- [x] **RP-T7 — Persistent left action rail** (RP-R5)
  `WorkUI.tsx`: wrap body in `.wb-shell` (rail column + existing Resizable body,
  rail OUTSIDE the group so `hive.workLayout` is untouched). `ui/ActionRail.tsx`:
  icon buttons per role action (Tooltip labels, `.wb-icon-btn` vocabulary), persona
  slot distinct, bottom gear opening ProfileSheet; keyboard + focus-visible;
  narrow-width safe. Wire `launchAction` (shared with grid). Styles in
  `workbench.css`. Verify: ActionRail test (renders role actions, launches, opens
  sheet, a11y) green ≥90%; noInlineStrings; typecheck; lint; confirm persisted
  layout unaffected.

- [x] **RP-T8 — Profile / settings sheet** (RP-R6; AG-R3.2/AS-T5)
  `ui/ProfileSheet.tsx` (DS `Sheet`): Papel section (role selector) + Agente
  section (agent selector) + global-scope note. Changing role/agent persists +
  updates lifted `App` state → grid/rail/session re-render live (no relaunch).
  Copy + styles. Verify: ProfileSheet test (role change live, agent change
  re-binds, global note) green ≥90%; noInlineStrings; typecheck; lint.

- [x] **RP-T9 — Feature closeout** (RP-R7)
  Full `npm run test` green; `npm run typecheck` clean; no new `npm run lint`
  errors from this feature's files; per-file coverage ≥90% on every changed file.
  `e2e/role-personalization.spec.ts` (`_electron.launch`): first-run through the
  required agent+role steps → work UI shows role hero + rail; launch a role action
  (asserts a chat turn starts); open ProfileSheet, change role, assert hero/rail
  update; dark+light screenshots of role step, hero, rail, sheet. Mark ROADMAP M9
  + this file `[x]`; update STATE.
