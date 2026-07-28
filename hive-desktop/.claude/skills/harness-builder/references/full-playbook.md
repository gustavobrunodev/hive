# Full harness playbook

**Load this file only in Full mode** (complete harness setup or improvement).
For scoped tasks — rules only, find skills, harness engineering alone, stack
presets — stay in `SKILL.md` and load a single module instead.

You are setting up or improving the **coding-agent harness** of a project: the
system of **guides** (feedforward — rules/skills that steer the agent before it
acts) and **sensors** (feedback — checks that let it self-correct after). The
deliverable is a harness that is **small, sharp, and trusted**, plus a short
plan the squad can keep evolving.

This playbook coordinates four reference modules under `references/`. **Do not
run them in parallel or blindly in sequence** — `harness-engineer` is the spine
that decides *what the harness needs*, and it *calls* the others only to fill
gaps it has actually identified.

| Module | Role |
| --- | --- |
| `harness-engineer` | **Spine.** Frames, assesses, wires sensors, closes steering loop. |
| `agent-rules-architect` | **Guides.** Authors/trims `AGENTS.md` + `docs/` for guide gaps found. |
| `stack-presets` | **Presets.** Org mandatory ai-tools (skills + MCPs) per stack (progressive, idempotent). |
| `find-skills` | **Gaps.** Vets ecosystem skills for gaps baselines/rules don't cover. |

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
4. **Write `HARNESS.md`** — the project's living harness memory — using
   `references/harness-engineer/assets/HARNESS.template.md`. Resolve its path per
   `harness-engineer/SKILL.md` step 3 (`.specs/project/`, `docs/`, …); if one
   already exists, update it in place instead of creating a second.

**Gate:** Present assessment + prioritized shortlist. **Get user go-ahead before
changing anything.**

## Phase 2 — Guides / rules (`agent-rules-architect`)

For **guide gaps only**, load `references/agent-rules-architect/SKILL.md` and
follow its workflow. `harness-engineer` decides *what*; this module decides *how*
minimally.

Validate:

```bash
python3 references/agent-rules-architect/scripts/audit_rules.py <repo-path>
```

**Guard:** Rules only for identified gaps. No linter restatement, no README
copy, keep `AGENTS.md` ruthlessly small.

## Phase 3 — Skills: baselines first, then gaps

**3a before 3b**, always.

### 3a — Presets (`stack-presets`)

Load `references/stack-presets/SKILL.md`. Progressive + idempotent. Presets are
**skills + MCPs** keyed by stack:

| Stack | Baseline skills | Baseline MCPs | Condition |
| --- | --- | --- | --- |
| Any | `tlc-spec-driven` | — | only if no SDD tool |
| React | `vercel-react-best-practices` + testing/perf on gap | Figma · Playwright · Chrome DevTools | if missing |
| Angular | `angular-developer` + testing/perf on gap | Figma · Playwright · Chrome DevTools | if missing |
| .NET / C# | `dotnet-best-practices` + testing/perf on gap | — (frontend-only MCP set) | if missing |

Skills install project-level; MCPs go in `.mcp.json` (Figma needs an API-key
placeholder — never a real key). Confirm each step with user.

### 3b — Gap discovery (`find-skills`)

Load `references/find-skills/SKILL.md` for gaps baselines don't cover.
Vet before recommending (1K+ installs, reputable source). Install only with
go-ahead (`npx skills add <owner/repo@skill> -g -y`).

## Phase 4 — Sensors & timing (`harness-engineer`)

`references/harness-engineer/SKILL.md` steps 4–5:

- Sensors with **self-correction messages** →
  `references/harness-engineer/references/sensors-catalog.md`
- Placement by cost →
  `references/harness-engineer/references/timing-and-placement.md`
- Encode timing in rules, hooks, CI. Confirm heavy changes with user.

## Phase 5 — Steering loop + living memory (`harness-engineer`)

Steps 6–7: re-run the inventory, log what landed in `HARNESS.md` §5b, record in
§7 every control considered and *not* built (with its revisit trigger), and state
honest limits (sensors verify form, not intent).

```bash
python3 references/harness-engineer/scripts/harness_inventory.py <repo-path>
```

Then hand over the maintenance contract: `HARNESS.md` is **living memory**, so it
gets updated whenever a control changes — on the user's request, when a failure
recurs, or as fallout from ordinary feature work — not only at the next full
review. See `harness-engineer/SKILL.md` step 7 for the trigger table.

---

## Definition of done

- [ ] `HARNESS.md` written to a resolved project path (not a chat reply) and
      linked from `AGENTS.md`, with all controls classified and findings tied to
      the goal or an observed failure.
- [ ] Its §7 lists what deliberately **does not** exist — every control
      considered and rejected, with the reason and a revisit trigger.
- [ ] Its §5b logs, dated, what actually landed and how it was verified.
- [ ] Only prioritized items implemented; deferrals are one line each.
- [ ] Minimal `AGENTS.md` + `docs/` via `agent-rules-architect`, audit passing.
- [ ] Sensors with self-correction messages; gating only where justified.
- [ ] Stack presets present — skills + MCPs (via `stack-presets` if missing).
- [ ] Additional skills vetted and fill real gaps.
- [ ] Steering loop documented; inventory re-run confirms coverage.
- [ ] Honest limits stated.

## Anti-patterns

- Harness theater — noise nobody acts on.
- Running modules mechanically instead of letting assessment decide.
- Mute sensors — no self-correction message.
- Everything gates everything.
- Feedforward-only or feedback-only.
- Imagined failures.
