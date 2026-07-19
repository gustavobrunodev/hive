# Product

## Register

product

## Users

Squad members — Product Managers, Tech Leads/Architects, Analysts and UX
designers — who are BMAD-curious but not necessarily CLI-fluent. They live in
this app for long working sessions: chatting with agents, launching BMAD
workflows, and reading/editing the artifacts (PRDs, architecture docs,
stories) those workflows produce. Their context is deep work at a desk, hours
at a time.

## Product Purpose

Hive Desktop is the visual, guided, squad-friendly surface over BMAD's
CLI-first agile-AI framework. It abstracts the BMAD CLI (zero-terminal
install/update/run), chats with any agent through a decoupled adapter layer
(Claude CLI first), and manages workspace artifacts in an integrated file
explorer/editor. Success: a non-engineer runs a full BMAD workflow — from
intent to reviewed artifact — without ever seeing a terminal.

## Brand Personality

Calm, capable, first-party. Three words: **focused, trustworthy, fluent**.
The tool should disappear into the task; familiarity with the best desktop
tools (VS Code, Linear, Notion) is a feature, not a liability. Warmth is
carried by the coral accent and the persona layer (John, Winston, Sally…),
never by decoration.

## Anti-references

- A "wrapped terminal": raw CLI output, monospace-everything, log-dump UIs.
- Electron-app jank: mismatched form controls, web-page scrollbars, dead
  hover states, controls that don't behave like their OS counterparts.
- SaaS-dashboard clichés: hero metrics, gradient accents, card grids.
- Over-decorated chat UIs; the chat is a working document, not a messenger.

## Design Principles

1. **OS-grade file management.** Explorer interactions (rename, create,
   drag, multi-select, tabs) must behave exactly like the native file
   manager / VS Code muscle memory users already have.
2. **Artifacts are the product.** Reading and editing BMAD artifacts gets
   first-class typography and space; chrome stays quiet around them.
3. **Guided, never gated.** Every workflow is reachable by intent (pills,
   actions, slash menu) — but nothing blocks a user who just wants to type.
4. **One vocabulary.** All UI comes from `@hive/design-system` role tokens;
   both themes resolve for free. No component invents its own affordance.
5. **Motion signals state.** 150–250ms, ease-out; nothing decorative.

## Accessibility & Inclusion

- WCAG AA floors: body text ≥4.5:1, large text/UI icons ≥3:1 (theme.css
  documents the dark-theme ramp against these floors).
- Full keyboard operability: roving tabindex in the tree, focus-visible
  rings on every custom-interactive control, Escape/Enter conventions.
- `prefers-reduced-motion` alternatives for every animation.
- All UI copy is pt-BR via `t()` (i18n/pt-BR.ts) — no inline literals.
