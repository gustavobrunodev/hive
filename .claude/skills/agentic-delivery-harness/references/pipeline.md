# Pipeline — from an idea to merged code

The delivery run. Six phases, each producing an artifact the next one consumes. The value is not the phase list — it is that **every phase ends in a durable artifact**, so nothing important lives only in a chat window that will be compacted away.

```
Research  →  Design doc  →  Sizing  →  Tracker tasks  →  Spec-driven run  →  Close the loop
  raw         for humans     how many     for humans        for the agent       into the harness
  material                   runs?
```

Not every feature needs all six. The sizing gate below tells you which to skip, and the rule of thumb is: **skip the human-facing artifacts when no human other than you needs to weigh in.** A one-day change goes straight to `tlc-spec-driven`. Producing a design doc nobody asked to read is pure ceremony.

---

## Phase 0 — Research

**Goal:** turn scattered raw material into a grounded understanding of what is actually being asked.

**Feed it raw material, not summaries.** Call transcripts, the actual spreadsheet, screenshots of the current manual process, the support tickets, the analytics query. Every layer of pre-digestion you apply is a layer of your own assumptions baked in before the model can question them. If the stakeholder conversation happened on a call, dump the transcript in — a transcript with hesitations and half-formed ideas contains signal a tidy summary destroys.

**Spend the strong model here.** This is the phase with the widest search space and the highest leverage: a misread requirement propagates through design, tasks, and implementation before anything catches it. The general rule across the pipeline:

> Spend reasoning where the search space is wide. Spend throughput where the spec already narrowed it.

Research and design are wide. Implementation against a good spec with a passing gate is narrow — a fast model is usually the right call there, and often the better one, because it does more iterations per unit of patience.

**End with an artifact, always.** Research that ends in chat is research you will redo. Where it goes depends on what comes next — a design doc if humans need to weigh in, `.specs/` notes if not, `STATE.md` if it is a decision that outlives the feature.

---

## Phase 1 — Technical design doc

**Skip this when no one outside the run needs to weigh in.** That is the whole test. Not project size, not complexity — *audience*. You write a TDD when:

- someone has to approve an approach before you build it,
- another engineer owns a system you are integrating with,
- the reasoning will be re-litigated in three months by someone who wasn't there,
- or a non-technical stakeholder needs to see what they are getting.

A spec cannot serve any of those. Specs are written for the agent: dense, code-adjacent, and stale the moment the feature ships. A TDD is written for people and holds its value for months.

Use `assets/technical-design-doc.template.md`. The sections that earn their place:

| Section                | Why it's there                                                                          |
| ---------------------- | --------------------------------------------------------------------------------------- |
| Context & problem      | Why now. The part stakeholders actually read.                                            |
| In scope / out of scope | The out-of-scope list prevents more rework than the in-scope list creates.               |
| Architecture           | The shape, named components, the integration points. No file paths.                     |
| Domain rules           | The non-obvious business logic. This is what the spec will later expand into criteria.   |
| Interfaces             | Endpoint/function names and payload shapes. Names, not signatures — signatures drift.    |
| Risks                  | What could make this fail or take twice as long.                                        |
| Open questions         | See below — the highest-value section.                                                  |
| Implementation plan    | High-level phases with **human-day estimates**. Feeds the sizing gate.                  |

**Open questions are the mechanism, not a formality.** When drafting, resolve what is genuinely obvious from context and *ask about what is not*. An agent that fabricates an answer to an open question produces a design that looks complete and is wrong. Ask, get the answer, write it into the doc as resolved — the resolution is now a requirement, and downstream the spec must implement it.

The habit worth teaching the user: answer open questions **in the document**, inline, rather than in chat. A question answered in chat is lost at the next compaction; a question answered in the doc becomes part of the frozen input.

**Watch what the draft reveals about your harness.** When the model proposes something your team would never accept — the wrong language for domain terms, a pattern you abandoned two years ago — that is not a model failure. It is a missing guide, and it belongs in `AGENTS.md`. Note it and route it in Phase 5.

---

## Phase 2 — Sizing

The implementation plan gave you an estimate in human-days. Use it to decide **how many spec-driven runs this becomes**, before any spec exists.

| Estimate    | Shape                                                                    |
| ----------- | ------------------------------------------------------------------------ |
| ≤ 1 day     | No TDD, no tracker task. Straight to `tlc-spec-driven`, small scope.     |
| 2–10 days   | One run. One task, one spec, one branch, one PR.                        |
| 10–25 days  | Split at a phase boundary into 2 runs. Each ships independently.        |
| > 25 days   | Split into phases first, then size each phase. Something is under-scoped. |

