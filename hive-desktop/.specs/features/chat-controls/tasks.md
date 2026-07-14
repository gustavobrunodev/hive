# Tasks — Chat Controls

Atomic tasks: implement → verify → atomic commit. Requirement IDs traced.
Coverage ≥90% per changed file. Env: `source ~/.nvm/nvm.sh && nvm use 22.22.1`.
Independent of agent-selection / role-personalization (can land before or after).

---

- [x] **CC-T1 — `interrupted` event + user-stop flag** (CC-R1.5)
  `agentAdapter.ts`: add `| { type: 'interrupted' }` to `AgentEvent`.
  `claudeCliAdapter.ts`: `stop()` sets an `interrupted` flag; `pipeTurn` emits
  `interrupted` (not `error`) when the turn ended via a user stop. Update
  `claudeCliAdapter.test.ts` + `agentService.test.ts`. Verify: a stop mid-turn
  emits `interrupted`, prior `token`s intact, clean exit still `done`, real error
  still `error`. Tests green ≥90%; typecheck.

- [x] **CC-T2 — Interrupt wiring + Stop control in Chat** (CC-R1.1–1.4)
  `Chat.tsx`: handle `interrupted` (commit non-empty `streamingTextRef` as an
  assistant message, drop empty, clear streaming, no error Alert); render a Stop
  affordance in the composer visible only while `isStreaming` → `agent.stop()`.
  Icon in `ui/icons.tsx`; copy in `pt-BR.ts`; styles in `workbench.css`. Verify:
  Chat test (Stop shown only while streaming; commits partial / drops empty; no
  Alert; next send works) green ≥90%; noInlineStrings; typecheck; lint.

- [x] **CC-T3 — Full skill discovery** (CC-R3.1)
  `workflowCatalog.ts`: `listSkills(workspaceRoot)` → `{key,label,description}[]`
  from the full `bmad-help.csv` (reuse `parseBmadHelpCsv`, dedup, skip `_meta`/
  empty), `[]` on missing/empty (CC-R2.5). Update `workflowCatalog.test.ts`.
  Verify: full list + dedup + empty-fallback tests green ≥90%; typecheck.

- [x] **CC-T4 — `skills.list` IPC** (CC-R3.1)
  `main/index.ts`: `skills:list` handler → `listSkills`. `preload/index.ts` +
  `.d.ts`: `skills.list(workspace)`. Verify: index + preload tests green ≥90%;
  typecheck.

- [x] **CC-T5 — Slash-command menu** (CC-R2)
  `chat/SlashMenu.tsx` (new) + `Chat.tsx` integration: open on leading `/`
  (query = text after `/`, close on space/delete/Esc); portal/fixed-positioned
  upward popover anchored to the composer; type-to-filter; ↑/↓/Enter/Esc keyboard
  with `aria-activedescendant` (focus stays in textarea); select →
  `agent.runWorkflow` + clear + close; teaching empty state; 120ms motion +
  reduced-motion. Icon + copy + styles. Verify: SlashMenu test (opens on `/`,
  filters, keyboard nav, select launches+clears, empty state) green ≥90%;
  noInlineStrings; typecheck; lint.

- [x] **CC-T6 — Feature closeout** (CC-R4)
  Full `npm run test` green; `npm run typecheck` clean; no new `npm run lint`
  errors from this feature's files; per-file ≥90% on changed files.
  `_electron.launch` visual pass: a streaming turn → Stop → partial preserved;
  the `/` menu open + filtered + launch. Mark ROADMAP M2 (chat-controls slice) +
  this file `[x]`; update STATE.
