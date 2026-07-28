# Tool Compatibility: per-tool specifics, precedence, migration

Read this when the user targets a specific agent, when multiple rule files
already coexist, or when migrating off a legacy format. The portable default —
root `AGENTS.md` + on-demand `docs/` — works everywhere; this doc is about
layering native features and avoiding conflicts.

## The portable baseline

`AGENTS.md` is read by 20+ tools (Cursor, Codex, Copilot coding agent, Gemini
CLI, Jules, Aider, Zed, Warp, RooCode, Devin, OpenCode, and more). If you only
produce a clean root `AGENTS.md` plus `docs/` referenced from its index, every
major agent benefits with zero tool-specific work. Add the below only as
enhancements.

## Cursor

- **Reads `AGENTS.md`** in the project root *and* nested subdirectories,
  automatically. Nested files combine with parents; more specific wins. Root
  behaves as global instructions.
- **Reads `CLAUDE.md`** the same way — and note: Cursor applies `CLAUDE.md` to
  **every** conversation regardless of any frontmatter. Don't keep both a
  `CLAUDE.md` and an `AGENTS.md` with overlapping content or you double-load;
  pick one as source of truth (symlink the other if needed).
- **`.cursor/rules/*.mdc`** are structured rules with three frontmatter fields —
  `description`, `globs`, `alwaysApply` — and content injected at the *start* of
  context. The four behaviors:

  | `alwaysApply` | `description` | `globs` | Behavior |
  |---|---|---|---|
  | `true` | — | — | Always included every session (globs/description ignored). |
  | `false` | — | set | **Auto-attached** when a file matching the glob is in context. |
  | `false` | set | — | **Agent-requested**: the description is shown to the agent, which pulls the rule in when relevant. *Description is required* or it never fires. |
  | `false` | — | — | **Manual**: only when `@rule-name` is mentioned. |

  `globs` are comma-separated, unquoted, in the canonical docs (e.g.
  `globs: src/api/**, src/server/**`). Rules apply only to Agent/Chat.

- **Using Cursor for native auto-loading of your `docs/` layer:** keep `docs/`
  files as the source of truth and add thin `.mdc` rules that `@`-reference them.
  Example `.cursor/rules/database.mdc`:

  ```markdown
  ---
  description: Rules for changing DB schema or writing migrations
  globs: src/db/**, migrations/**
  alwaysApply: false
  ---
  Follow @docs/database.md when modifying the schema or adding a migration.
  ```

  Now Cursor auto-attaches by path/description while other tools use the
  `AGENTS.md` index — one source of truth, two delivery mechanisms.
- **Best practices Cursor itself publishes:** keep rules under ~500 lines, split
  large rules into focused composable ones, reference files instead of copying
  (prevents staleness), avoid vague guidance, and add rules only when you see the
  agent repeat a mistake. This matches the minimalism mandate exactly.
- **Caveats to respect:** `.cursorrules` (single root file) is **legacy/being
  deprecated** — migrate it to `.cursor/rules/*.mdc` (Always Apply) or fold it
  into `AGENTS.md`. Nested `.cursor/rules/` *directories* in subpackages are
  **not reliably supported in current docs** — prefer root rules with `globs`, or
  nested `AGENTS.md`, for subdirectory scoping. Precedence between `AGENTS.md` and
  `.cursor/rules` is **not documented**; they're merged, so don't make them
  conflict.

## Claude Code

- Reads **`CLAUDE.md`** (project root, and `~/.claude/CLAUDE.md` for personal
  global rules). Supports `@path` **imports** (up to ~4 hops) and a
  `CLAUDE.local.md` for personal, gitignored overrides.
- Has first-class **Agent Skills** (`.claude/skills/*/SKILL.md`) — for
  *specialized workflows*, a Skill is often a better home than a context-file
  section. Keep `CLAUDE.md` minimal and push workflows into Skills.
- Cross-compat: since several tools (incl. Cursor and OpenCode) also read
  `CLAUDE.md`, and Claude Code reads `AGENTS.md` in current versions, prefer a
  single `AGENTS.md` and symlink `CLAUDE.md → AGENTS.md` if you need both names.

## Codex (OpenAI)

- Reads **`AGENTS.md`**, merged root-to-cwd. Enforces a **32 KiB default cap** on
  the *combined* size of discovered files — **truncated silently** past that.
  This is a hard reason to keep the always-loaded layer small and push detail
  into on-demand `docs/`.
- Supports **`AGENTS.override.md`** for local, uncommitted overrides.

## GitHub Copilot coding agent

- Reads **`AGENTS.md`**; also supports `.github/copilot-instructions.md`. If both
  exist, avoid divergence — keep one canonical source.

## OpenCode

- Reads both **`AGENTS.md`** and **`CLAUDE.md`** (AGENTS.md takes priority, then
  CLAUDE.md, then deprecated `CONTEXT.md`), with hierarchical discovery from cwd
  up to the worktree root plus a global `~/.config/opencode/AGENTS.md`.
- Discovers **Skills** in `.claude/skills/`, `.agents/skills/`, and
  `.opencode/skills/` — a skill written for Claude Code works as-is.
- Implements the lazy-loading of nested `AGENTS.md` described above: a
  subdirectory's file is injected when the agent reads a file there.

## General precedence model

Across tools the consistent rules are: **the closest file to the edited code
wins**, and **an explicit user chat prompt overrides any file**. Where a tool
layers its own sources (e.g. Cursor's Team → Project → User rules), more-specific
/ higher-trust sources win and everything applicable is merged. When precedence
is undocumented (e.g. `AGENTS.md` vs `.cursor/rules`), assume *merge* and simply
don't author conflicting instructions.

## Consolidation & migration recipes

- **Many tool-specific files exist →** pick `AGENTS.md` as the canonical source,
  move the genuinely useful (non-inferable) content into it, and replace the
  others with **symlinks** (`ln -s AGENTS.md CLAUDE.md`) so no copy drifts.
- **Legacy `.cursorrules` →** migrate content into `.cursor/rules/*.mdc` (set
  Always Apply to match old behavior) or into `AGENTS.md`, then delete it.
- **Oversized single file →** split: keep the always-relevant minimum in
  `AGENTS.md`, move specialized sections into `docs/` with an index (see
  `progressive-rules.md`). This both fixes bloat and respects size caps.

When unsure whether a tool supports something, prefer the portable baseline and
note the tool-specific enhancement as optional — never make the result depend on
an undocumented behavior.
