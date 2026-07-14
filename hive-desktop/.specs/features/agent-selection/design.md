# Design — Agent Selection

Reuses the existing `AgentAdapter` contract untouched; adds a registry, a global
persisted selection, and a picker that rides the same onboarding + profile
surfaces as role-personalization. Product register throughout.

---

## 1. Adapter registry (`main/agentRegistry.ts` — new)
```ts
export interface AgentRegistryEntry {
  id: string
  displayName: string
  description: string     // one-liner for the picker card
  available: boolean      // false = declared placeholder ("Em breve")
  create?: (pr: ProcessRunner) => AgentAdapter  // only for available entries
}
export function createAgentRegistry(pr: ProcessRunner): {
  list(): AgentMeta[]                     // {id, displayName, description, available}
  get(id: string): AgentAdapter | null    // available only
  defaultId(): string                     // first available (claude-cli)
  resolve(id: string | null): { id: string; adapter: AgentAdapter } // fallback-safe (AG-R2.2)
}
```
Entries: `claude-cli` (available, wraps `createClaudeCliAdapter`), `devin`
(available:false, no `create`). Extensible: adding a real adapter later is a new
entry + `available:true`. `AgentMeta` (id/displayName/description/available) is
the serializable shape crossing IPC.

## 2. AgentService made re-bindable (`main/agentService.ts`)
`createAgentService` takes the **registry** (not a single adapter) + the initial
selected id. Add `setAdapter(id)` (switch which adapter future `startSession`
uses; only `available`) and `capabilities()` reads the current adapter. Existing
`startSession/send/runWorkflow/onEvent/stop` unchanged in signature. `main/index.ts`
wires `createAgentService(registry, configStore.getAgent() ?? registry.defaultId())`.

## 3. Config + IPC
- `configStore`: add `agent: string | null` + `setAgent`/`getAgent` (global, AG-C2).
- IPC under the shared `profile` namespace: `profile.agents()` → `AgentMeta[]`;
  `profile.getAgent()`; `profile.setAgent(id)` → persists + `agentService.setAdapter(id)`
  (rejects unavailable ids). Changing agent triggers the renderer to restart its
  session (Chat re-reads capabilities + re-starts — same effect as a model change).

## 4. UI
### `AgentSetup.tsx` (onboarding step, before RoleSetup — RP-C6)
Same `.wb-gate` shell + a card radiogroup (shares the `RoleCard`-style selectable
card via a small generic `ChoiceCard`, or a dedicated `AgentCard`). Available
agents selectable; unavailable render **disabled** with an "Em breve" `Badge`
(DS `Badge`, muted — never a full-saturation accent on an inactive state, product
register) + description. Default preselects `claude-cli`. CTA "Continuar".

### Profile sheet section (AG-R3.2)
The "Agente" section in `ProfileSheet` (role-personalization §5): same card group;
changing re-binds the live session.

### Active-agent indicator (AG-R3.3)
A small, quiet label in the chat composer toolbar (next to model/effort) showing
the active agent's `displayName` — so the user always knows who they're talking
to. Read from the loaded agent state; not a control there (changed via the gear).

## 5. Session re-bind on change
`agent` is lifted to `App.tsx` alongside `role`. `Chat`'s session effect already
keys on `workspace/model/effort`; add `agent` to its deps so changing the agent
tears down + restarts the session (the effect's cleanup calls `agent.stop()`), and
re-reads `capabilities()` (which now reflects the new adapter). Clean, reuses the
existing lifecycle.

## 6. Testing
`agentRegistry` (list/get/resolve/fallback for unknown id); `agentService`
setAdapter + capabilities reflect selection; config `agent` round-trip; IPC
rejects unavailable id; `AgentSetup` disables unavailable + requires a pick;
composer shows the active agent. ≥90% per-file. Visual via `_electron.launch`.

## 7. Risks
- Placeholder honesty: unavailable agents must be visibly non-functional
  (disabled + "Em breve"), never appear selectable then fail. Enforced by
  `available` gating in both UI and `setAdapter`.
- Unknown persisted id (older config / removed adapter): `resolve()` falls back to
  default (AG-R2.2) — covered by a test.
