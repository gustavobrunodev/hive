# Progressive Rules: the on-demand docs/ layer

This is the layer that lets you give an agent deep, specialized knowledge
*without* paying for it on every task. Read this when designing `docs/` and the
index that points to it. The mechanism mirrors how Agent Skills work: cheap
always-on *awareness*, full content loaded only on demand.

## The three levels (and where each lives)

1. **Awareness (always loaded, ~one line each).** A short index in `AGENTS.md`
   that names each specialized rule file and the trigger for reading it. Costs a
   handful of tokens; this is all the agent pays on an unrelated task.
2. **The rule file (loaded on demand).** A `docs/<category>.md` with the full
   guidance for one area. Pulled in only when the task matches the trigger.
3. **Deep references (loaded rarely).** A rule file may itself point to a long
   spec, a schema, or examples for the agent to open only if it needs them.

Your job is to design clean categories (level 2) and write triggers crisp enough
(level 1) that the right file loads at the right time — and nothing loads when
it shouldn't.

## How loading actually happens

The **portable mechanism — works in every AGENTS.md-aware tool** — is the index
of pointers. Because `AGENTS.md` is always in context, the agent *sees* the index
and, when the current task matches a trigger, reads that file with its normal
file-reading ability. No special tooling required. This is the default and what
you should always produce.

Some tools add **native auto-loading** on top, which you can layer on when the
target tool is known (details in `tool-compatibility.md`):

- **Cursor** can load rules automatically by file glob (`.cursor/rules/*.mdc`
  with `globs:`) or let the agent pull a rule in from its `description:`. You can
  keep the `docs/` files as the single source of truth and have thin `.mdc`
  rules `@`-reference them, so Cursor auto-attaches by path while other tools use
  the index.
- **Nested `AGENTS.md`** (Cursor, OpenCode, Codex, …) auto-loads by *directory*:
  put area rules in `packages/x/AGENTS.md` and they apply when the agent touches
  that area. Use this when a category maps cleanly onto a directory.

Default to the portable index. Add native auto-loading as an enhancement, never
as the only path — it keeps the result tool-agnostic.

## Choosing categories that load reliably

A good category has a **clear, mutually-exclusive trigger** so the agent never
has to guess. Categorize along whichever of these gives the cleanest triggers
for the project:

- **By subsystem / domain:** `database.md`, `auth.md`, `payments.md`, `search.md`.
- **By technology:** `react.md`, `graphql.md`, `terraform.md`.
- **By directory:** maps a folder to a file (`docs/api.md` ⇄ `src/api/**`); pairs
  naturally with glob or nested-file auto-loading.
- **By task type:** `testing.md`, `e2e-testing.md` (when Playwright, Cypress,
  Selenium, or similar is present — worth splitting from `testing.md` when it
  has its own run target, fixtures, and flakiness rules), `migrations.md`,
  `releasing.md`, `debugging.md`.

Heuristics for good categorization:

- **One concern per file.** If a file needs "and" in its purpose, consider
  splitting. Single-concern files load precisely and stay easy to maintain.
- **Trigger first, then content.** Before writing a file, write its one-line
  index trigger. If you can't phrase a crisp "when to read this," the category is
  fuzzy — rethink the boundary.
- **Aim for a handful, not dozens.** Over-fragmenting forces the agent to load
  many files for one task; over-merging defeats on-demand loading. Most repos
  land at ~3–8 files. Let real structure decide, not symmetry.
- **Mirror how work is actually sliced.** If people say "I'm working on the
  billing service," `docs/billing.md` will trigger naturally.

## Granularity: by aspect, by scope — never one catch-all

The most common failure of this layer isn't too many files, it's **one big
file**. A `docs/architecture.md` that covers layering, entity naming, transaction
handling, external clients, logging, and testing is an always-relevant file, and
"always relevant" means it gets loaded on every task — you've reinvented the
bloated always-loaded layer, one indirection down.

So when a broad topic has real depth, shard it by **aspect** and keep each shard
scoped:

| Instead of one… | Ship these |
| --- | --- |
| `docs/architecture.md` | `docs/coding-patterns.md` (repository pattern, lean controllers, transactions, entity naming) · `docs/integration-patterns.md` (external clients, injection, logging, metrics, circuit breakers) · `docs/module-structure.md` (folder layout, suffixes, where a new file goes) · `docs/persistence.md` (migrations, datasource) |
| `docs/testing.md` (in a repo with real e2e) | `docs/testing.md` (unit/integration) + a nested e2e `AGENTS.md` with its own `docs/` (below) |

The test for a shard: **name the task that opens it.** "Adding a controller"
opens `coding-patterns.md`. "Wiring a third-party API" opens
`integration-patterns.md`. If you can't name a task, or two shards answer the
same task, the cut is wrong.

Pair the shard with a **routing table** in `AGENTS.md` (task → file), not just a
trigger list — see mandatory block 2 in `mandatory-blocks.md`. The table *is* the
interface to this layer.

