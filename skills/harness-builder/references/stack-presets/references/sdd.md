# SDD baseline — `tlc-spec-driven` + the memory contract

**Applies to:** any project (spec-driven development is stack-agnostic).

This row produces **two** outputs, and the second one is unconditional:

1. **An SDD tool in place** — keep the one the project already has, otherwise
   install `tlc-spec-driven`, the org default.
2. **The memory contract in `AGENTS.md`** — a `STATE.md` the agent reads at the
   start of every session, plus the map to project vision, roadmap, and feature
   specs. This lands **in all three branches**, including the rare "no SDD tool."

Never skip step 4, even if the user declined the install. The tool has a default;
the memory contract has no opt-out.

## Step 1 — Detect an existing SDD tool

Look for any of:

- **An installed spec-driven skill** — `tlc-spec-driven`, `spec-driven*`,
  `spec-kit`, `specify`, `kiro`, `openspec`, `bmad*` under `.cursor/skills/`,
  `.agents/skills/`, `.claude/skills/`, or listed in `skills-lock.json` /
  `.skill-lock.json`.
- **SDD tooling/config in the repo** — `.specify/` (GitHub Spec Kit), `.kiro/`
  (Kiro), `openspec/` (OpenSpec), `.specs/` (tlc-spec-driven), `.spec/`,
  `bmad/` or `_bmad/` (BMAD Method), `.taskmaster/`, or a `specs/` directory
  with a spec-driven structure.
- **A documented SDD workflow** already in `AGENTS.md` / `CLAUDE.md` / README.

## Step 2 — Decide (no question; the outcome is determined)

| Detection result | What to do |
| --- | --- |
| **A tool is present** | **Keep it. Install nothing.** Report "SDD tool already present: `<name>`" and go to step 4 (branch B, or branch A if it *is* `tlc-spec-driven`). Never install a second SDD tool alongside an existing one. |
| **No tool found** | **Install `tlc-spec-driven`** — it's the org default, not a suggestion. Go to step 3. |

This row does **not** ask the user which SDD tool they want. Like every other
preset, it's the org's floor: an unmanaged project gets `tlc-spec-driven`, a
managed one keeps what it has.

Treat it as a **proposed step to confirm** inside `/build-harness` (the same as
any other install), not as an open question about *which* tool. The only way the
project ends up with no SDD tool is the user explicitly declining — that's
branch C in step 4, an exception you honor, not an option you offer.

**Why `tlc-spec-driven`:** Tech Lead's Club spec-driven development — four
adaptive phases (Specify → Design → Tasks → Execute) auto-sized by complexity,
atomic commits, an independent verifier, a persistent decision log (`STATE.md`),
and a lessons layer. Stack-agnostic, so it's safe as a universal default.

## Step 3 — Install (whenever no SDD tool was found)

Project-level (the baseline travels with the repo):

```bash
npx skills add tech-leads-club/agent-skills --skill tlc-spec-driven -y
```

Global alternative (all of this user's projects): add `-g`.

## Step 4 — The memory contract in `AGENTS.md` (always)

Read `sdd-memory-contract.md` for the block itself, the per-tool mapping table,
and the fallback scaffold. The branch you're in decides only *which paths* the
block names:

| Branch | Situation | Where the contract points |
| --- | --- | --- |
| **A** | `tlc-spec-driven` — already present, or just installed in step 3. **The common case.** | The canonical `.specs/…` paths, **verbatim** — no substitution, no invention. |
| **B** | Some other SDD tool is present | **First** find that tool's own convention for memory/state, lessons, and roadmap, and link to *those* files. Only if the tool has no such convention, create the equivalent structure. |
| **C** | No SDD tool, because the user explicitly declined the install | **First** find the project's own convention for the same three concerns and link to it. Only if it has none, create the equivalent structure. |

In branches B and C the rule is the same and the order matters: **search before
you scaffold.** Creating a second `STATE.md` next to a tool's existing memory
file is exactly the duplication that makes rule files hurt.

The block itself is written by `agent-rules-architect` (it owns `AGENTS.md`).
Hand it the resolved paths; don't hand-roll the file here.

## Report

State plainly: which branch you were in, what you installed (or why you didn't),
which memory/roadmap files the contract now points at, and which of those you
created versus found.
