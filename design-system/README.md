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

Mount `ToastProvider` once near the app root (it renders its own `ToastViewport`); mount `TooltipProvider` once as well. Radix packages (`@radix-ui/react-*`, plus `cmdk` and `react-resizable-panels`) are bundled `dependencies`, not peers — only `react`/`react-dom` stay external.

## App-shaping primitives (product register)

Structure, navigation, and data-display primitives for assembling the chat/workspace split (D4: these stay generic — the actual chat screen and file-explorer pane are assembled in the consuming app).

| Component | Kind | Notes |
|---|---|---|
| `Separator` | [R] | `decorative` (default `true`, no `role`) vs. explicit `false` (`role="separator"`) |
| `Tabs` + `TabsList` + `TabsTrigger` + `TabsContent` | [R] | `TabsList`'s `variant`: `"underline"` (default) or `"segmented"` |
| `Accordion` + `AccordionItem` + `AccordionTrigger` + `AccordionContent` | [R] | `type="single"` or `"multiple"`; chevron rotates on `data-state`, height-transitions via Radix's `--radix-accordion-content-height` |
| `ScrollArea` | [R] | Thin tokenized scrollbar overlay; `Viewport` always has real `overflow`, so native scroll still works if the overlay doesn't render |
| `Sheet` + `SheetTrigger` + `SheetClose` + `SheetContent` + `SheetTitle` + `SheetDescription` | [R] | `SheetContent`'s `side`: `"left" \| "right" (default) \| "top" \| "bottom"`; slides in/out instead of centering |
| `ContextMenu` (+ `Item`/`CheckboxItem`/`RadioGroup`+`RadioItem`/`Separator`/`Label`) | [R] | Opens at the pointer on right-click; keyboard fallback (context-menu key) is a Radix built-in |
| `Command` + `CommandInput` + `CommandList` + `CommandEmpty` + `CommandGroup` + `CommandItem` + `CommandSeparator` + `CommandDialog` | [R] | `cmdk`-backed type-to-filter palette; `CommandDialog` composes cmdk's bare `Command` inside this system's own `Dialog` (not cmdk's bundled dialog) |
| `Breadcrumb` + `BreadcrumbItem` | [H] | Array-driven (`items` prop); collapses the middle into a static "…" past `maxItems`, always keeps first + last |
| `Tree` | [H] | WAI-ARIA tree pattern (`role="tree"/"treeitem"/"group"`); roving tabindex, arrow-key nav (←/→ collapse-or-ascend / expand-or-descend, ↑/↓ move), Home/End, type-ahead with wrap-around; `selection="single" \| "multiple"` |
| `Avatar` | [R] | `size` (named or px), optional `status` dot (`online`/`offline`/`away`/`busy`) |
| `Progress` | [R] | Determinate (`value`/`max`) or indeterminate (`value={null}`) |
| `Alert` | [H] | `variant`: `info`/`success`/`warning`/`danger` — full tinted background + matching border, deliberately **no** side-stripe |
| `Empty` | [H] | `icon`/`title`/`description`/`action` slots — "teaches the interface," not a blank area |
| `Kbd` | [H] | Renders one key/token per `<Kbd>`; compose siblings for combos (`<Kbd>⌘</Kbd><Kbd>K</Kbd>`) |
| `Resizable` + `ResizablePanel` + `ResizableHandle` | [H] | Wraps `react-resizable-panels` (`Group`/`Panel`/`Separator` — the library's installed v4 API, not the older `PanelGroup`/`PanelResizeHandle` naming); persistence via the library's own `defaultLayout`/`onLayoutChanged` props |

## Build

```sh
npm install
npm run build
```

Emits `dist/ds-bundle.js` (ESM, `react`/`react-dom` external) and `dist/ds-bundle.css` (all component + base styles, auto-bundled by esbuild from the CSS imports in each component).
