# Product

## Register

product

## Users

Technical practitioners — developers and operators running an AI agent against a real codebase and filesystem — using a **desktop application** built on `@hive/design-system`. Two primary workflows: (1) an **AI chat** conversation with an agent (streaming responses, attachments, multi-turn history) and (2) a **workspace file explorer** (tree navigation, file actions, a resizable split against the chat). Sessions are long (hours, not seconds), keyboard-heavy, and often involve destructive or consequential actions (delete, rename, overwrite) that the user must be able to trust without re-reading a manual. This is not a first-touch marketing visitor; it is a returning, fluent operator who wants the tool to get out of the way.

## Product Purpose

`@hive/design-system` today ships 24 presentational components for the Harness Builder marketing site — the **brand** register, where design IS the product (dark Zup identity: bordo/coral, cut corners, dot gradients). This expansion adds a second, parallel register: a set of **interactive, accessible primitives** (forms, overlays, menus, structure, AI-chat composites) that the upcoming desktop app assembles into real screens. The design system's job in this register is to disappear into the task: every control should feel exactly as familiar as it needs to and no more surprising than it has to. Success looks like a developer opening the app, never once pausing to figure out how a control works, and the Zup brand surviving as a quiet accent rather than a costume the UI wears.

## Brand Personality

Three words: **precise, restrained, quietly confident.** The brand personality established by the marketing site (bordo depth, coral warmth, the diagonal cut-corner signature, engineering-grade seriousness) still informs the product register — but translated, not transplanted. On brand surfaces the Zup identity is loud (display type, orchestrated reveals, full-bleed dot gradients). On product surfaces the same identity shows up as: coral/bordo-sensatez used sparingly for primary actions and selection state, the 4pt spacing rhythm, Inter as the single working typeface, and nothing else. The product register earns trust through consistency, not through personality display.

## Anti-references

- **Generic AI-chatbot-clone UIs** (the undifferentiated "ChatGPT skin" every AI product now wears) — the chat surface should feel like *this* tool, grounded in the Zup palette, not a reskin of a template.
- **Electron-default chrome** — no unstyled native title bars, no default OS scrollbars fighting the rest of the interface, no visual seam between "the app" and "the shell."
- **Glassmorphism / heavy blur-and-glow overlays** — inconsistent with the flat, cut-corner brand language; overlays in this system get tokenized surfaces and real elevation shadows, not frosted glass.
- **Gratuitous motion** — orchestrated page-load sequences, bouncy easings, decorative parallax. The brand site's `Reveal`/`Stagger` scroll choreography is a brand-register tool; it does not belong in a chat pane or a file tree.
- **Invented affordances for standard tasks** — custom scrollbars that don't scroll right, non-standard modal dismiss behavior, novel form controls that reinvent `<select>`. If Linear, Raycast, or VS Code has already solved it, use that solved shape.
- **SaaS-dashboard cliché** (generic card-grid analytics look, purple-to-blue gradients, floating pill navs) — this is a working tool for one operator, not a multi-tenant admin dashboard.

## Design Principles

### The product slop test

The bar is not "would someone say AI made this" — it's: **would a developer fluent in Linear, Raycast, VS Code, and Notion sit down and trust this interface immediately, or pause at every subtly-off component?** Product UI's failure mode isn't flatness, it's strangeness without purpose — over-decorated buttons, mismatched form controls, gratuitous motion, a display font on a table cell, a hand-rolled dropdown that opens on the wrong edge. Familiarity is a feature here, not a compromise.

### Typography approach

