---
name: harness-builder
description: Creates, improves, or maintains a project's coding-agent harness (guides + sensors) via three bundled reference modules, recording it all in a living HARNESS.md — what guides the agent, what measures it, and what deliberately does not exist. Full playbook — assess, rules, presets, sensors, steering loop. Scoped — update the existing HARNESS.md after a control changes or a failure recurs; rules/AGENTS.md only (agent-rules-architect); harness assess/audit/sensors/timing/hygiene (harness-engineer); org stack ai-tool presets — skills + MCPs — React/Angular/.NET/SDD (stack-presets). Progressive loading — each mode loads only what it needs. Use for build-harness, harness setup, agent rules, AGENTS.md, architecture principles, SDD/spec-driven setup, sensors, linters, pre-commit hooks, stack presets — or to update/evolve the harness record when the user says the agent keeps repeating a mistake, asks to add or drop a check, or ships work that changed how the project is checked.
---

# Harness Builder

**Router skill.** Before doing anything: determine which **mode** applies, then
load **only** what that mode needs. Never read all reference modules up front.

## Step 1 — Pick the mode

| Mode | User intent (examples) | Load |
| --- | --- | --- |
| **Update** | The project already has a `HARNESS.md` and something specific changed: "the agent keeps doing X", "add/drop this check", "we just shipped Y — does the harness need to change?", "update the harness record" | [`references/harness-engineer/SKILL.md`](references/harness-engineer/SKILL.md) **step 7 only** |
| **Full** | Build/improve the *complete* harness; setup from scratch; run build-harness; no narrower scope stated | [`references/full-playbook.md`](references/full-playbook.md) |
| **Rules** | Create/improve/audit/trim `AGENTS.md`, `.cursor/rules`, agent instructions; "só rules"; optimize rules; architecture principles | [`references/agent-rules-architect/SKILL.md`](references/agent-rules-architect/SKILL.md) |
| **Harness** | Assess/audit harness; add sensors; timing/placement; hygiene floor (pre-commit, `.gitignore`, MCP secrets); steering loop — *without* full playbook or rules-only job | [`references/harness-engineer/SKILL.md`](references/harness-engineer/SKILL.md) |
| **Presets** | Apply org ai-tool presets (skills + MCPs); install stack tools; "presets React/Angular/.NET"; SDD / spec-driven baseline | [`references/stack-presets/SKILL.md`](references/stack-presets/SKILL.md) |

**Routing rules:**

- Match the **narrowest** mode that fits. "Só quero rules" → **Rules**, not Full.
- **Check for an existing `HARNESS.md` first** (`.specs/project/`, `docs/`, repo
  root). If one exists, read it before anything else — it already records what
  was tried, what was rejected, and why — and prefer **Update** over Full unless
  the user asked for a fresh end-to-end review. Never open a second one.
- If the user names a stack for presets ("aplicar presets num app React"), use
  **Presets** — inside that module, load **only** the matching stack reference
  (e.g. `references/stack-presets/references/frontend-react.md`), never all.
- Multi-scope requests ("avalia o harness e depois escreve rules") → run modes
  **sequentially**: finish one module, then load the next. Do not preload both.
- Ambiguous? Ask once: full harness vs. scoped task — default to **Full** only
  when they clearly want end-to-end setup.

## Step 2 — Execute the mode

Load the single file from the table and follow it end-to-end. **Do not** load
other module `SKILL.md` files unless the active workflow explicitly delegates
(Full playbook does; scoped modes do not).

### Update

Read `references/harness-engineer/SKILL.md` and work from its **step 7** — the
trigger table and the in-place edit discipline. Do **not** re-run the full
assessment: read the existing `HARNESS.md`, confirm the specific claim against
the repo, make the change, update the affected sections (§2 for what a control
now enforces, §5b for a dated log row, §7 when the answer is "we're not building
that, because…"). Escalate to **Full** only if the request turns out to need a
whole re-map.

### Full

Read `references/full-playbook.md`. It orchestrates phases 0–5 and tells you
*when* to load each module — still one module at a time per phase.

### Rules

Read `references/agent-rules-architect/SKILL.md` only. Run its workflow and
audit script. Skip harness assessment and presets unless the user expands scope.
Its three **mandatory blocks** (memory/SDD contract, architecture principles when
they exist, general rules) apply in this mode too.

### Harness

Read `references/harness-engineer/SKILL.md` only. For orientation on concepts,
also read `references/harness-engineer/references/harness-model.md` — not the
full playbook or other modules. Always check its **hygiene floor** (pre-commit
tooling, `.env` in `.gitignore`, MCP credentials via `${ENV_VAR}`) — those three
are checked on every run, not only when asked. Delegate rule-file writing to
Rules mode if that surfaces as a separate ask.

### Presets

Read `references/stack-presets/SKILL.md` only. Detect stack (or use what
the user stated), then load **only** the matching reference file(s) from its
baseline map — e.g. React → `references/frontend-react.md` (+ the shared
`references/frontend-mcps.md` for its MCP set) inside that module. Always
evaluate `references/sdd.md` for cross-cutting SDD — it installs
`tlc-spec-driven` by default when the project has no SDD tool, keeps any existing
one, and ensures the memory contract lands in `AGENTS.md` either way. Idempotent:
install only what's missing (skills *and* MCPs); confirm with user.

## Prime directive (all modes)

**Less, but sharper, wins.**

- Every control must **earn its place** — real observed failure, high-precision
  signal, runs as far left as cost allows, no duplication/conflict.
- **When in doubt, sharpen or remove** rather than add.
- Out-of-scope ideas → **one deferred line**, never a catalog.
- In **Full** mode, `harness-engineer` is the spine; other modules serve its
  assessment. In scoped modes, stay inside the one module unless the user widens.

**Three named exceptions**, and only these — all *unconditional*, not
"thorough":

- The **hygiene floor** (CI-04 pre-commit tooling, HYG-02 `.env` ignored,
  HYG-08 MCP credentials via `${ENV_VAR}`) — checked and fixed on every run.
- The **three mandatory blocks** in `AGENTS.md` (memory/SDD contract; architecture
  principles *when the project has them*; general rules) — written on every run.
- **`HARNESS.md`, kept current** — the project's living record of what guides the
  agent, what measures it, and what deliberately does not exist. Written on the
  first pass, linked from `AGENTS.md`, and updated in place whenever a control
  changes (see `harness-engineer/SKILL.md` step 7). Its §7 is what stops each new
  run from re-proposing controls an earlier one already rejected.

Their absence *is* the evidence, and each costs minutes. Everything else still
has to earn its place.

## Module index (load on demand)

| Path | Scope |
| --- | --- |
| `references/full-playbook.md` | Full mode only — 6-phase orchestration |
| `references/harness-engineer/` | Harness mode; also phases 0–1, 4–5 in Full |
| `references/agent-rules-architect/` | Rules mode; phase 2 in Full |
| `references/stack-presets/` | Presets mode; phase 3 in Full |

Each module folder is a verbatim, independently-updatable copy — replace the
folder to update without touching this router.
