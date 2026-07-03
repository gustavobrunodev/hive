---
name: Hive Design System — Zup
description: Dark-born "Zup" brand system (bordo/coral, cut corners) extended with a light theme and a semantic role-token layer for a two-register (brand + product) component library.
colors:
  # --- Layer 1 primitives (theme-independent brand ramp; components never consume these directly) ---
  bordo: "oklch(19.5% 0.048 4.8)"          # #260a12
  bordo-2: "oklch(33.1% 0.094 13.6)"       # #5c1c27
  bordo-sensatez: "oklch(42.4% 0.127 14.4)" # #852838
  coral: "oklch(65.9% 0.114 42.2)"         # #cc7958
  coral-hover: "oklch(70.8% 0.106 41.5)"   # #d98a6c (existing Button.css hover)
  verde: "oklch(75.5% 0.130 163.2)"        # #52c998
  cinza-impacto: "oklch(87.8% 0.011 17.4)" # #ded4d4
  cinza-conhecimento: "oklch(69.6% 0.026 17.8)" # #ad9797
  cinza-light: "oklch(95.9% 0.005 17.3)"   # #f5f0f0

  # --- Layer 2 semantic role tokens, dark theme (= today's raw values, unchanged) ---
  dark-bg: "oklch(19.5% 0.048 4.8)"
  dark-bg-2: "oklch(16.4% 0.040 7.2)"
  dark-surface: "oklch(23.1% 0.050 4.9)"
  dark-surface-2: "oklch(25.8% 0.058 4.5)"
  dark-surface-3: "oklch(28.5% 0.070 356.3)"
  dark-ink: "oklch(87.8% 0.011 17.4)"
  dark-muted: "oklch(69.6% 0.026 17.8)"
  dark-faint: "oklch(61.7% 0.023 21.4)"
  dark-border: "oklch(87.8% 0.011 17.4 / 14%)"
  dark-border-strong: "oklch(87.8% 0.011 17.4 / 26%)"
  dark-accent: "oklch(65.9% 0.114 42.2)"
  dark-accent-hover: "oklch(70.8% 0.106 41.5)"
  dark-accent-ink: "oklch(20.6% 0.036 352.3)"
  dark-focus: "oklch(65.9% 0.114 42.2)"
  dark-danger: "oklch(63.7% 0.208 25.3)"
  dark-danger-bg: "oklch(63.7% 0.208 25.3 / 14%)"
  dark-danger-ink: "oklch(63.7% 0.208 25.3)"
  dark-warning: "oklch(76.7% 0.157 71.7)"
  dark-warning-bg: "oklch(76.7% 0.157 71.7 / 14%)"
  dark-warning-ink: "oklch(76.7% 0.157 71.7)"
  dark-success: "oklch(75.5% 0.130 163.2)"
  dark-success-bg: "oklch(75.5% 0.130 163.2 / 14%)"
  dark-success-ink: "oklch(75.5% 0.130 163.2)"
  dark-info: "oklch(71.4% 0.104 246.2)"
  dark-info-bg: "oklch(71.4% 0.104 246.2 / 14%)"
  dark-info-ink: "oklch(71.4% 0.104 246.2)"
  dark-selected: "oklch(65.9% 0.114 42.2)"
  dark-selected-bg: "oklch(65.9% 0.114 42.2 / 16%)"
  dark-overlay: "oklch(0% 0 0 / 60%)"
  dark-shadow-1: "oklch(0% 0 0 / 24%)"
  dark-shadow-2: "oklch(0% 0 0 / 32%)"
  dark-shadow-3: "oklch(0% 0 0 / 40%)"

  # --- Layer 2 semantic role tokens, light theme (new) ---
  light-bg: "oklch(95.9% 0.005 17.3)"
  light-bg-2: "oklch(92.3% 0.010 25.1)"
  light-surface: "oklch(100.0% 0.000 89.9)"
  light-surface-2: "oklch(95.7% 0.008 36.6)"
  light-surface-3: "oklch(92.7% 0.012 29.9)"
  light-ink: "oklch(19.5% 0.048 4.8)"
  light-muted: "oklch(49.6% 0.023 18.0)"
  light-faint: "oklch(61.8% 0.025 21.2)"
  light-border: "oklch(19.5% 0.048 4.8 / 12%)"
  light-border-strong: "oklch(19.5% 0.048 4.8 / 24%)"
  light-accent: "oklch(42.4% 0.127 14.4)"
  light-accent-hover: "oklch(33.1% 0.094 13.6)"
  light-accent-ink: "oklch(100.0% 0.000 89.9)"
  light-focus: "oklch(42.4% 0.127 14.4)"
  light-danger: "oklch(50.1% 0.178 28.7)"
  light-danger-bg: "oklch(50.1% 0.178 28.7 / 10%)"
  light-danger-ink: "oklch(50.1% 0.178 28.7)"
  light-warning: "oklch(45.5% 0.098 67.2)"
  light-warning-bg: "oklch(45.5% 0.098 67.2 / 10%)"
  light-warning-ink: "oklch(45.5% 0.098 67.2)"
  light-success: "oklch(51.5% 0.110 156.8)"
  light-success-bg: "oklch(51.5% 0.110 156.8 / 10%)"
  light-success-ink: "oklch(51.5% 0.110 156.8)"
  light-info: "oklch(49.9% 0.126 253.2)"
  light-info-bg: "oklch(49.9% 0.126 253.2 / 10%)"
  light-info-ink: "oklch(49.9% 0.126 253.2)"
  light-selected: "oklch(42.4% 0.127 14.4)"
  light-selected-bg: "oklch(42.4% 0.127 14.4 / 10%)"
  light-overlay: "oklch(19.5% 0.048 4.8 / 45%)"
  light-shadow-1: "oklch(19.5% 0.048 4.8 / 8%)"
  light-shadow-2: "oklch(19.5% 0.048 4.8 / 10%)"
  light-shadow-3: "oklch(19.5% 0.048 4.8 / 14%)"
