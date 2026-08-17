# Measurement — an LLM judge you can defend

How to get a trustworthy number out of a non-deterministic grader.

The objection is fair and you should say it out loud before building anything: *how can a probabilistic model produce a reproducible score?* The answer is that it can't — **not while it is being asked a probabilistic question.** "Rate this implementation from 1 to 5" gets a different answer from every model on every run, because it packs interpretation, search, weighting, and arithmetic into one judgement call.

So you don't ask that question. You decompose the judgement until every remaining question has exactly one defensible answer, and you move everything else out of the model:

| The model still does                     | The model no longer does                     |
| ---------------------------------------- | -------------------------------------------- |
| Search the codebase for a specific thing  | Decide what to search for (baseline does)     |
| Report found / not found, with a location | Decide how much that is worth (weights do)    |
| Quote the evidence                        | Add anything up (the script does)             |

What is left for the model is the one thing it's genuinely good at: reading code and answering a narrow, closed question about it. Everything a model is unreliable at — consistent weighting, arithmetic, resisting its own incentives — has been moved somewhere deterministic.

**When this is worth building:** you are comparing things (frameworks, models, prompts, skill versions) and the comparison has to hold up; or you are shipping something where "it looks done" is not a sufficient answer. For ordinary feature work, the Verifier in `tlc-spec-driven` already applies the same principles at a lighter weight — use that instead of building this.

---

## 1. Freeze the input

Everything downstream compares runs against each other, which only means something if they were asked the same question.

The input is a **requirements document under version control** — a PRD, a spec, a task description — not a prompt. It should state:

- what must be built, as user stories with **acceptance criteria written as observable outcomes**
- what must explicitly *not* be built
- priorities (P0/P1/P2), because not all criteria deserve equal weight
- open questions, deliberately handled — see below

**Grind the ambiguity out before you freeze.** Run the input two or three times and read what came back. Where two runs diverged, the input was ambiguous, and the divergence is measuring your writing rather than the thing under test. Sharpen and repeat until reruns converge on the same interpretation. This iteration is most of the work and it is not optional — an unfrozen input silently becomes the dominant source of variance in every number you later produce.

**Open questions are a deliberate instrument.** Two kinds, and the difference matters:

- **Resolved** open questions — recorded with their answer. These are now requirements: the run must implement them, and a framework that misses them was not reading carefully.
- **Unresolved** open questions — the run should surface them rather than invent an answer.

Keep unresolved ones scarce if the run must complete autonomously, but don't eliminate them entirely. Real requirements documents have holes, and how a framework handles a hole — asks, flags, or silently fabricates — is one of the more revealing things you can measure.

Freeze it: commit it, and reference it by commit hash in every run.

---

## 2. Freeze the baseline

The input says what to build in prose. The baseline says **what counts as evidence that it was built** — and it is the artifact that makes the judgement binary.

Take each acceptance criterion and decompose it into two kinds of atomic check:

- **I-checks (implementation)** — one observable fact about the code. Matched or not.
- **T-checks (test)** — one test that proves the behaviour. Present and asserting the right thing, or not.

Worked example. This acceptance criterion:

> When an authenticated user requests a trial with a plan `priceId` and a duration `trialDays` (default 14), the system creates the subscription in trial mode without requiring a payment method, and returns status `trialing` with the end date.

decomposes into:

```
I-01  Creates a subscription in trial mode for an authenticated user with a plan priceId
I-02  Subscription is created without requiring a payment method
I-03  Response returns status "trialing"
I-04  Response returns trialEndDate matching the trialDays duration
T-01  Unit test asserts subscription.status === "trialing" after createTrial()
T-02  Unit test asserts creation succeeds with no payment method attached
T-03  Integration test asserts POST /subscriptions/trial returns trialing + trialEndDate
```

Each line is now a question with one answer. The judge has nowhere to be generous, and nowhere to be vague.

**Three properties make a check good:**

- **Atomic** — one fact. "Creates the subscription and returns the status" is two checks pretending to be one, and a judge will match it on the easier half.
- **Observable in the artifact** — a check you can only answer by guessing at intent is not a check. If you can't say what file or test would satisfy it, rewrite it.
- **Neutral about implementation** — the check says *what must be true*, not which function does it. A check that names a file constrains the design and measures conformity instead of correctness.

**Freeze it once and reuse it for every run.** This is the point of the whole exercise: the same baseline judges every framework, every model, every attempt. Regenerating it per run means each contestant is graded against a subtly different rubric, and the comparison is worthless — it will still produce numbers, which is what makes it dangerous.

Generate it with a **pinned-model sub-agent** (`assets/agents/baseline-freezer.md`), commit the output, and never regenerate it while a comparison is open. Format in `assets/baseline.example.json`.

---

## 3. Run under a clean session

Between runs, wipe everything a previous run could have left behind — build output, caches, installed dependencies, databases, generated files, branches. See the protocol in [roles.md](roles.md).

This looks like paranoia until it bites you, and it bites quietly: a run reads a `dist/` directory from a *previous* attempt, finds the feature already implemented, and reports success. The tests pass. The score is excellent. Nothing was built. There is no signal in the run distinguishing this from real success, which is why it must be prevented structurally rather than detected.

