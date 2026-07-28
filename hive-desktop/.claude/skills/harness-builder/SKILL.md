---
name: harness-builder
description: Creates, improves, or maintains a project's coding-agent harness (guides + sensors) via four bundled reference modules, recording it all in a living HARNESS.md — what guides the agent, what measures it, and what deliberately does not exist. Full playbook — assess, rules, baselines, gap skills, sensors, steering loop. Scoped — update the existing HARNESS.md after a control changes or a failure recurs; rules/AGENTS.md only (agent-rules-architect); find/install ecosystem skills (find-skills); harness assess/audit/sensors/timing (harness-engineer); org stack ai-tool presets — skills + MCPs — React/Angular/.NET/SDD (stack-presets). Progressive loading — each mode loads only what it needs. Use for build-harness, harness setup, agent rules, AGENTS.md, sensors, linters, stack presets, skill discovery — or to update/evolve the harness record when the user says the agent keeps repeating a mistake, asks to add or drop a check, or ships work that changed how the project is checked.
---

# Harness Builder

**Router skill.** Before doing anything: determine which **mode** applies, then
load **only** what that mode needs. Never read all reference modules up front.

## Step 1 — Pick the mode

| Mode | User intent (examples) | Load |
| --- | --- | --- |
| **Update** | The project already has a `HARNESS.md` and something specific changed: "the agent keeps doing X", "add/drop this check", "we just shipped Y — does the harness need to change?", "update the harness record" | [`references/harness-engineer/SKILL.md`](references/harness-engineer/SKILL.md) **step 7 only** |
| **Full** | Build/improve the *complete* harness; setup from scratch; run build-harness; no narrower scope stated | [`references/full-playbook.md`](references/full-playbook.md) |
| **Rules** | Create/improve/audit/trim `AGENTS.md`, `.cursor/rules`, agent instructions; "só rules"; optimize rules | [`references/agent-rules-architect/SKILL.md`](references/agent-rules-architect/SKILL.md) |
| **Find** | Find/search/install a skill; "tem skill para X?"; skills.sh; extend agent capabilities | [`references/find-skills/SKILL.md`](references/find-skills/SKILL.md) |
| **Harness** | Assess/audit harness; add sensors; timing/placement; steering loop; harness gaps — *without* full playbook or rules-only job | [`references/harness-engineer/SKILL.md`](references/harness-engineer/SKILL.md) |
| **Presets** | Apply org ai-tool presets (skills + MCPs); install stack tools; "presets React/Angular/.NET"; SDD baseline | [`references/stack-presets/SKILL.md`](references/stack-presets/SKILL.md) |

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
audit script. Skip harness assessment, presets, and find-skills unless the user
expands scope.

### Find

Read `references/find-skills/SKILL.md` only. Search, vet, present, install with
go-ahead.

### Harness

Read `references/harness-engineer/SKILL.md` only. For orientation on concepts,
also read `references/harness-engineer/references/harness-model.md` — not the
full playbook or other modules. Delegate rule-file writing to Rules mode if that
surfaces as a separate ask.

### Presets

Read `references/stack-presets/SKILL.md` only. Detect stack (or use what
the user stated), then load **only** the matching reference file(s) from its
baseline map — e.g. React → `references/frontend-react.md` (+ the shared
`references/frontend-mcps.md` for its MCP set) inside that module. Always
evaluate `references/sdd.md` for cross-cutting SDD. Idempotent: install only
what's missing (skills *and* MCPs); confirm with user.

## Prime directive (all modes)

**Less, but sharper, wins.**

- Every control must **earn its place** — real observed failure, high-precision
  signal, runs as far left as cost allows, no duplication/conflict.
- **When in doubt, sharpen or remove** rather than add.
- Out-of-scope ideas → **one deferred line**, never a catalog.
- In **Full** mode, `harness-engineer` is the spine; other modules serve its
  assessment. In scoped modes, stay inside the one module unless the user widens.

**One unconditional output:** a **`HARNESS.md` kept current** — the project's
living record of what guides the agent, what measures it, and what deliberately
does not exist. Written on the first pass, linked from `AGENTS.md`, and updated
in place whenever a control changes (see `harness-engineer/SKILL.md` step 7). Its
§7 is what stops each new run from re-proposing controls an earlier one already
rejected.

## Module index (load on demand)

| Path | Scope |
| --- | --- |
| `references/full-playbook.md` | Full mode only — 6-phase orchestration |
| `references/harness-engineer/` | Harness mode; also phases 0–1, 4–5 in Full |
| `references/agent-rules-architect/` | Rules mode; phase 2 in Full |
| `references/stack-presets/` | Presets mode; phase 3a in Full |
| `references/find-skills/` | Find mode; phase 3b in Full |

Each module folder is a verbatim, independently-updatable copy — replace the
folder to update without touching this router.