## E2E: a nested AGENTS.md with its own docs/

When a project has e2e tests, they get more than a category — they get their own
**nested rule root**, because e2e work has a different runner, different setup,
different selectors, and different failure modes than the rest of the codebase,
and it lives in its own directory.

Create `AGENTS.md` **at the root of the e2e config/specs directory** — wherever
`playwright.config.ts` / `cypress.config.ts` / `wdio.conf.js` actually lives
(`e2e/`, `tests/e2e/`, `cypress/`, `apps/<app>-e2e/`) — plus a `docs/` folder
beside it:

```text
e2e/
├── AGENTS.md              # commands, required setup, selectors, boundaries + index
├── docs/
│   ├── fixtures-e-auth.md     # test users, login bypass, seeded state
│   ├── network-mocking.md     # what to intercept, what never to mock
│   ├── flakiness.md           # retry policy, isolation, how to reproduce
│   ├── visual-testing.md      # snapshot baselines, when to regenerate
│   └── ci.md                  # shards, artifacts, timeouts, env targets
├── playwright.config.ts
└── specs/
```

Why nested rather than `docs/e2e-testing.md` at the root: agents load the
**nearest** file, so a spec author gets these rules automatically and every other
task pays nothing for them. Keep a single one-line pointer in the root
`AGENTS.md` ("Escrevendo testes e2e → ler `e2e/AGENTS.md`") so it's discoverable
from the top.

Create only the shards the project actually needs — a suite with no visual
testing doesn't get `visual-testing.md`. Use `assets/AGENTS.md.e2e.template` for
the nested file and `assets/docs-rule.template.md` for each shard.

The same pattern applies to any other area with a genuinely distinct workflow and
its own directory (a mobile app, an infra/terraform tree, a data-pipeline
package): nested `AGENTS.md` + local `docs/`, root file keeps one pointer.

## Writing the index in AGENTS.md

The index is the only always-loaded part of this layer, so it must be tiny and
unambiguous. Phrase each entry as an **imperative with a concrete trigger** so
the agent knows exactly when to act:

```markdown
## Specialized rules — read the file when its trigger applies
- Changing DB schema or writing a migration → read `docs/database.md`
- Touching anything under `src/auth/` → read `docs/auth.md`
- Adding or modifying an API endpoint → read `docs/api.md`
- Writing or debugging tests → read `docs/testing.md`
```

What makes triggers reliable:

- **Name the observable condition** (a directory, a file type, an action) rather
  than a vague topic. "Touching `src/auth/`" beats "for authentication stuff."
- **Keep triggers disjoint.** Overlap makes the agent load too much or hesitate.
- **One line each.** The index is awareness, not content — resist summarizing the
  file in the index (that defeats the purpose and leaks tokens).

## What belongs in a docs/ rule file

Each file is the place for the depth that would have bloated `AGENTS.md`:
detailed conventions for the area, required sequences (e.g. how to author a
migration safely), the do/don't patterns specific to that subsystem, and
pointers to deeper specs. Apply the same discipline as the top layer — concrete,
imperative, no duplication of what the code or human docs already say — but you
have more room because the cost is only paid when the file is relevant.

Keep individual files focused and reasonably short (Cursor, for instance,
recommends rules under ~500 lines and splitting bigger ones). If a file grows
unwieldy, split by sub-concern and add a level-3 pointer to the longest material.

Use `assets/docs-rule.template.md` as a starting skeleton.

## Don't duplicate human docs — reference them

If the project already documents an area well (a `docs/database.md` written for
humans, an architecture doc, an ADR), **do not restate it**. Either point to it
from the index ("Database schema changes → read the existing `docs/db/schema.md`,
then follow the migration rules below") or keep the agent file to the *additional*
agent-specific rules and link out for the rest. Duplication is the measured #1
cause of context files hurting — referencing keeps things DRY and prevents drift.

## Where to put the files

The user-facing default is a `docs/` directory at the repo root, referenced from
`AGENTS.md`. Two practical adjustments:

- **If `docs/` already holds human documentation,** don't scatter agent rules
  among it. Use a clearly-scoped subfolder (e.g. `docs/agents/`) or distinct,
  obviously-named files, and reference the existing human docs rather than
  competing with them. Update the index paths accordingly.
- **If targeting Cursor specifically and you want automatic attachment,** you can
  additionally place thin `.cursor/rules/*.mdc` files that `@`-reference the
  `docs/` files (see `tool-compatibility.md`). The `docs/` files stay the single
  source of truth.

## Sanity check

After building the layer, verify: every index pointer resolves to a file that
exists; every `docs/` file has a clear matching trigger in the index; **every
file is single-concern and you can name the task that opens it**; no file
duplicates README/human-doc content; the e2e directory has its own `AGENTS.md` +
`docs/` if e2e tests exist; and the always-loaded index stayed tiny.
`scripts/audit_rules.py` checks the resolvable-pointer and size parts for you.
