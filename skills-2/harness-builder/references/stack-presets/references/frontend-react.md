# React preset — skills set + frontend MCPs

**Applies when:** the project has a React frontend.

## Detect that React applies

- `react` (and/or `next`) in `package.json` dependencies, or `.jsx` / `.tsx`
  components, or a Next.js config (`next.config.*`).

## Skills (install each only if missing)

Detect presence under `.cursor/skills/`, `.agents/skills/`, `.claude/skills/`, or
in `skills-lock.json`. Install project-level by default.

### Best-practices (pinned baseline)

- **Skill:** `vercel-react-best-practices` — React / Next.js performance and
  quality guidelines from Vercel Engineering (40+ rules across 8 categories,
  prioritized by impact). ~510K installs. Also covers a lot of the **performance**
  slot below.
- **Source:** `vercel-labs/agent-skills` (GitHub).

```bash
npx skills add vercel-labs/agent-skills --skill vercel-react-best-practices -y
```

### Testing

- **Goal:** a skill that enforces the org's React testing conventions (component
  + hook tests, Testing Library patterns).
- **Find & vet** (don't hard-code blind — confirm on the leaderboard):

  ```bash
  npx skills find react testing
  ```

  Pick one with **1K+ installs** from a reputable source (`vercel-labs`,
  `anthropics`, official framework orgs). Skip anything under 100 installs.
- **Skip if:** the Playwright MCP (see frontend MCP set) already covers the
  project's E2E needs and there's no unit/component-test gap — don't add a testing
  skill that duplicates it.

### Performance

- Largely **already covered** by `vercel-react-best-practices`. Only add a
  dedicated performance skill if the assessment found a specific gap it doesn't
  address (e.g. bundle analysis, Core Web Vitals workflow):

  ```bash
  npx skills find react performance
  ```

  Same vetting bar (1K+ installs, reputable source). Prefer **not** adding one if
  the best-practices baseline suffices.

## MCPs

Install the shared **frontend MCP set** — Figma, Playwright, Chrome DevTools.
See `frontend-mcps.md` for the exact `.mcp.json` blocks, detection, and the
Figma API-key handling. Install once per project (skip any server key already
present).

## Anti-overengineering

- The best-practices skill is the anchor; testing/performance skills are added
  **only on a real, observed gap**, not by default.
- Don't install a Playwright/testing *skill* that duplicates the Playwright *MCP*.
