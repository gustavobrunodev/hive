# AGENTS.md Guide: format, sections, sizing, nesting

Read this when writing or trimming the always-loaded `AGENTS.md`. It assumes
you've already researched the project (`research-playbook.md`) and triaged what
deserves to be a rule (`principles-and-evidence.md`).

## What AGENTS.md is

A plain-Markdown "README for agents" at the repository root: a predictable place
agents look for build/test commands, conventions, and constraints they can't
infer. It's an open standard (stewarded under the Linux Foundation's Agentic AI
Foundation) read by 20+ tools including Cursor, Codex, Copilot coding agent,
Gemini CLI, Jules, Aider, Zed, and OpenCode.

Format facts that matter:

- **No required schema.** Standard CommonMark Markdown; use whatever headings
  help. Agents just parse the text.
- **Location & precedence.** Root file applies project-wide. You may place more
  files in subdirectories; the **closest file to the edited code wins**, and a
  user's chat prompt overrides everything.
- **Size cap (real constraint).** Some tools cap the *combined* size of all
  discovered AGENTS.md files — Codex truncates at **32 KiB by default, silently**.
  This is another reason to keep it lean and push detail into on-demand `docs/`.
- **Optional frontmatter exists but isn't required.** A v1.1 proposal adds
  optional `description`/`tags` frontmatter for progressive disclosure; don't
  rely on it. Plain Markdown is the safe, universal choice.

## The high-value sections

GitHub's 2,500-repo analysis found the same handful of sections in top-tier
files. Treat these as a *menu*, not a checklist — include a section only if you
have non-inferable content for it. Order the most-used commands early; agents
reference them constantly.

1. **One-line project/stack context** *(optional, ≤2 lines).* Only the part the
   agent can't cheaply infer — e.g. an unusual architecture or a version
   constraint. Skip a generic "this is a web app" sentence.
2. **Commands.** The highest-value section. Exact, copy-pasteable, *with flags*:
   build, dev/run, test (suite **and** single test), lint, format, typecheck.
   Names like "use Jest" are not enough — give the literal command.
3. **Testing.** Only non-obvious rules: required setup (e.g. "start the DB with
   `docker compose up -d db` first"), what to mock vs. not, where tests live, how
   to run one. Skip "write tests for new code" unless that's genuinely a project
   norm worth stating.
4. **Code style — exceptions only.** *Only* conventions that differ from defaults
   and that the linter/formatter does **not** already enforce. If Prettier/Ruff
   handles it, say nothing. A 3–10 line snippet beats prose.
5. **Boundaries.** The most consistently helpful content. What to never touch
   (generated dirs, `vendor/`, secrets, `.env`, production configs) and what to
   ask before doing. A three-tier framing — **Always / Ask first / Never** — is
   clear and compact.
6. **Git / PR workflow** *(if non-standard).* Branch naming, commit format
   (e.g. Conventional Commits), merge strategy, pre-PR checks. Skip if it's
   ordinary.
7. **The `docs/` index.** A short pointer list into the on-demand layer (see
   `progressive-rules.md`). This is what makes specialized rules discoverable
   without loading them.

## Sizing

- **Target under ~150 lines.** A hard sniff test: **if AGENTS.md is longer than
  the README, it's almost certainly too long.** Past ~300 lines you're very
  likely net-negative.
- Length is a *symptom*, not the disease — the disease is low-signal content.
  Don't pad to look thorough; don't keep a line you can't justify with the
  inference test. When torn between two phrasings, pick the shorter.

## Writing style that performs

- **Imperative and concrete.** "Run X", "Never edit Y", "Import Z from W."
- **Commands with flags, verbatim.** `pytest -q tests/unit`, not "run the unit
  tests."
- **Snippets over prose for style.** Show the pattern; don't describe it.
- **Pair every "don't" with a "do."** "Don't use `fetch` directly; use the
  `apiClient` wrapper in `src/lib/api.ts`."
- **No duplication.** Link to the README/CONTRIBUTING/docs instead of restating.
- **No filler.** Cut "this project values quality" and similar.

## Worked contrast

**Bloated / net-negative (don't):**
```markdown
# AGENTS.md
This project is a modern web application built with React, a popular JavaScript
library for building user interfaces. We care deeply about code quality and
maintainability. The source code lives in the src directory. To install
dependencies, run npm install. We use Prettier to keep our code nicely
formatted, and ESLint to catch problems. Please write clean, readable code and
follow our established conventions and best practices...
```
Nearly every line fails the inference test: the stack is in `package.json`, the
folder layout is self-evident, the formatter enforces formatting, and "write
clean code" is unactionable.

**Minimal / high-signal (do):**
```markdown
# AGENTS.md

## Commands
- Install: `pnpm install`   # never `npm` — it corrupts the lockfile
- Dev: `pnpm dev`
- Test (all): `pnpm test`
- Test (one): `pnpm vitest run path/to/file.test.ts`
- Lint/format/types: `pnpm check`  # runs eslint + prettier + tsc

## Boundaries
- Never edit `src/generated/**` (regenerated from the OpenAPI spec).
- Never commit `.env*`.

## Conventions (non-default)
- All API calls go through `src/lib/api.ts`; do not call `fetch` directly.

## Specialized rules — load when relevant
- Database & migrations → read `docs/database.md`
- Auth & sessions → read `docs/auth.md`
```

## Nesting & monorepos

Agents read the nearest file and the closest wins, so in a monorepo with
genuinely different conventions per package, place a small `AGENTS.md` *inside
each package* and keep the root file to what's truly shared. (Large OpenAI repos
ship dozens of nested AGENTS.md files this way.) This is itself a form of
progressive disclosure: an agent working in `packages/api/` automatically gets
that package's rules and not the frontend's. Don't nest preemptively — only when
two areas actually diverge.

## Backward compatibility

If a tool-specific file already exists and you're consolidating onto AGENTS.md,
you can keep older tools working by making the legacy filename a **symlink** to
`AGENTS.md` (e.g. `ln -s AGENTS.md CLAUDE.md`) rather than maintaining two copies
that drift apart. See `tool-compatibility.md` for per-tool specifics and
precedence.
