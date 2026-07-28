# The memory contract: STATE, LESSONS, ROADMAP

Read this from `sdd.md` step 4. It defines the one block every project's
`AGENTS.md` must carry, how to resolve its paths in each branch, and what to
scaffold when nothing exists yet.

## Why this block exists

An agent starts every session with no memory. Without a single, named file it is
told to read first, it re-derives decisions that were already made, re-hits
blockers that were already solved, and repeats mistakes the team already paid
for. One always-loaded pointer to one living file fixes that at a cost of ~8
lines — the highest signal-per-token content in the whole file.

Three concerns, one file each (or fewer, if the project's tool already merges
them):

| Concern | What lives there |
| --- | --- |
| **STATE / memory** | Decisions taken (and why), open blockers, lessons that keep recurring. Read at the start of every session, appended during work. |
| **ROADMAP** | Milestones — what's done, what's next, in what order. |
| **PROJECT** | Vision, goals, non-goals — the "why" that keeps scope honest. |
| **Feature specs** | Per-feature requirements, design, tasks. |

Lessons may be their own file (`LESSONS.md`) when the tool separates them; when
it doesn't, they live inside STATE. Either is fine — what matters is that
`AGENTS.md` names the file the agent must read first.

## The canonical block

This is branch A verbatim (tlc-spec-driven). Paste it as-is; substitute paths
only in branches B and C.

```markdown
Decisões, blockers e lições que se repetem
vivem em `.specs/project/STATE.md` — **leia no início de cada sessão**.

## Onde está o resto

- `.specs/project/PROJECT.md` — visão, goals e não-goals.
- `.specs/project/ROADMAP.md` — marcos.
- `.specs/project/STATE.md` — memória viva (decisões + lições) — **leia antes de começar**.
- `.specs/features/` — specs por feature (requisitos, design, tasks).
```

Rules for the block, in every branch:

- **Placement:** near the top of `AGENTS.md`, before the on-demand `docs/` index.
  It's the first thing the agent should act on.
- **Every path must resolve.** A pointer to a file that doesn't exist is worse
  than no pointer — `audit_rules.py` fails on it. Create the file (even as a
  stub with its headings) or drop the line.
- **Keep the bold imperative.** "**leia no início de cada sessão**" is what makes
  the agent actually open the file. Don't soften it into a description.
- **Don't summarize the files here.** One line each. The content lives in the
  files; this block is awareness only.

## Branch A — `tlc-spec-driven` (the default outcome)

This is where most projects land: either the skill was already installed, or
step 3 just installed it as the org default. Use the canonical block
**unchanged**. The paths are the skill's own contract:

| Path | Role |
| --- | --- |
| `.specs/project/STATE.md` | Decision log + lessons (memória viva) |
| `.specs/project/PROJECT.md` | Vision, goals, non-goals |
| `.specs/project/ROADMAP.md` | Milestones |
| `.specs/features/` | Per-feature requirements, design, tasks |

If the skill was just installed and hasn't run yet, those files may not exist.
Create them as stubs (see the scaffold below) so the pointers resolve — the skill
fills them on first use.

## Branch B — another SDD tool is already present

**Search first.** Map the tool's native files onto the four roles, then write the
block pointing at *those* paths. Known conventions:

| Tool | STATE / memory | ROADMAP | PROJECT / vision | Feature specs |
| --- | --- | --- | --- | --- |
| **GitHub Spec Kit** (`.specify/`) | — (usually none) | `.specify/memory/constitution.md` is principles, not milestones | `.specify/memory/constitution.md` | `specs/<nnn-feature>/spec.md`, `plan.md`, `tasks.md` |
| **Kiro** (`.kiro/`) | `.kiro/steering/*.md` | — | `.kiro/steering/product.md` | `.kiro/specs/<feature>/requirements.md`, `design.md`, `tasks.md` |
| **OpenSpec** (`openspec/`) | `openspec/project.md` | — | `openspec/project.md` | `openspec/changes/<id>/`, `openspec/specs/` |
| **BMAD Method** | `_bmad/` or `docs/` state files, sprint status | `docs/epics.md`, sprint plan | `docs/prd.md`, product brief | `docs/stories/<story>.md` |
| **Taskmaster** (`.taskmaster/`) | `.taskmaster/state.json` (machine-readable) | `.taskmaster/tasks/` | PRD in `.taskmaster/docs/` | `.taskmaster/tasks/` |

This table is a starting point, not an authority — **verify against the repo**.
Read the tool's own skill/config and list what's actually there before writing a
path down.

Then:

- **Role covered by the tool → link to the tool's file.** Do not create a parallel
  file. Keep the tool's naming; only the block's wording is yours.
- **Role *not* covered → create it**, using the scaffold below, and place it where
  the tool's files already live (e.g. `.kiro/steering/STATE.md`,
  `openspec/ROADMAP.md`) so the project keeps one home for this material.

Most existing tools cover specs and some notion of project vision but have **no
living memory file** — that gap is the common case, and filling it is the whole
point of this step.

## Branch C — no SDD tool (the user declined the install)

Rare: `tlc-spec-driven` is installed by default, so you only get here when the
user explicitly turned it down. Honor that — don't re-propose it — and give the
project the same behaviour by other means.

**Search first**, same discipline. The project may already keep this material
under different names:

- `DECISIONS.md`, `docs/decisions/`, `docs/adr/`, `adr/` → the ADR pattern is a
  legitimate decision log. Point STATE at it (or at an index of it).
- `LESSONS.md`, `RETROSPECTIVE.md`, `docs/learnings.md` → lessons.
- `ROADMAP.md`, `docs/roadmap.md`, a GitHub Projects board documented in the
  README, `MILESTONES.md` → roadmap.
- `PROJECT.md`, `VISION.md`, `docs/product/`, the README's "why" section →
  project vision. A good README section is enough; link to it with an anchor
  rather than duplicating it into a new file.
- `docs/specs/`, `docs/features/`, `docs/rfcs/` → feature specs.

Whatever you find, **link it** — do not create a competing file. Only what's
genuinely missing gets scaffolded, and it gets the same behaviour the
tlc-spec-driven layout gives: one memory file read at session start, one roadmap,
one vision doc, one place for feature specs.

## The fallback scaffold (branches B and C, missing roles only)

Default location when the project has no existing home for this material:
`.specs/project/` and `.specs/features/` — the same layout as branch A, so the
project can adopt `tlc-spec-driven` later without moving anything. If the project
already documents in `docs/`, put them in `docs/project/` instead and keep the
block's paths in sync.

Copy from `../assets/memory-scaffold/`:

| Asset | Creates |
| --- | --- |
| `STATE.md` | Decision log + blockers + recurring lessons, with the append format |
| `PROJECT.md` | Vision, goals, non-goals |
| `ROADMAP.md` | Milestones |

Create `.specs/features/` (or the chosen equivalent) as an empty directory with a
`.gitkeep`, or point the block at the directory only once a first spec exists —
never leave a dangling path.

Fill the stubs with what you can *evidence* from the repo (README, existing docs,
git history, open issues) and mark the rest `<a preencher>`. Do not invent goals,
decisions, or milestones — an invented decision log is worse than an empty one,
because the agent will treat it as fact.

## Verify

After writing the block, confirm:

```bash
python3 ../agent-rules-architect/scripts/audit_rules.py <repo-path>
```

Every path in the block must resolve (the audit reports broken pointers as
`ERROR`), and `AGENTS.md` must still be under the size targets.
