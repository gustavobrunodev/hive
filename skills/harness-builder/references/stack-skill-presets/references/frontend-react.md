# React baseline — `vercel-react-best-practices`

**Applies when:** the project has a React frontend.

## Detect that React applies

- `react` (and/or `next`) in `package.json` dependencies, or `.jsx` / `.tsx`
  components, or a Next.js config (`next.config.*`).

## Detect if already installed (if found, skip)

- `vercel-react-best-practices` (or `react-best-practices`) under
  `.cursor/skills/`, `.agents/skills/`, `.claude/skills/`, or in
  `skills-lock.json`.

## The baseline

- **Skill:** `vercel-react-best-practices` — React / Next.js performance and
  quality guidelines from Vercel Engineering (40+ rules across 8 categories,
  prioritized by impact). ~510K installs.
- **Source:** `vercel-labs/agent-skills` (GitHub).

## Install (project-level, only if missing)

```bash
npx skills add vercel-labs/agent-skills --skill vercel-react-best-practices -y
```

Global alternative: add `-g`.
