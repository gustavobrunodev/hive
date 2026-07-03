# TypeScript Migration + Test Infrastructure Tasks

**Design**: `.specs/features/typescript-migration/design.md`
**Status**: Complete

---

## Execution Plan

### Phase 0: Tooling Foundation (Sequential)

Nothing compiles or tests until config + deps exist.

```
T1 → T2 → T3 → T4
```

### Phase 1: Shared Primitives (Sequential, small)

```
T5 (types) → T6 (cx) → T7 (useReveal)
```

### Phase 2: Component Migration (Parallel — 23 units)

Every component `.jsx → .tsx` is independent once Phase 1 lands. Each migration task pairs with its test task (same folder) so coverage is proven per unit.

```
        ┌→ T8  (Badge)      ─┐
        ├→ T9  (BrandMark)  ─┤
T7 ─────┼→ ...              ─┼──→ (all green) → T31
        └→ T30 (ValueCard)  ─┘
```

### Phase 3: Barrel + Build + Gate (Sequential)

```
T31 (index.ts) → T32 (build.mjs + package types) → T33 (coverage gate + full verify)
```

---

## Task Breakdown

### T1: Add TS + test devDependencies

**What**: Add all TypeScript/Vitest/RTL devDependencies and npm scripts to `package.json`.
**Where**: `package.json`
**Depends on**: None
**Requirement**: TSM-06, TSM-07

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] devDeps present: `typescript`, `vitest`, `@vitest/coverage-v8`, `jsdom`, `@testing-library/react`, `@testing-library/dom`, `@testing-library/user-event`, `@testing-library/jest-dom`, `@types/react`, `@types/react-dom`
- [x] scripts: `typecheck`, `test`, `test:watch`, `test:coverage`
- [x] `npm install` succeeds

**Verify**: `npm install && npx vitest --version && npx tsc --version`

---

### T2: Add tsconfig files + CSS ambient module

**What**: Create `tsconfig.json`, `tsconfig.build.json`, and `src/css.d.ts`.
**Where**: `tsconfig.json`, `tsconfig.build.json`, `src/css.d.ts`
**Depends on**: T1
**Reuses**: Config blocks from design.md
**Requirement**: TSM-01, TSM-04

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] `tsconfig.json` has `strict:true`, `jsx:"react-jsx"`, `moduleResolution:"Bundler"`, `noEmit:true`
- [x] `tsconfig.build.json` extends it with `emitDeclarationOnly:true`, `outDir:"dist"`
- [x] `src/css.d.ts` declares `declare module "*.css";`
- [x] `npx tsc --noEmit` runs (errors expected until migration — must not crash on config)

**Verify**: `npx tsc --noEmit --showConfig`

---

### T3: Add Vitest config

**What**: Create `vitest.config.ts` with jsdom env + v8 coverage + 90% thresholds + exclusions.
**Where**: `vitest.config.ts`
**Depends on**: T1
**Reuses**: Config from design.md
**Requirement**: TSM-06, TSM-07

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] `environment:"jsdom"`, `globals:true`, `setupFiles:["./test/setup.ts"]`
- [x] coverage `include:["src/**/*.{ts,tsx}"]`, excludes `index.ts`, `*.stories.tsx`, `*.d.ts`, `types/**`
- [x] thresholds all 90
- [x] `npx vitest run` executes (0 tests OK at this point)

**Verify**: `npx vitest run --coverage` (empty run succeeds)

---

### T4: Add test setup file

**What**: Create `test/setup.ts` importing jest-dom matchers.
**Where**: `test/setup.ts`
**Depends on**: T3
**Requirement**: TSM-06

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] `import "@testing-library/jest-dom/vitest"` present
- [x] `toBeInTheDocument` available in a scratch test

**Verify**: write a throwaway `expect(document.body).toBeInTheDocument()` test, run, delete.

---

### T5: Create shared type helpers

**What**: Create `src/types/index.ts` with `HostProps` and `PolymorphicProps`.
**Where**: `src/types/index.ts`
**Depends on**: T2
**Reuses**: design.md Type Foundation
**Requirement**: TSM-02, TSM-10

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] `HostProps<T>` and `PolymorphicProps<D>` exported
- [x] File typechecks in isolation

