# Harness Assessment — Analytics Dashboard (example)

> A calibrated example showing the expected shape and level of specificity.
> Fictional TypeScript/Next.js service rebuilt largely by an AI agent — close to
> the kind of app the sensors article describes. Use it to gauge tone, evidence,
> and the implementability bar; don't copy it literally.

## 1. Context

- **Project / scope:** `analytics-dashboard` — Next.js + React frontend, a Node
  service layer that fetches and joins data from external APIs.
- **Stack & harnessability:** TypeScript (typed → type checker is a free sensor),
  a roughly layered backend (`routes → services → clients + domain`) that has
  started to drift, no enforced module boundaries. Mostly greenfield, AI-built.
  High harnessability — typed + emerging layers make computational sensors viable.
- **Goal / pain that prompted this:** "A small change to the date-range picker
  touched 40+ files," and "the agent keeps re-implementing the same backend call
  three different ways." Review is taking too long.
- **Regulation categories in scope:** maintainability (primary), light
  architecture-fitness (logging). Behaviour out of scope this round.
- **Target agent(s)/tools:** Cursor + Claude Code.

## 2. Current harness inventory

| Control | Direction | Execution | Category | Stage(s) | Gating? | LLM-actionable? | What it actually enforces |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `tsc` | feedback | computational | maint. | CI | yes | n/a | compiles; `strict` is **off** |
| ESLint | feedback | computational | maint. | CI | no | no (raw codes) | style preset only; no max-lines/args/complexity, no `no-explicit-any` |
| Vitest + coverage | feedback | computational | maint./behav. | CI | no | n/a | ~70% line coverage; mostly one broad acceptance test |
| `AGENTS.md` | feedforward | inferential | maint. | in-session | — | — | install/run commands; a few stale notes |
| (none) secret scan | — | — | — | — | — | — | secrets could be committed |

## 3. Coverage map

**Direction × execution**

|             | Computational | Inferential |
| ----------- | ------------- | ----------- |
| Feedforward | — | `AGENTS.md` (thin) |
| Feedback    | `tsc`, ESLint (style), Vitest/coverage | — (no AI review) |

**Category × stage**

| Category \ Stage | In-session | Pre-commit | CI | Continuous | Runtime |
| ---------------- | ---------- | ---------- | -- | ---------- | ------- |
| Maintainability  | AGENTS.md only | — (no hooks) | tsc, ESLint, tests | — | — |
| Architecture     | — | — | — | — | — |
| Behaviour        | — | — | tests/coverage | — | — |

## 4. Findings

- **[Gap] No module-boundary enforcement despite real layers.** `server/clients/*`
  imports from `server/services/*` in 3 places (evidence: `clients/spaces.ts`
  imports `services/aggregate.ts`). The "40-file change" pain is the symptom of
  unconstrained coupling. No guide and no sensor covers this.
- **[Gap] Tests are assertion-light; coverage hides it.** `mappers.ts` shows 100%
  statement coverage but has no unit tests — it's only exercised by the broad
  acceptance test. A future change to `dvpToSchema` could silently break a chart.
  No mutation testing to expose the assertion gap.
- **[Mute sensor] ESLint emits raw codes.** Even the rules that exist give the
  agent no guidance, so it can't self-correct well and tends to disable rules.
- **[Imbalance] Feedforward-heavy, no inferential feedback.** Repeated semantic
  duplication (three different backend-call implementations) is exactly what an AI
  modularity review catches and linters can't.
- **[Timing] Everything is CI-only; nothing runs in-session or pre-commit.** The
  agent gets feedback minutes later in CI instead of within the turn, and secrets
  could be committed.
- **[Config] `tsc` strict is off** — leaving the strongest free sensor underused.

## 5. Prioritized recommendations

### P1 — Add module-boundary rules with self-correction messages, wired in-session
- **What:** `dependency-cruiser` rules enforcing `routes → services → clients +
  domain`, plus a rule requiring every new file to live in the defined structure.
- **Why:** closes the [Gap] behind the "40-file change" pain; holds the layering
  as the agent works.
- **Type:** sensor · computational
- **Category:** maintainability (architecture-adjacent)
- **Stage & gating:** in-session + pre-commit + CI · gate
- **How:** generate the config with the agent; expand error messages to re-teach
  the layers (see the `clients-no-services` example in `sensors-catalog.md`); add
  an `AGENTS.md` line: "After editing `server/**`, run `npm run lint:dep` and fix
  the import the message points to — don't suppress."
- **Effort:** M

### P2 — Turn on `tsc strict` and tune ESLint to AI-failure modes, with messages
- **What:** `"strict": true`; add `max-lines`, `max-lines-per-function`,
  `max-params`, `complexity`, `@typescript-eslint/no-explicit-any`; a custom
  formatter carrying self-correction guidance + suppress-with-reason.
- **Why:** closes [Mute sensor] and the strict [Config] gap; targets AI sprawl.
- **Type:** sensor · computational
- **Category:** maintainability
- **Stage & gating:** in-session + pre-commit (changed files) + CI · gate strict,
  report thresholds (allow rare reasoned threshold bumps)
- **How:** ratchet strict by fixing errors area-by-area; add the four threshold
  rules; write the formatter with the agent.
- **Effort:** M

### P3 — Add a scheduled AI modularity review + incremental mutation testing
- **What:** a weekly modularity/"garbage-collection" review (inferential) and
  Stryker on changed files in CI, with a small query CLI over its JSON.
- **Why:** catches the semantic duplication linters miss and the assertion gaps
  coverage hides.
- **Type:** sensor · inferential (review) + computational (mutation)
- **Category:** maintainability
- **Stage & gating:** continuous (review) + CI on changed files (mutation) · report
- **How:** run the review 1–2× per pass (second run finds more); add a
  `query_stryker` helper so reports don't clog context.
- **Effort:** L

### P4 — Add GitLeaks to a pre-commit hook
- **What:** `gitleaks protect --staged` via `lefthook`/`husky`.
- **Why:** closes the secret-scan gap; cheap, high blast-radius.
- **Type:** sensor · computational · maintainability/security
- **Stage & gating:** pre-commit · gate
- **Effort:** S

## 6. Steering loop — keeping the harness alive

- **Watch:** how often the agent bumps lint thresholds (signals a weak message),
  and which warnings it suppresses (start code review there).
- **Add when:** a *new* mistake recurs — not from imagination.
- **Retire when:** a rule fires mostly false positives or the modularity review
  keeps re-flagging a legitimate hub (suppress it).
- **Keep in sync:** if a guide and a sensor disagree (e.g. a rule encourages a
  pattern the linter punishes), fix one.
- **Re-measure:** re-run `harness_inventory.py` after wiring P1–P4.

## 7. Honest limits

This round raises maintainability and the in-session feedback loop, but does
**not** verify functional correctness. The tests assert little; until that's
addressed (approved scenarios + stronger assertions), human verification of
behaviour is still required — the harness just tells you *where* to look.