- **One working family.** Inter (`--ff-body`, already in the system) carries every label, control, body string, and data value in the product register. `Funnel Display` (`--ff-display`) stays exclusive to brand-register marketing headlines — **it never appears in a dense UI label, button, table cell, or form control.** This is a hard line, not a preference (see DESIGN.md's Typography section for the enforced scale).
- **Fixed rem scale, not fluid/clamp.** The marketing site's `clamp(2rem, 4.4vw, 3.1rem)` headline sizing is correct for a hero; it is wrong for a sidebar label that must not reflow at different viewport widths mid-session. Product type sizes are fixed rem values.
- **Tighter scale ratio (~1.125–1.2)** between steps. The product surface has more simultaneous type roles on screen at once (label, body, mono/data, caption) than a marketing page ever does; a wide ratio creates visual noise, not hierarchy.
- **Density is a feature.** File-tree rows, message metadata, and settings forms may run tighter than marketing prose; a 65–75ch measure still applies to actual reading prose (chat message bodies), not to table/tree rows.

### Color approach

- **Restrained is the floor.** No single product screen is "drenched" in bordo or coral. The accent (coral on dark, a darkened coral/bordo-sensatez on light — see DESIGN.md OQ4 resolution) is reserved for primary actions, current selection, and state indicators — never decoration.
- **State-rich semantic vocabulary, standardized once.** Every interactive surface speaks the same eight words: hover, focus, active, disabled, selected, loading, error, and (where relevant) warning/success/info. A component that only implements three of these is unfinished, not "simple."
- **A second neutral layer** (`--surface-2`/`--surface-3`) separates the file-tree sidebar and chat toolbar from primary content, the same way Linear/VS Code separate a side rail from the working pane — slightly warmer or cooler than the content surface, never a different hue family.

### Component state contract

Every interactive component in this expansion ships the **full state set**: `default`, `hover`, `focus-visible`, `active`, `disabled`, `loading` (where the action can be pending), and `error` (where the control can be invalid) — plus `selected`/`data-state` for components that carry a current-item concept (Tree, Tabs, Menu items). No component ships with a partial set to save time; a checkbox with no visible focus ring or a button with no disabled treatment is a shipped bug, not a fast-follow.

### Motion budget

- **150–250ms** on state transitions (hover, open/close, expand/collapse), using the existing `--ease-quart`/`--ease-expo` curves.
- **Motion conveys state only** — feedback, loading, reveal, dismissal. Never decoration, never an entrance choreography.
- **No orchestrated load sequences.** The brand site's `Reveal`/`Stagger` scroll-in effect is explicitly out of bounds for the product register: users load into a task and start working immediately.
- **`prefers-reduced-motion: reduce` always has a fallback** — an instant state change or a crossfade, never "just don't animate the thing that was communicating state."

### Product bans (in addition to the anti-references above)

- Decorative motion that doesn't convey a state change.
- An inconsistent component vocabulary across screens — if the chat's "send" button looks different from the file explorer's "confirm" button, one of them is wrong.
- `Funnel Display` (or any display face) in a UI label, button, or data cell.
- Reinvented standard affordances for flavor: custom scrollbars that behave differently from native, non-standard `<select>`/checkbox/radio shapes, home-grown modal dismiss logic. Radix primitives exist precisely to prevent this (see design.md's D1).
- Full-saturation accent color on an inactive/disabled state.
- Modal-as-first-thought. Dialog/AlertDialog are for destructive confirmation and focused single-task capture; inline validation, Popover, and progressive disclosure are tried first.
- The brand's diagonal cut-corner (`.cut`/`.cut-sm`) motif on interactive product controls (inputs, menus, overlays, tree rows) — it stays a brand-register signature (Button, Panel, ValueCard) and does not migrate onto dense UI chrome.

## Accessibility & Inclusion

- **WCAG contrast**: ≥4.5:1 for body text, ≥3:1 for large text (≥18pt / ≥14pt bold) and non-text UI components (borders, icons, the accent fill itself), verified per token in DESIGN.md and per component at ship time.
- **Keyboard operability**: every interactive component is fully operable without a pointer — Tab/Shift+Tab, Space/Enter, Arrow keys where the pattern calls for it (RadioGroup, Slider, Select, Tree, Menu), Escape to dismiss overlays, roving tabindex for composite widgets (Tree, Tabs, Menu).
- **Visible focus**: every focusable element shows a `:focus-visible` ring using `--focus`, never suppressed.
- **Reduced motion**: `prefers-reduced-motion: reduce` is honored everywhere motion appears (see Motion budget above).
- **Screen reader support**: correct roles/ARIA delegated to Radix where Radix backs the component (D1); icon-only controls always carry an accessible name (`aria-label` or `VisuallyHidden` text); live regions (Toast, loading states) announce without stealing focus.
- **Delegated a11y, not reinvented a11y**: focus trap, dismiss-on-outside-click/Escape, positioning/collision, and roving-tabindex are Radix's job (D1) — the design system supplies tokens and visual states on top, not a parallel accessibility implementation.
