# Sensors Catalog: concrete feedback controls that work

A working reference for *which* sensors to recommend, what each catches, its
execution type and cost, when to run it, and — most importantly — how to make its
output drive agent self-correction. Don't propose sensors generically; match them
to observed failure modes and the project's stack/harnessability.

Grounded in "Maintainability sensors for coding agents" (the follow-up to the
harness-engineering article), extended across ecosystems.

## Contents

1. The one idea that multiplies every sensor: self-correction messages
2. Managing warnings without drowning in them
3. Sensors by concern
   - A. File & function static analysis (linters)
   - B. Type checking
   - C. Module / architecture / dependency rules
   - D. Coupling analysis
   - E. AI modularity & design review
   - F. The test suite as a regression sensor (coverage, mutation, property, fuzz)
   - G. Security: SAST, secret scanning, dependency scanning
   - H. Dependency-freshness report
   - I. Code-review agents
   - J. Architecture fitness functions
   - K. Behaviour sensors
4. Ecosystem cheat-sheet (tool names per concern)
5. How to recommend a sensor (the checklist)

---

## 1. The one idea that multiplies every sensor: self-correction messages

A sensor exists to give the agent feedback it can act on. The single
highest-leverage, most-overlooked move is to **rewrite a sensor's output into
guidance optimized for the agent** — "a good kind of prompt injection." A raw
`error: no-explicit-any` is a *mute* sensor. The same rule with a message that
explains the intent and the escape hatch is a *teaching* sensor.

Example (a custom ESLint message for `no-explicit-any`):

```
We want things typed to avoid errors, especially for key concepts. But we also
don't want to clutter the codebase with unnecessary types — make a judgment call.
If you choose not to introduce a type, suppress it with:
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- (give reason why)
```

Example (a dependency-rule violation message that re-teaches the architecture):

```
ERROR clients-no-services
  API clients must not depend on the orchestration layer above them.
  [Layers: routes -> services -> clients + domain. Services orchestrate: fetch
   via clients, compute via domain — no I/O, no SDKs, no knowledge of fetching.]
```

Principles for these messages:
- **State the *why*, not just the *what*.** The agent reasons better with intent.
- **Offer the escape hatch explicitly** (how to suppress, with a required reason),
  so the agent doesn't either blindly comply or silently disable the whole rule.
- **Recap the relevant concept** (the layering, the convention) right in the
  message — the agent may not have it in context.
- Most tools support custom messages or a **custom formatter**; build one (with
  AI) for your noisiest, highest-value rules first.

When a sensor can't carry a message (e.g. a bare exit code), pair it with a guide:
an `AGENTS.md`/docs line that says what to do when it fails.

## 2. Managing warnings without drowning in them

Static analysis was historically underused because keeping a "clean house" is
toil — and noisy metrics become wallpaper. Agents change the economics, *if* you
manage warnings deliberately:

- **Suppress-with-reason.** Let the agent suppress a warning inline *with a stated
  reason* (as above). This keeps suppressions visible, reviewable, and a great
  starting point for human review ("show me what the agent chose to suppress").
- **Threshold bumps as the rare exception.** For numeric limits (max lines,
  cyclomatic complexity), allow the agent to *slightly raise the threshold* when a
  refactor is genuinely unwarranted — but say in the message that this should be
  the absolute exception. A bump (vs. a blanket disable) keeps the rule armed: it
  fires again if things get worse. *Watch for the agent over-using bumps* — that's
  a sign the self-correction message is missing or too soft.
- **Per-area rules.** The same rule often wants different behaviour in different
  places (`no-console`: forbid in backend → use the logger; restrict differently
  in frontend). Scope rules by path; explain the per-area intent in the message.
- **Expect a noisy first activation.** Turning on a new rule set surfaces "a mix
  of irrelevant things and things that matter." Triage before you let the agent
  loose, or you'll trigger over-engineering spirals.

## 3. Sensors by concern

For each: what it catches · execution type · cost · when to run · notes.

### A. File & function static analysis (linters)

The lowest-hanging fruit for AI failure modes — but the AI-relevant rules usually
aren't in default presets, so you must configure them:

- **max function arguments**, **file length**, **function length**, **cyclomatic
  complexity** — the four that most reliably catch AI sprawl. Set explicit maxima.
