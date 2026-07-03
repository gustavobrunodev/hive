# Component Library Expansion Tasks

**Design**: `.specs/features/component-library-expansion/design.md`
**Status**: Draft (planning)

Convention: each task is atomic, ends with a green `typecheck` (and for component tasks, its own RTL test), and is one git commit. A phase is "done" only when `npm run typecheck && npm run test:coverage && npm run build` are all green **and** an `impeccable` audit of that phase's demo passes in both themes. Component tasks marked `[R]` wrap Radix, `[H]` in-house, `[C]` composite.

---

## Execution Plan (phase dependency)

```
Phase 0 (foundations) ──► Phase 1 (forms + overlays) ──► Phase 2 (app-shaping) ──► Phase 3 (chat)
        │                        │                              │
        └ blocks all             └ Radix/token layer            └ needs ScrollArea/Avatar/Textarea
```

Within Phase 1/2/3, component tasks are **parallelizable** once the phase's shared pieces land.

---

## Phase 0 — Foundations (sequential; unblocks everything)

- **T1 — DESIGN.md + PRODUCT.md via impeccable** (F3). Author `PRODUCT.md` (register: product) and `DESIGN.md` (token roles, both themes' OKLCH values, state/motion/icon conventions, contrast targets). *Verify*: files exist; light+dark accent values pass contrast math for text + fills.
- **T2 — Two-layer `tokens.css`** (F1). Add primitive ramps + semantic role tokens under `:root[data-theme=dark|light]`, `:root` mirrors dark, `prefers-color-scheme` default. *Verify*: a scratch demo toggles `data-theme` and recolors; existing dark values unchanged (diff computed values).
- **T3 — Migrate existing 24 components' CSS to role tokens** (Req P1.3). Mechanical raw→role swap (`--coral`→`--accent`, etc.). *Verify*: `test` still green; marketing demo renders pixel-identical on dark (visual diff).
- **T4 — Radix + libs deps + build check** (F2, Quality.3/5). Add `@radix-ui/*`, `cmdk`, `react-resizable-panels` to `dependencies`; confirm esbuild bundles them with react external. *Verify*: `npm run build` emits single JS+CSS+`.d.ts`; bundle imports resolve; `react`/`react-dom` stay external.
- **T5 — Shared primitives + z-scale** (F4). `useControllableState`, `useAutosizeTextarea`, `VisuallyHidden`, z-index token scale; jsdom polyfills (`ResizeObserver`, `matchMedia`, `scrollIntoView`) in `test/setup.ts`. *Verify*: unit tests for hooks; polyfills load.

```
T1 → T2 → T3
     T2 → T4 → T5
```

---

## Phase 1 — Forms + Overlays + Loading (parallel after T5)

Forms:
- **T6 — Input** [H] — states + `aria-invalid`, startIcon slot.
- **T7 — Textarea (autosize)** [H] — min/max rows via `useAutosizeTextarea`.
- **T8 — Label** [H] + **T9 — Field** [H] — wires `htmlFor`/`id`/`aria-describedby`/`aria-invalid`, description + error slots. (T9 depends T6–T8.)
- **T10 — Checkbox** [R] · **T11 — RadioGroup** [R] · **T12 — Switch** [R] · **T13 — Select** [R] · **T14 — Slider** [R].

Overlays:
- **T15 — Dialog** [R] · **T16 — AlertDialog** [R] · **T17 — Popover** [R] · **T18 — Tooltip** [R] · **T19 — DropdownMenu** [R] · **T20 — Toast** [R] (+ `useToast()` API, stacking viewport).

Feedback:
- **T21 — Spinner** [H] (`role=status`) · **T22 — Skeleton** [H] (reduced-motion shimmer).

*Per-task verify*: RTL asserts the state contract + a11y (role, label wiring, keyboard, focus trap/restore for overlays, live-region for Toast); reduced-motion fallback; renders in both themes.
*Phase gate*: export all from `index.ts`; README rows; `typecheck + test:coverage + build` green; `impeccable audit` of a Phase-1 demo in both themes.

---

## Phase 2 — App-shaping primitives (parallel after Phase 1 gate)

- **T23 — Separator** [R] · **T24 — Tabs** [R] · **T25 — Accordion** [R].
- **T26 — ScrollArea** [R] — tokenized thin scrollbars + native fallback.
- **T27 — Sheet/Drawer** [R] — `side` prop over Dialog primitives.
- **T28 — ContextMenu** [R] — pointer + keyboard fallback.
- **T29 — Avatar** [R] — size + status-dot slot.
- **T30 — Progress** [R] · **T31 — Alert** [H] (variants info/success/warning/danger; **no side-stripe** — full border/tinted bg) · **T32 — Empty** [H] (icon/title/desc/action slots) · **T33 — Kbd** [H] · **T34 — Breadcrumb** [H] (overflow/collapse).
- **T35 — Resizable** [H] — wrap `react-resizable-panels`; tokenized handle, keyboard, persistence via `useControllableState`.
- **T36 — Tree** [H] — WAI-ARIA tree pattern: roles, roving tabindex, arrow/Home/End/type-ahead, expand/collapse, single+multi select, render-prop rows. (Largest single task — has its own sub-checklist for keyboard branches.)
- **T37 — Command** [R/H] — `cmdk` inside DS `Dialog`; groups, empty state, `Kbd` hints.

*Per-task verify*: ARIA roles + keyboard nav (esp. Tree, Command, Resizable handle); ScrollArea native fallback; both themes.
*Phase gate*: exports + README + full green + `impeccable audit` of a demo that mounts a **chat/workspace split skeleton** (Resizable + ScrollArea + Tree + Tabs) in both themes.

---

## Phase 3 — Generic AI-chat primitives (after Phase 2 gate; D4 = stay generic)

- **T38 — ChatMessage/Bubble** [C] — `role=user|assistant|system`, avatar/content/timestamp/actions slots, role alignment.
- **T39 — TypingIndicator** [H] — accessible status + reduced-motion.
- **T40 — MessageList** [C] — auto-scroll pin-to-latest unless scrolled up; "jump to latest" affordance (uses ScrollArea).
- **T41 — Attachment** [C] — chip with remove callback.
- **T42 — PromptInput** [C] — autosize Textarea + toolbar + send (disabled empty/streaming) + Attachment slot + keyboard submit.

*Per-task verify*: role-based alignment; send disabled-when-empty; auto-scroll pins to latest; Attachment remove fires callback; no transport/model coupling.
*Phase gate*: exports + README + full green + `impeccable audit` of a **full chat demo** in both themes.

---

## Cross-cutting closeout

- **T43 — README + index audit** — component table complete; export-name diff shows only additions (Req Quality.4).
- **T44 — CONCERNS entry** — record the runtime-dep/bundle-size follow-up (per-component `exports` map) and the Radix jsdom-polyfill notes.
- **T45 — Final gate** — `npm run typecheck && npm run test:coverage && npm run build` green; coverage ≥90%; STATE.md updated to "execution complete".

---

## Requirement Traceability

| Task(s) | Req |
| --- | --- |
| T1–T5 | F1–F4, Quality.3/5, P1(theme) |
| T6–T14 | Accessible form controls (P1) |
| T15–T20 | Overlays & menus (P1) |
| T21–T22 | Loading & empty affordances (P1) |
| T23–T37 | App-shaping structure primitives (P2) |
| T38–T42 | Generic AI-chat primitives (P3) |
| T43–T45 | Quality & API integrity (P1) |

## Suggested first commit

`T1` (DESIGN.md/PRODUCT.md via impeccable) — it fixes the token values every later task consumes and satisfies the "all UX through impeccable" rule up front.
