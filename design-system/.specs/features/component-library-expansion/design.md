# Component Library Expansion Design

**Spec**: `.specs/features/component-library-expansion/spec.md`
**Status**: Draft (planning)

---

## Architecture Overview

Additive, non-breaking expansion. Existing `src/components/*` and `build.mjs`/esbuild pipeline stay; we (1) refactor `tokens.css` into a two-layer token system (primitive brand ramps → semantic role tokens) that resolves per `data-theme`, (2) add `@radix-ui/*` primitives as **runtime dependencies** that esbuild bundles into the single ESM output, and (3) add new component folders following the exact `ComponentName/{ComponentName.tsx,.css,.test.tsx}` + `hds-` convention. `react`, `react-dom`, and `react/jsx-runtime` stay external; Radix bundles in.

```mermaid
graph TD
    subgraph Tokens[Two-layer tokens.css]
      P[Primitive ramps: bordo/coral/verde/neutral scales] --> S1[Semantic tokens dark theme :root / data-theme=dark]
      P --> S2[Semantic tokens light theme data-theme=light]
      S1 --> RT[--bg --surface --ink --border --accent --focus --danger ...]
      S2 --> RT
    end
    subgraph Components
      RT --> EX[existing 24 components CSS]
      RT --> NEW[new components CSS]
      NEW --> RX[@radix-ui/react-*]
      NEW --> SP[shared: Portal/z-index, VisuallyHidden, useControllableState, useAutosize]
    end
    subgraph Build[build.mjs unchanged shape]
      IDX[src/index.ts barrel] --> ESB[esbuild -> dist/ds-bundle.js + .css, Radix bundled]
      IDX --> DTS[tsc --emitDeclarationOnly -> dist/*.d.ts]
    end
```

---

## Token Architecture (F1)

Two layers in `src/tokens.css`:

**Layer 1 — primitives (theme-independent):** the raw brand ramps. Keep existing `--bordo*`, `--coral`, `--verde`, `--cinza-*`; extend each into a numbered scale (`--bordo-50…900`, neutral `--n-0…900`) so both themes can pick different rungs. These are NOT consumed by components directly (Req P1.5).

**Layer 2 — semantic roles (theme-dependent):** resolved under `:root[data-theme="dark"]` / `:root[data-theme="light"]`, with `:root` (no attr) mirroring dark and a `@media (prefers-color-scheme: light)` block flipping the default when `data-theme` is absent.

Role tokens components consume:

| Role | Purpose |
| --- | --- |
| `--bg` / `--bg-2` | app background / sunken |
| `--surface` / `--surface-2` / `--surface-3` | raised panel / hover / nested (sidebar-vs-content second neutral, per product register) |
| `--ink` / `--muted` / `--faint` | primary / secondary / tertiary text |
| `--border` / `--border-strong` | hairlines / emphasized |
| `--accent` / `--accent-hover` / `--accent-ink` | primary action fill / hover / text-on-accent |
| `--focus` | focus ring color (`:focus-visible`) |
| `--danger` / `--warning` / `--success` / `--info` (+ `-bg`, `-ink` each) | semantic states |
| `--selected` / `--selected-bg` | tree/list current selection |
| `--overlay` | modal backdrop |
| `--shadow-1..3` | elevation (composed per theme) |

Existing components migrate their CSS from raw tokens (`var(--coral)`, `var(--ink)`) to roles (`var(--accent)`, `var(--ink)`) — mechanical, keeps dark output identical because dark role values = today's raw values.

**OQ4 resolved (provisional, DESIGN.md via impeccable confirms):** On **dark**, `--accent = coral`. On **light**, coral (L≈0.72) fails 4.5:1 for text and is weak as a fill on white → light `--accent` = a darkened coral / `--bordo-sensatez` region; `--accent-ink` = near-white. Exact OKLCH values are set when `DESIGN.md` is authored (F3) and contrast-verified (Req P1.4).

