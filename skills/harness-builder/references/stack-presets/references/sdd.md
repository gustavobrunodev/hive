# SDD baseline — `tlc-spec-driven`

**Applies to:** any project (spec-driven development is stack-agnostic).
**Install only if:** the project has **no SDD tool already**.

## Detect an existing SDD tool (if any is found, do NOT install)

- A spec-driven skill already installed — any of `tlc-spec-driven`,
  `spec-driven*`, `spec-kit`, `specify`, `kiro`, `openspec` under
  `.cursor/skills/`, `.agents/skills/`, `.claude/skills/`, or listed in
  `skills-lock.json`.
- SDD tooling/config in the repo: `.specify/` (GitHub Spec Kit), `.kiro/`
  (Kiro), `openspec/` (OpenSpec), `.spec/`, or a `specs/` directory with a
  spec-driven structure.
- A documented SDD workflow already in `AGENTS.md` / `CLAUDE.md` / README.

If any of the above exists → report **"SDD tool already present"** and stop.

## The baseline

- **Skill:** `tlc-spec-driven` — Tech Lead's Club spec-driven development. Four
  adaptive phases (Specify → Design → Tasks → Execute), auto-sized by
  complexity, atomic commits, persistent state across sessions. Stack-agnostic.
- **Source:** `tech-leads-club/agent-skills` (GitHub).

## Install (project-level, only if missing)

```bash
npx skills add tech-leads-club/agent-skills --skill tlc-spec-driven -y
```

Global alternative (all of this user's projects): add `-g`.
