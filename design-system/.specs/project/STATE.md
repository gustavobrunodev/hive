# STATE — @hive/design-system

Persistent memory across sessions. Load at session start.

## Active Feature

**`component-library-expansion`** — expand the DS with ~25–35 interactive components (shadcn/ui as catalog reference, Radix UI as a11y engine), add a light theme alongside dark, for a future AI-chat + file-explorer desktop app. Planning **done** (spec + design + tasks, 2026-07-03). Execution **in progress**: Phase 0 foundations, Phase 1 forms/overlays/feedback, and Phase 2 app-shaping primitives are all **complete** (T1–T37, 2026-07-03) — 32 components landed total. Phase 2 added: Separator, Tabs, Accordion, ScrollArea, Sheet, ContextMenu, Avatar, Progress, Alert, Empty, Kbd, Breadcrumb, Resizable, Tree, Command. Phase 2 gate green: typecheck/test:coverage/build all pass, 555 tests, coverage 99.80/98.67/96.66/99.80% (lines/branches/functions/statements). All 20 landed Radix/cmdk/react-resizable-panels deps are now actually in use. Next: Phase 3 generic AI-chat primitives (T38–T42: ChatMessage, TypingIndicator, MessageList, Attachment, PromptInput), then cross-cutting closeout (T43–T45). See `.specs/features/component-library-expansion/{spec,design,tasks}.md`.

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

## Todos

- Phase 3 (T38–T42): ChatMessage/Bubble, TypingIndicator, MessageList, Attachment, PromptInput.
- Cross-cutting closeout (T43–T45): full README/index export-diff audit, CONCERNS entry, final gate.

## Preferences

- Lightweight tasks (validation, STATE updates, session handoff) run fine on faster/cheaper models.