---

## 4. The judge contract

The judge is a **fresh sub-agent with a pinned model that did not write the code** ([roles.md](roles.md)). It receives the baseline, the repository, and these rules:

**Binary only.** Every check gets `true` or `false`. No partial credit, no "mostly implemented" — a partial match is `false`, and if that feels unfair the check was not atomic enough. Fix the baseline, not the scale.

**Evidence or zero.** A `true` requires `file:line` plus the code or assertion that satisfies it. No evidence, no match — enforced by the scorer, not by asking nicely.

**A `false` must show the search.** The cheapest way for a judge to be wrong is to not look hard enough and report absence. Require the search that justifies it: the globs or symbols searched, and what was found instead. This is the same evidentiary standard as a match, applied to the negative claim, and it is what stops "I couldn't find it" from being a synonym for "I didn't look".

**No arithmetic.** The judge emits per-check results and stops. It never computes a subtotal, a percentage, or a final score. Models produce numbers that look right and don't add up, and a single wrong subtotal invalidates everything above it.

**One check at a time.** Structure the judge's work as a walk through the baseline, not as an essay about the implementation. The output is a results file, not a narrative.

### Why the judge doesn't need to be policed

A natural next thought is to add a second judge to catch the first one lying. It isn't worth it, and the reason is about incentive rather than capability: **an agent dispatched with the sole task of evaluating has nothing to gain from a good score.** It is not defending work it produced.

The bias appears the moment you collapse the roles. Ask the implementer to assess its own output and it will find its work satisfactory — not from dishonesty, but because it is reasoning from the mental model that produced the code, in which everything necessary was obviously done. `judge ≠ author` is not a trust exercise; it is removing the conflict of interest that makes self-assessment unreliable.

---

## 5. Score it with the script

Never let the model compute the score. Run `scripts/score.py`:

```bash
python3 scripts/score.py --baseline baseline.json --results run-1.json run-2.json run-3.json
```

The formula it implements:

```
criterion = 0.6 · (I-checks matched / I-checks total)  +  0.4 · (T-checks matched / T-checks total)
story     = mean of its criterion scores
total     = Σ (story · priority_weight) / Σ priority_weight
```

**Why 0.6 / 0.4.** Implementation is the larger share because it is the thing being asked for; tests are a substantial minority because unproven behaviour is not finished behaviour. The exact split is a judgement about what you value — change it in the baseline's `weights` block if your project weighs proof differently — but keep it *fixed across everything you compare*, or the number stops meaning anything.

**Why priority weights.** A P0 criterion missed is a different event from a P2 missed. Flat averaging hides that; a framework can skip the hard core, nail the periphery, and post a respectable score.

**Renormalization.** When a criterion genuinely has no test dimension, the script renormalizes over the dimensions present rather than capping it at 0.6 — otherwise the implementer is penalized for a choice the baseline author made.

The script also enforces the integrity rules mechanically and exits non-zero on violation: matches without evidence are forced to `false`, checks the judge silently skipped are counted as `false` and reported, and result IDs absent from the baseline are errors. This matters more than it sounds — it converts three of the judge's rules from instructions the model may drift on into properties of the pipeline.

---

## 6. Repeat, and report the spread

**One run is an anecdote.** Three is the usual floor — enough to see whether you are looking at a signal or at variance. Report mean and spread, never a single run's number, and treat a wide spread as a finding about your harness rather than noise to average away: if the same input produces 0.65 and 0.92, something upstream is still open, and the mean of those two describes nothing that exists.

`score.py` computes this across multiple result files.

---

## 7. What the report says

Scored, and driving the number:

- **Per-criterion results** — every I-check and T-check with its match and evidence. The audit trail; without it the score is an assertion.
- **Scope adherence** — did it build what was asked, and did it stay out of what was excluded.
- **Engineering gates** — build, lint, typecheck, test suite. Binary and computational; no judge involved.

Reported, not scored — informative because it explains *why* the number came out where it did:

- **Elicitation** — how well implicit requirements were extracted into the spec (input validation, error taxonomy, auth boundaries, limits, pagination). Cite where in the produced spec each appeared. Leave it unscored: it is upstream of implementation and mixing it in makes a single number answer two questions badly.
- **Robustness** — tests beyond the required ones, tiered (required / secondary / nice-to-have).

Keep the scored and unscored sections visibly separate. A reader who cannot tell which observations moved the number will not trust either kind.

---

## 8. Validate the harness itself

A measurement harness is a piece of engineering and deserves the same scepticism as the thing it measures. One property tells you most of what you need:

**Swap the judge model and re-score the same artifacts. The number should barely move.**

If it moves materially, the judgement is still leaking into the model — checks are not atomic enough, evidence rules are too loose, or the judge is being asked to weigh rather than to find. Tighten the baseline and re-test. When the score is stable across judges, you have what you were after: **the model became an instrument rather than an opinion.**

Two supporting checks worth running once:

- **Score a known-incomplete implementation.** If a deliberately half-built version scores well, the checks aren't discriminating and the baseline is measuring effort rather than outcome.
- **Score the same artifact twice with the same judge.** Residual variance here is the floor below which no comparison you make is meaningful.
