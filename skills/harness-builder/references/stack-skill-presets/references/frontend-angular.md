# Angular baseline — `angular-developer` (official)

> **Org choice:** the official Angular team skill is the Angular baseline.
> (The original preset request listed `vercel-react-best-practices` for Angular,
> which is a React skill — corrected here.)

**Applies when:** the project is an Angular app.

## Detect that Angular applies

- `@angular/core` in `package.json`, or an `angular.json` at the repo root.

## Detect if already installed (if found, skip)

- `angular-developer` (or another `angular-*-best-practices`) under
  `.cursor/skills/`, `.agents/skills/`, `.claude/skills/`, or in
  `skills-lock.json`.

## The baseline

- **Skill:** `angular-developer` — the official Angular team skill. Enforces
  modern v20+ conventions (signals, built-in control flow, standalone
  components) and verifies generated code with `ng build`. Structured as a single
  orchestrator with progressive `references/`.
- **Source:** `angular/skills` (GitHub, official — Google Angular team).
- **Alternative (community):** `alfredoperez/angular-best-practices`
  (skill `angular-best-practices`).

## Install (project-level, only if missing)

```bash
npx skills add angular/skills --skill angular-developer -y
```

Global alternative: add `-g`.