typography:
  display:
    fontFamily: "Funnel Display, Georgia, Times New Roman, serif"
    fontSize: "clamp(2rem, 4.4vw, 3.1rem)"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Inter, Helvetica Neue, Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "Inter, Helvetica Neue, Arial, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "0.01em"
  mono:
    fontFamily: "Inter Tight, ui-monospace, monospace"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.5
    letterSpacing: "normal"
rounded:
  none: "0px"
  sm: "4px"
  md: "6px"
  lg: "10px"
  full: "999px"
spacing:
  1: "4px"
  2: "8px"
  3: "12px"
  4: "16px"
  5: "24px"
  6: "32px"
  7: "48px"
  8: "64px"
  9: "96px"
  10: "128px"
components:
  button-primary-dark:
    backgroundColor: "{colors.dark-accent}"
    textColor: "{colors.dark-accent-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "15px 26px"
    height: "48px"
  button-primary-dark-hover:
    backgroundColor: "{colors.dark-accent-hover}"
    textColor: "{colors.dark-accent-ink}"
  button-primary-light:
    backgroundColor: "{colors.light-accent}"
    textColor: "{colors.light-accent-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "15px 26px"
    height: "48px"
  button-primary-light-hover:
    backgroundColor: "{colors.light-accent-hover}"
    textColor: "{colors.light-accent-ink}"
  input-dark:
    backgroundColor: "{colors.dark-surface}"
    textColor: "{colors.dark-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "9px 12px"
    height: "40px"
  input-light:
    backgroundColor: "{colors.light-surface}"
    textColor: "{colors.light-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "9px 12px"
    height: "40px"
  dialog-surface-dark:
    backgroundColor: "{colors.dark-surface-2}"
    textColor: "{colors.dark-ink}"
    rounded: "{rounded.md}"
    padding: "24px"
  dialog-surface-light:
    backgroundColor: "{colors.light-surface}"
    textColor: "{colors.light-ink}"
    rounded: "{rounded.md}"
    padding: "24px"
