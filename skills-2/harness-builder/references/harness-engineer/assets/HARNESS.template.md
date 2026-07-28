# Harness — <project name>

> Output template for the harness-engineer skill. Replace every `<…>`. Delete
> rows/sections that don't apply — keep it lean. The goal is an evidence-based map
> plus a ranked, implementable plan, not an essay.
>
> **This file is the project's living harness memory — write it to the path
> resolved in the harness-engineer workflow (`.specs/project/HARNESS.md`,
> `docs/HARNESS.md`, …), not to a scratch buffer, and link it from `AGENTS.md`.**
> It answers three questions for whoever opens it next: what **guides** the
> agent, what **measures** it, and what deliberately **does not exist**. That
> third one is why the file has to persist — without it, every future run
> re-proposes the controls this one already considered and rejected.
>
> **Living, not archival.** It describes the harness as it is *right now*. Update
> it in place the moment any of these happen — the full workflow is for first
> passes and periodic reviews, not for every edit:
>
> - the user asks ("the agent keeps doing X", "add/drop this check");
> - a control is added, removed, retuned, or moved to another stage — **including
>   as a side effect of ordinary feature work**;
> - a failure recurs a second time;
> - a sensor starts firing noise nobody acts on;
> - a guide and a sensor start disagreeing;
> - something written here turns out to be false.
>
> A change that alters what guides or measures the agent and leaves §2/§5b
> untouched is unfinished work. §5b accumulates as a dated log and §7 keeps
> rejected controls with their reasons — never silently prune either.

## 1. Context

- **Project / scope:** <repo or subproject, what it is in one line>
- **Stack & harnessability:** <languages, typed?, clear module boundaries?,
  framework?, greenfield vs. legacy, monorepo?> — <one line on what this makes
  feasible vs. hard>
- **Goal / pain that prompted this:** <recurring agent mistakes or review pains,
  in the user's words — or, in a repo with a decision log, the recurring failures
  you found there; cite them>
- **Regulation categories in scope:** <maintainability / architecture / behaviour>
- **Target agent(s)/tools:** <Cursor / Claude Code / Codex / Copilot / …>

## 2. What guides and what measures the agent

| Control | Direction | Execution | Category | Stage(s) | Gating? | LLM-actionable? | What it actually enforces |
| --- | --- | --- | --- | --- | --- | --- | --- |
| <e.g. tsc> | feedback | computational | maint. | CI | yes | n/a | <e.g. strict mode on> |
| <e.g. ESLint> | feedback | computational | maint. | CI | no | no (raw codes) | <style only; no AI-failure rules> |
| <e.g. AGENTS.md> | feedforward | inferential | maint. | in-session | — | — | <what it steers> |

Record what each control *actually enforces*, not what its presence implies — a
config wired to no stage is inert, and saying so is the point of the table.

## 2b. Hygiene floor (always reported — pass/fail, no exceptions)

| ID | Control | Status | Evidence / fix |
| --- | --- | --- | --- |
| **CI-04** | Pre-commit tooling installed | <✓ / ✗> | <e.g. "`.husky/pre-commit` runs `lint-staged`" / "no hook tooling detected → add husky + lint-staged"> |
| **HYG-02** | `.gitignore` covers `.env` and `.env.*` | <✓ / ✗> | <e.g. "`.env` only — `.env.local` still stages → add `.env.*` + `!.env.example`"> |
| **HYG-08** | MCP credentials via `${ENV_VAR}` | <✓ / ✗ / n/a> | <e.g. "`.mcp.json` has a literal Figma key → interpolate + rotate" / "no MCP config found"> |

## 3. Coverage map

**Direction × execution** — is the loop balanced?

|             | Computational | Inferential |
| ----------- | ------------- | ----------- |
| Feedforward | <controls>    | <controls>  |
| Feedback    | <controls>    | <controls>  |

**Category × stage** — is coverage spread correctly across the lifecycle?

| Category \ Stage | In-session | Pre-commit | CI | Continuous | Runtime |
| ---------------- | ---------- | ---------- | -- | ---------- | ------- |
| Maintainability  | <…>        | <…>        | <…> | <…>       | <…>     |
| Architecture     | <…>        | <…>        | <…> | <…>       | <…>     |
| Behaviour        | <…>        | <…>        | <…> | <…>       | <…>     |

