# Harness Assessment — <project name>

> Output template for the harness-engineer skill. Replace every `<…>`. Delete
> rows/sections that don't apply — keep it lean. The goal is an evidence-based map
> plus a ranked, implementable plan, not an essay.

## 1. Context

- **Project / scope:** <repo or subproject, what it is in one line>
- **Stack & harnessability:** <languages, typed?, clear module boundaries?,
  framework?, greenfield vs. legacy, monorepo?> — <one line on what this makes
  feasible vs. hard>
- **Goal / pain that prompted this:** <recurring agent mistakes or review pains,
  in the user's words>
- **Regulation categories in scope:** <maintainability / architecture / behaviour>
- **Target agent(s)/tools:** <Cursor / Claude Code / Codex / Copilot / …>

## 2. Current harness inventory

| Control | Direction | Execution | Category | Stage(s) | Gating? | LLM-actionable? | What it actually enforces |
| --- | --- | --- | --- | --- | --- | --- | --- |
| <e.g. tsc> | feedback | computational | maint. | CI | yes | n/a | <e.g. strict mode on> |
| <e.g. ESLint> | feedback | computational | maint. | CI | no | no (raw codes) | <style only; no AI-failure rules> |
| <e.g. AGENTS.md> | feedforward | inferential | maint. | in-session | — | — | <what it steers> |

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

- **[Gap] <title>** — <failure mode with no guide *and* no sensor; the evidence>.
- **[Imbalance] <title>** — <guides without sensors, or vice versa>.
- **[Timing] <title>** — <misplaced or unwired control; where it runs vs. should>.
- **[Redundancy] <title>** — <two controls covering the same thing>.
- **[Conflict] <title>** — <controls pulling in opposite directions>.
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

### P3 — <…>
<same shape>

## 6. Steering loop — keeping the harness alive

- **Watch:** <which signals/failures to monitor next>
- **Add when:** <the trigger for introducing the next control>
- **Retire when:** <how to spot and remove noisy/low-value controls>
- **Keep in sync:** <how guides and sensors stay non-contradictory as they grow>
- **Re-measure:** re-run `harness_inventory.py` after changes to confirm the new
  coverage is real (wired), not just intended.

## 7. Honest limits

<What this harness does *not* cover — especially behaviour/correctness — and where
human attention is still required.>
