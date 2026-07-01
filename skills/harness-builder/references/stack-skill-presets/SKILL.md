---
name: stack-skill-presets
description: Org baseline skills that must exist in every project, mapped by stack. Ensures the mandatory skill for each detected stack (React, Angular, .NET) is installed when missing, plus a spec-driven-development skill when no SDD tool is present. Progressive — loads only the reference matching the detected stack. Use during harness setup (the /build-harness Phase 3) or whenever standardizing a project's baseline skills.
---

# Stack skill presets (org baseline)

Every project the squads own must carry the organization's **baseline skills**
for its stack. This skill ensures those baselines are present — installing the
missing ones, idempotently — without overengineering.

Two hard rules:

- **Progressive loading.** Detect the stack first, then read **only** the
  reference file(s) that match. Never load all of them. (React project → read
  only `references/frontend-react.md`; and so on.)
- **Idempotent & minimal.** Install a baseline **only if it's missing** from the
  project. If it's already there, report it and move on. Never install a stack's
  skill for a stack the project doesn't use.

## Baseline map

| Applies when… | Read only | Baseline skill | Condition |
|---|---|---|---|
| **Any project** (cross-cutting) | `references/sdd.md` | `tlc-spec-driven` | only if **no SDD tool** is already in the project |
| Frontend uses **React** | `references/frontend-react.md` | `vercel-react-best-practices` | if missing |
| Frontend uses **Angular** | `references/frontend-angular.md` | `angular-developer` (official) | if missing |
| Backend uses **.NET / C#** | `references/backend-dotnet.md` | `dotnet-best-practices` | if missing |

A project can match several rows (e.g. a React frontend + .NET backend → load
`frontend-react.md` **and** `backend-dotnet.md`, and always evaluate `sdd.md`).

## Procedure

1. **Get the stack.** Reuse the stack already detected in the harness assessment
   (the `/build-harness` Phase 1 inventory). If running standalone, detect it
   quickly from manifests (`package.json`, `*.csproj` / `*.sln`, `angular.json`).
2. **Select rows, load references progressively.** For each matching row, read
   **only** that reference file. Skip the rest — that is the whole point.
3. **Check presence (idempotency).** Each reference says how to detect whether its
   baseline is already installed. Look in the project's skill dirs
   (`.cursor/skills/`, `.agents/skills/`, `.claude/skills/`, `skills-lock.json`)
   and, for SDD, also for SDD tooling/config.
4. **Install only what's missing**, using the exact command in the reference.
   Default to a **project-level** install (the baseline travels with the repo).
   When running inside `/build-harness`, treat each install as a **proposed step
   to confirm**, not a silent edit.
5. **Report.** List what was already present, what you installed, and anything
   you deferred (with a one-line reason).

## Anti-overengineering

- Baselines are a **floor, not a catalog.** Don't add skills beyond the matched
  rows here — additional capability gaps are `find-skills`' job.
- Don't install a baseline "to be safe" for a stack the project doesn't use.
- If a baseline's exact package is ambiguous for this org, **ask once** rather
  than installing the wrong one.

## Reference files

Load only as the baseline map directs; never read them all up front.

- `references/sdd.md` — spec-driven-development baseline + how to detect an
  existing SDD tool.
- `references/frontend-react.md` — React baseline.
- `references/frontend-angular.md` — Angular baseline.
- `references/backend-dotnet.md` — .NET / C# baseline.