---

# Design System: Hive Design System — Zup

## Overview

**Creative North Star: "The Cut Ledger"** — a dark, engineering-grade maroon ledger with one warm coral seal, now extended into a second, quieter register: the same ledger opened in daylight.

This system has two registers sharing one token vocabulary. The **brand register** (24 existing marketing components) is the Zup identity at full volume: bordo (`#260a12`) as the ambient background, coral as a rare, deliberate accent, the diagonal cut-corner clip-path as a signature silhouette, `Funnel Display` for confident, weighty headlines, and scroll-driven reveal choreography. The **product register** (this expansion) is the same DNA translated for a desktop app where a developer spends hours in an AI chat and a file tree: Inter everywhere, a tighter fixed-rem type scale, plain rounded corners instead of cut corners, motion that only ever signals state, and a semantic role-token layer that resolves to a full **light theme** alongside the existing **dark theme**. Dark-theme role values are exact restatements of today's raw hexes — nothing about the marketing site's rendered output changes. Light theme is new territory, built from the same brand ramp (`bordo-sensatez`, `bordo-2`, `cinza-light`) rather than invented from scratch.

This system explicitly rejects: generic AI-chatbot-clone chrome, Electron-default unstyled shells, glassmorphism/frosted-glass overlays, gratuitous or orchestrated motion in task surfaces, and invented affordances for solved problems (custom scrollbars, hand-rolled modals). See PRODUCT.md's Anti-references for the full list.

**Key Characteristics:**
- Two-layer tokens: theme-independent brand primitives (Layer 1) feeding theme-resolved semantic roles (Layer 2); components consume roles only, never primitives.
- One typeface for product UI (Inter); `Funnel Display` is quarantined to brand-register headlines.
- Flat by default, elevated only when a surface leaves the document flow (overlays).
- The cut-corner motif is a brand-only signature; product controls use small, plain radii.
- Every accent value is contrast-verified per theme, not assumed.

## Colors

The palette is warm and mono-hued at its core (bordo → coral) with a small, deliberate set of cool-neutral state colors added for the product register's semantic vocabulary (danger/warning/success/info) — colors the marketing palette never needed because it has no error states.

### Primary
- **Coral** (`oklch(65.9% 0.114 42.2)` / `#cc7958`): the dark-theme accent — primary buttons, links, selection, focus ring. Unchanged from today.
- **Bordo Sensatez** (`oklch(42.4% 0.127 14.4)` / `#852838`): the light-theme accent. **OQ4 resolution, verified below**: raw coral only reaches 3.26:1 against white (fails the 4.5:1 body-text floor and is a weak, low-margin fill at 3.26:1 against the 3:1 UI floor). `bordo-sensatez` — already a named primitive in the existing brand ramp, one step darker and more saturated toward red — is adopted as light `--accent` instead of inventing a new hue.

**Contrast math (WCAG relative-luminance method, `(L_lighter + 0.05) / (L_darker + 0.05)`):**
- Raw coral `#cc7958` (relative luminance ≈0.361) against white `#ffffff` (luminance 1.0): `(1.0 + 0.05) / (0.361 + 0.05) ≈ 3.26:1` — below the 4.5:1 body floor; only just above the 3:1 non-text/large floor, and visually washes out against near-white. Rejected as light accent.
- `bordo-sensatez` `#852838` (luminance ≈0.0524) against white: `(1.0 + 0.05) / (0.0524 + 0.05) ≈ 8.91:1` — clears both the 4.5:1 body floor and the 3:1 UI-fill floor with wide margin. Against `light-bg` `#f5f0f0` (luminance ≈0.859): `(0.859 + 0.05) / (0.0524 + 0.05) ≈ 7.89:1` — same conclusion.
- `light-accent-ink` (white `#ffffff`) on the `bordo-sensatez` fill: same pair reversed, `8.91:1` — button label text on the light primary button clears 4.5:1 easily.
- `light-accent-hover` reuses the existing `bordo-2` primitive (`#5c1c27`, luminance ≈0.0135): `12.72:1` against white — hover only needs to read as "darker," and it does, by a wide margin.
- Dark-theme control pair (unchanged, for reference): accent-ink `#241019` on coral `#cc7958` = `5.54:1` (matches the shipped `Button.css` today).

