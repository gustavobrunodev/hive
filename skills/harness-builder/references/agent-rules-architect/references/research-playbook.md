# Research Playbook: discover before you write

Minimal, accurate rules are impossible to write by guessing. This is the step
that separates a context file that helps from one that hurts: you're hunting for
the *real* commands and the *non-obvious* conventions, and — just as important —
cataloguing what's **already documented** so you never duplicate it.

Work mostly read-only. Prefer reading config and CI files over assuming. Where
practical, verify a command actually exists before writing it down (a wrong
command is worse than no command).

## What you're trying to walk away with

A short, factual inventory:

1. **Stack & versions** — languages, frameworks, runtime/version pins, package
   manager.
2. **Commands that work** — install, build, dev/run, test (whole suite *and* a
   single test/file), lint, format, typecheck. Exact strings, with flags.
3. **What's already enforced** — formatter/linter and their configs (so you
   restate *nothing* they cover).
4. **Boundaries** — generated/vendored dirs, secrets, anything destructive or
   off-limits.
5. **Non-obvious constraints** — setup steps tests need, architectural rules a
   newcomer would get wrong, gotchas.
6. **Existing docs & rule files** — README, CONTRIBUTING, `docs/`, and any
   current `AGENTS.md`/`CLAUDE.md`/`.cursorrules`/`.cursor/rules`. These are both
   *sources* and *things not to duplicate*.
7. **Repo shape** — monorepo vs single package; where the real subprojects live
   (this decides whether you need nested files).

## A fast, reliable order of operations

1. **List the root and map the tree.** Identify manifest files, config files, CI
   directories, and whether it's a monorepo (workspaces, `packages/`, multiple
   manifests).
2. **Read the manifests** for the stack, versions, and especially the **scripts /
   task definitions** — these usually *are* the real commands.
3. **Read the CI config** (`.github/workflows/`, `.gitlab-ci.yml`, etc.). CI is
   the source of truth for how the project is *actually* built and tested — it
   won't lie the way a stale README might.
4. **Read tool configs** to learn what's already enforced (linters, formatters,
   type checkers, test runners, pre-commit hooks).
5. **Skim existing docs and rule files.** Note what's covered so you can
   reference rather than repeat, and salvage any genuinely useful non-obvious
   facts.
6. **Sample the code** only as needed to confirm a convention before encoding it
   (e.g. open 2–3 representative files to verify an actual pattern).

Searching tips: grep for script names and command strings across the repo to see
how things are really invoked; look at `Makefile`/`Justfile`/`Taskfile` targets;
check pre-commit configs for the canonical lint/format commands.

## Ecosystem cheat-sheet

Use this to know where to look and what the *typical* real commands are — but
always confirm against the repo's own scripts/CI rather than pasting defaults.

### Node / JavaScript / TypeScript
- **Manifests/locks:** `package.json`; lockfile reveals the package manager —
  `package-lock.json`→npm, `pnpm-lock.yaml`→pnpm, `yarn.lock`→yarn,
  `bun.lockb`→bun. **Match the lockfile**; using the wrong manager is a classic
  agent mistake worth a boundary.
- **Commands:** look in `package.json` "scripts" first (`build`, `dev`, `test`,
  `lint`, `format`, `typecheck`). Monorepos: `workspaces` field, `pnpm-workspace.yaml`,
  Nx/Turbo configs.
- **Enforced by tooling:** ESLint (`.eslintrc*`, `eslint.config.*`), Prettier
  (`.prettierrc*`), TypeScript (`tsconfig.json`). Don't restate their rules.
- **Single test:** e.g. `vitest run path/to/file.test.ts`, `jest path -t "name"`.

### Python
- **Manifests:** `pyproject.toml` (PEP 621 / Poetry / uv / Hatch), `setup.cfg`,
  `requirements*.txt`, `Pipfile`. Tool choice matters: `uv.lock`→uv,
  `poetry.lock`→Poetry. Using the wrong installer is a common, worth-noting trap.
- **Commands:** `pytest` (single: `pytest path::TestClass::test_name`), build via
  `python -m build`/`uv build`, run via the project's entrypoint.
- **Enforced by tooling:** Ruff (`ruff.toml`/`[tool.ruff]`), Black, isort, mypy
  (`[tool.mypy]`), flake8. Restate none of their formatting/lint specifics.

### Go
- **Manifests:** `go.mod`/`go.sum`. **Commands:** `go build ./...`,
  `go test ./...` (single: `go test ./pkg -run TestName`), `go vet`,
  `gofmt`/`golangci-lint`. Most style is enforced by `gofmt` — don't restate it.

### Rust
- **Manifests:** `Cargo.toml`/`Cargo.lock`; workspaces via `[workspace]`.
- **Commands:** `cargo build`, `cargo test` (single: `cargo test name`),
  `cargo clippy`, `cargo fmt`. Formatting/lint enforced by fmt/clippy.

### Java / Kotlin / JVM
- **Manifests:** `pom.xml` (Maven), `build.gradle(.kts)` (Gradle),
  `settings.gradle` for multi-module. **Commands:** `mvn test`/`./gradlew test`
  (single via `-Dtest=...` / `--tests ...`), build via `package`/`build`.

### Ruby
- **Manifests:** `Gemfile`/`.gemspec`. **Commands:** `bundle exec rspec [path:line]`,
  `bundle exec rake`, RuboCop for lint/format.

### PHP
- **Manifests:** `composer.json`. **Commands:** `composer test`/`./vendor/bin/phpunit`,
  PHP-CS-Fixer/PHPStan for style/static analysis.

### .NET / C#
- **Manifests:** `*.csproj`, `*.sln`, `Directory.Build.props`. **Commands:**
  `dotnet build`, `dotnet test --filter Name~...`, `dotnet format`.

### Other ecosystems / build orchestration
- **Make/Just/Task:** `Makefile`, `Justfile`, `Taskfile.yml` targets are often
  the canonical entrypoints regardless of language — check them.
- **Containers/infra:** `Dockerfile`, `docker-compose.yml` (often required for
  tests — a high-value non-obvious setup step), Bazel (`BUILD`, `WORKSPACE`).
- **Pre-commit:** `.pre-commit-config.yaml` lists the exact canonical
  lint/format commands the team relies on — excellent source.

## Distinguishing "rule" from "noise" while researching

As you gather, sort findings against the inference test (see
`principles-and-evidence.md`). A quick field guide:

- A command the agent would otherwise guess wrong (wrong runner, wrong manager,
  required flag, single-test syntax) → **keep**, it's high value.
- A formatting/style point already enforced by a tool → **drop**, the tool wins.
- A setup prerequisite without which tests/build fail confusingly → **keep**,
  often the single most valuable line in the file.
- A boundary (don't edit generated dir, don't commit secrets, don't touch
  `legacy/`) → **keep**, boundaries are top-leverage.
- An architecture description a reader could reconstruct from the tree → **drop**.
- A genuine non-obvious constraint ("module X must stay dependency-free", "all
  money values are integer cents") → **keep**.

## Monorepo note

If there are multiple real subprojects with *different* conventions, plan for
**nested `AGENTS.md`** in each subproject rather than cramming everything into the
root (agents read the nearest file; the closest wins). Keep the root file to
what's truly shared. See `references/agents-md-guide.md` for nesting mechanics.

## Output of this step

A tight written inventory (the seven items above) that feeds triage. You are now
equipped to decide, per item, whether it survives the inference test and whether
it belongs in the always-loaded `AGENTS.md` or an on-demand `docs/` file.
