# Principles & Evidence: why minimalism wins

Read this when you're deciding whether a piece of context earns its place, or
when a user pushes for a big "comprehensive" file and you need to explain why
that backfires. The goal is to *internalize the reasoning* so your judgment is
good on cases this doc doesn't cover — not to memorize rules.

## The core finding

Two strands of evidence point the same way:

1. **ETH Zurich, "Evaluating AGENTS.md" (Gloaguen, Mündler, Müller, Raychev,
   Vechev; ICLR 2026 Workshop on Memory for LLM-Based Agentic Systems).** The
   first rigorous study of whether repo-level context files actually help. They
   built AGENTbench (138 real issues from 12 repos with developer-written
   context files) and also tested SWE-bench Lite with LLM-generated files,
   across multiple agents and models (Sonnet 4.5, GPT-5.x, Qwen3).

   - **LLM-generated** context files: **~3% *lower*** task success on average
     (performance dropped in 5 of 8 settings).
   - **Developer-written** context files: **~4% higher** on average — a marginal
     gain, and only when minimal.
   - **Both** increased steps and inference **cost by 20%+** (20% on SWE-bench
     Lite, 23% on AGENTbench).
   - Agents **do** follow the instructions (e.g. they use `uv` when told). The
     problem is that honoring unnecessary instructions causes more exploration,
     more testing, and more reasoning tokens (+14–22%) — work that often doesn't
     change the outcome except to cost more.

   Their recommendation, verbatim in spirit: *omit LLM-generated context files
   for now, and include only minimal requirements (e.g. specific tooling to use
   with the repo).*

2. **GitHub's analysis of 2,500+ real `AGENTS.md` files**, plus follow-up work.
   The best-performing files are *boring, specific, and short*. The strongest
   single signal: a file longer than the README is almost always too long. The
   follow-up confirmed that **auto-generated files which duplicated README
   content actively reduced success** — redundancy is the enemy.

## Why redundancy is the specific villain

There's an important nuance that tells you *where* context files help. When
researchers stripped a repo of all other documentation and left only the context
file, even LLM-generated files started to help (~+2.7%). The interpretation:

> Context files are valuable in proportion to the **non-obvious, non-duplicated**
> information they carry. In a well-documented repo, a generated file is mostly
> restating what's already discoverable — so it's pure overhead. In a bare repo,
> the same file is the only signal there is.

This is the key to good judgment: **value = (information the agent can't easily
get elsewhere) − (tokens spent on everything else).** Maximize the numerator,
slash the denominator.

## How this justifies the two-layer architecture

The evidence indicts *always-loaded* bloat, not the *existence* of detailed
knowledge. The cost is paid because the file is in context on **every** task,
relevant or not. So the fix isn't "write less knowledge" — it's "stop paying for
knowledge you don't currently need":

- **`AGENTS.md` (always loaded)** must stay near the floor the evidence rewards:
  minimal, non-obvious, broadly-applicable. This is the layer that gets taxed on
  every task, so it's where minimalism matters most.
- **`docs/` (loaded on demand)** can hold the richer, specialized material. It
  costs nothing until a task pulls it in. This is how you satisfy a user who
  wants depth *without* re-creating the bloat problem.

Progressive disclosure isn't a nicety here — it's the mechanism that
reconciles "the user wants thorough rules" with "thorough always-on rules
measurably hurt."

## The inference test (your sharpest tool)

Before any line goes into a rule file, ask:

> **Can the agent figure this out by reading the code, the package manifests, or
> the existing docs?**

If yes, cut it. The agent reads code faster and more reliably than it reads your
paraphrase of the code. Examples of things that *fail* the test (cut them):

- "This is a React project." (It's in `package.json`.)
- "Run `npm install` to install dependencies." (Universally known.)
- "We use Prettier for formatting." (Visible in config; the formatter enforces it.)
- "The `src/` folder contains the source code." (Self-evident.)

Things that *pass* the test (keep them) are non-obvious and prevent real errors:

- "Tests need the local Postgres from `docker compose up db` first — they fail
  cryptically without it."
- "`src/legacy/` is sync-only; do not convert it to async."
- "Use `pnpm`, never `npm` — `npm install` corrupts the lockfile here."
- "Run a single test with `pytest path::test_name`; the suite takes 12 min."

## The specificity rule

Vague guidance is worse than none — it adds tokens and triggers reasoning while
giving nothing executable to act on. Always convert intent into something
concrete:

- Bad: "Format your code properly." → Good: "Run `ruff format .` before
  committing."
- Bad: "Write good tests." → Good: "Every endpoint needs an integration test in
  `tests/api/`; mock external HTTP with `responses`, never the database."
- Bad: "Follow our conventions." → Good: a 5-line code snippet showing the
  convention.

A real code snippet (3–10 lines) almost always beats a paragraph describing the
same thing.

## Boundaries: the highest-leverage content

Across the 2,500-repo analysis, the single most consistently *helpful* content
was explicit boundaries — what the agent must never do. "Never commit secrets"
was the most common useful constraint. Boundaries are high-leverage because they
prevent expensive, hard-to-undo mistakes, and they're genuinely non-obvious. A
three-tier framing works well: **Always do / Ask first / Never do.** Keep it
short and concrete (name the directories, the files, the commands).

## Iterate from real failures, not imagination

The best rule files *grow through use*, not upfront planning. The disciplined
loop: start minimal → watch where the agent actually makes mistakes → add a
targeted rule for that specific failure → stop. Do **not** brainstorm every
possible rule a project "should" have; that's how files bloat into net-negative
territory. When improving an existing file, the same logic runs in reverse:
aggressively remove rules that aren't tied to a real, observed failure.

## Keep rules alive

Stale instructions are *worse than none* — they actively mislead. Whatever you
write should be cheap to keep true: prefer referencing files that change with
the code (so they can't drift) over restating their contents, and treat the rule
files as living documentation updated in the same change that alters a command
or convention.

## A one-paragraph summary to carry into every decision

Treat the always-loaded layer like a strict token budget you're reluctant to
spend. Spend it only on non-obvious, broadly-relevant, mistake-preventing
signals stated as concretely as possible. Push everything specialized into
on-demand `docs/`. Never duplicate what the code or existing docs already say.
Smaller, sharper, and accurate beats comprehensive every single time.
