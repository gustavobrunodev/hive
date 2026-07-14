# Tasks — Agent Selection

Atomic tasks, each: implement → verify → atomic commit. Requirement IDs traced.
Coverage gate ≥90% per changed file. Run env: `source ~/.nvm/nvm.sh && nvm use
22.22.1` in every command (STATE.md lesson).

**Build-order note:** AS-T1..T3 (foundations) land first. AS-T4 (onboarding step)
depends on role-personalization's gate refactor (RP-T4) — done together there to
avoid churning `App.tsx` twice. AS-T5 (profile-sheet section) lands with RP-T8
(ProfileSheet). AS-T6 (indicator) is independent.

---

- [x] **AS-T1 — Adapter registry** (AG-R1)
  `main/agentRegistry.ts` + test. `createAgentRegistry(processRunner)` with
  `claude-cli` (available, wraps `createClaudeCliAdapter`) and `devin`
  (available:false). `list()/get(id)/defaultId()/resolve(id)` incl. unknown-id
  fallback to default (AG-R2.2). Verify: `npm run test -- agentRegistry`
  green, ≥90%; `npm run typecheck`.

- [x] **AS-T2 — AgentService re-bindable** (AG-R1.2/1.3)
  `agentService.ts`: `createAgentService(registry, initialId)`; add
  `setAdapter(id)` (available-only) + `capabilities()` reflects current adapter.
  Update `agentService.test.ts`. Verify: tests green, ≥90%, typecheck.

- [x] **AS-T3 — Config.agent + `profile` IPC (agent half)** (AG-R2)
  `configStore.ts`: `agent: string|null` + `getAgent`/`setAgent` (+ test).
  `main/index.ts`: wire `createAgentService(registry, getAgent() ?? defaultId())`;
  add `profile.agents`/`getAgent`/`setAgent` handlers (`setAgent` persists +
  `agentService.setAdapter`, rejects unavailable). `preload/index.ts` + `.d.ts`:
  `profile` namespace (agent methods). Verify: configStore + preload + index
  tests green, ≥90%, typecheck.

- [x] **AS-T4 — `AgentSetup` onboarding step** (AG-R3.1) — *with RP-T4*
  `renderer/onboarding/AgentSetup.tsx` (+ `AgentCard`/shared `ChoiceCard`) on the
  `.wb-gate` shell: available selectable, unavailable disabled + "Em breve" Badge;
  default preselect `claude-cli`; required "Continuar" persists via
  `profile.setAgent`. Copy in `pt-BR.ts`. Wired into `App.tsx`'s gate (RP-T4).
  Verify: component test (renders agents, disables unavailable, requires pick,
  persists) green ≥90%; noInlineStrings; typecheck; lint.

- [x] **AS-T5 — Agent section in ProfileSheet** (AG-R3.2) — *with RP-T8*
  Add the "Agente" section to `ProfileSheet` (role-personalization). Change →
  `profile.setAgent` + lifted `agent` state updates → `Chat` re-binds session
  (AS-T? via dep). Verify: covered by ProfileSheet test (change agent persists +
  propagates).

- [x] **AS-T6 — Active-agent indicator + session re-bind** (AG-R3.3/AG-C4)
  `Chat.tsx`: add `agent` to the session effect deps so a change restarts the
  session + re-reads capabilities; show the active agent `displayName` quietly in
  the composer toolbar. `agent` lifted from `App` (with RP state plumbing).
  Verify: Chat test (agent change restarts session, indicator shows name) green
  ≥90%; typecheck; lint.

- [x] **AS-T7 — Feature closeout**
  Full `npm run test` green, `npm run typecheck` clean, no new `npm run lint`
  errors from this feature's files; `_electron.launch` visual pass of AgentSetup
  (dark+light) + the profile-sheet agent section + composer indicator. Mark
  ROADMAP M5 (agent-selection slice) + this file `[x]`; update STATE.