## 4. Findings

Anchor each to evidence (a file, a config, an observed failure). Tag the type.

- **[Hygiene] <CI-04 | HYG-02 | HYG-08>** — <what's missing; the fix inline>.
  Only for the ones that failed above; drop this line if all three pass.
- **[Gap] <title>** — <failure mode with no guide *and* no sensor; the evidence>.
- **[Imbalance] <title>** — <guides without sensors, or vice versa>.
- **[Timing] <title>** — <misplaced or unwired control; where it runs vs. should>.
- **[Redundancy] <title>** — <two controls covering the same thing>.
- **[Conflict] <title>** — <controls pulling in opposite directions, *including* a
  guide that instructs the agent straight into a known failure>.
- **[Mute sensor] <title>** — <high-value rule with non-actionable output>.
- **[False security] <title>** — <green signal that doesn't mean what it seems>.

## 5. Prioritized recommendations

Ordered by leverage ÷ cost. Each must be implementable as written.

### P1 — <recommendation title>
- **What:** <the concrete change>
- **Why:** <which observed failure it prevents / which finding it closes>
- **Type:** <guide | sensor> · <computational | inferential>
- **Category:** <maintainability | architecture | behaviour>
- **Stage & gating:** <in-session / pre-commit / CI / continuous / runtime> ·
  <gate | report>
- **How (concrete):** <exact tool + config snippet; the self-correction message;
  where it's wired — rule/hook/CI>
- **Effort:** <S | M | L>

### P2 — <…>
<same shape>

## 5b. Change log

Append-only, newest last, one dated block per round of harness change — whether
it came from a full assessment, a one-line request from the user, or a control
that shifted during ordinary feature work. This is what makes the file memory
rather than a proposal.

### <date> — <what prompted it: "initial pass" / "user: agent kept doing X" / "fallout from feature Y">

| # | Change | Where |
| --- | --- | --- |
| <P1> | <the change, in one line> | <path> |

**Not implemented, and why:** <anything from §5 the user approved but that the
work itself proved wrong — say so here rather than dropping it silently.>

**Verification:** <the gate command and its result — "verify green, N tests" —
plus anything proven by *running* it rather than by reading it.>

**State after the change** — repeat the category × stage map so the delta is
visible, and name which cell is still empty *on purpose* (that belongs in §7).

## 6. Steering loop

The generic update triggers are in the header; this section is *this project's*
instantiation of them — the concrete signals worth watching here.

- **Watch:** <which signals/failures to monitor next — name the project's own
  canonical source, e.g. "any lesson in STATE.md that says 'again'">
- **Add when:** <the trigger for introducing the next control — usually a failure
  recurring a second time>
- **Retire when:** <how to spot and remove noisy/low-value controls>
- **Keep in sync:** <how guides and sensors stay non-contradictory as they grow —
  e.g. once a sensor covers a rule, the rule shrinks to a pointer>
- **Re-measure:** re-run `harness_inventory.py` after changes to confirm the new
  coverage is real (wired), not just intended — **and record the script's known
  false negatives for this repo**, so the next run doesn't re-chase them:

  | Script says | Reality here |
  | --- | --- |
  | <e.g. "no strict mode"> | <e.g. "strict lives in tsconfig.node/web, not tsconfig.json"> |

## 7. What deliberately does not exist

The load-bearing half of this file. Every control considered and **not** built,
each with its reason — so a future run doesn't re-propose it as a fresh idea, and
so a reader can tell a deliberate absence from an oversight.

| Control | Why not | Revisit when |
| --- | --- | --- |
| <e.g. mutation testing> | <no observed case of a green test hiding a bug> | <that happens once> |
| <e.g. secret scanning> | <no secrets, no deploy — nothing to leak yet> | <first credential, or first deploy> |
| <e.g. an arch rule for X> | <the rule is currently *held*; a guard would need an allowlist of N legitimate files — noise, no signal> | <the rule is actually violated> |

**Honest limits** — what *no* control here covers:

<Especially behaviour/correctness: sensors verify form and catch regressions;
they don't verify intent. A test can assert the wrong thing and still pass. Name
where human attention is still required, specific to this project rather than
generic.>