- **`no-explicit-any` / loose typing**, **require test file**, **structured
  logging / no raw `console`** — common AI shortcuts. Community presets targeting
  agent failure modes are emerging (e.g. Factory's ESLint plugin).

Execution: computational · Cost: ¢ (ms) · When: **in-session + pre-commit + CI.**
Notes: this is where custom self-correction messages pay off most. Trade-offs
lurk (max-lines vs. max-lines-per-function can push complexity into prop chains) —
watch for them.

### B. Type checking

A type checker is a *free sensor* in a typed language — one of the strongest
harnessability multipliers. Enforce a real strictness level (`strict` in TS,
`mypy --strict`-ish, etc.); ratchet it up over time rather than all at once.

Execution: computational · Cost: ¢–$ · When: **in-session + pre-commit + CI.**
Notes: prefer typing over prose rules — the type *is* the guide and the sensor.

### C. Module / architecture / dependency rules

Enforces boundaries that linters (file-local) can't see: layer direction, "module
X may not import Y," "every new file must live in the defined folder structure."
This is **structural testing** — the article's canonical feedback/computational
example (e.g. ArchUnit in a hook).

- Work *with* the agent to define the layers, then have it write the rules — the
  config syntax has a steep entry cost that AI absorbs almost entirely.
- Agents *will* violate new rules a few times, then self-correct from the feedback
  — so these rules actively clean up haphazard structure and hold it going forward.
- Add a catch-all rule requiring every new file to sit somewhere in the defined
  structure, or the agent invents folders outside it.

Execution: computational · Cost: ¢–$ · When: **in-session + pre-commit + CI.**
Limit: only expresses what's visible via imports, file names, and folders.

### D. Coupling analysis

Extracts coupling metrics (fan-in/fan-out, import/call counts, cycles, DSM).
**Caveat from the experiments:** raw coupling data is *noisy and not very useful
to the agent on its own* — "good vs. bad" coupling is contextual (a deliberate DI
factory or a shared frontend/backend schema looks like a "god module" but isn't).

Best uses:
- **Risk triage for review** — knowing a changed file has 10+ callers tells a
  human (or a review agent) where to spend attention.
- **Grounding an inferential review** — feed the metrics to an AI review to focus
  it, but don't expect the metrics alone to yield good findings.

Execution: computational (data) + inferential (interpretation) · Cost: $ · When:
**continuous / review-time.** Notes: needs suppression for legitimate hubs or it
re-flags them forever.

### E. AI modularity & design review

The fully inferential route — and the experiments found it **very fruitful** where
computational coupling data fell flat. A well-prompted review (e.g. dedicated
"modularity skills") finds real, high-value issues: duplicated route/handler code,
semantic duplication (a third page reimplementing a shared hook), parameters
repeated at every layer, responsibilities in the wrong place — and it correctly
recognizes legitimate hubs that pure metrics mislabel.

This is "garbage collection": agents rarely refactor repeated code on their own
("happy to copy and paste" to the 3rd/4th occurrence) until nudged. Practical
tips:
- **Run it more than once.** A second run (without the first's context) surfaces
  issues the first missed — run multiple times when it matters.
- **Grounding in coupling data** barely helped vs. reading the code; don't over-
  invest in feeding it metrics.
- Ideal future state is running it on the *changed files* of a commit to shift it
  left, but it's typically a scheduled "janitor" pass today.

Execution: inferential · Cost: $$ · When: **continuous / scheduled** (or
review-time). Notes: without this *and* without human coupling expertise, agents
quietly compound design debt.

### F. The test suite as a regression sensor

Tests are the ultimate behaviour spec *and* the regression sensor: a failing
pre-existing test forces the question "did I break this, or am I intentionally
changing it?" A good suite lowers the odds the agent breaks wanted behaviour. But
when tests are AI-generated and unreviewed, two risks dominate:

- **Coverage ≠ effectiveness.** Coverage says a line *ran*, not that its effect was
  *asserted*. A file can show 100% statement coverage yet have no real assertions
  (covered only by a broad acceptance test).
- **Tests may encode faulty behaviour** (harder; out of scope for sensors — flag
  it for human attention).

Tools in the box:
- **Coverage** (¢) — visibility of what's exercised. Necessary, not sufficient.
- **Property-based testing** (¢) — finds missing logical cases via generated
  inputs from declared properties.
- **Fuzz testing** ($$) — finds input-resilience gaps via malformed inputs.
- **Mutation testing** ($$) — finds **missing assertions** by mutating code and
  checking the suite notices. The key sensor for the AI-generates-tests era: it
  exposes the assertion gaps coverage hides. Resource-intensive, so run
  **incrementally / on changed files**, not continuously.

Execution: computational (suite/coverage/mutation) — though an AI-generated suite
is *created* inferentially · Cost: ¢ (suite) → $$ (mutation/fuzz) · When: suite =
**in-session + CI**; mutation/fuzz = **incremental in-session or CI/scheduled.**
Notes: mutation reports are huge JSON — build a small CLI to query summary /
worst-files / hotspots / changed-only so you don't clog the agent's context.

### G. Security: SAST, secret scanning, dependency scanning

- **Secret scanning** (e.g. GitLeaks) in the **pre-commit hook** — a sensor that
  stops the agent committing secrets and gives it feedback at commit time. High
  value, cheap, gating.
- **SAST** (e.g. Semgrep, often org-prescribed by an AppSec team) — pattern-based
  security/quality rules; runs in-session and CI.
- **Dependency / SCA scanning** — known-vuln detection (Dependabot, `npm audit`,
  `pip-audit`, `osv-scanner`, Trivy). Usually CI + scheduled.
- **AI security review** — an inferential pass driven by your AppSec checklist;
  scheduled. Pair with a **data-handling review** ("no user names should ever
  reach the web frontend").

Execution: mostly computational; reviews inferential · Cost: ¢ (secrets) → $$
(AI review) · When: secrets = **pre-commit**; SAST/SCA = **CI + scheduled**.

### H. Dependency-freshness report

A script gathers each dependency's age/activity/latest version; an AI then writes
a report recommending upgrades, deprecations, and risks. Computational data +
inferential synthesis. Catches gradual drift agents never raise on their own.

Execution: computational + inferential · Cost: $ · When: **scheduled.**

### I. Code-review agents

Inferential feedback on the diff. Split by cost and scope (keep quality left):
- **Fast in-session review** — a quick agent pass on the change before commit.
- **Broad post-integration review** — a slower review that considers the bigger
  picture, in CI. Ground it in computational signals (coupling, changed-file risk)
  to focus its tokens.

Execution: inferential · Cost: $–$$ · When: **pre-commit (fast) + CI (broad).**

### J. Architecture fitness functions

Make architecture characteristics *executable*: performance tests that feed back
whether the agent improved or degraded a requirement; observability conventions
(logging standards) as a guide, plus a debugging instruction that asks the agent
to reflect on whether the logs it had were good enough. Define the requirement as
a guide; the test is the sensor.

Execution: computational (perf tests) + inferential (reflection) · Cost: $ ·
When: **CI + scheduled**; runtime SLO watchers in production.

### K. Behaviour sensors

The hardest category — set expectations honestly. Today's realistic toolkit:
functional spec as the guide; green AI-generated suite + coverage + mutation as
imperfect feedback; **approved scenarios/fixtures** where they fit (selectively,
not wholesale); manual testing for the rest. Don't claim a behaviour harness
removes human verification — it directs it.

## 4. Ecosystem cheat-sheet

Concrete tools per concern. Always confirm against the repo's actual config/CI
before recommending; match the package manager and existing setup.

| Concern | Node / TS | Python | Go | Rust | JVM | .NET |
| --- | --- | --- | --- | --- | --- | --- |
| Lint (file/fn) | ESLint (+ AI-failure plugins) | Ruff, Pylint | golangci-lint, `go vet` | Clippy | Checkstyle, PMD, SpotBugs | Roslyn analyzers |
| Format | Prettier | Ruff format, Black | gofmt | rustfmt | Spotless | `dotnet format` |
| Types | tsc (`strict`) | mypy, Pyright | (built-in) | (built-in) | (built-in) | (built-in) |
| Arch / deps | dependency-cruiser, eslint-plugin-boundaries | import-linter, deptry | go-arch-lint, depguard | cargo-modules | ArchUnit | NetArchTest |
| Coupling | madge, dependency-cruiser | pydeps, import-linter | — | cargo-modules | (DSM tools) | — |
| Coverage | Vitest/Jest `--coverage`, c8/nyc | coverage.py / `pytest --cov` | `go test -cover` | cargo-llvm-cov / tarpaulin | JaCoCo | coverlet |
| Mutation | Stryker | mutmut, cosmic-ray | go-mutesting / gremlins | cargo-mutants | PIT | Stryker.NET |
| Property | fast-check | Hypothesis | gopter / rapid | proptest / quickcheck | jqwik | FsCheck |
| Secrets | GitLeaks, trufflehog | GitLeaks | GitLeaks | GitLeaks | GitLeaks | GitLeaks |
| SAST | Semgrep, ESLint security | Semgrep, Bandit | Semgrep, gosec | Semgrep, cargo-audit | Semgrep, SpotBugs | Semgrep, Security CodeQL |
| Deps / SCA | npm audit, osv-scanner, Dependabot | pip-audit, osv-scanner | govulncheck, osv-scanner | cargo-audit | OWASP Dep-Check | dotnet list package --vulnerable |
| Hooks runner | husky, lefthook, pre-commit | pre-commit, lefthook | lefthook, pre-commit | lefthook, pre-commit | lefthook | husky, lefthook |

## 5. How to recommend a sensor (the checklist)

For each candidate, answer — and put the answers in the assessment:

1. **Which observed failure does it catch?** No real failure → don't add it.
2. **Computational or inferential?** Prefer computational when the rule is
   objective; reserve inferential for genuine semantic judgment.
3. **What's the cost, and so where does it run?** Keep it as far left as it can
   afford (`timing-and-placement.md`).
4. **Gating or reporting?** Gate only where being wrong is expensive.
5. **Is the signal LLM-actionable?** If not, add a self-correction message or a
   paired guide — otherwise it's a mute sensor.
6. **Does it conflict with or duplicate an existing control?** Resolve before
   adding.
7. **Is it even buildable here (harnessability)?** Typed language, clear
   boundaries, framework — or not.
