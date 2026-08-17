# Placement — where behaviour lives, which model runs it, how it repeats

Three mechanics that decide whether a run is reproducible: **where you put a piece of behaviour**, **how the model gets chosen**, and **what state it starts from**.

---

## Inline vs skill vs sub-agent

| Placement      | You get                                                                                   | You give up                                                         |
| -------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| **Inline**     | Zero indirection, full shared context, immediate                                           | No reuse, no isolation, no pinning                                   |
| **Skill**      | Composability — invocable by name, from anywhere, by any agent; versioned; cheap to change | The model is whatever the caller happens to be; no context isolation |
| **Sub-agent**  | Pinned model, isolated context, role separation you can audit from git                     | Not composable — it must be spawned; it can't be dropped into a prompt |

**Default to a skill.** Skills compose, and composability is what makes a workflow survive contact with reality — you can call it directly, from another skill, or from inside a sub-agent. A sub-agent can only be spawned. That inflexibility is the reason sub-agents are the narrower tool, and reaching for one first is the most common over-engineering in this space.

**Reach for a sub-agent when you need one of exactly three things**, none of which a skill provides:

1. **A guaranteed model.** Not "please use X" in a prompt — enforced by the harness.
2. **A clean context.** The role must not inherit the caller's reasoning, especially when the whole point is independent judgement.
3. **An auditable role boundary.** The separation is recorded in a committed file rather than in a conversation.

If none of those apply, a skill is better and cheaper.

### A role, or just a phase?

Not every step deserves its own agent. A step becomes a **role** — and earns a sub-agent — when it needs a *different model*, a *different incentive*, or a *clean context*. Otherwise it is a **phase**, and phases belong inside one agent's flow where they can share context for free.

The classic case for separation is the judge: it needs a different incentive (it must not be defending its own work) and a clean context (it must re-derive coverage rather than inherit the author's belief about what was covered). The classic case against is "specify" and "design" — same model, same incentive, and the second is far better for having the first in context. Splitting those buys nothing and pays a handoff.

### The hybrid: a thin sub-agent that calls a skill

```markdown
---
name: run-planner
description: Produces the plan for one benchmark run.
model: claude-opus-5
---
Use the `tlc-spec-driven` skill. Produce the spec and task breakdown for the
feature described in the frozen input. Do not implement anything.
```

This gets you the pinned model *and* keeps the actual behaviour in a skill that anyone can invoke directly. **It is the right default for delivery work** — you keep the flexibility to run the same planning step by hand tomorrow.

The cost is one more indirection: orchestrator → sub-agent → skill, and each hop is a place a handoff can go wrong. **When you are measuring rather than delivering, prefer the behaviour written directly in the sub-agent.** In a benchmark you are spending flexibility to buy determinism, and that is the whole trade — one fewer moving part is worth more than the ability to invoke the step by hand.

---

## Pinning the model

A sub-agent definition lives in `.claude/agents/<name>.md`:

```markdown
---
name: run-judge
description: Independently judges an implementation against a frozen baseline.
tools: Read, Grep, Glob, Bash
model: claude-sonnet-5
---

You judge implementations against a frozen baseline. You never write or modify code.
...
```

**Prefer the most specific model identifier available.** Aliases (`sonnet`, `opus`) are convenient and they *move* — the same file will silently mean a different model after a vendor rolls the alias, and every score you recorded before that point becomes incomparable to every score after it, with nothing in the repo marking the discontinuity.

**The point is auditability, not preference.** A model named in a chat instruction is gone at the next compaction. A model named in a committed file is still there in six months when you check out the branch and ask "what actually produced this result?" — and you get an answer you can rely on rather than a recollection.

There is also a failure this rules out entirely: an orchestrator can *report* that it dispatched a step with model X while a bug or a misread instruction actually ran it with Y. Nothing in the transcript reveals the difference. Frontmatter removes the possibility rather than requiring you to detect it.

**Give each role only the tools it needs.** A judge with write access can fix what it was supposed to report. Restricting `tools:` makes the role boundary structural instead of aspirational.

---

## Restrict the context, deliberately

An isolated context is the second thing a sub-agent buys, and it is worth spending on purpose rather than accepting as a side effect.

**Pass a role the minimum that lets it do its job.** A judge that receives the implementer's reasoning will grade against that reasoning instead of against the baseline — it inherits the frame it was supposed to challenge. An implementer that receives the entire project's specs spends context on features it isn't building and loses the thread on the one it is.

**Keep the return trip narrow too.** A worker that reports full logs pollutes the orchestrator's context with material it will never act on, and the orchestrator's remaining budget is what has to carry the rest of the run. Compact structured summaries — what was done, commit hashes, counts, deviations — keep the main window usable through a long run.

`tlc-spec-driven` already implements this for feature execution (batching ~7 tasks per worker, compact summaries back). Reuse it rather than rebuilding it.

---

## The clean-session protocol

Run this before any run whose result you intend to trust or compare.

The failure it prevents is specific and quiet: an agent finds artifacts from a previous attempt — a built `dist/`, a migrated database, a generated client — concludes the work is already done, and reports success having built nothing. Every downstream signal agrees with it. The tests pass, because they were passing before. There is no way to tell this apart from real success after the fact, which is why it has to be prevented rather than detected.

Wipe, in this order:

1. **Build output** — `dist/`, `build/`, `out/`, `target/`, `.next/`, compiled assets
2. **Caches** — package manager, framework, test runner, type checker incremental state
3. **Dependencies** — remove and reinstall **from the lockfile**, so the dependency tree is part of what's frozen
4. **Data** — databases, seeds, fixtures, uploaded files, local storage
5. **Generated code** — clients, migrations, schemas produced by a previous run
6. **Version control state** — start from a known branch point, not from wherever the last run left the tree

**Write it as a committed script**, not a remembered sequence — `scripts/clean-session.sh` in the project. A cleanup performed from memory is itself a source of variance: the run where someone forgot step 3 is the run that produces the anomalous number, and you will spend a day looking for the cause somewhere else. The script is stack-specific; generate it from the project's actual build tooling and commit it alongside the baseline.

Verify it once, honestly: run it, then confirm the artifacts are actually gone. A cleanup script that silently fails on a path that moved is worse than none, because it buys unearned confidence.

---

## Loops

A loop replaces "keep prompting until it's done" with a bounded, self-terminating run. It fits when three things hold:

- the unit of work is **well defined and repeatable** — same shape each iteration
- there is a **verifiable termination condition** — a gate, a checklist, a score threshold
- each iteration's output is **inspectable afterwards** — commits, reports, logs

If any is missing, a loop converts a small problem into a large one at machine speed, and you find out at the end.

**Always bound the iteration count.** A fix→re-verify cycle that runs three times and then escalates is a working loop; one that runs until it succeeds is a way to spend a budget on an unsolvable task. `tlc-spec-driven` bounds its Verifier loop at 3 for this reason — mirror that discipline anywhere you build one.

**Match the loop to the failure you expect.** A loop over *independent* units (score each of 12 runs) is safe to let run — one bad iteration doesn't corrupt the others. A loop over *accumulated* state (keep fixing until the gate passes) needs a tighter bound and a checkpoint per iteration, because iteration 4 inherits everything iteration 3 got wrong.

The `/loop` skill handles the mechanics of scheduling and self-pacing when the user wants a recurring or self-terminating run.
