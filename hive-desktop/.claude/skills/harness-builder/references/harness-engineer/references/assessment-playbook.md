# Assessment Playbook: from a repo to a prioritized harness plan

The method for steps 2–4 of the workflow: inventory what exists, map it onto the
harness, find what's missing or misplaced, and turn that into a ranked,
implementable plan. This is where the value is — the writing afterward is easy.

## Step A — Inventory (find every existing control)

Start deterministic, then read for nuance.

1. **Run the script.** `python3 <skill-dir>/scripts/harness_inventory.py
   <repo-path>` detects stack, linters/formatters/type checkers, test &
   coverage & mutation config, dependency/architecture rules, SAST & secret
   scanning, hook runners, CI steps, and agent rule files, then prints a coverage
   matrix and obvious gaps. Use `--json` to capture structured output.
2. **Confirm what each control *actually enforces*.** Presence ≠ effectiveness.
   Open the configs: Is the type checker in `strict`? Do the lint rules include
   the AI-failure ones (max args/lines/complexity) or just style? Are arch rules
   real or stubs? Is coverage gated or just printed?
3. **Check the *timing* of each.** Read hook configs and CI: does the linter run
   only in CI, or also pre-commit and in-session (a rule telling the agent)?
   A control with no stage wired is "present but inert."
4. **Check *signal quality*.** Does any sensor emit LLM-actionable messages
   (custom formatter / message), or only raw codes? Mute sensors are a top fix.
5. **Inventory the guides too.** What do `AGENTS.md`/`CLAUDE.md`/`.cursor/rules`/
   `docs/` actually steer? (For depth here, lean on `agent-rules-architect`.)
6. **Note harnessability.** Typed? Clear boundaries? Framework? Greenfield vs.
   legacy? Monorepo? This bounds what you can recommend.

Output: a factual table of controls — name · direction · execution · category ·
stage(s) · gating? · LLM-actionable? · what it really enforces.

## Step B — Map onto the harness (the coverage matrix)

Lay the inventory across the dimensions from `harness-model.md`. Two views are
usually enough:

**View 1 — direction × execution** (is the loop balanced?)

|              | Computational | Inferential |
| ------------ | ------------- | ----------- |
| Feedforward  | …             | …           |
| Feedback     | …             | …           |

**View 2 — category × stage** (is coverage spread correctly across the lifecycle?)

| Category \ Stage | In-session | Pre-commit | CI | Continuous | Runtime |
| ---------------- | ---------- | ---------- | -- | ---------- | ------- |
| Maintainability  | …          | …          | …  | …          | …       |
| Architecture     | …          | …          | …  | …          | …       |
| Behaviour        | …          | …          | …  | …          | …       |

Empty cells are *candidate* gaps — but only real if a relevant failure mode lives
there and the control is buildable here. An empty "Behaviour × runtime" cell is
fine for a CLI tool; an empty "Maintainability × pre-commit" is a red flag for an
AI-heavy TS service.

## Step C — Find the findings

Hunt specifically for these, with evidence:

- **Coverage gaps** — a real, observed failure mode with *no guide and no sensor*.
  Anchor each to a failure the user or the codebase actually exhibits (sprawling
  files, assertion-light tests, layer violations, secret leaks). Resist inventing
  gaps the project doesn't feel.
- **Direction imbalance** — many guides but no sensors (mistakes recur because
  nothing measures them), or sensors but no guides (the agent keeps re-deriving
  what a one-line rule would say).
- **Timing misplacement** — expensive/inferential control gating every commit;
  cheap/deterministic control stranded in a nightly job; a control "present but
  not wired" to any stage.
- **Redundancy** — two controls catching the same thing (cost with no marginal
  signal). Recommend removing or merging one.
- **Conflict** — controls that pull in opposite directions (the max-lines vs.
  max-lines-per-function tension; a guide that says X and a sensor that punishes
  X). Flag and resolve, don't ship contradictions.
- **Mute sensors** — high-value rules whose output the agent can't act on. Usually
  the cheapest high-impact fix: add a self-correction message.
- **False security** — green dashboards that don't mean what they seem (high
  coverage, low assertion strength). Name the illusion.

## Step D — Prioritize (leverage ÷ cost)

Rank, don't dump. Bias toward:

1. **Fixes to observed failures** over hypothetical coverage. The best harnesses
   grow from real mistakes, not imagination.
2. **Cheapest control that catches the most.** A self-correction message on an
   existing linter beats standing up a new tool.
3. **Keep-quality-left moves** — shifting an existing CI-only check into
   pre-commit / in-session, or wiring an inert control to a stage.
4. **Buildability** — don't recommend arch rules for a structure-less script, or a
   behaviour harness you can't actually staff.

Then sequence: a few high-signal changes first, re-measure, iterate. A smaller
harness the agent trusts beats a big one that fires noise.

## Step E — Write it up

Use `assets/HARNESS.template.md`, written to the project as `HARNESS.md` (path
resolution in `SKILL.md` step 3). For every recommendation, make it
*implementable*: what · why (which failure it prevents) · type (guide/sensor,
computational/inferential) · category · stage + gate/report · concrete steps
(exact tool, config snippet, self-correction message, where it's wired) · effort.

Then present priorities to the user and implement the agreed items per workflow
step 5 — smallest step first, treating heavy installs/CI edits as confirmations.

## Guardrails (so the assessment doesn't become bloat itself)

The same minimalism that governs `agent-rules-architect` governs here:

- **Every control must earn its place.** If you can't name the failure it
  prevents, cut the recommendation.
- **Prefer sharpening to adding.** A tuned, message-bearing existing sensor often
  beats a new one.
- **Watch for over-harnessing.** Too many noisy signals cause over-engineering
  spirals and a false sense of quality — and the human stops trusting the harness.
- **Stay honest about limits.** Especially behaviour: a harness directs human
  attention, it doesn't remove it. Say so.
- **Leave a living loop.** The harness is never "done"; hand back how to evolve it
  (add controls from new recurring failures, retire noisy ones, keep guides and
  sensors in sync).
