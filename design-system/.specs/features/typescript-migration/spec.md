# TypeScript Migration + Test Infrastructure Specification

## Problem Statement

`@hive/design-system` ships 24 React components authored in `.jsx` with zero automated tests and only one hand-written type declaration (`HarnessMark.d.ts`). Consumers get no type safety on the public API and refactors are unguarded. We need to migrate the whole `src/` tree to TypeScript (strict) and stand up Vitest + React Testing Library with ≥90% coverage — without changing any runtime behavior or the published API surface.

## Goals

- [x] Every `.jsx`/`.js` source file under `src/` migrated to `.tsx`/`.ts` with `strict: true` and **zero** type errors.
- [x] Public API (all 40+ named exports from `src/index`) unchanged in name, signature, and runtime behavior.
- [x] Vitest + React Testing Library configured; `npm test` and `npm run test:coverage` run green.
- [x] Global coverage ≥90% (lines / branches / functions / statements) with standard exclusions.
- [x] Build still produces `dist/ds-bundle.js` + `dist/ds-bundle.css`, **plus** emitted `dist/*.d.ts` for the public API.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Changing component behavior / markup / CSS | Migration must be behavior-preserving |
| Renaming or restructuring the public API | Consumers (harness-builder site) depend on current export names |
| Adding new components | Pure migration + testing effort |
| Storybook / visual regression tooling | `.stories.*` preview mechanism (`window.__dsPreview`) stays as-is |
| Migrating `.design-sync/` mirror or `build.mjs` bundling strategy | Only build outputs (types) are extended, not the bundler |
| CI pipeline wiring | Local scripts only; CI is a follow-up |

---

## User Stories

### P1: Strict TypeScript source ⭐ MVP

**User Story**: As a design-system maintainer, I want the entire `src/` tree in strict TypeScript so that props and exports are type-checked at author time.

**Why P1**: Type safety is the primary ask; everything else builds on the `.ts`/`.tsx` files existing.

**Acceptance Criteria**:

1. WHEN `npm run typecheck` runs THEN system SHALL report zero errors under `strict: true`.
2. WHEN a consumer imports any named export from `@hive/design-system` THEN system SHALL provide accurate prop types.
3. WHEN `HarnessMark` is migrated THEN system SHALL inline the existing `HarnessMark.d.ts` contract into the `.tsx` and remove the standalone `.d.ts`.
4. WHEN a component spreads `...rest` onto a host element THEN system SHALL type `rest` via the matching `React.ComponentPropsWithoutRef<...>`.

**Independent Test**: `npm run typecheck` passes; `src/` contains no `.jsx`/`.js` files.

---

### P1: Behavior-preserving build ⭐ MVP

**User Story**: As a consumer, I want the built bundle and public API to be byte-for-byte equivalent in behavior so that nothing downstream breaks.

**Why P1**: The package is published (`main`, `files: ["dist"]`); a regression here breaks the marketing site.

**Acceptance Criteria**:

1. WHEN `npm run build` runs THEN system SHALL emit `dist/ds-bundle.js` and `dist/ds-bundle.css` as before.
2. WHEN the build runs THEN system SHALL additionally emit `dist/index.d.ts` (+ per-module declarations) covering every public export.
3. WHEN `src/index.ts` is compared to the previous `src/index.js` THEN system SHALL export the identical set of names.
4. WHEN `package.json` is inspected THEN system SHALL declare `"types": "dist/index.d.ts"`.

**Independent Test**: Diff export names old vs new = empty; `dist/index.d.ts` exists and resolves.

---

### P1: Vitest + RTL harness with ≥90% coverage ⭐ MVP

**User Story**: As a maintainer, I want a test suite covering every component and utility so that behavior is locked before future changes.

**Why P1**: The 90% coverage bar is an explicit requirement.

**Acceptance Criteria**:

1. WHEN `npm test` runs THEN system SHALL execute the Vitest suite in a jsdom environment and pass.
2. WHEN `npm run test:coverage` runs THEN system SHALL fail if any global metric (lines/branches/functions/statements) is < 90%.
3. WHEN coverage is computed THEN system SHALL exclude `src/index.ts` (barrel), `*.stories.*`, `*.d.ts`, and config/build files.
4. WHEN a component test is written THEN system SHALL follow the `react-testing-library` skill (role/label/text queries, `userEvent`, no implementation-detail assertions).
5. WHEN `useReveal` is tested THEN system SHALL exercise both the `IntersectionObserver` path and the reduced-motion / unsupported fallback.

**Independent Test**: `npm run test:coverage` exits 0 with the summary showing ≥90% on all four metrics.

---

### P2: Shared type foundation

**User Story**: As a maintainer, I want shared prop-type helpers so that polymorphic `as`/`href` components are typed consistently.

**Why P2**: Improves quality of the migration but the migration can technically land with per-file inline types.

**Acceptance Criteria**:

1. WHEN a polymorphic component (`Reveal`, `Stagger`, `Button`) is typed THEN system SHALL derive host props from `as`/`href` in one consistent pattern.
2. WHEN `cx` is migrated THEN system SHALL accept `(...parts: Array<string | false | null | undefined>)` and return `string`.

**Independent Test**: `Button` with `href` accepts anchor props; without `href` accepts button props — both typecheck.

---

## Edge Cases

- WHEN `IntersectionObserver` is absent in the test env THEN `useReveal` SHALL set `isIn = true` immediately (fallback path must be tested, not just mocked away).
- WHEN a component receives extra HTML attributes via `...rest` THEN types SHALL allow standard DOM attributes without `any`.
- WHEN `strict` surfaces an implicit-`any` in existing code THEN the fix SHALL be a type annotation only — never a behavior change.
- WHEN a component has no branching logic (e.g. `DotsBackground`) THEN a single render test SHALL satisfy its coverage.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| TSM-01 | P1: Strict TS source | Design | Done |
| TSM-02 | P1: Strict TS source (rest/props typing) | Design | Done |
| TSM-03 | P1: Behavior-preserving build (esbuild TS entry) | Design | Done |
| TSM-04 | P1: Behavior-preserving build (.d.ts emit) | Design | Done |
| TSM-05 | P1: Behavior-preserving build (identical exports) | Design | Done |
| TSM-06 | P1: Vitest + RTL harness | Design | Done |
| TSM-07 | P1: Coverage ≥90% + exclusions | Design | Done |
| TSM-08 | P1: Component tests via RTL skill | Tasks | Done |
| TSM-09 | P1: useReveal both branches tested | Tasks | Done |
| TSM-10 | P2: Shared polymorphic type helpers | Design | Done |
| TSM-11 | P2: cx typed signature | Tasks | Done |

**ID format:** `TSM-[NUMBER]`
**Coverage:** 11 total, 0 mapped to tasks yet (mapped in tasks.md).

---

## Success Criteria

- [x] `find src -name '*.jsx' -o -name '*.js'` returns nothing.
- [x] `npm run typecheck` → 0 errors.
- [x] `npm run build` → `dist/ds-bundle.js`, `dist/ds-bundle.css`, `dist/index.d.ts` all present.
- [x] `npm run test:coverage` → all four metrics ≥90%, exit 0.
- [x] Export-name diff (old `index.js` vs new `index.ts`) is empty.
