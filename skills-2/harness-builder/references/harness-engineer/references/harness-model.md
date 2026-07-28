# The Harness Model: the theory behind every decision

Read this early. It's the vocabulary and the reasoning the rest of the skill
assumes. The goal is to *internalize the model* so your judgment is good on cases
no checklist covers — not to memorize terms. It condenses Birgitta Böckeler's
"Harness engineering for coding agent users" (martinfowler.com) and its follow-up
"Maintainability sensors for coding agents."

## Contents

- What a harness is (and the bounded context we mean)
- The two goals of a good harness
- Feedforward and feedback (guides and sensors)
- Computational and inferential (the cost/trust axis)
- The control map (a 2×2 you'll reuse constantly)
- The steering loop
- Timing: keep quality left
- Regulation categories (maintainability / architecture / behaviour)
- What each control type can and can't catch
- Harnessability (why some codebases resist harnessing)
- Harness templates
- The role of the human
- Open questions to stay honest about

## What a harness is

"Harness" has become shorthand for *everything in an agent except the model* —
**Agent = Model + Harness**. That's broad, so narrow it to our bounded context:
using a coding agent. Part of the harness is **built in** (system prompt, code
retrieval, orchestration) — you don't control that. But coding agents also let
*you*, the user, build an **outer harness** for your specific system. That outer
harness is this skill's entire subject.

## The two goals of a good harness

A well-built outer harness does two things at once:

1. **Raises the probability the agent gets it right the first time** (fewer bad
   outputs to begin with).
2. **Provides a feedback loop that self-corrects** as many remaining issues as
   possible *before they reach human eyes*.

The payoff: less review toil, higher system quality, and fewer wasted tokens.
Keep both goals in view — a harness that only prevents *or* only catches is half
a harness.

## Feedforward and feedback (guides and sensors)

Two complementary ways to control the agent:

- **Guides — feedforward controls.** They anticipate the agent's behaviour and
  steer it *before* it acts, raising the odds of a good first attempt. Examples:
  `AGENTS.md`/rules, skills, bootstrap/scaffold scripts, codemods (e.g.
  OpenRewrite recipes), LSP/code-intelligence hints.
- **Sensors — feedback controls.** They observe *after* the agent acts and let it
  self-correct. Examples: linters, type checkers, tests, structural/architecture
  rules, AI code review. Sensors are *especially* powerful when their output is
  **optimized for LLM consumption** — e.g. a custom linter message that includes
  instructions for the fix. The article calls this "a positive kind of prompt
  injection."

**You need both.** Feedforward-only gives you an agent that keeps repeating the
same mistakes (it's never measured). Feedback-only gives you an agent that
re-derives the same rules every time (it was never told). Most real gaps are an
imbalance between these two.

## Computational and inferential (the cost/trust axis)

Orthogonal to direction is *how* a control executes:

- **Computational** — deterministic, fast, run by the CPU. Tests, linters, type
  checkers, structural analysis. Milliseconds to seconds; results are reliable.
  Cheap enough to run on *every* change.
- **Inferential** — semantic analysis, AI code review, "LLM as judge." Run by a
  GPU/NPU. Slower, costlier, non-deterministic. But they provide rich, contextual
  judgment computational tools can't — and with a strong, task-appropriate model
  they can genuinely increase trust *despite* the non-determinism.

Practical consequence: **push work down to computational controls whenever the
rule is objective.** "Once you have something that really is objective, converting
it to a formal, unambiguous, deterministic format gives you more assurance."
Reserve inferential controls for judgment that truly needs semantics — and accept
you'll run them less often.

## The control map

Every control lands somewhere on this 2×2. Keep it in your head; you'll use it to
spot gaps:

|                    | Computational                              | Inferential                                  |
| ------------------ | ------------------------------------------ | -------------------------------------------- |
| **Feedforward**    | Codemods, scaffolds, type stubs, LSP hints | Coding-convention skills, AGENTS.md, how-tos |
| **Feedback**       | Tests, linters, type/dep/arch checks       | AI code/modularity review, LLM-as-judge      |

From the article's examples: coding conventions = feedforward/inferential
(AGENTS.md, skills); bootstrap instructions = feedforward/both (a skill + a
bootstrap script); codemods = feedforward/computational; structural tests =
feedback/computational (a hook running ArchUnit against module-boundary
violations); review instructions = feedback/inferential (skills).

## The steering loop

The human's job is to **steer the agent by iterating on the harness.** Whenever an
issue happens more than once, improve the feedforward and feedback controls so
that issue becomes less probable — or impossible — next time.

Crucially, you can use AI *to build the harness itself*. Agents now make custom
controls cheap: they can write structural tests, draft rules from observed
patterns, scaffold custom linters, generate how-to guides from codebase
archaeology, and build small query tools for noisy reports. This collapses the
old cost barrier that kept static analysis underused.

## Timing: keep quality left

Teams that continuously integrate have always spread checks across the timeline
by **cost, speed, and criticality.** The earlier (further "left") you catch an
issue, the cheaper it is to fix. So distribute controls accordingly:

- **Before commit / in-session** — what's reasonably fast: linters, fast test
  suites, a basic review agent, secret scanning.
- **Post-integration / CI** — what's more expensive: mutation testing, a broad
  review that considers the bigger picture (plus a *repeat* of the fast controls
  on clean infra).
- **Continuous / scheduled (outside the change lifecycle)** — what drifts
  gradually: dead-code detection, test-quality and coverage analysis, dependency
  scanners, modularity reviews — "garbage collection" passes.
- **Runtime / production** — what only shows up live: agents watching degrading
  SLOs and suggesting fixes, LLM judges sampling response quality and flagging log
  anomalies.

See `timing-and-placement.md` for the decision framework and how to *encode* this.

## Regulation categories

The harness acts like a cybernetic governor regulating the codebase toward a
desired state. But "desired state" has dimensions, and harnessability differs
across them — so *name which you mean*:

### Maintainability harness
Regulates internal code quality / "internal quality": keeping the codebase easy
and low-risk to change over time. **The most tractable today** — we have decades
of tooling (linters, type checkers, structural analysis, tests, mutation testing)
to repurpose as sensors. First signs of erosion: a small change touches more and
more files, or changes start breaking things that used to work.

### Architecture fitness harness
Defines and checks the architecture characteristics of the app — essentially
**fitness functions.** Examples: a skill that feeds forward performance
requirements + performance tests that feed back whether the agent improved or
degraded them; conventions for observability (logging standards) + debugging
instructions that ask the agent to reflect on the quality of the logs it had.

### Behaviour harness
*Does the app functionally do what we need?* This is the elephant in the room.
Today most high-autonomy setups do: feed-forward a functional spec (a short prompt
to multi-file descriptions); feed-back a green AI-generated test suite + coverage
+ maybe mutation testing, then manual testing. That puts a lot of faith in
AI-generated tests — **not good enough yet.** The "approved scenarios/fixtures"
pattern helps in some areas but isn't a wholesale answer. *Be honest with the
user about this limit;* don't oversell a behaviour harness.

## What each control type can and can't catch

Mapping common agent failure modes against the maintainability harness (from the
article) — useful for setting expectations:

- **Computational sensors catch structural problems reliably:** duplicate code,
  cyclomatic complexity, missing coverage, architectural drift, style violations.
  Cheap, proven, deterministic.
- **Inferential controls *partially* catch semantic problems:** semantically
  duplicate code, redundant tests, brute-force fixes, over-engineered solutions —
  but expensively and probabilistically, so not on every commit.
- **Neither reliably catches the highest-impact problems:** misdiagnosis of
  issues, over-engineering / unnecessary features, misunderstood instructions.
  And **correctness is outside any sensor's remit if the human never specified
  what they wanted.** This is exactly where you direct human attention.

## Harnessability

Not every codebase is equally amenable to harnessing:

- A **strongly typed language** gives you a type checker as a sensor for free.
- **Clear module boundaries** afford architectural-constraint rules.
- **Frameworks** (e.g. Spring) abstract away details so the agent can't get them
  wrong — implicitly raising its success rate.

Without those properties, the corresponding controls simply *aren't available to
build*. This plays out differently across:

- **Greenfield** — you can bake harnessability in from day one; tech and
  architecture choices decide how governable the codebase will be. Teams may even
  start choosing stacks partly by what harnesses already exist for them.
- **Legacy** — the hard case: the harness is *most needed where it's hardest to
  build* (debt-laden code resists typing, clear boundaries, and tests).

Read harnessability early — it tells you which recommendations are even feasible,
and where to set expectations.

## Harness templates

Most orgs have a few service topologies covering ~80% of needs (data-via-API
business services, event processors, dashboards), often already codified as
service templates. These may evolve into **harness templates**: a bundle of guides
+ sensors that leash an agent to a topology's structure, conventions, and stack.
Same caveat as service templates, maybe worse: instantiated copies drift from
upstream, and non-deterministic guides/sensors are harder to test and version.
If a project already uses service templates, propose capturing its harness as a
reusable bundle.

## The role of the human

Human developers are an *implicit* harness: absorbed conventions, felt pain of
complexity, accountability ("my name is on the commit"), and organizational
alignment (what the team is trying to achieve, which debt is tolerated and why,
what "good" looks like *here*). An agent has none of this — no social
accountability, no aesthetic disgust at a 300-line function, no sense of "we don't
do it that way here," no memory of which convention is load-bearing vs. habit.

A harness tries to **externalize and make explicit** what human experience brings,
but it only goes so far. Building a coherent system of guides, sensors, and
self-correction loops is expensive — so **prioritize with a clear goal: a good
harness shouldn't try to eliminate human input, but to direct it where it matters
most.** Use this to resist over-building.

## Open questions to stay honest about

These have no settled answers — flag them rather than pretend otherwise:

- **Coherence at scale** — how do you keep guides and sensors in sync and
  non-contradictory as the harness grows?
- **Conflicting signals** — how far can you trust an agent to make sensible
  trade-offs when a guide and a sensor point in different directions?
- **Silent sensors** — if a sensor never fires, is that high quality or inadequate
  detection? We lack a "harness coverage" metric akin to code coverage / mutation
  testing.
- **Guide vs. sensor balance** — once you trust a set of sensors, which guides can
  you delete? Do good sensors make weaker (cheaper) models viable?

Building this outer harness is an *ongoing engineering practice*, not a one-time
configuration. Treat the assessment you produce as a snapshot that the steering
loop will keep revising.
