# Codebase Concerns

**Analysis Date:** 2026-07-03 (component-library-expansion feature, T44)

## Performance Bottlenecks

**Single-bundle esbuild output now includes all of Radix + cmdk + react-resizable-panels:**

- Problem: `dist/ds-bundle.js` bundles every `@radix-ui/react-*` package the barrel imports (20 packages), `cmdk`, and `react-resizable-panels` into one file — a consumer using only `Button` and `Input` still ships the code for `Tree`, `Command`, `Resizable`, etc.
- Files: `build.mjs`, `src/index.ts`
- Measurement: not yet measured against a target budget; flagged in `design.md`'s original CONCERNS as an accepted tradeoff, not re-measured here.
- Cause: `esbuild`'s single-entry-point bundling with only `react`/`react-dom` external (by design — see `design.md`'s Dependency Plan).
- Improvement path: per-component `exports` map (e.g. `@hive/design-system/dialog`) so consumers import only what they use, with a matching `build.mjs` change to emit one bundle per component instead of one barrel bundle. Out of scope for this feature (design.md flagged this explicitly); worth doing before the desktop app's initial bundle-size budget is set.

## Fragile Areas

**Radix-vs-jsdom test gaps in pointer/geometry-dependent components:**

- Files: `src/components/Resizable/Resizable.test.tsx`, `src/components/MessageList/MessageList.test.tsx`, `src/components/ScrollArea/ScrollArea.test.tsx`
- Why fragile: jsdom performs no real layout (`getBoundingClientRect`, `scrollHeight`/`clientHeight` are inert/zero, `ResizeObserver` is a no-op polyfill, `Element.prototype.scrollTo` doesn't exist). Components that depend on real scroll/resize geometry (`react-resizable-panels`' keyboard-resize codepath, `MessageList`'s ResizeObserver-driven auto-follow, `ScrollArea`'s overflow-based scrollbar visibility) have real, working logic that is only partially exercised by the test suite — the untestable branches are documented inline as comments at each call site, not silently skipped.
- Common failures: `react-resizable-panels`' `adjustLayoutByDelta` actually throws (`"Previous layout not found for panel index 0"`) if a keyboard-resize keydown is dispatched in jsdom — `Resizable.test.tsx` deliberately does not exercise that codepath for this reason.
- Safe modification: when touching these components, don't try to "fix" jsdom to make the geometry-dependent branches pass — that's fighting the test environment, not a real bug. Verify geometry-dependent behavior manually in a real browser (or via `impeccable`'s live-preview mechanism) instead.
- Test coverage: global coverage stays ≥90% on all four metrics regardless (per-file dips in `functions`% on these three files are accounted for by the untestable branches above, not missing test *intent*).

## Bugs Found During Storybook Documentation (not fixed — behavior frozen)

**`Button` doesn't forward its ref, so `asChild`-style composition logs a React warning:**

- Found: `storybook-documentation` feature, T75 Playwright MCP spot-check on `Overlays/Dialog`'s `Default` story (`<Dialog.Trigger asChild><Button>...</Button></Dialog.Trigger>`).
- Symptom: browser console logs `Warning: Function components cannot be given refs. Attempts to access this ref will fail. Did you mean to use React.forwardRef()?` pointing at `Button.tsx`. The dialog still opens and is fully operable/themed — Radix's `Slot` merges the trigger's other props (onClick, etc.) independently of the ref, so this is silent/non-fatal today.
- Cause: `Button` (`src/components/Button/Button.tsx`) is a plain function component, not wrapped in `React.forwardRef`. Any future `asChild`/composition pattern that needs Radix to imperatively focus or measure the underlying DOM node (not just click it) would silently fail to do so.
- Impact: `src/components/Button/Button.tsx` only, and only in `asChild`-composition contexts (Dialog/AlertDialog/Sheet/Tooltip triggers wrapping a `Button` — Popover/DropdownMenu triggers etc. would hit the same warning if a story or consumer composes them the same way).
- Not fixed here: `storybook-documentation`'s scope is docs/stories only, component behavior/public API is frozen (see `context.md`'s standing constraints). Adding `forwardRef` is a safe, additive change (no prop/behavior change) but belongs to a future component-fix pass, not a docs feature.
- Fix sketch for that future pass: wrap `Button`'s function body in `React.forwardRef<HTMLButtonElement | HTMLAnchorElement, ButtonProps>(...)`, forward the ref onto the rendered `<button>`/`<a>`, and update `ButtonProps` if a typed ref export is desired.

## Dependencies at Risk

**`react-resizable-panels` — installed major version's public API differs from what `design.md` assumed:**

- Risk: `design.md` was authored assuming the library's classic `PanelGroup`/`Panel`/`PanelResizeHandle` export names (an older major version). The actually-installed `react-resizable-panels@4.12.0` exports `Group`/`Panel`/`Separator` instead — a breaking rename between majors. `Resizable.tsx` wraps the real installed API; the DS's own public names (`Resizable`/`ResizablePanel`/`ResizableHandle`) are unaffected, but a future `npm update` to a newer major could rename the underlying API again.
- Impact: `src/components/Resizable/Resizable.tsx` only — the DS's own public API is insulated from this by the wrapper.
- Migration plan: pin the installed major in `package.json` (currently `^4.12.0`, so npm won't auto-jump to a new major); when intentionally upgrading, re-read the installed `.d.ts` before assuming any export name, per the lesson in `.specs/project/STATE.md`.

**`cmdk`'s bundled `CommandDialog` is a second, separate Radix Dialog instance:**

- Risk: `cmdk` ships its own `CommandDialog` (wrapping its own internal `@radix-ui/react-dialog` usage) that does *not* set `aria-modal` and doesn't share this system's `Dialog` component's focus/z-index/motion conventions. `src/components/Command/Command.tsx`'s `CommandDialog` deliberately does NOT use cmdk's version — it composes cmdk's bare `Command` root inside the DS's own already-built `Dialog`. A future contributor "simplifying" `Command.tsx` by switching to cmdk's bundled `CommandDialog` would silently reintroduce a second, inconsistent dialog implementation (missing `aria-modal`, different z-index scale, no `cut` support).
- Impact: `src/components/Command/Command.tsx` only.
- Migration plan: none needed — this is a "don't do X" note, not an open risk requiring action.

## Known jsdom Polyfill Requirements

`test/setup.ts` polyfills, all required by Radix-backed components in this feature and unlikely to be removable while Radix remains the a11y engine:

- `ResizeObserver` (no-op stand-in) — Radix `ScrollArea`/`Select`, `useAutosizeTextarea`, `MessageList`.
- `window.matchMedia` (safe default, `matches: false`) — every `prefers-reduced-motion` check across the library.
- `Element.prototype.scrollIntoView` (no-op) — Radix `Select`, list-style keyboard navigation.
- `Element.prototype.hasPointerCapture`/`setPointerCapture`/`releasePointerCapture` — Radix `Select` and other pointer-driven primitives throw without these; added in T13 after hitting the failure directly (see `.specs/project/STATE.md`'s Lessons).

If a future Radix version or a new component pulls in another browser API jsdom doesn't implement, add the polyfill here (never inline it in a single component's test file) and document the reason, following the existing pattern.