### Secondary
State colors, one hue family per semantic meaning, distinct from the coral/bordo accent so a red error state is never confusable with a coral call-to-action:
- **Danger** — dark `oklch(63.7% 0.208 25.3)` / `#ef4444` (4.92:1 against `dark-bg`); light `oklch(50.1% 0.178 28.7)` / `#b3261e` (6.54:1 against white). Destructive actions, invalid fields, error text.
- **Warning** — dark `oklch(76.7% 0.157 71.7)` / `#f0a020` (8.60:1 against `dark-bg`); light `oklch(45.5% 0.098 67.2)` / `#7a4a05` (7.48:1 against white). Non-blocking caution.
- **Success** — dark `oklch(75.5% 0.130 163.2)` / `#52c998` (the existing `--verde` primitive, 8.96:1 against `dark-bg`); light `oklch(51.5% 0.110 156.8)` / `#1f7a4d` (5.32:1 against white). Confirmations.
- **Info** — dark `oklch(71.4% 0.104 246.2)` / `#6aa9e0` (7.37:1 against `dark-bg`); light `oklch(49.9% 0.126 253.2)` / `#2564a8` (6.06:1 against white). Neutral system messages.

Each carries a `-bg` tint (same hue, 10–14% alpha, for chip/banner fills — decorative, not contrast-checked) and an `-ink` value (the base color itself, already contrast-verified above; used as text/icon on the corresponding `-bg` or on the page surface directly).

