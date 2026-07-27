# The three mandatory blocks

Everything else in this skill is subtractive: candidate rules must survive the
inference test or get cut. These three blocks are the exception — they go into
`AGENTS.md` on **every** run, create or improve.

| Block | Condition | Why it's exempt from the inference test |
| --- | --- | --- |
| **1. Memory contract** | Always | The agent cannot infer that a decision log exists, let alone that it must read it before acting. Nothing in the code says "read `STATE.md` first." |
| **2. Architecture principles** | Only when the project actually has them | Structural intent — *why* the folders are shaped this way, what must not depend on what — is the one thing reading the tree teaches you wrong. But a project with no real architecture gets nothing here. |
| **3. General rules** | Always | Planning and testing standards are process, not code; there is nothing in the repo to infer them from. |

They are exempt from the *inference* test, not from the *minimalism* rule. Each
stays tight, and each pushes its depth into `docs/`.

---

## Block 1 — Memory contract (always)

The pointer to the project's living memory: decisions, blockers, recurring
lessons, plus the map to vision, roadmap, and feature specs.

**The paths are not yours to choose.** They come from the SDD decision made in
`stack-presets/references/sdd.md` (branch A: `tlc-spec-driven`'s canonical
`.specs/…`; branch B: an existing SDD tool's own convention; branch C: the
project's own convention, or a scaffold). Read
`stack-presets/references/sdd-memory-contract.md` for the resolution rules and
the canonical wording, then write the block with the resolved paths.

Placement: **near the top of `AGENTS.md`**, above the `docs/` index — it's the
first thing the agent should act on. Canonical shape (branch A shown verbatim):

```markdown
Decisões, blockers e lições que se repetem
vivem em `.specs/project/STATE.md` — **leia no início de cada sessão**.

## Onde está o resto

- `.specs/project/PROJECT.md` — visão, goals e não-goals.
- `.specs/project/ROADMAP.md` — marcos.
- `.specs/project/STATE.md` — memória viva (decisões + lições) — **leia antes de começar**.
- `.specs/features/` — specs por feature (requisitos, design, tasks).
```

Non-negotiables: every path resolves to a real file (`audit_rules.py` reports
broken pointers as `ERROR`); the bold "leia no início de cada sessão" imperative
survives; one line per file, no summaries.

---

## Block 2 — Architecture principles (when they exist)

### First: does this project *have* architecture principles?

Do not invent them, and do not promote incidental folder layout into doctrine. A
CRUD app with a `src/` folder has no architecture principles; skip the block
entirely. Evidence that it does:

- A **structural convention repeated across the tree** — layered (`routes/` →
  `services/` → `repositories/`), modular monolith (`packages/<module>/`),
  vertical slices, hexagonal (`domain/`, `application/`, `infrastructure/`).
- **Enforcement already exists** — dependency-cruiser rules, `eslint-plugin-
  boundaries`, import-linter contracts, ArchUnit tests, Nx tags/`implicit-
  Dependencies`, module `project.json` boundaries.
- **Written intent** — an ADR, an architecture doc, a `modular-architecture`-style
  skill, or a README section describing boundaries.
- **The user states them.** If they hand you principles (as in the worked example
  below), that's authoritative — encode them.

If none of those exist, say so in your report and move on. A fabricated
architecture section is worse than an absent one: the agent will enforce a
structure the codebase doesn't have and fight the code on every task.

### Then: summarize in `AGENTS.md`, shard the depth into `docs/`

The `AGENTS.md` block is a **map, not a manual** — the invariants plus a routing
table. Everything explanatory goes into granular `docs/` files, one per aspect
(see `progressive-rules.md` for how granular, and why).

Shape it as: **Structure** (the layering rule in 3–5 lines) → **Module
structure** (naming/co-location, concrete paths) → **Key principles** (a numbered
line, not paragraphs) → **Progressive documentation loading** (the routing table
that sends the agent to the right `docs/` file).

A calibrated example — a modular monorepo whose principles the user supplied:

```markdown
## Architecture Principles

**Structure:**

- Apps = Bootstraps (orchestration only)
- Packages = Business logic
- Modules = Independent, composable domains

**Module Structure (flat-by-aggregate):**

- One business concept = one folder: `package/<module>/<aggregate>/`
  (e.g. `billing/subscription/`, `identity/user/`)
- Co-locate **production** code by aggregate: `.entity.ts`, `.repository.ts`,
  `.service.ts`, `.controller.ts` or `.resolver.ts`, `.types.ts`, `.dto.ts`
- Unit tests: `package/<module>/<aggregate>/__test__/<file>.spec.ts`
- Package root: `<module>.module.ts`, `<module>.facade.ts`, `config.ts`,
  `index.ts` (facade + module exports only)
- Shared infra only: `shared/persistence/` — no business repos

**10 Key Principles:**

1. Well-defined boundaries | 2. Composability | 3. Independence | 4. Individual
scale | 5. Explicit communication | 6. Replaceability | 7. Deployment
independence | 8. State isolation ⚠️ | 9. Observability | 10. Fail independence

### Progressive Documentation Loading

**CRITICAL**: Only load documents relevant to your current task. Do NOT load all
documentation at once.

| Task | Read |
| --- | --- |
| New entity or migration | `docs/coding-patterns.md` (entity naming) |
| New controller/service/repository | `docs/coding-patterns.md` |
| External API, third-party client | `docs/integration-patterns.md` |
| Logging, metrics, circuit breakers | `docs/integration-patterns.md` |
| Create/evaluate a module, boundaries, compliance | `modular-architecture` skill |
```

What makes that example work — reproduce these properties, not the content:

- **Concrete paths and suffixes**, not adjectives. `package/<module>/<aggregate>/`
  is checkable; "keep modules cohesive" is not.
- **The routing table is the payload.** It converts "read the architecture docs"
  into "on *this* task, open *that* file."
- **It defers to enforcement that already exists.** Where a skill or a lint rule
  owns a topic, the block points at it instead of restating it.
- **Numbered principles are a mnemonic**, not an essay — one line, expanded in
  `docs/` if they need expanding.

**Delegate, don't duplicate.** If the project has an architecture skill (e.g.
`modular-architecture`) or a dependency-cruiser config, name it and stop. The
sharpest form of this block is the shortest one that routes correctly.

