# Product

## Register

brand

## Users

Developers and technical leads evaluating or installing the `harness-builder` agent skill — visitors arriving from a link, a repo README, or a search, deciding in the first screen whether this tool solves a real problem for them. They are fluent in dev tooling and skeptical of marketing fluff; they want to see *what it does* and *how to install it* fast, not be sold to.

## Product Purpose

This Docusaurus site is the marketing/landing surface for `harness-builder`, a skill that orchestrates four reference modules (rules, sensors, skills, harness engineering) to help any coding agent build and evolve a project's harness without overengineering. The site's job: explain the skill's value in one hero screen, show how it works, and get the visitor to install it. Success looks like a developer understanding the pitch in under 30 seconds and running the install command.

## Brand Personality

Inherited directly from the sibling `@hive/design-system` package's brand register (the same Zup identity used across Hive's marketing surfaces): **precise, restrained, quietly confident.** Dark bordo background, coral accent used sparingly for emphasis and primary actions, the diagonal cut-corner (`.cut`/`.cut-sm`) signature, dot-dispersion gradients (never simple linear/radial), `Funnel Display` for display type + `Inter` for body/UI. Engineering-grade seriousness — the copy and visuals should read as built-by-practitioners-for-practitioners, not as a generic startup landing page.

## Anti-references

- Generic SaaS landing page clichés — hero-metric templates, identical feature-card grids, tiny uppercase tracked eyebrows above every section, numbered `01/02/03` section markers used as decoration rather than a real sequence.
- Gradient text, glassmorphism/heavy blur cards — inconsistent with the flat, cut-corner Zup brand language.
- Stock-photo or generic AI-tool marketing pages — this should look like it was built by the same team that builds the design system, not outsourced.
- Oversized/undersized or misaligned hero media — the hero's two blocks (copy + video) must read as one deliberately-composed unit, not an afterthought embed.

## Design Principles

- **Show, don't tell.** The hero's video carries as much weight as the headline — it should be large and confident enough to actually demonstrate the product, not a small preview thumbnail bolted on the side.
- **One brand, two registers, shared discipline.** This site is brand-register (design IS the product here), but it borrows every token, component, and restraint rule already proven in `@hive/design-system`'s brand-register components (BrandMark, HarnessMark, Terminal, ValueGrid, Reveal/Stagger) rather than inventing new visual language.
- **Practitioner trust over sales pitch.** Copy is direct and technical; the design should never feel like it's compensating for a weak product with decoration.

## Accessibility & Inclusion

- WCAG AA contrast (≥4.5:1 body text, ≥3:1 large text/non-text UI) on the dark bordo background — verify coral-on-bordo and muted-text combinations specifically.
- `prefers-reduced-motion: reduce` honored for the `Reveal`/`Stagger` scroll-choreography already in use.
- Hero video ships with visible `controls` and is `muted` for autoplay compliance (already the case) — no motion-only content without a static equivalent.