---

## Dependency Plan (D1 / Req Quality.5)

Added to `dependencies` (bundled, not peers):

| Package | Backs |
| --- | --- |
| `@radix-ui/react-checkbox` | Checkbox |
| `@radix-ui/react-radio-group` | RadioGroup |
| `@radix-ui/react-switch` | Switch |
| `@radix-ui/react-select` | Select |
| `@radix-ui/react-slider` | Slider |
| `@radix-ui/react-dialog` | Dialog + Sheet/Drawer |
| `@radix-ui/react-alert-dialog` | AlertDialog |
| `@radix-ui/react-popover` | Popover |
| `@radix-ui/react-tooltip` | Tooltip |
| `@radix-ui/react-dropdown-menu` | DropdownMenu |
| `@radix-ui/react-context-menu` | ContextMenu |
| `@radix-ui/react-tabs` | Tabs |
| `@radix-ui/react-accordion` | Accordion |
| `@radix-ui/react-separator` | Separator |
| `@radix-ui/react-scroll-area` | ScrollArea |
| `@radix-ui/react-avatar` | Avatar |
| `@radix-ui/react-progress` | Progress |
| `@radix-ui/react-toast` | Toast (**OQ1 resolved**: use Radix Toast — built-in ARIA live region + swipe/pause; we add stacking/viewport CSS) |
| `@radix-ui/react-visually-hidden` | shared VisuallyHidden |
| `cmdk` | Command palette (**OQ2 resolved**: adopt `cmdk` — shadcn standard, tiny, excellent filtering/a11y; cheaper than reimplementing on Radix) |
| `react-resizable-panels` | Resizable (**OQ3 resolved**: adopt it — Radix has no resizable; this lib handles keyboard + ARIA `separator` + persistence) |

In-house (no dep): Input, Textarea, Label, Field, Spinner, Skeleton, Breadcrumb, **Tree**, Empty, Kbd, Alert, TypingIndicator, and all Phase-3 composites.

> Bundle-size note: Radix primitives are individually small and tree-shakeable, but esbuild bundles the whole barrel. If bundle size becomes a concern, a **task-level follow-up** is per-component entry points / `exports` map so consumers import only what they use. Out of scope for this feature; flagged in CONCERNS.

---

## Folder & Convention Rules (all components)

- `src/components/<Name>/<Name>.tsx` + `<Name>.css` + `<Name>.test.tsx`; export added to `src/index.ts`; row added to `README.md`.
- CSS classes prefixed `hds-<name>` (BEM-ish: `hds-input`, `hds-input-error`). Use `cx()` for conditional classes.
- Props: extend the host element via `React.ComponentPropsWithoutRef<...>` and spread `...rest` (matches `Button` pattern). Radix-backed components forward `ref` and spread onto the Radix primitive.
- Every interactive component defines: `:default`, `:hover`, `:focus-visible` (ring via `--focus`), `:active`, `[disabled]`/`[data-disabled]`, and where relevant `[data-state]`/error (`aria-invalid`). (impeccable product register.)
- Motion: 150–250ms, `--ease-quart`/`--ease-expo`; every enter/exit animation paired with a `@media (prefers-reduced-motion: reduce)` crossfade/instant fallback. Radix exposes `data-state="open|closed"` for CSS-driven transitions.
- Icons: components take an optional `icon`/`startIcon` `ReactNode` slot; DS documents 16/20px, `stroke: currentColor` convention — DS ships no icon set (Out of Scope).

## Shared Primitives (F4)

- **z-index scale** (CSS tokens): `--z-dropdown: 1000; --z-sticky: 1100; --z-overlay: 1200; --z-modal: 1300; --z-toast: 1400; --z-tooltip: 1500;` — Radix portals get these via the content CSS.
- **`useControllableState`** — controlled/uncontrolled value hook (for in-house Tree, Resizable persistence, PromptInput).
- **`useAutosizeTextarea`** — min/max row autosize for Textarea/PromptInput.
- **`VisuallyHidden`** — re-export/wrap Radix; used for a11y labels (Spinner, icon-only buttons).

