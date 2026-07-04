# Storybook Documentation Tasks

**Design**: `.specs/features/storybook-documentation/design.md`
**Spec**: `.specs/features/storybook-documentation/spec.md`
**Status**: Execution complete (2026-07-04). All 76 tasks (T1–T76) done: Storybook 9.1.20 configured, all 61 components storied + committed, 4 foundations MDX pages, sidebar ordering, coverage/TSDoc/Playwright+a11y audits passed, final gate green. See `.specs/project/STATE.md` for the full closeout summary and `.specs/codebase/CONCERNS.md` for one bug found (not fixed) during the Playwright sweep.

---

## Conventions (apply to every task)

**Tools available:** `playwright` MCP (visual validation), `impeccable` skill (UX/usage sections). Foundation tasks may use `context7`/web to confirm Storybook 9 APIs.

**Shared "Done when" for every component-story task (T11–T71):**
- [ ] `<Name>.stories.tsx` created next to the component (CSF3, `title: '<Group>/<Name>'`, `tags: ['autodocs']`).
- [ ] All meaningful variants/sizes/states from the component's props are covered (own story or one side-by-side overview story).
- [ ] Interactive/overlay/provider components are operable in canvas (trigger works, portal mounts, provider wrapped via decorator).
- [ ] Autodocs prop table populated (add concise TSDoc to the component's props if any are undescribed — docs-only, no behavior change).
- [ ] `impeccable`-reviewed usage section present (When to use / When not · Do's & Don'ts · A11y · Relevant tokens) — depth proportional to the component's UX complexity.
- [ ] **Playwright MCP visual validation:** Storybook running; navigate to `/iframe.html?id=<storyId>` (and `&globals=theme:light`/`theme:dark`); screenshot each key state in **both themes**; confirm legibility, contrast, borders, portal theming. Record pass in the task checklist.
- [ ] `addon-a11y` panel shows no critical violations for the story (or violation is documented as a known/false-positive).
- [ ] **Commit:** `docs(design-system): storybook stories for <Name>` (one commit per component, does not touch `main.ts`/sidebar order/other components).

**Gates unchanged:** After each phase, `npm run typecheck && npm run test:coverage && npm run build` must stay green and `dist/` unchanged (stories are dev-only, already coverage-excluded).

---

## Execution Plan

```
Phase 0 — Foundation (SEQUENTIAL)
  T1 → T2 → T3 → T4 → T5 → T6

Phase 1 — Foundations docs (PARALLEL after T6)
  ├── T7  Introduction.mdx   [P]
  ├── T8  Tokens.mdx         [P]
  ├── T9  Theming.mdx        [P]
  └── T10 Accessibility.mdx  [P]

Phase 2 — Component stories (groups sequential-ish; components PARALLEL within a group)
  2A Brand      T11–T14   [P]
  2B Forms      T15–T23   [P]
  2C Overlays   T24–T31   [P]
  2D Feedback   T32–T38   [P]
  2E Navigation T39–T45   [P]
  2F Layout     T46–T50   [P]
  2G Data       T51–T62   [P]
  2H AI Chat    T63–T67   [P]
  2I Utilities  T68–T71   [P]

Phase 3 — Integration & gate (SEQUENTIAL)
  T72 → T73 → T74 → T75 → T76
```

Within a group, component tasks are independent (`[P]`) — each touches only its own folder. Barrel/sidebar-order wiring is deferred to Phase 3 to avoid merge races (same rhythm proven in the expansion feature per STATE.md).

---

## Phase 0 — Foundation

### T1: Install Storybook 9 (react-vite) + addons
**What:** Add Storybook, Vite builder, and a11y/docs addons as dev deps; scaffold `.storybook/`.
**Where:** `package.json` (devDeps + scripts), `.storybook/` (generated).
**Depends on:** None · **Requirement:** SBDOC-01
**Tools:** MCP: NONE · Skill: NONE · confirm exact 9.x package split via web/context7.
**Done when:**
- [ ] `@storybook/react-vite`, `@storybook/addon-a11y`, docs/essentials-equivalent, `vite`, `storybook` installed at latest stable 9.x (pinned).
- [ ] `scripts.storybook` = `storybook dev -p 6006` and `scripts.build-storybook` = `storybook build` added.
- [ ] Vite/Storybook added as **devDependencies only**; `dependencies` and `build.mjs` untouched.
**Verify:** `npx storybook --version` prints a 9.x version; `git diff package.json` shows only devDeps + scripts.

### T2: Configure `.storybook/main.ts`
**What:** Framework, scoped story glob (coexist with design-sync), addons, autodocs.
**Where:** `.storybook/main.ts`
**Depends on:** T1 · **Requirement:** SBDOC-01, SBDOC-04, SBDOC-09, SBDOC-15
**Done when:**
- [ ] `framework: '@storybook/react-vite'`.
- [ ] `stories: ['../src/**/*.mdx', '../src/**/*.stories.tsx']`; excludes `.design-sync/**` and `*.preview.tsx`.
- [ ] `addons` include a11y + docs; `docs: { autodocs: 'tag' }`.
**Verify:** `npm run storybook` boots with no glob/collision error and does not load any `.design-sync` preview.

### T3: Configure `.storybook/preview.ts` (CSS + theme + a11y)
**What:** Load DS CSS, theme toolbar toggle applied to `<html>`, backgrounds, a11y params.
**Where:** `.storybook/preview.ts` (+ `preview-head.html` if fonts need it).
**Depends on:** T2 · **Requirement:** SBDOC-02, SBDOC-03
**Done when:**
- [ ] `import '../src/base.css'` (pulls tokens + reset + fonts).
- [ ] `globalTypes.theme` toolbar with `light`/`dark` (default `dark`).
- [ ] Global decorator sets `data-theme` on `document.documentElement` (NOT a wrapper div — roles are `:root[data-theme]`); canvas background follows theme.
- [ ] `parameters.a11y` axe config present.
**Verify (Playwright MCP):** with a seeded story, toggling the toolbar flips `<html data-theme>` and both canvas + a Radix portal restyle to the theme.

### T4: Reconcile legacy previews + gitignore + scripts hygiene
**What:** Move the custom `window.__dsPreview` story out of the CSF glob; keep design-sync intact; ignore build output.
**Where:** `src/components/HarnessMark/HarnessMark.stories.tsx` → design-sync convention (`*.preview.tsx` or `.design-sync/previews/`); `.gitignore`.
**Depends on:** T2 · **Requirement:** SBDOC-04
**Done when:**
- [ ] Legacy custom preview no longer matches Storybook's glob; design-sync still finds it (per `.design-sync/config.json`).
- [ ] `storybook-static/` added to `.gitignore`.
**Verify:** `npm run storybook` does not list a broken HarnessMark custom-preview story; design-sync config still resolves its preview.

### T5: Smoke story + green build
**What:** One seeded CSF story to prove the pipeline end-to-end.
**Where:** `src/components/Button/Button.stories.tsx` (seed; expanded in T?)
**Depends on:** T3, T4 · **Requirement:** SBDOC-01, SBDOC-05
**Done when:**
- [ ] Button story renders with real tokens in both themes.
- [ ] `npm run build-storybook` completes with no errors.
- [ ] `npm run typecheck && npm run test:coverage && npm run build` still green; `dist/` unchanged.
**Verify (Playwright MCP):** screenshot Button story light + dark — tokens correct.

### T6: Establish the per-component docs template (impeccable)
**What:** Define the canonical usage-section structure + a decorator helper for providers/overlays, so all Phase 2 tasks are consistent.
**Where:** `.storybook/decorators.tsx` (provider/theme helpers), a short authoring note in `Contributing.mdx` stub or `design.md`.
**Depends on:** T5 · **Requirement:** SBDOC-06, SBDOC-07, SBDOC-10
**Tools:** Skill: `impeccable` (usage-section rubric) · MCP: NONE
**Done when:**
- [ ] Reusable decorators for: toast provider, tooltip provider, portal-theming, fixed-height layout (Resizable/ScrollArea/MessageList).
- [ ] Documented usage-section rubric (When to use/not · Do's & Don'ts · A11y · Tokens).
**Verify:** Button story refactored to use the template renders unchanged.

---

## Phase 1 — Foundations docs (impeccable) `[P]`

### T7: `Introduction.mdx` [P]
**Where:** `src/stories/Introduction.mdx` · **Depends on:** T6 · **Requirement:** SBDOC-13
**Tools:** Skill `impeccable` · Source: `PRODUCT.md`, `README.md`.
**Done when:** DS overview, brand language, install/consume, theme model; renders as the sidebar landing page. Playwright-MCP screenshot in both themes.

### T8: `Foundations/Tokens.mdx` [P]
**Where:** `src/stories/Tokens.mdx` · **Depends on:** T6 · **Requirement:** SBDOC-12
**Done when:** Live swatches for color roles, spacing, radius, z-index, typography read from CSS vars; correct in both themes (Playwright MCP).

### T9: `Foundations/Theming.mdx` [P]
**Where:** `src/stories/Theming.mdx` · **Depends on:** T6 · **Requirement:** SBDOC-12
**Done when:** `data-theme` light/dark model, how to set it, portal considerations; live demo. Playwright-MCP verified.

### T10: `Accessibility.mdx` [P]
**Where:** `src/stories/Accessibility.mdx` · **Depends on:** T6 · **Requirement:** SBDOC-13
**Tools:** Skill `impeccable`.
**Done when:** Radix engine, focus/`aria-modal`/keyboard/reduced-motion conventions documented.

---

## Phase 2 — Component stories (T11–T71)

Each row = one atomic task following the **Shared "Done when"** above. `[P]` within its group. **Requirement:** SBDOC-05, -06, -07, -08, -09, -10, -11, -15 (all component tasks). "Notes" flags provider/decorator needs and special validation.

### 2A — Brand (Depends on T6)
| ID | Component | Notes |
| --- | --- | --- |
| T11 | BrandMark | variants/tones |
| T12 | HarnessMark | reuse legacy variant coverage as CSF (symbol/horizontal/stacked/wordmark/icon, mono/negative) |
| T13 | Logo | — |
| T14 | Footer | wide layout; check both themes |

### 2B — Forms (Depends on T6)
| ID | Component | Notes |
| --- | --- | --- |
| T15 | Button | variants/sizes/disabled/loading (expand T5 seed) |
| T16 | Input | states: default/focus/error/disabled |
| T17 | Textarea | autosize demo |
| T18 | Label | with/without required |
| T19 | Field | wraps Label+control+error/help |
| T20 | Checkbox | checked/indeterminate/disabled |
| T21 | RadioGroup | keyboard nav note |
| T22 | Switch | on/off/disabled |
| T23 | Select | Radix portal — theme portal; operable |
| — | Slider | see T50? → no, Slider is Forms |

### 2B (cont.) — Forms
| ID | Component | Notes |
| --- | --- | --- |
| T23b→ | Slider | **assign T-id in exec**; Radix; single/range |

*(Slider tracked with Forms; final numbering reconciled at exec start — see Granularity note.)*

### 2C — Overlays (Depends on T6) — all need portal-theming decorator + operable trigger
| ID | Component | Notes |
| --- | --- | --- |
| T24 | Dialog | open state story; `aria-modal` |
| T25 | AlertDialog | requires explicit choice; Escape blocked |
| T26 | Popover | placement variants |
| T27 | Tooltip | provider decorator; hover/focus |
| T28 | DropdownMenu | items/separators/shortcuts |
| T29 | ContextMenu | right-click trigger |
| T30 | Sheet | side variants |
| T31 | Command | cmdk inside DS Dialog; search demo |

### 2D — Feedback (Depends on T6)
| ID | Component | Notes |
| --- | --- | --- |
| T32 | Toast | `useToast()` provider decorator; trigger button |
| T33 | Spinner | sizes |
| T34 | Skeleton | shapes |
| T35 | Progress | seed deterministic value; indeterminate |
| T36 | Alert | tones/variants |
| T37 | Empty | with/without action |
| T38 | Callout | tones |

### 2E — Navigation (Depends on T6)
| ID | Component | Notes |
| --- | --- | --- |
| T39 | Tabs | horizontal/vertical |
| T40 | Breadcrumb | truncation |
| T41 | Nav | active states |
| T42 | Accordion | single/multiple |
| T43 | Tree | expand/collapse; nested |
| T44 | SteppedList | steps/active |
| T45 | Timeline | gradient brand tokens |

### 2F — Layout (Depends on T6)
| ID | Component | Notes |
| --- | --- | --- |
| T46 | Separator | horizontal/vertical; decorative default |
| T47 | ScrollArea | **CONCERNS**: fixed height + overflow so scrollbar shows; validate real scroll in browser |
| T48 | Resizable | **CONCERNS**: two-panel fixed-height layout; validate drag + keyboard resize in browser (works in SB, not jsdom) |
| T49 | Panel | — |
| T50 | SectionHeading | — |

### 2G — Data Display (Depends on T6)
| ID | Component | Notes |
| --- | --- | --- |
| T51 | Table | + Pkg/Stack/Cond sub-exports |
| T52 | Badge | tones |
| T53 | Chip | tones/removable |
| T54 | PinChip | — |
| T55 | Avatar | image/fallback/sizes |
| T56 | Kbd | key combos |
| T57 | CodeBlock | syntax + copy |
| T58 | Terminal | brand dots decorative tokens |
| T59 | ModeBlock | + ModeSplit |
| T60 | CaseCard | + CaseGrid |
| T61 | SkillCard | + SkillGrid/SkillSpinePin |
| T62 | ValueCard | + ValueGrid |

### 2H — AI Chat (Depends on T6)
| ID | Component | Notes |
| --- | --- | --- |
| T63 | ChatMessage | user/assistant roles |
| T64 | TypingIndicator | seed stable animation frame; reduced-motion |
| T65 | MessageList | **CONCERNS**: fixed height + many messages; validate pin-to-latest in browser |
| T66 | Attachment | file types/states |
| T67 | PromptInput | autosize + submit |

### 2I — Utilities (Depends on T6)
| ID | Component | Notes |
| --- | --- | --- |
| T68 | VisuallyHidden | frame so effect is explained (renders "nothing") |
| T69 | Reveal | reduced-motion; seed revealed state for screenshot |
| T70 | DotsBackground | decorative; frame it |
| T71 | (spare/reconcile) | any component missed in numbering reconciliation |

> **Granularity note:** 61 components → 61 tasks. Slider and a couple of composite folders (Table, ModeBlock, Card grids) export sub-components documented within the same task. The T-numbering above has minor drift (Slider, T71 spare) to be reconciled into a clean 1:1 list at the start of Execute — the invariant is **exactly one task per component folder, all 61 covered**. Verify against `ls src/components | wc -l` = 61 before starting Phase 2.

---

## Phase 3 — Integration & gate

### T72: Sidebar ordering + grouping
**What:** Enforce group order (Brand→Forms→Overlays→Feedback→Navigation→Layout→Data Display→AI Chat→Utilities) + Foundations pages on top.
**Where:** `.storybook/preview.ts` (`options.storySort`) · **Requirement:** SBDOC-14
**Done when:** Sidebar shows Introduction/Foundations/Accessibility first, then the 9 component groups in order.

### T73: Coverage completeness audit
**What:** Prove all 61 components have a story.
**Where:** script/manual cross-check `ls src/components` vs `*.stories.tsx`.
**Depends on:** all of Phase 2 · **Requirement:** SBDOC-05
**Done when:** every component folder has exactly one `.stories.tsx`; diff both directions empty; index count 61.
**Verify:** `comm`/diff of component folders vs story files is empty.

### T74: TSDoc/Autodocs backfill audit
**What:** Ensure no Autodocs prop table has empty description cells for public props.
**Requirement:** SBDOC-09, SBDOC-11
**Done when:** spot-check each group's Docs tab; add missing TSDoc (docs-only); typecheck green.

### T75: Full a11y + Playwright MCP sweep
**What:** Final visual + a11y pass across groups in both themes.
**Requirement:** SBDOC-08, SBDOC-15
**Done when:** Playwright-MCP spot-check per group in light+dark; a11y panel reviewed; issues logged to STATE/CONCERNS (not fixed here).

### T76: Final gate + STATE update
**What:** Confirm nothing regressed; record feature done.
**Depends on:** T72–T75 · **Requirement:** all
**Done when:**
- [ ] `npm run typecheck && npm run test:coverage && npm run build` green; `dist/` unchanged.
- [ ] `npm run build-storybook` green.
- [ ] `.specs/project/STATE.md` updated (feature complete, decisions, any bugs found → CONCERNS.md).
- [ ] **Commit:** `docs(design-system): storybook config + foundations + sidebar (T72–T76)`.

---

## Requirement Coverage

| Requirement | Tasks |
| --- | --- |
| SBDOC-01 boot/build | T1, T2, T5 |
| SBDOC-02 css loaded | T3 |
| SBDOC-03 theme toggle | T3, T72 |
| SBDOC-04 glob coexist | T2, T4 |
| SBDOC-05 all 61 storied | T5, T11–T71, T73 |
| SBDOC-06 variants | T11–T71 |
| SBDOC-07 overlays operable | T6, T24–T31, T32 |
| SBDOC-08 Playwright MCP validation | T11–T71, T75 |
| SBDOC-09 autodocs | T2, T11–T71, T74 |
| SBDOC-10 impeccable usage | T6, T11–T71 |
| SBDOC-11 TSDoc backfill | T11–T71, T74 |
| SBDOC-12 foundations/tokens/theming | T8, T9 |
| SBDOC-13 intro + a11y pages | T7, T10 |
| SBDOC-14 sidebar grouping | T72 |
| SBDOC-15 a11y addon | T2, T11–T71, T75 |

**Coverage:** 15/15 requirements mapped. 76 tasks (T1–T76). Every component folder = exactly one task.