### Sharding: one `docs/` file per aspect, by scope

The block above is only half the work. **Always** create the granular `docs/`
files it routes to — a block pointing at files that don't exist is a broken
index, and one giant `docs/architecture.md` defeats on-demand loading.

Split by *aspect and scope*, so a task loads one file and not five. Typical cut
for a layered/modular codebase (adapt names to the project's vocabulary):

| File | Scope — one concern |
| --- | --- |
| `docs/coding-patterns.md` | Repository pattern, lean controllers, transactions, entity naming, state isolation |
| `docs/integration-patterns.md` | External clients, injection, logging, metrics, circuit breakers, events |
| `docs/module-structure.md` | Folder layout, file suffixes, co-location, where a new file goes |
| `docs/persistence.md` | Migrations, datasource, connection handling |
| `docs/testing.md` | Unit-test placement and conventions |

Rules for the shard: one concern per file (if its purpose needs "and", split it);
every file has exactly one trigger in the routing table; no file restates what a
linter, an arch rule, or an existing skill already enforces. Use
`assets/docs-rule.template.md` as the skeleton.

---

## Block 3 — General rules (always)

Two sections, appended near the end of `AGENTS.md`. The first is **always
present**; only the commands inside it change per project.

### "Writing implementation plans" — mandatory, commands adapted

Copy the wording; replace the commands with the ones this project actually runs.
Never ship the example's `nx`/`yarn` commands into a project that uses something
else — a wrong command is worse than no command.

```markdown
## General Rules

### Writing implementation plans

Remember that you are writing high quality and maintainable code while avoiding
overengineering. You must be pragmatic and follow the guidelines in the docs
first before blindly following industry standards.

Implementation plans should always include build and lint and e2e tests when
necessary. To run build add `<build cmd>` and `<lint cmd>` and `<e2e cmd>`.

### Implementation and Testing

IMPORTANT: always include e2e tests to cover important paths. You should always
make sure that the plans include a test suite that covers the happy paths and
edge cases. Your tests should be high quality and give confidence while covering
most of the implementation.
```

Command substitution, by what step 2's research found:

| Project shape | `<build cmd>` | `<lint cmd>` | `<e2e cmd>` |
| --- | --- | --- | --- |
| Nx monorepo | `nx build <packageName>` | `nx lint:check <packageName>` | `yarn test:e2e <packageName>` |
| pnpm workspace | `pnpm --filter <pkg> build` | `pnpm --filter <pkg> lint` | `pnpm --filter <pkg> test:e2e` |
| Single npm package | `npm run build` | `npm run lint` | `npm run test:e2e` |
| Python | `uv build` / `python -m build` | `ruff check .` | `pytest tests/e2e` |
| .NET | `dotnet build` | `dotnet format --verify-no-changes` | `dotnet test tests/E2E` |

Use the *real* script names from `package.json` / `pyproject.toml` / CI — verify
they exist before writing them. **Drop the e2e clause only when the project has no
e2e suite at all**; keep build and lint always. If e2e is absent, say so in your
report rather than silently inventing a target.

### "Implementation and Testing" — keep when e2e is meaningful

Ship it verbatim when the project has (or should have) e2e coverage. For a
library or CLI with no e2e layer, keep the section but narrow the first sentence
to the suite that does exist — don't demand a test type the project can't run.

---

## Interaction with the audit

After writing all three blocks, run the audit and expect these to still hold:

```bash
python3 <skill-dir>/scripts/audit_rules.py <repo-path>
```

- **No broken pointers.** Every memory-contract path and every routing-table
  target exists.
- **Still small.** These blocks are why the `docs/` layer exists — if `AGENTS.md`
  crossed ~150 lines, the depth belongs in `docs/`, not the always-loaded file.
- **No vague-language flags.** "Remember that you are writing high quality and
  maintainable code" reads close to the banned phrasing, but it earns its place
  because the next clause is concrete ("follow the guidelines in the docs first")
  and it is followed by exact commands. If the audit flags a line you wrote, it's
  because the concrete part is missing — add it.
