# STATE — @hive/design-system

Persistent memory across sessions. Load at session start.

## Active Feature

None. `component-library-expansion` — expanded the DS with 37 new interactive components (shadcn/ui as catalog reference, Radix UI as a11y engine) plus a light theme alongside dark, for a future AI-chat + file-explorer desktop app. Planning **done** (spec + design + tasks). Execution **complete** (Phase 0–3, T1–T45 all done, 2026-07-03):

- **Phase 0 (foundations):** `PRODUCT.md`/`DESIGN.md` (impeccable, contrast-verified OKLCH for both themes), two-layer `tokens.css` (primitives + semantic roles under `data-theme`), all 24 marketing components migrated to role tokens, 20 Radix/`cmdk`/`react-resizable-panels` deps, shared hooks (`useControllableState`, `useAutosizeTextarea`, `VisuallyHidden`), z-index scale, jsdom polyfills.
- **Phase 1 (forms/overlays/feedback, 17 components):** Input, Textarea, Label, Field, Checkbox, RadioGroup, Switch, Select, Slider, Dialog, AlertDialog, Popover, Tooltip, DropdownMenu, Toast+`useToast()`, Spinner, Skeleton.
- **Phase 2 (app-shaping primitives, 15 components):** Separator, Tabs, Accordion, ScrollArea, Sheet, ContextMenu, Avatar, Progress, Alert, Empty, Kbd, Breadcrumb, Resizable, Tree, Command.
- **Phase 3 (generic AI-chat primitives, 5 components):** ChatMessage, TypingIndicator, MessageList, Attachment, PromptInput.
- **Closeout:** README/index export-diff audit (T43, found and fixed 3 pre-existing documentation gaps), `.specs/codebase/CONCERNS.md` authored (T44), final gate green.

