# Timing & Placement: keep quality left, then wire it in

Deciding *where in the lifecycle* each control runs is half of harness design —
and "when should this sensor run?" is a question users ask directly. This file
covers the principle, the decision framework, and — the part people skip — how to
**encode** the timing so the agent and the pipeline actually run each control at
the right moment.

## The principle: keep quality left

The earlier (further "left") you catch an issue, the cheaper it is to fix. Teams
that continuously integrate have always spread checks across the timeline by
**cost, speed, and criticality**; do the same for agent controls. Two framing
questions from the article:

- *What's reasonably fast and should run even before a commit exists?* (linters,
  fast tests, a basic review agent, secret scanning)
- *What's more expensive and should only run post-integration in the pipeline* —
  plus a repeat of the fast controls on clean infra? (mutation testing, a broad
  review that takes in the bigger picture)

And two that live *outside* the change lifecycle:

- *What drifts gradually and should be monitored continuously?* (dead code, test-
  quality/coverage analysis, dependency scanners, modularity reviews)
- *What only appears at runtime?* (agents watching degrading SLOs; LLM judges
  sampling response quality and flagging log anomalies)

## The five stages

| Stage | What runs here | Why | Typical execution |
| --- | --- | --- | --- |
| **In-session** (alongside the agent) | type check, fast linters, fast unit tests, dep/arch rules, quick review | tightest loop — the agent self-corrects within the same turn, before you ever see it | computational, ¢ |
| **Pre-commit / pre-push** (git hook) | the fast set again, scoped to changed files; secret scanning | a clean gate before code leaves the machine; catches what an in-session agent skipped | computational, ¢ |
| **CI / post-integration** | repeat fast controls on clean infra + the expensive ones: mutation testing, broad AI review, SCA | confirm on neutral ground; afford the slow/expensive checks once per change, not per keystroke | computational + inferential, $–$$ |
| **Continuous / scheduled** (off the change path) | drift & health: dead-code, coverage/test-quality, modularity review, dependency-freshness | catches slow erosion no single change triggers — "garbage collection" | mostly inferential, $$ |
| **Runtime / production** | SLO watchers, log-anomaly / response-quality judges | some signals only exist live | inferential, $$ |

## The decision framework

Place a control by four properties — *not* by habit:

1. **Speed** — sub-second → can run in-session/pre-commit. Minutes → CI/scheduled.
2. **Cost** — free (CPU) → run often and early. GPU/token-heavy → run rarely and
   right.
3. **Determinism** — deterministic → safe to *gate*. Non-deterministic
   (inferential) → usually *report*, or gate only with a tolerant threshold.
4. **Criticality / blast radius** — expensive-to-undo mistakes (secrets, broken
   migrations, boundary violations) earn an early *gate*; advisory quality signals
   *report* and inform, don't block.

Rules of thumb:
- **Cheap + deterministic + critical →** in-session *and* pre-commit *and* CI,
  gating. (type check, secret scan, arch rules)
- **Cheap + deterministic + advisory →** in-session + CI, mostly reporting with
  self-correction messages. (most lint rules)
- **Expensive + non-deterministic →** CI or scheduled, reporting. (mutation, broad
  AI review, modularity review)
- **Slow-drift →** scheduled only. (dependency-freshness, dead-code)

Never let an expensive inferential check gate every commit, and never strand a
cheap deterministic one in a nightly job — both are classic misplacements to flag
in an assessment.

## Encoding the timing (the part people skip)

A decision about *when* is worthless until it's wired in. There are three places
to encode it; use them together.

### 1. In agent rules / guides (so the in-session agent runs it)

This is the user's "define it in the project rules." Add an imperative,
*triggered* instruction — and delegate the actual file-writing to
`agent-rules-architect`. Phrase it as an observable trigger → action, e.g. in
`AGENTS.md` or an on-demand `docs/` rule:

```markdown
## Checks to run while you work
- After editing anything under `server/**`: `npm run lint:dep` (enforces layer
  boundaries — read the error's layer recap and fix the import, don't suppress).
- Before committing: `npm run typecheck && npm run lint && npm test -- --changed`.
- After adding or changing a mapper/transformer: run mutation testing on that file
  (`npm run mutation -- --mutate src/path`) and add assertions for any survivors.
```

For **Cursor**, you can additionally place a thin `.cursor/rules/*.mdc` with
`globs:` so the instruction auto-attaches when matching files are in context (see
`agent-rules-architect/references/tool-compatibility.md`). Some agents also
support **hooks** that run a command automatically after an edit/tool call — the
strongest form of "in-session sensor"; use them when available.

### 2. In git hooks (so it gates before code leaves the machine)

Use the project's hook runner (`pre-commit`, `lefthook`, `husky`, `.githooks`).
Keep hooks **fast and scoped to changed files** — a Stripe-style heuristic of
"run the relevant linters based on what changed" keeps the gate from becoming a
tax people bypass. Example `lefthook.yml`:

```yaml
pre-commit:
  parallel: true
  commands:
    secrets:
      run: gitleaks protect --staged --redact
    lint:
      glob: "*.{ts,tsx}"
      run: npx eslint {staged_files}
    typecheck:
      glob: "*.{ts,tsx}"
      run: npx tsc --noEmit
```

Heavy checks (mutation, broad review) do **not** belong in pre-commit — they push
people to `--no-verify`. Put them in CI.

### 3. In CI (so it's confirmed on clean infra and the slow checks get their turn)

Repeat the fast computational controls (clean environment catches "works on my
machine"), then add the expensive ones. Be explicit about **gate vs. report**:

```yaml
# .github/workflows/ci.yml (sketch)
jobs:
  fast:        # gating
    steps: [typecheck, lint, unit tests, dep/arch rules, sca]
  deep:        # mostly reporting; gate only with tolerant thresholds
    steps: [mutation testing (changed files), broad AI review, coverage report]
```

Scheduled drift jobs (`on: schedule:`) host the modularity review,
dependency-freshness report, and dead-code scans — often as agent jobs that open
issues/PRs rather than fail a build.

## The output: a timing column in the assessment

Every sensor in the assessment gets a **where it runs** value and a **gate /
report** flag. A control with no stage assigned isn't really in the harness yet —
that's itself a finding ("present but not wired"). Re-running
`scripts/harness_inventory.py` after wiring confirms the stage is real (the hook /
CI step actually exists), not just intended.