**Verify**: `npx tsc --noEmit`

---

### T6: Migrate cx utility (+ test)

**What**: `src/utils/cx.js → cx.ts` with typed signature; add `cx.test.ts`.
**Where**: `src/utils/cx.ts`, `src/utils/cx.test.ts`
**Depends on**: T5
**Requirement**: TSM-11

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] Signature `(...parts: Array<string | false | null | undefined>) => string`
- [x] Test covers: joins truthy, drops `false/null/undefined/""`, empty → `""`
- [x] 100% coverage on `cx.ts`
- [x] Old `.js` removed

**Verify**: `npx vitest run src/utils/cx.test.ts --coverage`

---

### T7: Migrate useReveal hook (+ test)

**What**: `src/hooks/useReveal.js → useReveal.ts`; test both branches.
**Where**: `src/hooks/useReveal.ts`, `src/hooks/useReveal.test.ts`
**Depends on**: T6
**Requirement**: TSM-09
**Reuses**: design.md testing strategy for useReveal

**Tools**: MCP: NONE · Skill: `react-testing-library` (`renderHook`)

**Done when**:

- [x] Return typed as `readonly [RefObject<HTMLElement | null>, boolean]` (or equivalent) — matches current tuple
- [x] Test A: `IntersectionObserver` stubbed to emit `isIntersecting:true` → `isIn` becomes `true`
- [x] Test B: reduced-motion via `matchMedia` mock OR `IntersectionObserver` absent → `isIn` immediately `true`
- [x] Branch coverage on `useReveal.ts` ≥90%
- [x] Old `.js` removed

**Verify**: `npx vitest run src/hooks/useReveal.test.ts --coverage`

---

### T8–T30: Migrate + test each component `[P]`

**Pattern (applies to every component folder):**

- Rename `X.jsx → X.tsx`; type props via `ComponentPropsWithoutRef<host>` or `PolymorphicProps` (T5); keep every export and all runtime/markup/CSS identical.
- Add `X.test.tsx` using the **`react-testing-library`** skill: render + assert visible role/text output for **each** export; exercise every prop branch (variants, `href`, `arrow`, `as`, conditional children) to clear 90%.
- Delete the old `.jsx`.

**Tools (all)**: MCP: NONE · Skill: `react-testing-library`
**Requirement**: TSM-01, TSM-02, TSM-08

| Task | Folder | Exports to cover | Branch/props to hit for 90% |
| --- | --- | --- | --- |
| T8 [P] | Badge | `Badge` | className passthrough |
| T9 [P] | BrandMark | `BrandMark` | default render |
| T10 [P] | Button | `Button` | `href` (link) vs no-href (button), `variant`, `arrow`, `cut` |
| T11 [P] | Callout | `Callout` | variants/children |
| T12 [P] | CaseCard | `CaseGrid`, `CaseCard` | both exports |
| T13 [P] | Chip | `Chip` | props branches |
| T14 [P] | CodeBlock | `CodeBlock`, `Cor`, `Cmt` | three exports |
| T15 [P] | DotsBackground | `DotsBackground` | single render (no branches) |
| T16 [P] | Footer | `Footer` | render + links |
| T17 [P] | HarnessMark | `HarnessMark` | all `variant` values, `tone` mono/color, `endorsement`, `icon` background — inline `.d.ts` then delete it; migrate `.stories.jsx → .stories.tsx` |
| T18 [P] | Logo | `Logo` | render |
| T19 [P] | ModeBlock | `ModeSplit`, `ModeBlock` | both exports |
| T20 [P] | Nav | `Nav` | render + items |
| T21 [P] | Panel | `Panel` | props branches |
| T22 [P] | PinChip | `PinChip` | props |
| T23 [P] | Reveal | `Reveal`, `Stagger` | `as` polymorphism, `in` class toggle (may stub useReveal) |
| T24 [P] | SectionHeading | `SectionHeading` | props |
| T25 [P] | SkillCard | `SkillGrid`, `SkillCard`, `SkillSpinePin` | three exports |
| T26 [P] | SteppedList | `SteppedList`, `SteppedListItem` | both exports |
| T27 [P] | Table | `Table`, `Pkg`, `Stack`, `Cond` | four exports |
| T28 [P] | Terminal | `Terminal` | props |
| T29 [P] | Timeline | `Flow`, `SpineLabel`, `Steps`, `Step`, `Substeps`, `Sub` | six exports — largest; test each |
| T30 [P] | ValueCard | `ValueGrid`, `ValueCard` | both exports |

