# [Feature name]

| | |
| --- | --- |
| **Author** | |
| **Status** | Draft / In review / Approved / Superseded |
| **Reviewers** | *who has to weigh in before this is built* |
| **Last updated** | |

> This document is for **people**. It explains why we are building this and what
> shape it takes, so a teammate can weigh in now and a stranger can understand
> the decision in six months. It is not agent input — the spec is, and it is
> derived from this later. **No file paths, no code snippets, no symbol names:**
> the codebase will have moved by the time this is executed.

## 1. Context and problem

What is happening today, who it hurts, and why now. If there is a manual process
being replaced, describe it concretely — that description is often the most
useful part of the document.

## 2. Goals

- What success looks like, observably.

### Non-goals

- What we are explicitly **not** doing, and why.

*The non-goals list prevents more rework than the goals list creates. Be
specific: "no bulk import in v1" beats "keep it simple".*

## 3. Architecture

The shape of the solution. Named components and how they relate. Diagrams if
they help. Describe **what each part is responsible for**, not where its code
will live.

### Integration points

Systems we touch and what we depend on from each. Flag anything owned by another
team — those are the reviewers who need to see this.

## 4. Domain rules

The business logic that is not obvious from the shape. Edge cases, state
transitions, precedence when rules conflict, what happens to data that already
exists.

*This section is what the spec's acceptance criteria will be derived from. Vague
here becomes ambiguous there and wrong in the code.*

## 5. Interfaces

Endpoints, jobs, or public functions this introduces or changes — **names and
payload shapes**, not signatures. Note breaking changes explicitly.

## 6. Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| | | |

Include the "this takes twice as long as estimated because…" risks, not only the
failure modes.

## 7. Open questions

| # | Question | Owner | Status | Answer |
| --- | --- | --- | --- | --- |
| 1 | | | Open / Resolved | |

**Answer these here, in the document, not in chat.** A question answered in a
conversation is lost at the next context reset. A question answered here becomes
part of the frozen input — and a resolved question is now a requirement the
implementation must satisfy.

Leave genuinely undecided ones marked Open rather than guessing. A design that
fabricates an answer looks complete and is wrong.

## 8. Implementation plan

High-level phases with **human-day estimates**. This is what sizes the work into
runs — not a task list for an agent.

| Phase | What | Estimate |
| --- | --- | --- |
| 0 | | |
| 1 | | |

**Total:** ~N days → *[how many runs this becomes, and where the split lands]*

## 9. Out of scope for now

Ideas raised and deliberately deferred, with the reason. One line each. This is
what stops the same suggestion from being re-litigated every planning cycle.
