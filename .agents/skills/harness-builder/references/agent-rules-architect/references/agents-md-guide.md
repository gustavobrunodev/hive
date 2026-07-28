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
- **Language.** Write the file in **Brazilian Portuguese (pt-BR)** by default —
  headings and prose included (e.g. `## Comandos`, `## Limites`, `## Convenções`,
  `## Regras especializadas`). Commands, code, paths, and flags stay verbatim.
  See "Language" in `SKILL.md` step 1 for the improve-existing-file exception.

## The high-value sections

GitHub's 2,500-repo analysis found the same handful of sections in top-tier
files. Treat these as a *menu*, not a checklist — include a section only if you
have non-inferable content for it. Order the most-used commands early; agents
reference them constantly.

**Exception — three blocks are not on the menu.** The memory contract (top of
file), architecture principles (only when the project has them), and general
rules (end of file) go in regardless. See `mandatory-blocks.md`; the ordering is
memory contract → the menu sections below → architecture principles → `docs/`
index → general rules.

1. **One-line project/stack context** *(optional, ≤2 lines).* Only the part the
   agent can't cheaply infer — e.g. an unusual architecture or a version
   constraint. Skip a generic "this is a web app" sentence.
2. **Commands.** The highest-value section. Exact, copy-pasteable, *with flags*:
   build, dev/run, test (suite **and** single test), lint, format, typecheck.
   Names like "use Jest" are not enough — give the literal command.
3. **Testing.** Only non-obvious rules: required setup (e.g. "start the DB with
   `docker compose up -d db` first"), what to mock vs. not, where tests live, how
   to run one. Skip "write tests for new code" unless that's genuinely a project
   norm worth stating. If an e2e framework (Playwright, Cypress, …) is present,
   keep only a one-line pointer here (`Escrevendo testes e2e → ler
   \`e2e/AGENTS.md\``) and push the depth into a **nested `AGENTS.md` + `docs/`
   at the e2e root** (see `progressive-rules.md`).
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
- **The mandatory blocks cost ~40 lines together** — that's the budget they're
  designed for. If they push you over ~150, the fix is never to drop them: it's
  that the architecture block is explaining instead of routing, or a menu section
  is carrying detail that belongs in `docs/`. Shard, don't cut.

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
Este projeto é uma aplicação web moderna construída com React, uma biblioteca
JavaScript popular para construir interfaces de usuário. Nós nos preocupamos
profundamente com qualidade e manutenibilidade de código. O código-fonte vive
na pasta src. Para instalar as dependências, rode npm install. Usamos Prettier
para manter nosso código bem formatado, e ESLint para pegar problemas. Por
favor escreva código limpo e legível e siga nossas convenções e boas práticas
estabelecidas...
```
Quase toda linha falha no teste de inferência: o stack está no `package.json`,
a estrutura de pastas é autoevidente, o formatter já força a formatação, e
"escreva código limpo" não é acionável.

**Minimal / high-signal (do):**
```markdown
# AGENTS.md

## Comandos
- Instalar: `pnpm install`   # nunca `npm` — corrompe o lockfile
- Dev: `pnpm dev`
- Testes (todos): `pnpm test`
- Testes (um só): `pnpm vitest run path/to/file.test.ts`
- Lint/format/types: `pnpm check`  # roda eslint + prettier + tsc

## Limites
- Nunca editar `src/generated/**` (regenerado a partir do spec OpenAPI).
- Nunca commitar `.env*`.

## Convenções (fora do padrão)
- Toda chamada de API passa por `src/lib/api.ts`; não chamar `fetch` direto.

## Regras especializadas — carregar quando aplicável
- Banco de dados e migrations → ler `docs/database.md`
- Auth e sessões → ler `docs/auth.md`
```

## Nesting & monorepos

Agents read the nearest file and the closest wins, so in a monorepo with
genuinely different conventions per package, place a small `AGENTS.md` *inside
each package* and keep the root file to what's truly shared. (Large OpenAI repos
ship dozens of nested AGENTS.md files this way.) This is itself a form of
progressive disclosure: an agent working in `packages/api/` automatically gets
that package's rules and not the frontend's. Don't nest preemptively — only when
two areas actually diverge.

Treat this as an active check during research (see "Repo shape" and "Monorepo
note" in `research-playbook.md`), not something to reach for only if the user
asks: walk every module/app/package and ask whether its commands, stack, or
conventions actually differ from its siblings. If yes, give it its own
`AGENTS.md` in its own folder; if a module has nothing that diverges, don't
create one just for symmetry.

## Backward compatibility

If a tool-specific file already exists and you're consolidating onto AGENTS.md,
you can keep older tools working by making the legacy filename a **symlink** to
`AGENTS.md` (e.g. `ln -s AGENTS.md CLAUDE.md`) rather than maintaining two copies
that drift apart. See `tool-compatibility.md` for per-tool specifics and
precedence.