### Neutral
- **Dark `--bg`** `oklch(19.5% 0.048 4.8)` / `#260a12` — today's bordo, unchanged. **`--bg-2`** `oklch(16.4% 0.040 7.2)` / `#1c060b` — sunken, new.
- **Dark `--surface` / `--surface-2` / `--surface-3`** — `#30121a` / `#3a1620` (both today's raw values) / `#44192b` (new nested tier).
- **Dark `--ink`** `#ded4d4` (12.76:1 on `--bg`), **`--muted`** `#ad9797` (6.74:1), **`--faint`** `oklch(61.7% 0.023 21.4)` / `#93807f` (new tertiary tier, 4.59–4.97:1 against surface/bg).
- **Light `--bg`** `oklch(95.9% 0.005 17.3)` / `#f5f0f0` — the existing `--cinza-light` primitive, repurposed as the light background. **`--bg-2`** `#ece3e2` — sunken.
- **Light `--surface` / `--surface-2` / `--surface-3`** — `#ffffff` (raised, pops against the warm off-white `--bg`) / `#f6efed` (hover) / `#efe4e2` (nested).
- **Light `--ink`** — the `bordo` primitive itself, `#260a12`, reused as text: `18.51:1` on white, `16.40:1` on `--bg`. **`--muted`** `oklch(49.6% 0.023 18.0)` / `#6f5d5d`: worst-case `4.90:1` against `--bg-2` (the darkest surface it's likely to sit on) — clears 4.5:1 everywhere in the surface stack. **`--faint`** `oklch(61.8% 0.025 21.2)` / `#94807f`: `3.71:1` on white — deliberately below the 4.5:1 body floor (tertiary/placeholder/disabled-label use only, never body copy), still clears the 3:1 large-text/UI floor.
- **Borders** (`--border` / `--border-strong`) are ink-tinted low-alpha overlays in both themes (dark: `cinza-impacto` at 14%/26% alpha, unchanged from today's `--line`/`--line-strong`; light: `bordo` at 12%/24% alpha) — hairlines, exempt from text-contrast targets as decorative dividers; the token that *does* carry a verified 3:1 non-text floor for interactive boundaries is `--focus` (see Primary above, reuses `--accent`).

### Named Rules
**The Dark-Truth Rule.** Every dark-theme role token is a byte-for-byte restatement of a value already live in `tokens.css` today (or, where a token is genuinely new — `--bg-2`, `--surface-3`, `--faint` — a same-hue-family extension of the existing ramp). The marketing site renders pixel-identical after the token refactor; if a dark value in this document doesn't trace to today's CSS, it's a bug in this document.

**The Darkened-Coral Rule.** Raw coral never appears as text or a primary fill on a light surface. Light `--accent` is `bordo-sensatez`; light `--accent-hover` is `bordo-2`. Both are named primitives already in the brand ramp — light theme borrows from the existing palette, it does not invent a new one.

## Typography

**Display Font:** Funnel Display (with Georgia, Times New Roman, serif fallback) — brand register only.
**Body Font:** Inter (with Helvetica Neue, Arial, sans-serif fallback) — both registers.
**Label/Mono Font:** Inter for UI labels; Inter Tight (`ui-monospace`, `monospace` fallback) for code/data/keyboard-shortcut display — already established by the existing `CodeBlock` component.

**Character:** The brand register pairs a serif-weighted display face against Inter body copy for editorial confidence. The product register drops the pairing entirely — Inter alone, at a denser, fixed-rem scale, carries headings, labels, controls, and data. One family reads as consistent; a display face on a table cell reads as a mistake.

### Hierarchy
- **Display** (700, `clamp(2rem, 4.4vw, 3.1rem)`, line-height 1.05): brand-register hero/section headlines only (`SectionHeading`, `h1`/`h2`/`h3` today). Never appears in product-register UI.
- **Headline** (700, 1.5rem / 24px, line-height 1.2): product-register panel/dialog titles, settings-page section titles.
- **Title** (600, 1.125rem / 18px, line-height 1.3): card headers, list-group headers, message-thread titles.
- **Body** (400, 1rem / 16px, line-height 1.5, 65–75ch measure for prose like chat message content): default reading text in both registers.
- **Label** (600, 0.8125rem / 13px, letter-spacing 0.01em, line-height 1.3): buttons, form labels, tree-item text, tab labels — the workhorse size for dense UI.
- **Caption/Mono** (500, 0.875rem / 14px, Inter Tight): timestamps, file sizes, keyboard shortcuts (`Kbd`), inline code.

### Named Rules
**The One Family Rule.** Product surfaces set every label, control, and data value in Inter. `Funnel Display` is reserved for brand-register marketing headlines and is never referenced by a new component's CSS.
**The Fixed-Scale Rule.** Product type sizes are fixed rem values, not `clamp()`. A sidebar label that resizes with the viewport is a bug; only brand-register hero type is allowed to flex with `clamp()`.

## Elevation

Today's system is **flat**: depth is communicated with an `inset box-shadow` used as a border (`Button`'s ghost variant, `PinChip`) and the diagonal cut-corner silhouette — never an ambient drop shadow. That stays true for every rest-state product surface (panels, list rows, cards, sidebar). The product expansion introduces a real shadow vocabulary, but scoped narrowly: **only surfaces that leave the document flow via a portal** (Dialog, AlertDialog, Popover, DropdownMenu, ContextMenu, Tooltip, Toast, Sheet) get elevation. A shadow there isn't decoration — it's the only visual signal that the surface is floating above, not part of, the page.

### Shadow Vocabulary
- **`--shadow-1`** (dark `0 1px 2px oklch(0% 0 0 / 24%)`; light `0 1px 2px oklch(19.5% 0.048 4.8 / 8%)`): Tooltip, small Popover — barely-there separation.
- **`--shadow-2`** (dark `0 4px 12px oklch(0% 0 0 / 32%)`; light `0 4px 12px oklch(19.5% 0.048 4.8 / 10%)`): DropdownMenu, ContextMenu, larger Popover, Toast.
- **`--shadow-3`** (dark `0 12px 32px oklch(0% 0 0 / 40%)`; light `0 12px 32px oklch(19.5% 0.048 4.8 / 14%)`): Dialog, AlertDialog, Sheet — the surfaces that most fully interrupt the task.

Light-theme shadows are `bordo`-tinted rather than pure black (`oklch(19.5% 0.048 4.8 / …)`), at lower alpha than dark's pure-black shadows — a pure-black shadow on a warm off-white surface reads muddy and off-brand; a bordo-tinted shadow stays in the palette family even at low opacity.

### Named Rules
**The Flat-Until-It-Floats Rule.** Rest-state surfaces stay flat or border-defined, identically to the 24 existing marketing components. `--shadow-1..3` exist exclusively for portaled overlays where elevation communicates z-order, never as a generic "card" treatment.

## Components

### Buttons
- **Shape:** small radius (`--rounded-sm`, 4px) for product-register buttons — not the brand register's cut corner. The existing brand `Button` component keeps its `cut`/`cut-sm` clip-path prop (16px/10px) unchanged; new product controls never adopt it.
- **Primary:** dark fills `--accent` (coral) with `--accent-ink` text; light fills `--accent` (`bordo-sensatez`) with `--accent-ink` (white) text. Padding `15px 26px`, min-height 48px (unchanged from today's `Button.css`).
- **Hover / Focus:** hover swaps fill to `--accent-hover` (dark: `#d98a6c`, lighter; light: `bordo-2` `#5c1c27`, darker — hover direction flips per theme because it always moves *away* from the surface, brightening on dark, deepening on light). Focus-visible renders a 2–2.5px inset ring in `--focus` (= `--accent`), matching today's ghost-button focus treatment.
- **Ghost / ithird variant:** transparent fill, `--border-strong` outline, `--ink` text; hover fills `--surface`. Disabled: `--faint` text, `--border` outline, no pointer, no full-saturation accent anywhere on the element (PRODUCT.md ban).

### Overlays (Dialog, AlertDialog, Popover, DropdownMenu, ContextMenu, Tooltip, Toast, Sheet)
- **Surface:** `--surface-2` (dark) / `--surface` (light), `--rounded-md` (6px) corners, `--shadow-2` or `--shadow-3` per the Elevation table above, `--border` hairline.
- **Motion:** enter/exit at 150–250ms using `--ease-quart` (settle) or `--ease-expo` (dismiss), driven off Radix's `data-state="open|closed"` attribute. `prefers-reduced-motion: reduce` replaces the transform/opacity transition with an instant show/hide or a bare opacity crossfade — never removes the transition without a fallback.
- **Backdrop:** `--overlay` (dark: 60% black; light: 45% bordo-tinted) behind Dialog/AlertDialog/Sheet only; Popover/DropdownMenu/Tooltip/ContextMenu have no backdrop (per D1/Radix conventions).
- **Dismiss:** Escape and outside-click close everything except AlertDialog, which requires an explicit button choice (PRODUCT.md: modal is not a shortcut around a real decision).

### Inputs / Fields
- **Style:** `--surface` background, `--border` stroke (1px), `--rounded-sm` (4px) corners, `--ink` text, `label`-scale (13px/600) for the field label.
- **Focus:** stroke swaps to 2px `--focus`, no glow/blur — a crisp ring, consistent with the Button focus treatment.
- **Error:** stroke and helper text switch to `--danger`/`--danger-ink`; `aria-invalid="true"` wired by the component, not just visual.
- **Disabled:** `--faint` text and stroke, `--surface-2` fill, `cursor: not-allowed`, not focusable, no accent color anywhere.

### States, Motion & Icons (applies to every interactive component in this expansion)
- **State floor:** `default`, `:hover`, `:focus-visible` (ring in `--focus`), `:active`, `[disabled]`/`[data-disabled]`, and `[data-state]`/`aria-invalid` where the pattern calls for it (Radix exposes `data-state="open|closed|checked|unchecked"` etc. directly). No component ships a partial set.
- **Motion:** 150–250ms, `--ease-quart` for settling transitions, `--ease-expo` for dismissal/emphasis (matches the existing `Button.css` curve usage). Every enter/exit animation is paired with a `prefers-reduced-motion: reduce` fallback (instant or crossfade).
- **Icons:** an optional `icon`/`startIcon` `ReactNode` slot at a fixed **16px** (dense contexts: tree rows, menu items, inline chips) or **20px** (buttons, standalone) box, `stroke: currentColor` so icon color always inherits the text-role token it sits in. The design system ships no icon set; the consuming app supplies SVGs at those two sizes.

### Named Rules
**The Full Set Rule.** default/hover/focus-visible/active/disabled (+ loading/error where applicable) is the floor for every interactive component; three of five states is an unfinished component, not a simpler one.
**The No-Cut-On-Chrome Rule.** The diagonal cut-corner clip-path never appears on an input, menu, overlay, or tree row. It is a brand-register signature (`Button`, `Panel`, `ValueCard`) and stays there.

## Do's and Don'ts

### Do:
- **Do** consume role tokens only (`var(--accent)`, `var(--ink)`) in every new component's CSS — never a raw primitive (`var(--coral)`, `var(--bordo)`) directly, so both themes resolve correctly (design.md's Token Architecture, Req P1.5).
- **Do** ship the full state set — default, hover, focus-visible, active, disabled, loading, error where applicable — on every interactive component (PRODUCT.md's Component state contract; The Full Set Rule above).
- **Do** delegate focus trap, dismiss, positioning, and roving-tabindex to Radix on every `[R]`-tagged component (D1); style on top with tokens only.
- **Do** keep dark-theme values exact restatements of today's raw hexes (The Dark-Truth Rule) so the marketing site's rendered output never shifts.
- **Do** use `bordo-sensatez` (`#852838`) as light `--accent` and `bordo-2` (`#5c1c27`) as light `--accent-hover` — both existing brand primitives, both contrast-verified above at 8.91:1 and 12.72:1 against white.
- **Do** reserve `--shadow-1..3` for portaled overlays only (Dialog, Popover, DropdownMenu, ContextMenu, Tooltip, Toast, Sheet) — every rest-state surface stays flat or border-defined.
- **Do** cap motion at 150–250ms and pair every transition with a `prefers-reduced-motion: reduce` fallback.

### Don't:
- **Don't** use raw coral (`#cc7958`) as light-theme accent text or a light-theme primary-button fill — it measures 3.26:1 against white, below the 4.5:1 body floor and a weak margin even for a 3:1 UI fill.
- **Don't** put `Funnel Display` in a UI label, button, table cell, or data value — display type is brand-register only (PRODUCT.md's product bans; The One Family Rule).
- **Don't** apply the `.cut`/`.cut-sm` diagonal clip-path to any new interactive product component (input, menu, overlay, tree row) — it is a brand-register signature only (The No-Cut-On-Chrome Rule).
- **Don't** reinvent standard affordances for flavor — no custom scrollbars that behave differently from native, no hand-rolled modal dismiss logic, no non-standard `<select>`/checkbox/radio shapes. Radix exists to prevent exactly this (PRODUCT.md's product bans).
- **Don't** ship decorative motion or an orchestrated load sequence in the product register — the brand site's `Reveal`/`Stagger` scroll choreography does not belong in a chat pane or file tree (PRODUCT.md).
- **Don't** use a full-saturation accent color on a disabled or inactive state — disabled always renders at `--faint`/`--border` emphasis.
- **Don't** reach for a modal as the first solution to a confirmation or capture problem — exhaust inline validation, `Popover`, and progressive disclosure first; `AlertDialog` is reserved for destructive/irreversible actions.
- **Don't** duplicate a token value between this frontmatter and prose with a different number — the YAML frontmatter above is normative; prose here only explains where and why.