Final gate: `npm run typecheck && npm run test:coverage && npm run build` all green — 599 tests, coverage 99.69/98.31/93.13/99.69% (lines/branches/functions/statements, all ≥90%), single `dist/ds-bundle.js` (883KB) + `dist/ds-bundle.css` (89KB) + `dist/index.d.ts`, `react`/`react-dom` stay external. Every component folder has exactly one barrel export (verified empty diff both directions). See `.specs/features/component-library-expansion/{spec,design,tasks}.md` and `.specs/codebase/CONCERNS.md` for the bundle-size follow-up (per-component `exports` map — not yet done, flagged for a future feature).

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
- DESIGN.md documented a `--rounded-sm/md/lg/full` corner scale in prose and frontmatter, but T2 never added it to `tokens.css` — Popover.css shipped referencing an undefined `var(--rounded-md)`. Fixed in a standalone commit before it spread to more components; worth double-checking DESIGN.md-vs-tokens.css parity after any future token-authoring pass.
- jsdom gaps hit repeatedly across Radix-backed Phase 1 components, now polyfilled in `test/setup.ts`: `hasPointerCapture`/`setPointerCapture`/`releasePointerCapture` (Select and other pointer-driven primitives throw without them).
- Real Radix-vs-jsdom timing/behavior quirks worth remembering for future Radix work: (1) `RadioGroup`'s arrow-key auto-select relies on an `isArrowKeyPressedRef` set on native `keydown` and cleared on `keyup` — `userEvent.keyboard("{ArrowDown}")` fires both back-to-back faster than the group's deferred `setTimeout(0)` focus-move, so use the hold syntax `{ArrowDown>}` / `{/ArrowDown}` instead. (2) `@radix-ui/react-dialog`/`react-alert-dialog` do NOT set `aria-modal` on `Content` despite `modal=true` being the default — our wrappers add it explicitly. (3) `AlertDialogContent` only blocks outside-click by default (`onPointerDownOutside`/`onInteractOutside`), NOT Escape — our wrapper overrides `onEscapeKeyDown` too, since spec.md requires AlertDialog to always need an explicit choice. (4) Radix Toast's pause-on-hover listens for `pointermove`/`focusin` (bubbling) on a `role="region"` wrapper around the viewport, but resumes only on `pointerleave`/`focusout` (non-bubbling) — dispatch `pointerleave` directly on the region element in tests, not a descendant.
- Component tasks that don't touch shared files (`src/index.ts`, `README.md`, `test/setup.ts`) are safe to build fully in parallel; barrel/README wiring is best done once at the phase gate to avoid merge races. New shared-file needs discovered mid-phase (e.g. a missing jsdom polyfill) should be landed as their own small commit rather than folded into a component commit.
- Twice during Phase 2, the harness process itself restarted mid-batch (unrelated to the earlier session-limit event) — background subagents mid-task showed `status: "stopped"` with no completion record on resume. Both times, the agents' file writes had already landed on disk (some had even self-committed) before the interruption; recovery was: check `git log`/`git status` for what actually landed, run `typecheck`/`test`/`coverage` on whatever's uncommitted to verify it's real and working, then commit per-component. Lesson: never trust a "stopped"/truncated agent summary — always verify actual repo state directly rather than re-doing work or assuming failure.
- `react-resizable-panels`'s installed v4.12 API is `Group`/`Panel`/`Separator` (not the classic `PanelGroup`/`Panel`/`PanelResizeHandle` naming design.md assumed from an older major version) — always check the installed package's actual `.d.ts`/source before wrapping a third-party dep, even when a design doc names specific exports.
- `cmdk`'s bundled `CommandDialog` wraps its own separate Radix Dialog instance (and doesn't set `aria-modal` either) — `Command.tsx` instead composes cmdk's bare `Command` root inside this system's own already-built `Dialog` component, reusing its focus trap/`aria-modal`/z-index/motion conventions rather than shipping two different dialog implementations.
- `react-resizable-panels`' keyboard-resize codepath (`onDocumentKeyDown` → `adjustLayoutByDelta`) asserts on real prior-layout state and throws in jsdom (`"Previous layout not found for panel index 0"`) because jsdom has no real layout geometry — a third-party library limitation, not fixable from a styling wrapper; the test suite exercises focus/ARIA/prop-forwarding instead of actually pressing a resize key.
- Radix's `Separator` primitive (`@radix-ui/react-separator@1.1.11` as installed) does NOT default `decorative` to `true` internally (no default parameter value) — the DS wrapper sets the default itself so `role="separator"` is correctly absent unless a consumer explicitly opts out of decorative mode. Verify installed-package defaults directly rather than assuming a prop's documented "default" is applied automatically.
- The full 45-task execution used a consistent two-tier commit rhythm that worked cleanly across 37 components: (1) one commit per component (its own `.tsx`+`.css`+`.test.tsx`, never touching `index.ts`/`README.md`/`test/setup.ts`) so components stay parallelizable without merge races; (2) at each phase gate, one `docs` commit wiring that phase's barrel exports + README rows, then one `chore` commit rebuilding `dist/`+`coverage/` (both tracked in git for this package). Small shared-file fixes discovered mid-phase (a missing token, a new jsdom polyfill) got their own tiny standalone commit between component commits rather than being folded into whichever component happened to need them. Worth repeating verbatim for any future multi-component DS expansion.
- `ScrollArea`'s `Root` ref only reaches the outer wrapper, not the actual scrolling `Viewport` element — components needing real scroll-position access (like `MessageList`'s pin-to-latest behavior) need a `viewportRef` prop threaded through explicitly. Added as a small backward-compatible extension in T40 rather than having `MessageList` reimplement `ScrollArea`'s Root/Viewport/Scrollbar structure itself.
- Native `scroll` events (like `pointerleave`/`focusout`) do not bubble — a handler passed as an `onScroll` prop to an *ancestor* of the real scrolling element will never fire. Attach scroll listeners via `addEventListener` directly on the actual scrollable DOM node (obtained via a ref), not through a wrapper component's prop.

## Todos

None. `component-library-expansion` execution finished 2026-07-03. Next feature (not yet planned): the actual desktop app consuming this package (AI-chat screen + workspace/file-explorer pane) — a separate project per D4, not part of this package's scope. See `.specs/codebase/CONCERNS.md` for the deferred per-component `exports`/bundle-size follow-up.

## Preferences

- Lightweight tasks (validation, STATE updates, session handoff) run fine on faster/cheaper models.
