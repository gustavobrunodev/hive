# STATE — @hive/design-system

Persistent memory across sessions. Load at session start.

## Active Feature

None. `typescript-migration` — migrate all `src/` to strict TS + Vitest/RTL with ≥90% coverage. Planning **done** (spec + design + tasks). Execution **complete** (Phase 0–3, T1–T33 all done, 2026-07-02): all 23 component folders + shared primitives migrated to `.tsx`/`.ts`; barrel is `src/index.ts` with verified export-name parity; `build.mjs` emits `dist/ds-bundle.js`, `dist/ds-bundle.css`, `dist/index.d.ts`; `npm run typecheck && npm run test:coverage && npm run build` all green (242 tests, 100% lines/branches/functions/statements — well above the 90% gate).

## Decisions

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

## Todos

None. Phase 0→3 execution finished 2026-07-02.

## Preferences

- Lightweight tasks (validation, STATE updates, session handoff) run fine on faster/cheaper models.