**Done when (per task)**:

- [x] `.tsx` typechecks under strict; no `.jsx` left in folder
- [x] Every export has a render test; all prop branches exercised
- [x] File-level coverage ≥90% (usually 100% for these)
- [x] Behavior/markup unchanged vs original

**Verify (per task)**: `npx vitest run src/components/<Folder> --coverage`
**Commit (per task)**: `refactor(<component>): migrate to TS + add RTL tests`

---

### T31: Migrate barrel + freeze export parity

**What**: `src/index.js → index.ts`; verify export names identical to original.
**Where**: `src/index.ts`
**Depends on**: T8–T30
**Requirement**: TSM-05

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] All import paths updated to `.tsx`/`.ts` (or extensionless per resolver)
- [x] Export-name set equals original `index.js` (diff empty)
- [x] No `.jsx`/`.js` remain: `find src \( -name '*.jsx' -o -name '*.js' \)` empty
- [x] `npx tsc --noEmit` → 0 errors

**Verify**: compare sorted export identifiers old vs new; `npm run typecheck`

---

### T32: Wire declaration emit + package types

**What**: Point `build.mjs` entry to `index.ts`, add `tsc` declaration step; add `"types"` to `package.json`.
**Where**: `build.mjs`, `package.json`
**Depends on**: T31
**Requirement**: TSM-03, TSM-04

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] `build.mjs` entry = `src/index.ts`; runs `tsc -p tsconfig.build.json` after esbuild
- [x] `package.json` has `"types": "dist/index.d.ts"`
- [x] `npm run build` emits `dist/ds-bundle.js`, `dist/ds-bundle.css`, `dist/index.d.ts`

**Verify**: `npm run build && ls dist/ds-bundle.js dist/ds-bundle.css dist/index.d.ts`
**Commit**: `build: TS entry + emit published declarations`

---

### T33: Full coverage gate + green verification

**What**: Run the whole suite with coverage and confirm the 90% gate + all success criteria.
**Where**: repo-wide
**Depends on**: T32
**Requirement**: TSM-07 (+ all)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] `npm run test:coverage` → lines/branches/functions/statements all ≥90%, exit 0
- [x] `npm run typecheck` → 0 errors
- [x] `npm run build` → all three dist artifacts present
- [x] Any file under 90% has a follow-up test added until the gate passes

**Verify**: `npm run typecheck && npm run test:coverage && npm run build`
**Commit**: `test: enforce 90% coverage gate across design-system`

---

## Parallel Execution Map

```
Phase 0 (Sequential):  T1 → T2 → T3 → T4
Phase 1 (Sequential):  T5 → T6 → T7
Phase 2 (Parallel):    T7 done, then T8..T30 all [P]  (23 independent units)
Phase 3 (Sequential):  all Phase 2 done → T31 → T32 → T33
```

---

## Task Granularity Check

| Task | Scope | Status |
| --- | --- | --- |
| T1–T4 tooling | 1 file each | ✅ Granular |
| T5 types | 1 file | ✅ Granular |
| T6/T7 primitives | 1 module + 1 test | ✅ Granular |
| T8–T30 | 1 component folder + its test | ✅ Granular (cohesive per folder) |
| T31 barrel | 1 file | ✅ Granular |
| T32 build | 2 config files | ✅ Cohesive |
| T33 gate | verification only | ✅ Granular |

---

## Tool & Skill Summary

- **Skill `react-testing-library`** → every component test (T7 hook + T8–T30). Role/label/text queries, `userEvent`, `renderHook`; no implementation-detail assertions.
- **No MCPs required** — all local file + npm operations.
- Suggested execution order note: Phase 2's 23 units are independent and safe to fan out; each commits on its own (`refactor(<component>): …`) keeping commits atomic and revertible.