---

## Radix → DS Mapping (representative)

| DS component | Radix parts wrapped | DS adds |
| --- | --- | --- |
| `Dialog` | Root/Trigger/Portal/Overlay/Content/Title/Description/Close | tokenized surface, `.cut` optional, focus ring, reduced-motion, z-scale |
| `Sheet` | Dialog primitives | `side` prop (left/right/top/bottom) + slide transform |
| `Select` | Root/Trigger/Value/Icon/Portal/Content/Viewport/Item/ItemIndicator | trigger styled like `Input`, check indicator, scroll buttons |
| `Tooltip` | Provider/Root/Trigger/Portal/Content/Arrow | delay defaults, tokenized bubble, arrow |
| `DropdownMenu`/`ContextMenu` | Root/Trigger/Portal/Content/Item/CheckboxItem/RadioItem/Separator/Label/Sub | item states, `Kbd` shortcut slot, danger item variant |
| `Tabs` | Root/List/Trigger/Content | underline/segmented variants |
| `Accordion` | Root/Item/Header/Trigger/Content | chevron rotation via `data-state`, height transition |
| `ScrollArea` | Root/Viewport/Scrollbar/Thumb/Corner | tokenized thin scrollbars, native fallback |
| `Avatar` | Root/Image/Fallback | size prop, status dot slot |
| `Toast` | Provider/Viewport/Root/Title/Description/Action/Close | stacking viewport, variant (info/success/danger), `useToast()` imperative API |

In-house behavioral specs worth noting:
- **Tree** — WAI-ARIA tree pattern (`role=tree/treeitem/group`, roving tabindex, ←/→ collapse/expand, ↑/↓ move, Home/End, type-ahead, `aria-expanded`/`aria-selected`; single + multi-select via prop). Data-driven (`nodes` prop) + render-prop for row content; DS-generic (D4).
- **Resizable** — thin wrapper over `react-resizable-panels` exposing `PanelGroup`/`Panel`/`PanelResizeHandle` styled as DS, with tokenized handle + hit area.
- **Command** — `cmdk` `Command` inside a DS `Dialog` for the ⌘K palette; groups, empty state, `Kbd` hints.

---

## Testing Strategy (Req Quality.2)

Use the project's `react-testing-library` skill. Per component: query by role/label; assert the full state contract. Radix-backed components: test the DS wiring and a11y surface (open/close, focus trap/restore, `aria-*`, keyboard), not Radix internals. Coverage stays ≥90% global; complex a11y branches (Tree keyboard nav, autosize, reduced-motion) get explicit branch tests. `test/setup.ts` already loads jest-dom; add `ResizeObserver`/`matchMedia`/`scrollIntoView` jsdom polyfills as needed for Radix + autosize + MessageList.

## Verification (impeccable)

Before a phase is "done": run `impeccable audit`/`polish` on a demo page mounting that phase's components in **both** themes; verify contrast, focus visibility, keyboard paths, and reduced-motion. Demo/preview uses the existing `*.stories.tsx` + `window.__dsPreview` mechanism (already in repo).

---

## Risks / CONCERNS

- **First runtime deps** in a zero-dep package → bundle grows; version-pin Radix and document in README. Mitigation follow-up: per-component `exports` map.
- **Existing-component CSS refactor** (raw→role tokens) risks visual drift on dark. Mitigation: dark role values are exact copies of today's raw values; snapshot/visual diff the marketing demo.
- **jsdom gaps** for Radix (pointer capture, `ResizeObserver`) → tests need polyfills; some interactions verified via the RTL skill's userEvent + explicit polyfills rather than real layout.
- **Scope creep** across 35 components → phases are the shipping unit; each phase independently green (`typecheck + test:coverage + build`).
