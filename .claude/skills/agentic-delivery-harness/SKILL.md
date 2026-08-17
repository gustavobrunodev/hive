---
name: agentic-delivery-harness
description: Design the machinery around agentic implementation runs — both the delivery pipeline (research → technical design doc → tracker tasks → spec-driven execution via tlc-spec-driven → independent verification) and the deterministic measurement harness that proves the run worked (frozen baselines of binary checks, evidence-or-zero judging, judge ≠ author, script-computed scores, repeated runs with variance). Use whenever the user wants to set up, fix, or reason about how agents deliver work on a project — multi-agent orchestration, sub-agent roles with pinned models, implementation loops, clean-session protocols, deciding what belongs in a spec vs a tracker task vs a design doc, sizing a feature into runs, benchmarking spec-driven frameworks or models, or building an LLM-as-judge whose score they can actually trust. Reach for it even when the phrasing is casual — "set up a workflow for the agent", "make the agent's output reliable", "the score changes every time I run it", "how do I run this project end to end", "how do I score what the agent built", "should this be a skill or a subagent" are all this skill. NOT for the static repo harness of rules, linters and sensors (that is harness-builder) and NOT for executing one already-planned feature (that is tlc-spec-driven).
license: CC-BY-4.0
metadata:
  version: 1.0.0
---

# Agentic Delivery Harness

Everything around the model call, engineered so the run is reproducible, auditable, and honest.

## The one idea

**The model is the only part of a run you cannot make deterministic. So make everything else deterministic.**

Agents feel unreliable because people leave every variable open at once and then blame the model. In practice a run has a fixed set of degrees of freedom, and each one you close buys back a slice of reproducibility at a known cost:

| Degree of freedom | Left open, you get                        | Closed by                                                     |
| ----------------- | ----------------------------------------- | ------------------------------------------------------------- |
| **Input**         | different work each run                   | a frozen artifact under version control, not a chat message   |
| **State**         | the agent reads last run's build output   | clean-session protocol before the first token                 |
| **Model**         | a run you cannot reproduce or audit later | model pinned in a **committed** sub-agent file                |
| **Context**       | roles bleeding into each other            | one sub-agent per role, fresh context each                    |
| **Question**      | invented scores ("I'd give it a 4/5")     | binary checks — found / not found, nothing in between         |
| **Claim**         | confident hallucination                   | evidence-or-zero: `file:line` or the check scores 0           |
| **Arithmetic**    | plausible-looking wrong totals            | a script does the sums, never the model                       |
| **Sample**        | one lucky run                             | N runs, report mean and spread                                |
| **Grader**        | self-serving assessment                   | judge ≠ author, always a fresh agent                          |

Nearly every "the agent is flaky" complaint is one of these nine left open. That makes diagnosis tractable — you are not debugging a mind, you are finding the leak.

**The cost side is real.** Each closure buys determinism and spends flexibility, tokens, or wall-clock. Closing all nine is right for a benchmark whose number you will publish; it is overkill for a two-file bug fix. Match the closures to what the run has to withstand: *reproduce it tomorrow*, *defend the number to someone else*, *hand it to a teammate* — or none of those, in which case leave them open and move on.

## Diagnose first

When the user arrives with a symptom rather than a request, name the leak before proposing machinery:

| Symptom                                                | Leaked degree of freedom | Fix                                                                      |
| ------------------------------------------------------ | ------------------------ | ------------------------------------------------------------------------ |
| "It scored 0.9 yesterday and 0.6 today, same code"     | Sample, or Input         | N runs + spread; verify the input artifact actually froze                 |
| "The agent said the tests pass but they don't exist"   | Claim, Grader            | evidence-or-zero enforced by the scorer; separate judge from author       |
| "It rebuilt something that was already there"          | State                    | clean-session: wipe build output, caches, deps, DB before the run         |
| "I can't tell which model produced this result"        | Model                    | pinned model in a committed `.claude/agents/*.md`, not a chat instruction |
| "Every run interprets the requirement differently"     | Input                    | grind ambiguity out of the frozen artifact until reruns converge          |
| "The totals in the report don't add up"                | Arithmetic               | `scripts/score.py` — the model never sums                                 |
| "The reviewer agent approves everything"               | Grader, Question         | judge ≠ author; decompose into binary checks it cannot soften             |
| "Late tasks come out sloppier than early ones"         | Context                  | batch tasks into sub-agents (~7 tasks each); fresh context per batch      |
| "It follows the plan but ignores our conventions"      | *not this skill*         | a missing guide — route to **harness-builder** (AGENTS.md / sensors)      |

