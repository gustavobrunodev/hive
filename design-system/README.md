# Hive Design System

React components extracted from the Harness Builder marketing site (`harness-builder/site/index.html`) — the dark "Zup" brand language: bordo background, coral accent, diagonal-cut corners, dot-dispersion gradients, Funnel Display + Inter type.

## Setup

Load the brand fonts before the bundle styles:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  href="https://fonts.googleapis.com/css2?family=Funnel+Display:wght@600;700&family=Inter:wght@400;500;600;700&family=Inter+Tight:wght@600;700&display=swap"
  rel="stylesheet"
/>
```

```js
import "@hive/design-system/dist/ds-bundle.css";
import { Button, ValueCard, ValueGrid } from "@hive/design-system";
```

Wrap your app's outer container with `className="wrap"` for the page max-width/gutter, and keep `<body>` background on `var(--bordo)` (set globally by `base.css`).

## Tokens

All design tokens are CSS custom properties on `:root` (`src/tokens.css`): the `--bordo`/`--coral`/`--verde` palette, `--ink`/`--muted`/`--surface`/`--line` semantic aliases, `--ff-display`/`--ff-body`/`--ff-num` type families, a 4pt `--s-1`…`--s-10` spacing scale, and `--ease-expo`/`--ease-quart` motion curves. Components consume these directly — don't hardcode hex values when extending the system.

Two signature visual motifs are utility classes, not components: `.cut` / `.cut-sm` (the diagonal lean-right corner clip-path) and `.dots` (the dot-dispersion gradient overlay, rendered via `<DotsBackground />`). Apply `.cut`/`.cut-sm` to any surface that should carry the brand's cut-corner signature.

## Components

| Component | Source pattern |
|---|---|
| `Button` (`variant: primary\|ghost`) | `.btn` |
| `Badge` (`variant: accent\|muted`) | `.badge`, `.case-mode` |
| `Chip` (`variant: tag\|phase\|agent\|skill`) | `.tag`, `.chip`, `.agent-chip`, `.skilltag` |
| `PinChip` (`variant: drive\|deleg`) | `.pin-chip` |
| `BrandMark` | `.zmark` |
| `Logo` (`tone: color\|black\|white`, `mark: brain\|simple\|description\|full`) | `assets/logos/*.svg` |
| `Panel` | shared surface primitive (background/border/cut/hover) underlying the cards below |
| `Callout` (`variant: gate\|limits`) | `.gate`, `.limits` |
| `SectionHeading` | `.s-head` / `.eyebrow` / `.rule` / `.lead` |
| `ValueGrid` + `ValueCard` | `.val-grid` / `.val` |
| `SkillGrid` + `SkillCard` + `SkillSpinePin` | `.skills` / `.skill` (incl. `lead-card`) |
| `CaseGrid` + `CaseCard` | `.cases` / `.case` |
| `ModeSplit` + `ModeBlock` | `.modes-split` / `.mode-block` |
| `Terminal` | `.term` (hero terminal mockup) |
| `Table` + `Pkg`/`Stack`/`Cond` | `.table-wrap` / `table` |
| `SteppedList` + `SteppedListItem` | `ol.steps-list` |
| `CodeBlock` + `Cor`/`Cmt` | `.code` (with working copy-to-clipboard) |
| `Flow`/`SpineLabel`/`Steps`/`Step`/`Substeps`/`Sub` | `.flow` (pipeline/timeline diagram) |
| `DotsBackground` | `.dots` |
| `Reveal` / `Stagger` | scroll-reveal wrappers (`IntersectionObserver`, respects `prefers-reduced-motion`) |
| `Nav` | `header.nav` |
| `Footer` | `footer.ft` |

## Theming (light + dark)

Every interactive component below consumes a **semantic role-token layer** (`--bg`, `--surface`, `--ink`, `--border`, `--accent`, `--focus`, `--danger`/`--warning`/`--success`/`--info`, etc. — see `DESIGN.md` for the full table and both themes' values), resolved per `data-theme`:

```html
<html data-theme="dark"> <!-- or data-theme="light" -->
```

With no `data-theme` attribute, the system falls back to `prefers-color-scheme` (defaulting to dark). The original 24 marketing components above render unchanged on the dark theme — their raw brand tokens (`--coral`, `--bordo`, etc.) still work directly, but new components should consume role tokens only. See `PRODUCT.md` (register: product) and `DESIGN.md` for the full design language and Do's/Don'ts.

## Interactive components (product register)

Built on [Radix UI](https://www.radix-ui.com/) primitives for accessibility (focus trap, keyboard nav, ARIA), styled with this system's tokens. **[R]** = Radix-backed, **[H]** = in-house, **[C]** = composite.

| Component | Kind | Notes |
|---|---|---|
| `Input` | [H] | `startIcon` slot, `error` → `aria-invalid` |
| `Textarea` | [H] | Auto-resize via `useAutosizeTextarea`; `onSubmit` + `submitOnEnter` |
| `Label` | [H] | `required` indicator (visual + `VisuallyHidden` text) |
| `Field` | [H] | Composes `Label` + a control + description/error, wires `htmlFor`/`aria-describedby`/`aria-invalid` |
| `Checkbox` | [R] | Supports `indeterminate` |
| `RadioGroup` + `RadioGroupItem` | [R] | Roving-tabindex, arrow-key nav |
| `Switch` | [R] | |
| `Select` + `SelectItem` (+ `SelectGroup`/`SelectLabel`/`SelectSeparator`) | [R] | Trigger styled like `Input`; portalled listbox |
| `Slider` | [R] | Single or range (multi-thumb) via `value`/`defaultValue` array length |
| `Dialog` | [R] | Focus trap + restore, `cut` prop for the brand cut-corner clip-path |
| `AlertDialog` | [R] | Escape/outside-click dismiss both blocked — requires an explicit `AlertDialogAction`/`AlertDialogCancel` choice |
| `Popover` | [R] | Edge-aware positioning (Radix `avoidCollisions`) |
| `TooltipProvider` + `Tooltip` + `TooltipTrigger` + `TooltipContent` | [R] | Shows on hover *and* keyboard focus |
| `DropdownMenu` (+ `Item`/`CheckboxItem`/`RadioGroup`+`RadioItem`/`Separator`/`Label`) | [R] | `Item` supports `shortcut` slot + `variant="danger"` |
| `ToastProvider` + `Toast` + `useToast()` | [R] | Imperative `toast({ title, description, variant, duration })`; ARIA live region, pause-on-hover/focus, and stacking are Radix built-ins |
| `Spinner` | [H] | `role="status"`, named/pixel `size`, reduced-motion static fallback |
| `Skeleton` | [H] | Flexible block primitive; shimmer disabled under `prefers-reduced-motion` |
| `VisuallyHidden` | [H] | Wraps `@radix-ui/react-visually-hidden` |

Mount `ToastProvider` once near the app root (it renders its own `ToastViewport`); mount `TooltipProvider` once as well. Radix packages (`@radix-ui/react-*`, plus `cmdk` and `react-resizable-panels` landing in later phases) are bundled `dependencies`, not peers — only `react`/`react-dom` stay external.

## Build

```sh
npm install
npm run build
```

Emits `dist/ds-bundle.js` (ESM, `react`/`react-dom` external) and `dist/ds-bundle.css` (all component + base styles, auto-bundled by esbuild from the CSS imports in each component).