**The binding constraint is review, not agent capacity.** An agent will happily produce a 60-file change; a human will not review one honestly. They will skim it, approve it, and the defects ship. Size runs so the resulting diff is one a reviewer can actually hold in their head.

That threshold is a property of the *team*, not the work. A repo with strong sensors, high coverage, and a well-tuned review setup absorbs a bigger change safely than one without. Ask what the team's real ceiling is instead of asserting a number — and if the honest answer is "we don't review well yet", that is a harness gap to route to `harness-builder`, not a reason to make runs smaller forever.

**Split at dependency boundaries, never by line count.** "Phases 0–3" and "phases 4–6" is a split. "The first half of the files" is not — it produces two runs that can't be verified independently, which defeats the point.

---

## Phase 3 — Tracker tasks

One task per run, in whatever the team uses. The project/epic carries the TDD link and the whole-picture context; each task carries one run's worth.

**These are for humans.** They exist so a team can see what is in flight and what shipped. They are not agent input, and writing them as if they were is the most common failure here.

A task contains:
- the outcome, at the level a teammate can understand without the TDD open
- acceptance criteria — observable, not implementation-shaped
- a link to the TDD for the reasoning
- dependencies on other tasks

A task does **not** contain: file paths, code snippets, function or symbol names, directory layouts. Code ages between planning and execution. A path written in a task is a claim about the codebase's future, and the agent has no way to know it went stale — it will follow it confidently into the wrong place. The agent re-derives structure at execution time, from the codebase as it actually is.

If the team creates these often, this is worth a small skill of its own so every project and task comes out in the same shape. Consistent structure is what lets the next phase consume them without an interpretation step.

---

## Phase 4 — The spec-driven run

Now hand off to **`tlc-spec-driven`**. This skill does not reimplement spec/design/task authoring — that skill owns it, including auto-sizing, per-task gates, atomic commits, sub-agent batching, and the always-on Verifier.

**What to pass it:**

| Give it                            | Because                                                                     |
| ---------------------------------- | --------------------------------------------------------------------------- |
| The tracker task                   | The scope boundary and acceptance criteria for *this* run                    |
| The TDD                            | The reasoning, constraints, and rejected alternatives behind the task        |
| Whatever grounds the domain        | Live schema, analytics, API docs, an MCP into the real system                |

The task alone is too thin — it deliberately omits the reasoning. The TDD alone is too broad — it covers runs this one isn't doing. Together they bound the scope and explain it, which is exactly what the Specify phase needs.

**Start clean.** Fresh branch, and if the run has to be repeatable, the clean-session protocol in [roles.md](roles.md). Otherwise the agent may read artifacts from a previous attempt and mistake them for work already done.

**Let it size itself.** `tlc-spec-driven` decides Specify/Design/Tasks/Execute depth from complexity, and offers sub-agent batching above ~8 tasks. Don't pre-empt those decisions; you already made the sizing call that matters in Phase 2.

---

## Phase 5 — Close the loop

The run finished and the Verifier reported. Now the part almost everyone skips: **every surprise in a run is a defect in the harness, not just in the code.** Route each one to the layer that prevents its recurrence.

| What surprised you                                       | Where it belongs                        | Layer                            |
| -------------------------------------------------------- | --------------------------------------- | -------------------------------- |
| Agent didn't know a project convention                    | `AGENTS.md` rule                        | guide → `harness-builder`         |
| Agent knew the rule and broke it anyway                   | A test or lint rule that fails on it    | sensor → `harness-builder`        |
| Agent misread what was being asked                        | Sharper acceptance criteria in the spec | frozen input → this pipeline      |
| Agent claimed something it hadn't done                    | Evidence requirement in the judge       | measurement → `measurement.md`    |
| Verifier found a real gap the gate missed                 | `LESSONS.md` via `tlc-spec-driven`      | lesson → self-improving layer     |
| The same class of failure, **twice**                      | Promote it to a computational control   | `harness-builder`                 |

That last row is the one that compounds. A lesson written in prose is a guide — it raises the odds. A test that fails on the same mistake is a sensor — it makes recurrence impossible. The second occurrence is the signal to pay the cost of converting one into the other.

**A run that taught you nothing about your harness is worth being suspicious of.** Either the harness is genuinely mature, or nobody looked.
