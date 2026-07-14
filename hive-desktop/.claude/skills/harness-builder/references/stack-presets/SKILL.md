---
name: stack-presets
description: Org baseline ai-tools (skills + MCPs) that every project should carry, mapped by stack. Ensures the mandatory skills for each detected stack (React, Angular, .NET) plus the frontend MCP set (Figma, Playwright, Chrome DevTools) are installed when missing, and an SDD skill when no SDD tool is present. Progressive — loads only the reference matching the detected stack. Use during harness setup (the /build-harness Phase 3a) or whenever standardizing a project's baseline ai-tools.
---

# Stack presets (org ai-tool baseline)

Every project the squads own carries the organization's **baseline ai-tools** for
its stack — a company-standard, pre-selected set of **skills + MCPs**. This module
ensures those presets are present, installing the missing ones idempotently,
without overengineering.

An **ai-tool** here is either a **skill** (installed via `npx skills add`) or an
**MCP server** (configured in `.mcp.json`). A stack preset bundles both.

> **Not a harness template.** A *harness template* (see
> `../harness-engineer/references/harness-model.md`) is a topology-scoped bundle of
> **guides + sensors** that leashes an agent to a service topology. Stack presets
> are a narrower, orthogonal thing: the **tooling floor** keyed by *stack*, not
> topology. Presets are one input a harness template would bundle — keep the terms
> distinct.

Two hard rules:

- **Progressive loading.** Detect the stack first, then read **only** the
  reference file(s) that match. Never load all of them. (React project → read
  only `references/frontend-react.md`; and so on.)
- **Idempotent & minimal.** Install a preset item **only if it's missing** from
  the project. If it's already there, report it and move on. Never install a
  stack's tools for a stack the project doesn't use.

## Baseline map

| Applies when… | Read only | Baseline skills | Baseline MCPs |
|---|---|---|---|
| **Any project** (cross-cutting) | `references/sdd.md` | `tlc-spec-driven` (only if **no SDD tool**) | — |
| Frontend uses **React** | `references/frontend-react.md` | `vercel-react-best-practices` + testing + performance | Figma · Playwright · Chrome DevTools |
| Frontend uses **Angular** | `references/frontend-angular.md` | `angular-developer` + testing + performance | Figma · Playwright · Chrome DevTools |
| Backend uses **.NET / C#** | `references/backend-dotnet.md` | `dotnet-best-practices` + testing + performance | — (no MCP preset) |

A project can match several rows (e.g. a React frontend + .NET backend → load
`frontend-react.md` **and** `backend-dotnet.md`, and always evaluate `sdd.md`).
The **frontend MCP set** (Figma, Playwright, Chrome DevTools) is shared by React
and Angular — install it once per project, not once per frontend framework.

Each reference file lists its skills by **category** (best-practices, testing,
performance). Only the best-practices anchor is a pinned, confident package; the
testing/performance slots give a `npx skills find` query plus vetting criteria,
because the exact package should be confirmed against the leaderboard at install
time (install count, reputable source) rather than hard-coded blind.

## Procedure

1. **Get the stack.** Reuse the stack already detected in the harness assessment
   (the `/build-harness` Phase 1 inventory). If running standalone, detect it
   quickly from manifests (`package.json`, `*.csproj` / `*.sln`, `angular.json`).
2. **Select rows, load references progressively.** For each matching row, read
   **only** that reference file. Skip the rest — that is the whole point.
3. **Check presence (idempotency).**
   - **Skills:** look in the project's skill dirs (`.cursor/skills/`,
     `.agents/skills/`, `.claude/skills/`) and `skills-lock.json`.
   - **MCPs:** look for the server key in the project's `.mcp.json` (or the
     agent's MCP config). For SDD, also check for SDD tooling/config.
4. **Install only what's missing.**
   - **Skills:** use the exact command in the reference. Default to a
     **project-level** install (the baseline travels with the repo).
   - **MCPs:** add the server block from the reference to `.mcp.json`. MCPs that
     need a secret (Figma API key) must use a placeholder — **never** write a real
     key; tell the user which env/key to supply.
   - When running inside `/build-harness`, treat each install as a **proposed step
     to confirm**, not a silent edit.
5. **Report.** List what was already present, what you installed, what needs a
   secret before it works, and anything you deferred (with a one-line reason).

## Anti-overengineering

- Presets are a **floor, not a catalog.** Don't add tools beyond the matched rows
  here — additional capability gaps are `find-skills`' job.
- **Skill vs. MCP overlap.** Don't install both a testing *skill* and a testing
  *MCP* that do the same job. Playwright ships as the MCP; a separate
  "playwright testing" skill is usually redundant — prefer one, note the other as
  deferred.
- Don't install a preset "to be safe" for a stack the project doesn't use, and
  don't add MCPs to a backend-only project.
- If a preset's exact package is ambiguous for this org, **ask once** rather than
  installing the wrong one.

## Reference files

Load only as the baseline map directs; never read them all up front.

- `references/sdd.md` — spec-driven-development baseline + how to detect an
  existing SDD tool. (No MCP.)
- `references/frontend-react.md` — React skills set + frontend MCP set.
- `references/frontend-angular.md` — Angular skills set + frontend MCP set.
- `references/backend-dotnet.md` — .NET / C# skills set. (No MCP preset.)
