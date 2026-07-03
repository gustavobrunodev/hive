# STATE — @hive/design-system

Persistent memory across sessions. Load at session start.

## Active Feature

**`component-library-expansion`** — expand the DS with ~25–35 interactive components (shadcn/ui as catalog reference, Radix UI as a11y engine), add a light theme alongside dark, for a future AI-chat + file-explorer desktop app. Planning **done** (spec + design + tasks, 2026-07-03). Execution **in progress**: Phase 0 foundations **complete** (T1–T5, 2026-07-03) — `PRODUCT.md`/`DESIGN.md` authored via impeccable with contrast-verified OKLCH values for both themes; two-layer `tokens.css` (primitives + semantic roles under `data-theme`); existing 24 marketing components migrated to role tokens (byte-identical dark output); 20 Radix/`cmdk`/`react-resizable-panels` runtime deps added; shared primitives (`useControllableState`, `useAutosizeTextarea`, `VisuallyHidden`) + z-index scale + jsdom polyfills landed. Phase 0 gate green: typecheck/test:coverage/build all pass, 258 tests, coverage still ≥90% on all four metrics. Next: Phase 1 forms + overlays (T6–T22). See `.specs/features/component-library-expansion/{spec,design,tasks}.md`.

---

`typescript-migration` — migrate all `src/` to strict TS + Vitest/RTL with ≥90% coverage. Planning **done** (spec + design + tasks). Execution **complete** (Phase 0–3, T1–T33 all done, 2026-07-02): all 23 component folders + shared primitives migrated to `.tsx`/`.ts`; barrel is `src/index.ts` with verified export-name parity; `build.mjs` emits `dist/ds-bundle.js`, `dist/ds-bundle.css`, `dist/index.d.ts`; `npm run typecheck && npm run test:coverage && npm run build` all green (242 tests, 100% lines/branches/functions/statements — well above the 90% gate).

## Decisions

- **2026-07-03 — Expansion a11y engine (D1):** Interactive components built on **Radix UI primitives**, styled with our tokens. Accepts the first runtime deps (`@radix-ui/*`) into a previously zero-dep package. Rationale: battle-tested a11y; same model as shadcn.
- **2026-07-03 — Expansion scope (D2):** Desktop-app-driven subset (~25–35), not full shadcn parity. Deferred: Calendar, DatePicker, Carousel, Chart, DataTable, Pagination, Menubar, InputOTP, NavigationMenu.
- **2026-07-03 — Theming (D3):** Ship **light + dark** now via a semantic role-token layer + `data-theme`; existing dark palette (Zup) becomes the dark theme's values, components unchanged on dark.
- **2026-07-03 — DS vs app (D4):** DS ships generic primitives (Tree, ScrollArea, Resizable, ChatMessage, Avatar); the actual chat screen + workspace pane are assembled in the separate desktop app.
- **2026-07-01 — Migration style:** Big-bang + `strict:true`, no `allowJs`. Rationale: 27 files, small surface; hybrid JS/TS adds no value.
- **2026-07-01 — Coverage:** Global 90% (lines/branches/functions/statements) via v8, with standard exclusions (`src/index.ts` barrel, `*.stories.tsx`, `*.d.ts`, `src/types/**`).
- **2026-07-01 — Published types:** Emit `dist/*.d.ts` via `tsc -p tsconfig.build.json --emitDeclarationOnly` appended to `build.mjs`; set `package.json "types"`.
- **Constraint (hard):** Behavior + public API frozen. Export-name parity (`index.js` → `index.ts`) must be verified empty-diff. Type fixes only, never behavior changes.

## Blockers

- None.

## Lessons

- esbuild already accepts `.ts/.tsx` natively → bundler change is entry-point only; declarations need a separate `tsc` pass (esbuild doesn't emit types).
- `HarnessMark` ships a hand-written `HarnessMark.d.ts` — inline it into `HarnessMark.tsx` during T17, then delete the standalone `.d.ts`.
- `useReveal` has two runtime branches (IntersectionObserver vs reduced-motion/unsupported fallback) — both must be tested for branch coverage.
- By the time Phase 3 started, per-folder work (T1–T30) had already driven coverage to 100% on all four metrics — no targeted coverage-gap tests were needed in T33; the gate passed on the first run.
- `tsconfig.build.json`'s exclude list (`**/*.test.tsx`, `**/*.stories.tsx`, `test`) doesn't catch `.test.ts` (non-tsx) files — `useReveal.test.d.ts` and `cx.test.d.ts` leak into `dist/`. Harmless (not part of the public export surface, not referenced by `index.d.ts`) but worth tightening to `**/*.test.{ts,tsx}` in a future pass.
- `dist/` is tracked directly in git (no `.gitignore` entry) — build artifacts land in normal commits for this package.
- `PRODUCT.md`/`DESIGN.md` (impeccable) live at the **package root** (`design-system/PRODUCT.md`), not under `.specs/` — avoids colliding with the unrelated `.specs/features/*/design.md` (tlc-spec-driven architecture doc) and matches impeccable's own convention of scanning from project root.
- T3's raw→role token migration surfaced a latent bug: `var(--line)`/`var(--line-strong)` were referenced across ~15 component CSS files but were never actually defined in the old `tokens.css` — those borders were silently unstyled. Fixed as a byproduct of the T2/T3 refactor (now `--border`/`--border-strong`).
- Not every raw brand primitive maps to a semantic role: `--bordo-sensatez` and decorative gradient/dot uses of `--coral`/`--bordo`/`--verde` (Terminal dots, BrandMark, Timeline gradient, `base.css` dot pattern) intentionally stay raw — no dark-theme Layer-2 role resolves to their exact value, and forcing a role swap would either change dark rendering or introduce a light-theme contrast bug in a fixed brand-tile combo (e.g. `--cinza-impacto` text on a raw `--bordo-sensatez` background).

## Todos

None. Phase 0→3 execution finished 2026-07-02.

## Preferences

- Lightweight tasks (validation, STATE updates, session handoff) run fine on faster/cheaper models.
