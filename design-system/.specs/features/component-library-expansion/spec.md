# Component Library Expansion Specification

## Problem Statement

`@hive/design-system` today ships 24 **presentational** components extracted from the Harness Builder marketing site (dark "Zup" brand: bordo/coral, cut corners, dot gradients). They cover brand/marketing surfaces but provide almost none of the **interactive** primitives a real application needs: no accessible form controls, no overlays (dialog, popover, dropdown, tooltip), no menus, no tabs, no data-tree, no toast, no loading/empty affordances.

We are about to build a **desktop application** on top of this system whose two primary features are:

1. **AI chat** — a conversation surface with an AI agent (message list, prompt composer, streaming, attachments, avatars).
2. **Workspace file explorer** — a tree of files/folders with selection, context actions, and a resizable split against the chat.

To build that app we must expand the design system with a batch of common, reusable **interactive** components, using [shadcn/ui](https://ui.shadcn.com/docs/components) as the catalog and behavioral reference (not its implementation). The system must also gain a **light theme** alongside the existing dark theme, and every component's UX must be designed through the `impeccable` skill (product register).

## Approved Decisions (from planning discussion, 2026-07-03)

| # | Decision | Rationale |
| --- | --- | --- |
| D1 | **Accessibility via Radix UI primitives**, styled with our tokens/CSS. | Same model shadcn uses; battle-tested a11y (focus trap, dismiss, positioning, ARIA, roving-tabindex). Accepted cost: introduces the first runtime dependencies (`@radix-ui/*`) into a previously zero-dep package. |
| D2 | **Desktop-app-driven subset** (~25–35 components), not full shadcn parity. | Prioritize what the AI-chat + file-explorer app actually needs. |
| D3 | **Ship light + dark themes now.** | IDE-style file/chat apps commonly need both; retrofitting later means touching every component's CSS. |
| D4 | **Generic primitives live in the DS; product composition lives in the app.** | DS ships `Tree`, `ScrollArea`, `Resizable`, `ChatMessage`, `Avatar`; the actual chat screen and workspace pane are assembled in the desktop app. Keeps the DS app-agnostic. |

## Goals

- [ ] **Theming foundation**: semantic token layer (role-based CSS custom properties) driving **both** a `dark` and a `light` theme, switchable via `data-theme` on a root element, with `prefers-color-scheme` default. Existing 24 components render unchanged on the dark theme.
- [ ] **Radix integration**: `@radix-ui/*` primitives added as runtime deps; build (`build.mjs`) still emits a single ESM bundle + single CSS bundle + published `.d.ts`, with `react`/`react-dom` external.
- [ ] **~25–35 new interactive components** delivered in prioritized phases, each following the existing folder/`hds-` convention, each with `.tsx` + `.css` + `.test.tsx`.
- [ ] **impeccable-governed UX**: every interactive component ships the full state set (default, hover, focus-visible, active, disabled, selected, loading, error where applicable), plus loading (skeleton/spinner) and empty affordances where relevant.
- [ ] **Accessibility**: keyboard operable, correct ARIA/roles, visible focus, `prefers-reduced-motion` honored, contrast ≥4.5:1 body / ≥3:1 large — verified per component.
- [ ] **Quality bar preserved**: strict TS, RTL tests, global coverage ≥90% maintained; `typecheck + test:coverage + build` all green.
- [ ] **Docs**: `PRODUCT.md` + `DESIGN.md` (impeccable) authored; `README.md` component table extended; every new export added to `src/index.ts`.

## Out of Scope

| Item | Reason |
| --- | --- |
| Building the desktop application itself (chat screen, workspace pane) | This feature ships the DS primitives; the app is a separate consumer project (D4). |
| Full shadcn parity (Calendar, DatePicker, Carousel, Chart, Data Table, Pagination, Menubar, InputOTP, Navigation Menu) | Not needed by the two app features now; deferrable follow-ups (D2). |
| Adopting Tailwind | System uses hand-written per-component CSS + tokens; convention preserved. |
| Rewriting the existing 24 marketing components | They stay; they only inherit the new semantic token aliases so they still render on dark. |
| Markdown rendering / syntax highlighting engine inside chat messages | App concern; DS exposes slots, not a markdown parser. `CodeBlock` already exists. |
| Icon library authored from scratch | DS documents an icon convention (size/stroke/currentColor slot); the app supplies icon assets. |
| CI pipeline wiring | Local scripts only; follow-up. |

---

## Component Inventory (target subset)

Legend: **[R]** = built on a Radix primitive · **[H]** = in-house (no Radix) · **[C]** = composite of DS primitives · ⭐ = MVP for the two app features.

### Phase 0 — Foundations (no user-facing component; unblocks everything)
- F1. Semantic theming layer + `light`/`dark` themes (`tokens.css` refactor) ⭐
- F2. Radix runtime-dep integration + build/bundle updates ⭐
- F3. `PRODUCT.md` + `DESIGN.md` (impeccable) + icon/state conventions ⭐
- F4. Shared primitives: `Portal`/z-index scale, `VisuallyHidden`, `useControllableState` hook

### Phase 1 — Core primitives (forms + overlays) ⭐ MVP
Forms: **Input** [H], **Textarea** (autosize) [H], **Label** [H], **Field** (label+control+description+error) [H], **Checkbox** [R], **RadioGroup** [R], **Switch** [R], **Select** [R], **Slider** [R]
Overlays: **Dialog** [R], **AlertDialog** [R], **Popover** [R], **Tooltip** [R], **DropdownMenu** [R], **Toast** [H/R]
Feedback: **Spinner** [H], **Skeleton** [H]

### Phase 2 — App-shaping primitives ⭐ MVP for chat + explorer
Structure: **Tabs** [R], **Accordion** [R], **Separator** [R], **ScrollArea** [R], **Resizable** [H], **Sheet/Drawer** [R]
Navigation/data: **ContextMenu** [R], **Command** (palette) [R/H], **Breadcrumb** [H], **Tree** (file explorer) [H], **Avatar** [R], **Progress** [R], **Alert** [H], **Empty** [H], **Kbd** [H]

### Phase 3 — AI-chat primitives (generic, DS-level per D4)
**ChatMessage / Bubble** (role: user/assistant/system) [C], **MessageList** (auto-scroll conversation container) [C], **PromptInput** (Textarea + toolbar + send + attachment slot) [C], **Attachment** chip [C], **TypingIndicator** [H]

> Exact count flexes 25–35; phases are independently shippable. Phase boundaries are the delivery contract, not the individual counts.

---

## User Stories

### P1: Themeable foundation (light + dark) ⭐ MVP

**User Story**: As a design-system consumer, I want a semantic token layer that drives both a light and a dark theme so that the app can offer theme switching without me restyling components.

**Why P1**: Every new component consumes these tokens; authoring components before the semantic layer means reworking their CSS (D3).

**Acceptance Criteria**:
1. WHEN a root element carries `data-theme="light"` or `data-theme="dark"` THEN system SHALL resolve all component colors from role tokens (e.g. `--bg`, `--surface`, `--surface-2`, `--ink`, `--muted`, `--border`, `--accent`, `--accent-ink`, `--focus`, plus `--danger`/`--warning`/`--success`/`--info`) for that theme.
2. WHEN no `data-theme` is set THEN system SHALL fall back to `prefers-color-scheme`, defaulting to `dark`.
3. WHEN the existing 24 marketing components render under `data-theme="dark"` THEN system SHALL render them visually unchanged from today (Zup palette preserved as the dark theme's values).
4. WHEN body text renders on any surface in either theme THEN system SHALL meet contrast ≥4.5:1 (≥3:1 for large text), verified.
5. WHEN a consumer references a raw brand hex (e.g. `--coral`) THEN system SHALL still expose it, but components SHALL consume only role tokens.

**Independent Test**: Toggle `data-theme` on a demo page; every new component and a sample of existing ones recolor correctly; automated contrast check passes for both themes.

---

### P1: Accessible form controls ⭐ MVP

**User Story**: As an app developer, I want accessible Input, Textarea, Label, Field, Checkbox, RadioGroup, Switch, Select, and Slider so that I can build the prompt composer and settings forms.

**Why P1**: The chat prompt composer and any settings depend on these; forms are the most-reused primitive class.

**Acceptance Criteria**:
1. WHEN a form control renders THEN system SHALL expose default, hover, focus-visible, active, disabled, and error visual states (impeccable product requirement).
2. WHEN a control is associated with a `Label`/`Field` THEN system SHALL wire `htmlFor`/`id`/`aria-describedby`/`aria-invalid` so screen readers announce label, description, and error.
3. WHEN a user operates any control by keyboard THEN system SHALL support the expected keys (Space/Enter toggle, arrow keys for RadioGroup/Slider/Select) with a visible focus ring using `--focus`.
4. WHEN `Textarea` is used as the chat composer THEN system SHALL support auto-resize between a min and max row count and expose an `onSubmit` affordance (Enter to send / Shift+Enter newline is the app's choice via props).
5. WHEN a control is `disabled` THEN system SHALL be non-interactive, not focusable, and rendered at reduced emphasis (no full-saturation accent).
6. WHEN a Radix-backed control (Checkbox, RadioGroup, Switch, Select, Slider) renders THEN system SHALL delegate a11y/keyboard behavior to the Radix primitive and supply only tokenized styling.

**Independent Test**: RTL tests assert role, label association, keyboard toggling, `aria-invalid` on error, and disabled non-focusability for each control.

---

### P1: Overlays & menus ⭐ MVP

**User Story**: As an app developer, I want Dialog, AlertDialog, Popover, Tooltip, DropdownMenu, and Toast so that I can build confirmations, hover hints, action menus, and notifications.

**Why P1**: File actions (rename/delete → AlertDialog, context via DropdownMenu), chat affordances (Tooltip, Toast on error) all need these.

**Acceptance Criteria**:
1. WHEN an overlay opens THEN system SHALL trap focus, render above content via a portal on a semantic z-index scale, and restore focus to the trigger on close.
2. WHEN a user presses `Escape` or clicks the backdrop/outside THEN system SHALL dismiss the overlay (except AlertDialog, which SHALL require an explicit choice).
3. WHEN an overlay is positioned near a viewport edge THEN system SHALL flip/shift to stay visible (Radix positioning), never clipped by an `overflow` ancestor.
4. WHEN a Tooltip is shown THEN system SHALL be keyboard-reachable (focus triggers it) and hidden from the a11y tree as redundant when its content duplicates an accessible name.
5. WHEN a Toast is published THEN system SHALL announce via an ARIA live region, auto-dismiss after a configurable timeout, and be pausable on hover/focus; multiple toasts SHALL stack.
6. WHEN `prefers-reduced-motion: reduce` is set THEN system SHALL replace enter/exit motion with an instant or crossfade transition.

**Independent Test**: RTL tests assert open/close via keyboard + outside click, focus trap and restore, `role="dialog"`/`aria-modal`, live-region announcement for Toast.

---

### P1: Loading & empty affordances ⭐ MVP

**User Story**: As an app developer, I want Skeleton and Spinner so that I can show loading without janky spinners mid-content, per the product register.

**Why P1**: Chat streaming and file-tree loading both need non-jarring loading states.

**Acceptance Criteria**:
1. WHEN content is loading in place THEN system SHALL offer `Skeleton` blocks that match the eventual content's shape.
2. WHEN an inline/blocking action is pending THEN system SHALL offer `Spinner` with an accessible label (`role="status"`/`aria-live`).
3. WHEN reduced motion is set THEN system SHALL keep the shimmer/spin subtle or static per `prefers-reduced-motion`.

**Independent Test**: RTL asserts `role="status"` and reduced-motion behavior; visual check that skeleton matches target layout.

---

### P2: App-shaping structure primitives ⭐ MVP for the two app features

**User Story**: As the app builder, I want Tabs, Accordion, Separator, ScrollArea, Resizable, Sheet, ContextMenu, Command, Breadcrumb, Tree, Avatar, Progress, Alert, Empty, and Kbd so that I can assemble the chat/workspace split, the file tree, and a command palette.

**Why P2**: Depends on Phase 0/1 primitives; these compose them into the app's structural surfaces (D4 keeps them generic).

**Acceptance Criteria**:
1. WHEN the workspace and chat are laid out side by side THEN system SHALL provide `Resizable` panes with a keyboard-operable, ARIA-`separator` handle and min/max constraints that persist size via a controllable prop.
2. WHEN a long list (message log, file tree) renders THEN system SHALL provide `ScrollArea` with tokenized custom scrollbars that do not clip overlays and degrade to native scroll when unsupported.
3. WHEN the file explorer renders a hierarchy THEN system SHALL provide a `Tree` implementing the WAI-ARIA tree pattern: `role="tree"/"treeitem"/"group"`, roving tabindex, arrow-key navigation, expand/collapse, `aria-expanded`/`aria-selected`, single/multi-select via props.
4. WHEN a user right-clicks a tree item THEN system SHALL open a `ContextMenu` (Radix) at the pointer with keyboard fallback (context-menu key / long-press).
5. WHEN a user invokes the command palette THEN system SHALL provide `Command` with type-to-filter, keyboard navigation, grouped items, empty state, and `Kbd` shortcut hints.
6. WHEN a file path is shown THEN system SHALL provide `Breadcrumb` with a collapse/overflow affordance for deep paths.
7. WHEN a surface has no content THEN system SHALL provide an `Empty` component that teaches the interface (icon slot, title, description, action slot), not a blank area.
8. WHEN each of these renders THEN system SHALL follow the full state set and reduced-motion rules as in P1.

**Independent Test**: RTL asserts ARIA roles and keyboard nav for Tree, Tabs, Accordion, Command; Resizable handle moves via arrow keys; ScrollArea falls back to native.

---

### P3: Generic AI-chat primitives

**User Story**: As the app builder, I want ChatMessage/Bubble, MessageList, PromptInput, Attachment, and TypingIndicator so that the chat screen is assembly, not reinvention — while these stay generic (D4).

**Why P3**: Highest-level compositions; depend on Phase 1/2 primitives (Avatar, Textarea, ScrollArea, Tooltip, DropdownMenu).

**Acceptance Criteria**:
1. WHEN a message renders THEN system SHALL support `role` = `user | assistant | system`, an avatar slot, a content slot (children — app supplies rendered markdown), timestamp, and an actions slot (copy/retry), with role-appropriate alignment and tokenized styling.
2. WHEN the assistant is generating THEN system SHALL provide a `TypingIndicator` with an accessible "assistant is responding" status and reduced-motion fallback.
3. WHEN new messages arrive in `MessageList` THEN system SHALL keep the view pinned to the latest message unless the user has scrolled up, and expose a "jump to latest" affordance when unpinned.
4. WHEN a user composes a prompt in `PromptInput` THEN system SHALL provide an auto-resizing `Textarea`, a send control disabled while empty/streaming, an attachment slot rendering `Attachment` chips, and keyboard submit.
5. WHEN these compose DS primitives THEN system SHALL NOT hardcode app-specific behavior (no transport, no model calls); all data arrives via props/children.

**Independent Test**: RTL asserts role-based alignment, send disabled-when-empty, auto-scroll-pins-to-latest, and that removing an Attachment fires its callback.

---

### P1: Quality & API integrity ⭐ MVP

**User Story**: As a maintainer, I want the expansion to preserve the strict-TS, tested, single-bundle quality bar so that the package stays trustworthy.

**Why P1**: The system's value is its reliability; regressions here break the marketing site and the new app alike.

**Acceptance Criteria**:
1. WHEN `npm run typecheck` runs THEN system SHALL report zero errors under `strict: true`, including new Radix-typed props.
2. WHEN `npm run test:coverage` runs THEN system SHALL keep global coverage ≥90% (lines/branches/functions/statements) with the established exclusions.
3. WHEN `npm run build` runs THEN system SHALL emit a single `dist/ds-bundle.js` (ESM, `react`/`react-dom`/`react/jsx-runtime` external, Radix bundled) + `dist/ds-bundle.css` + `dist/index.d.ts` covering every new export.
4. WHEN a new component is added THEN system SHALL export it from `src/index.ts` and document it in `README.md`'s component table.
5. WHEN Radix deps are added THEN system SHALL declare them in `dependencies` (not `devDependencies`) and keep `react`/`react-dom` as `peerDependencies`.

**Independent Test**: `npm run typecheck && npm run test:coverage && npm run build` all green; export-name diff shows only additions.

---

## Traceability

| Req ID | Story | Phase |
| --- | --- | --- |
| F1–F4 | Themeable foundation / Quality | Phase 0 |
| Forms (Input…Slider) | Accessible form controls | Phase 1 |
| Overlays (Dialog…Toast) | Overlays & menus | Phase 1 |
| Skeleton, Spinner | Loading & empty affordances | Phase 1 |
| Tabs…Kbd | App-shaping structure primitives | Phase 2 |
| ChatMessage…TypingIndicator | Generic AI-chat primitives | Phase 3 |
| Quality bar | Quality & API integrity | all phases |

## Open Questions (resolve during Design)

- OQ1: `Toast` — adopt Radix Toast, or a lighter in-house queue? (Radix Toast lacks stacking niceties; evaluate.)
- OQ2: `Command` palette — build on Radix (Dialog + roving list) in-house, or add `cmdk`? (Second runtime dep tradeoff.)
- OQ3: `Resizable` — in-house pointer/keyboard split, or add `react-resizable-panels`? (Radix has no resizable.)
- OQ4: Light-theme brand mapping — does coral stay the accent on light, or shift to `--bordo-sensatez` for contrast? (impeccable to decide during DESIGN.md.)
