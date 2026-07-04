# Storybook Documentation Specification

## Problem Statement

`@hive/design-system` now ships **61 components** (forms, overlays, feedback, navigation, layout, brand, AI-chat primitives) with light + dark theming, but has **no browsable documentation**. Consumers (the future desktop app, and any HIVE team building on the DS) have only a README table and source code to discover components, props, variants, theming and a11y behavior. There is no living, visual, interactive surface to explore what exists, how it looks in both themes, and how to use it correctly.

We want a complete Storybook that documents **every** component, is visually validated per-component, and encodes UX/usage best practices (via the `impeccable` skill) — without disturbing the existing `.design-sync` preview pipeline.

## Goals

- [ ] **Coverage:** 100% of exported components (61/61) have at least one Storybook story; every meaningful variant/state is a story.
- [ ] **Depth:** Each component has Autodocs (auto prop table) + curated MDX usage guidance (do's & don'ts, a11y, tokens) shaped by `impeccable`.
- [ ] **Theming:** A global toolbar toggle renders every story in light **and** dark (`data-theme`), with matching backgrounds; tokens/`base.css` loaded so components render true-to-brand.
- [ ] **Visual validation:** Every component is visually verified in a running Storybook via the **Playwright MCP** (both themes, key states) before its task is marked done.
- [ ] **Non-disruption:** The existing `.design-sync` preview system and its custom `window.__dsPreview` previews keep working; Storybook coexists via a separate story glob.
- [ ] **DX:** `npm run storybook` (dev) and `npm run build-storybook` (static) work green; Storybook deps are dev-only and do not touch the production esbuild `build.mjs` output or the published `dist/`.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Automated visual-regression snapshots in CI (`@storybook/test-runner`, Chromatic) | User decision: visual validation is done via Playwright MCP per component, not CI baselines. Can be a future feature. |
| Migrating `.design-sync` previews to CSF / changing the design-sync pipeline | Decision: coexist. Pipeline stays as-is. |
| Publishing/hosting the static Storybook (Pages, S3, etc.) | Deployment target not defined yet; `build-storybook` output is enough for this feature. |
| Changing component behavior, public API, or styling | This is a documentation feature only. Any bug found during validation is logged in STATE/CONCERNS, not fixed here (unless trivially a story concern). |
| Documenting internal hooks (`useControllableState`, `useAutosizeTextarea`, `useReveal`) as stories | Not components. Covered narratively in an MDX guide page if relevant, not as stories. |
| Switching production build from esbuild to Vite | Vite is added only as Storybook's dev builder; `build.mjs` stays the shipping build. |

---

## User Stories

### P1: Storybook boots with themed, token-aware rendering ⭐ MVP

**User Story:** As a DS consumer, I want a running Storybook that renders our components with real tokens in both light and dark themes, so I can trust what I see matches production.

**Why P1:** Nothing else can be authored or validated until Storybook boots, loads `tokens.css`/`base.css`, and can toggle `data-theme`. This is the foundation.

**Acceptance Criteria:**
1. WHEN `npm run storybook` runs THEN the system SHALL start Storybook (Vite builder, React) with no errors and serve locally.
2. WHEN any story renders THEN the system SHALL have `src/tokens.css` and `src/base.css` loaded so components use real DS tokens.
3. WHEN the user toggles the theme control in the toolbar THEN the system SHALL set `data-theme` (light/dark) on the preview root AND switch the canvas background to the matching theme surface.
4. WHEN `npm run build-storybook` runs THEN the system SHALL produce a static build with no errors.
5. WHEN Storybook's story glob is configured THEN it SHALL match only true CSF stories AND SHALL NOT collide with the existing `.design-sync` custom-preview `.stories.tsx` files.

**Independent Test:** Run `npm run storybook`, open a single seeded story (e.g. Button), toggle light/dark, confirm tokens + background switch. Run `build-storybook` clean.

---

### P1: Every component has visually-validated variant stories ⭐ MVP

**User Story:** As a DS consumer, I want every component and its key variants/states as interactive stories, each visually verified, so I can explore the whole library with confidence.

**Why P1:** This is the core deliverable — "all components must be documented."

**Acceptance Criteria:**
1. WHEN the Storybook index loads THEN the system SHALL list all 61 exported components, each with ≥1 story.
2. WHEN a component has multiple variants/sizes/states (e.g. Button variants, Alert tones, Input states) THEN each meaningful one SHALL be a distinct story or a single "overview" story showing them side by side.
3. WHEN interactive/overlay components (Dialog, Popover, Select, Toast, Command, etc.) are storied THEN the story SHALL be openable/operable in the canvas (trigger + mounted portal render correctly).
4. WHEN each component's stories are authored THEN they SHALL be visually validated in a running Storybook via the **Playwright MCP** in both light and dark themes and key states, and the result recorded before the task is closed.
5. WHEN a component is theme-sensitive THEN it SHALL be confirmed legible/correct in both themes (contrast, borders, surfaces).

**Independent Test:** For any component, its stories appear in the sidebar, render, are operable, and screenshots in both themes look correct (captured via Playwright MCP).

---

### P2: Autodocs + curated MDX usage guidance (impeccable)

**User Story:** As a DS consumer, I want an auto-generated prop table plus curated usage guidance (when to use, do's & don'ts, a11y, tokens) per component, so I use each component correctly, not just see it.

**Why P2:** Elevates "it renders" to "documented completely." Autodocs gives prop tables cheaply; `impeccable` supplies the UX judgment that makes docs actually useful.

