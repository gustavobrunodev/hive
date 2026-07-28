# Angular preset — skills set + frontend MCPs

> **Org choice:** the official Angular team skill is the Angular best-practices
> baseline. (The original preset request listed `vercel-react-best-practices` for
> Angular, which is a React skill — corrected here.)

**Applies when:** the project is an Angular app.

## Detect that Angular applies

- `@angular/core` in `package.json`, or an `angular.json` at the repo root.

## Skills (install each only if missing)

Detect presence under `.cursor/skills/`, `.agents/skills/`, `.claude/skills/`, or
in `skills-lock.json`. Install project-level by default.

### Best-practices (pinned baseline)

- **Skill:** `angular-developer` — the official Angular team skill. Enforces
  modern v20+ conventions (signals, built-in control flow, standalone
  components) and verifies generated code with `ng build`. Structured as a single
  orchestrator with progressive `references/`.
- **Source:** `angular/skills` (GitHub, official — Google Angular team).
- **Alternative (community):** `alfredoperez/angular-best-practices`
  (skill `angular-best-practices`).

```bash
npx skills add angular/skills --skill angular-developer -y
```

### Testing

- **Goal:** a skill enforcing the org's Angular testing conventions (component /
  service specs; Karma/Jasmine or Jest per project).
- **Find & vet** (confirm on the leaderboard, don't hard-code blind):

  ```bash
  npx skills find angular testing
  ```

  Pick one with **1K+ installs** from a reputable source. Skip anything under 100.
- **Skip if:** `angular-developer` already covers the project's testing
  conventions and the Playwright MCP covers E2E — don't duplicate.

### Performance

- Partly **covered** by `angular-developer` (signals, change-detection guidance).
  Only add a dedicated performance skill on a specific observed gap (bundle
  budgets, change-detection profiling):

  ```bash
  npx skills find angular performance
  ```

  Same vetting bar. Prefer **not** adding one if the baseline suffices.

## MCPs

Install the shared **frontend MCP set** — Figma, Playwright, Chrome DevTools.
See `frontend-mcps.md` for the exact `.mcp.json` blocks, detection, and the
Figma API-key handling. Install once per project (skip any server key already
present).

## Anti-overengineering

- The best-practices skill is the anchor; testing/performance skills are added
  **only on a real, observed gap**, not by default.
- Don't install a Playwright/testing *skill* that duplicates the Playwright *MCP*.