## Pick the mode

| Mode            | The user wants                                                                                                                   | Read                                                   |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| **Pipeline**    | To set up or fix how work flows from idea to merged code — research, design doc, tracker tasks, specs, execution, verification    | [references/pipeline.md](references/pipeline.md)       |
| **Measurement** | To prove something worked, or compare frameworks/models/prompts with a number they can defend                                    | [references/measurement.md](references/measurement.md) |
| **Placement**   | To decide where a piece of behaviour lives — skill vs sub-agent vs inline, which model, how to loop it                           | [references/roles.md](references/roles.md)             |

Load **one**. Pipeline work usually pulls in Placement when it reaches the role layout; Measurement pulls in Placement for the judge. Open the second only when you get there.

If the request spans modes ("build the flow, then benchmark it"), run them sequentially — finish one before opening the next.

## The artifact map — the thing people get wrong

Four documents get confused constantly because they all describe "what we're building". They have different readers, and the reader decides everything about them:

| Artifact                            | Written for        | Survives                    | Code references             |
| ----------------------------------- | ------------------ | --------------------------- | --------------------------- |
| **Research notes**                  | you, and next you  | forever — it's raw material | no                          |
| **Technical design doc (TDD)**      | humans on the team | months                      | no — names and shapes only  |
| **Tracker task** (Linear/Jira/…)    | humans tracking    | until it ships              | **never** — see below       |
| **spec.md / tasks.md**              | the agent          | one feature                 | yes, that's the whole point |

**Tracker tasks must not carry file paths, code snippets, or symbol names.** A task planned today may be executed a month from now against a codebase that moved. The path you wrote is by then a lie the agent will follow confidently. A task carries the outcome, the acceptance criteria, and a link to the TDD; the agent re-derives paths at execution time, when they are true.

The inverse holds too: a spec is written *for the agent* and is disposable. Don't put it on a board and don't ask a stakeholder to sign off on it. Human sign-off is what the TDD is for.

## Where this sits

This skill designs the **run**. Two neighbours own the other layers — call them, don't reimplement them:

- **`harness-builder`** owns the *static* harness: AGENTS.md rules, linters, sensors, gates, the living `HARNESS.md`. Anything the agent should know, or be measured on, *regardless of which run it's in* belongs there. When a run surfaces a repeated failure, route it there — that's the steering loop closing.
- **`tlc-spec-driven`** owns *one feature's* execution: Specify → Design → Tasks → Execute, with per-task gates, atomic commits, and its own always-on Verifier. Don't rebuild spec/tasks/verification here. This skill decides *what gets handed to it, in what size, by whom, and how the result is judged*.

## Bundled

- `scripts/score.py` — the scorer. Reads a frozen baseline plus one or more judge result files, enforces evidence-or-zero and full coverage mechanically, and computes weighted scores with mean/spread across runs. Stdlib only; `python3 scripts/score.py --help`. **Use it instead of writing a new one** — the arithmetic rule exists precisely because ad-hoc summing is where scores quietly go wrong.
- `assets/technical-design-doc.template.md` — TDD skeleton with the sections that actually get read.
- `assets/baseline.example.json` + `assets/results.example.json` — a filled baseline showing the check decomposition, and the judge output that scores against it.
- `assets/agents/` — four pinned-model sub-agent definitions (freezer, planner, implementer, judge) to copy into `.claude/agents/` and adapt.

## Working rules

**Propose the smallest harness that survives the pressure the user named.** A published benchmark needs all nine closures. A weekly feature needs a frozen spec, a passing gate, and a judge that isn't the author. Adding ceremony nobody asked for is how this material gets misapplied — it produces impressive scaffolding the team abandons in two weeks.

**Build incrementally and prove each piece.** Freeze the input, run it twice, show the user the runs converged — then add the judge. A harness assembled all at once can't tell you which part is carrying the weight.

**Never claim a run is reproducible without having reproduced it.** The entire subject is honesty about non-determinism; asserting unverified results here defeats the skill. If you haven't run it twice, say so.
