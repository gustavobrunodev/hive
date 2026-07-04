# Context — Storybook Documentation

User decisions captured during Specify (2026-07-03). These resolve the gray areas and are binding for design/tasks.

## D-SB1 — Coexist with `.design-sync` (separate globs)
Storybook uses real CSF3, but the `.stories.tsx` extension is already taken by the custom `window.__dsPreview` design-sync preview format. **Decision:** coexist. Storybook's story glob is scoped so it matches only true CSF stories and does **not** pick up design-sync's custom previews. The one existing custom `src/components/HarnessMark/HarnessMark.stories.tsx` is relocated/renamed into the design-sync convention (e.g. `.design-sync/previews/` or a `*.preview.tsx` name) so the two systems never collide. The design-sync pipeline is otherwise untouched.

## D-SB2 — Full documentation depth
Per component: variant/state **stories** + **Autodocs** (auto prop table from TS types) + a curated **MDX usage section** (when to use / when not, do's & don'ts, a11y notes, relevant tokens) authored with the **`impeccable`** skill. This is the "documentação completa" the user asked for.

## D-SB3 — Visual validation via Playwright MCP only
Each component is visually validated by driving a **running Storybook** with the **Playwright MCP** (navigate to the story iframe, screenshot in light + dark, check key states) as a per-component acceptance gate during Execute. **No** automated CI visual-regression (no `@storybook/test-runner` snapshots, no Chromatic) in this feature — deferred.

## D-SB4 — Stack: Storybook + Vite builder
Storybook (latest stable, pinned at install time) with the **React + Vite** builder. Vite is added as a **dev-only** dependency; the production build stays the existing esbuild `build.mjs`. Storybook must not alter `dist/` or the coverage gate. (Storybook has no native esbuild builder; Vite is the modern default.)

## Standing constraints inherited from STATE.md
- Component behavior + public API are **frozen** — this feature adds docs/stories and at most **TSDoc comments** (docs-only). No behavior/style changes.
- `dist/` is tracked in git; do not let Storybook artifacts leak into `dist/`. Add `storybook-static/` to `.gitignore`.
- `*.stories.tsx` is already excluded from vitest coverage — real CSF stories inherit that exclusion; verify the gate stays green.
- Bugs discovered during visual validation are logged to STATE.md/CONCERNS.md, not fixed in this feature (unless purely a story authoring issue).
