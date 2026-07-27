# Full harness playbook

**Load this file only in Full mode** (complete harness setup or improvement).
For scoped tasks — rules only, find skills, harness engineering alone, stack
presets — stay in `SKILL.md` and load a single module instead.

You are setting up or improving the **coding-agent harness** of a project: the
system of **guides** (feedforward — rules/skills that steer the agent before it
acts) and **sensors** (feedback — checks that let it self-correct after). The
deliverable is a harness that is **small, sharp, and trusted**, plus a short
plan the squad can keep evolving.

This playbook coordinates three reference modules under `references/`. **Do not
run them in parallel or blindly in sequence** — `harness-engineer` is the spine
that decides *what the harness needs*, and it *calls* the others only to fill
gaps it has actually identified.

| Module | Role |
| --- | --- |
| `harness-engineer` | **Spine.** Frames, assesses, enforces the hygiene floor, wires sensors, closes steering loop. |
| `agent-rules-architect` | **Guides.** Authors/trims `AGENTS.md` + `docs/` for guide gaps found, and carries the three mandatory blocks. |
| `stack-presets` | **Presets.** Org mandatory ai-tools (skills + MCPs) per stack, plus the SDD decision (progressive, idempotent). |

Load each module's `SKILL.md` only when its phase starts — never all up front.

## Inputs to gather first (ask the user, don't assume)

1. **Project path / repo** (default: current workspace).
2. **Goal & pain.** What does "good" look like? Which *recurring* agent mistakes
   or review pains prompted this?
3. **Scope.** Regulation categories: **maintainability** (default),
   **architecture fitness**, **behaviour** (hardest — be honest).
4. **Target agent/tools** (Cursor, Claude Code, Codex, Copilot…).
5. **Create vs. improve.** Existing controls → audit + strengthen; inventory
   first, don't pile on.

---

## Phase 0 — Orient (load the mental model)

Read `references/harness-engineer/references/harness-model.md` — guides vs.
sensors, computational vs. inferential execution, regulation categories,
timing ("keep quality left"), harnessability, the human's role. Do not skip.

## Phase 1 — Assess (`harness-engineer`)

Follow `references/harness-engineer/SKILL.md` steps 1–3.

1. **Frame the job** (inputs above).
2. **Inventory:**

   ```bash
   python3 references/harness-engineer/scripts/harness_inventory.py <repo-path>
   ```

   Then read key configs/CI: what each control enforces, LLM-friendly output,
   lifecycle timing.
3. **Map** controls: direction × execution × category × timing. Find gaps,
   imbalance, misplacement, redundancy, weak signal quality.
4. **Check the hygiene floor** — the three baseline controls that hold on every
   run regardless of stack or stated goal (`CI-04` pre-commit tooling, `HYG-02`
   `.env` in `.gitignore`, `HYG-08` MCP credentials via `${ENV_VAR}`). See
   `references/harness-engineer/references/sensors-catalog.md` §L.
5. **Write Harness Assessment** using
   `references/harness-engineer/assets/harness-assessment.template.md`.

**Gate:** Present assessment + prioritized shortlist. **Get user go-ahead before
changing anything.**

## Phase 2 — Guides / rules (`agent-rules-architect`)

For **guide gaps only**, load `references/agent-rules-architect/SKILL.md` and
follow its workflow. `harness-engineer` decides *what*; this module decides *how*
minimally.

Three blocks are **mandatory**, independent of the gaps found (see that module's
`references/mandatory-blocks.md`):

1. **Memory / SDD contract** — `STATE.md` read at session start, plus the map to
   `PROJECT.md` / `ROADMAP.md` / feature specs. Paths come from Phase 3's SDD
   decision, so write this block *after* Phase 3 (or revisit it then).
2. **Architecture principles** — only when the project actually has them;
   summarized in `AGENTS.md`, sharded into granular `docs/` files.
3. **General rules** — "Writing implementation plans" (always, with *this*
   project's real build/lint/e2e commands) + "Implementation and Testing".

Validate:

```bash
python3 references/agent-rules-architect/scripts/audit_rules.py <repo-path>
```

**Guard:** Beyond the three mandatory blocks, rules only for identified gaps. No
linter restatement, no README copy, keep `AGENTS.md` ruthlessly small — depth
goes into `docs/`.

## Phase 3 — Stack presets (`stack-presets`)

Load `references/stack-presets/SKILL.md`. Progressive + idempotent. Presets are
**skills + MCPs** keyed by stack:

| Stack | Baseline skills | Baseline MCPs | Condition |
| --- | --- | --- | --- |
| Any | `tlc-spec-driven` (org default) | — | only if no SDD tool present |
| React | `vercel-react-best-practices` + testing/perf on gap | Figma · Playwright · Chrome DevTools | if missing |
| Angular | `angular-developer` + testing/perf on gap | Figma · Playwright · Chrome DevTools | if missing |
| .NET / C# | `dotnet-best-practices` + testing/perf on gap | — (frontend-only MCP set) | if missing |

Skills install project-level; MCPs go in `.mcp.json` with **credentials as
`${ENV_VAR}` interpolation, never literals** (HYG-08). Confirm each step with the
user.

The SDD row runs on every project and doesn't ask which tool to adopt: no SDD
tool found → install `tlc-spec-driven`; one already there → keep it. Either way
the memory contract lands in `AGENTS.md` via Phase 2 — see
`references/stack-presets/references/sdd.md`.

## Phase 4 — Sensors & timing (`harness-engineer`)

`references/harness-engineer/SKILL.md` steps 4–5:

- Sensors with **self-correction messages** →
  `references/harness-engineer/references/sensors-catalog.md`
- Placement by cost →
  `references/harness-engineer/references/timing-and-placement.md`
- Encode timing in rules, hooks, CI. Confirm heavy changes with user.

## Phase 5 — Steering loop (`harness-engineer`)

Step 6: re-run inventory, document how to evolve the harness, state honest
limits (sensors verify form, not intent).

```bash
python3 references/harness-engineer/scripts/harness_inventory.py <repo-path>
```

---

## Definition of done

- [ ] Harness Assessment with all controls classified; findings tied to goal or
      observed failure.
- [ ] Only prioritized items implemented; deferrals are one line each.
- [ ] Minimal `AGENTS.md` + granular `docs/` via `agent-rules-architect`, audit
      passing.
- [ ] The three mandatory blocks present in `AGENTS.md`: memory/SDD contract
      (pointing at real, existing files), architecture principles (if the project
      has any), general rules with this project's real commands.
- [ ] Nested `AGENTS.md` + its own `docs/` at the e2e root, when e2e tests exist.
- [ ] Hygiene floor green: pre-commit tooling (CI-04), `.env`/`.env.*` ignored
      (HYG-02), MCP credentials via `${ENV_VAR}` (HYG-08).
- [ ] Sensors with self-correction messages; gating only where justified.
- [ ] Stack presets present — skills + MCPs (via `stack-presets` if missing).
- [ ] SDD in place — existing tool kept, or `tlc-spec-driven` installed.
- [ ] Steering loop documented; inventory re-run confirms coverage.
- [ ] Honest limits stated.

## Anti-patterns

- Harness theater — noise nobody acts on.
- Running modules mechanically instead of letting assessment decide.
- Mute sensors — no self-correction message.
- Everything gates everything.
- Feedforward-only or feedback-only.
- Imagined failures.