**Acceptance Criteria:**
1. WHEN a component page opens THEN the system SHALL show an Autodocs prop table derived from its TS types (props, types, defaults, descriptions).
2. WHEN a component has non-obvious UX/a11y considerations THEN its docs SHALL include an `impeccable`-reviewed usage section (when to use / when not, do's & don'ts, a11y notes, relevant tokens).
3. WHEN props have public TSDoc comments THEN Autodocs SHALL surface them; components lacking descriptions SHALL get concise TSDoc added (docs-only, no behavior change).

**Independent Test:** Open a component's Docs tab: prop table is populated and a usage section with concrete guidance is present.

---

### P2: Overview / foundations documentation pages

**User Story:** As a DS consumer, I want top-level guide pages (Introduction, Design tokens, Theming, Accessibility, Contributing a story), so I understand the system, not just individual parts.

**Why P2:** Ties the component docs into a coherent system; entry point for newcomers.

**Acceptance Criteria:**
1. WHEN Storybook opens THEN the system SHALL present an Introduction page (what the DS is, brand language, how to consume it).
2. WHEN the user opens Foundations THEN the system SHALL document design tokens (color roles, spacing, radius, z-index, typography) and theming (`data-theme` light/dark), rendered live from `tokens.css`.
3. WHEN the user opens Accessibility THEN the system SHALL summarize DS a11y conventions (Radix engine, focus, `aria-modal`, keyboard) shaped by `impeccable`.

**Independent Test:** Sidebar shows Introduction + Foundations + Accessibility pages that render with live token swatches.

---

### P3: Sidebar organization + `a11y` addon

**User Story:** As a DS consumer, I want components grouped into logical sections and an accessibility panel, so navigation and a11y checks are effortless.

**Why P3:** Quality-of-life; the docs work without it but are much nicer with it.

**Acceptance Criteria:**
1. WHEN the sidebar renders THEN components SHALL be grouped (Brand, Forms, Overlays, Feedback, Navigation, Layout, Data Display, AI Chat, Utilities).
2. WHEN a story is selected THEN the `@storybook/addon-a11y` panel SHALL run axe checks against the rendered canvas.

---

## Edge Cases

- WHEN a component renders in a portal (Radix overlays: Dialog, Popover, Select, Toast, ContextMenu, DropdownMenu, Sheet, Command, Tooltip) THEN its story SHALL apply the `data-theme` and token context to the portal root, not only the canvas root, so themed rendering is correct.
- WHEN a component relies on animation/scroll/observer (Reveal, MessageList, TypingIndicator, Progress) THEN its story SHALL render a stable, screenshot-able state (respect reduced-motion / seed a deterministic state).
- WHEN a purely decorative or context-dependent component (DotsBackground, VisuallyHidden, Separator, HarnessMark endorsement) is storied THEN the story SHALL frame it so the effect is visible/explained even if the component renders "nothing" on its own.
- WHEN the existing `HarnessMark.stories.tsx` (custom `window.__dsPreview` format) is present THEN it SHALL NOT be picked up by Storybook's CSF glob (renamed/relocated to the design-sync convention) so the two systems don't collide.
- WHEN Storybook config or stories are added THEN coverage thresholds and the production build SHALL remain unaffected (stories already excluded from vitest coverage; `dist/` unchanged).
- WHEN a story imports a component THEN it SHALL import from the local source (`./Component`), not the built `dist/` bundle, so docs track source.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| SBDOC-01 | P1: Boot + Vite builder + build-storybook | Design | Pending |
| SBDOC-02 | P1: Token/base.css loaded in preview | Design | Pending |
| SBDOC-03 | P1: Theme toolbar toggle (light/dark) + backgrounds | Design | Pending |
| SBDOC-04 | P1: Story glob coexists w/ design-sync (no collision) | Design | Pending |
| SBDOC-05 | P1: ≥1 story per component, all 61 covered | Design | Pending |
| SBDOC-06 | P1: Variants/states as stories | Design | Pending |
| SBDOC-07 | P1: Interactive/overlay stories operable + portal theming | Design | Pending |
| SBDOC-08 | P1: Per-component Playwright-MCP visual validation (both themes) | Design | Pending |
| SBDOC-09 | P2: Autodocs prop tables from TS types | Design | Pending |
| SBDOC-10 | P2: impeccable-reviewed usage/a11y sections | Design | Pending |
| SBDOC-11 | P2: TSDoc added where prop descriptions missing (docs-only) | Design | Pending |
| SBDOC-12 | P2: Foundations pages (tokens, theming) live from tokens.css | Design | Pending |
| SBDOC-13 | P2: Introduction + Accessibility guide pages | Design | Pending |
| SBDOC-14 | P3: Sidebar grouping into sections | Design | Pending |
| SBDOC-15 | P3: addon-a11y axe panel per story | Design | Pending |

**ID format:** `SBDOC-[NUMBER]`
**Status values:** Pending → In Design → In Tasks → Implementing → Verified
**Coverage:** 15 total, 0 mapped to tasks (Tasks phase pending), 0 verified.

---

## Success Criteria

- [ ] `npm run storybook` and `npm run build-storybook` both run green with no console errors.
- [ ] All 61 components appear in the sidebar, each with ≥1 story; every meaningful variant/state is represented.
- [ ] Every component visually validated via Playwright MCP in light **and** dark, results recorded per task.
- [ ] Every component page shows a populated Autodocs prop table and an impeccable-reviewed usage section.
- [ ] Foundations (tokens/theming) + Introduction + Accessibility pages render live and correct.
- [ ] The `.design-sync` pipeline and its custom previews are unaffected; production `dist/` and coverage gate unchanged.
