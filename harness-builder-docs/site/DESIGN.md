# Design

Visual system derived from Zup's brand identity (`visual.md`). The brand colors
are already committed, so identity-preservation governs every choice here.

## Theme

Dark, drenched. Body surface is Bordô Excelência (`#260A12`) with Cinza Impacto
(`#DED4D4`) text — Zup's preferred combination. Light contrast sections use
`#F5F0F0`. Strategy: **Committed/Drenched** (the surface carries the brand).

## Color (tokens)

| Token | Value | Role |
|---|---|---|
| `--bordo` | `#260A12` | primary background / drench |
| `--bordo-2` | `#5C1C27` | gradient-dispersion start, raised surfaces |
| `--cinza-impacto` | `#DED4D4` | primary text on dark |
| `--cinza-conhecimento` | `#AD9797` | secondary text, captions |
| `--bordo-sensatez` | `#852838` | word highlight / accent on dark |
| `--coral` | `#CC7958` | primary accent, links, numbering, rule line |
| `--cinza-light` | `#F5F0F0` | light section background |
| `--verde` | `#52C998` | success / positive signal only |

Contrast: `#DED4D4` on `#260A12` ≈ 13:1. Coral and Bordô Sensatez are accents,
not body text. Green is functional (positive), never decorative.

## Typography

- **Funnel Display** (SemiBold/Bold) — titles, display. Fluid `clamp()`, max ≤ 6rem.
- **Inter** (Regular/SemiBold/Bold) — body, subtitles, lists. Fixed rem, ≥16px.
- **Inter Tight** (Bold) — large numerals / standout ≥ 37pt.
- Letter-spacing on display ≥ -0.03em. Initial caps, never ALL CAPS in prose.
  `text-wrap: balance` on headings.

## Signature shapes / graphics

- **Diagonal-cut corners** (Zup proprietary): `clip-path` polygons on buttons,
  badges, cards, panels. Diagonals lean right (agility). Avoids rounded-corner tell.
- **Dot-dispersion gradient** ("Gradiente Conexão"): never simple linear/radial.
  Implemented as a dispersed radial-dot field fading across the surface.
- **"Z" mark**: minimalist Z in nav/footer. Never rotate, distort, or shadow it.
- **Cocriação graphic**: two adjacent elements with `#5C1C27` softening the start.

## Layout

Asymmetric where it earns emphasis. Fluid spacing via `clamp()`, 4pt scale.
Header pattern: section title top-left with a Coral rule beneath. Footer:
`@zupinnovation` left, `zup.com.br` right (Inter, small, Cinza Conhecimento).

## Motion

Intentional, ease-out-expo / quart. One orchestrated hero entrance + earned
section reveals (IntersectionObserver, fire-once) + card stagger. No fade-on-every-
section reflex. Full `prefers-reduced-motion` fallback (crossfade / instant).

## Bans (brand-specific)

Linear/radial simple gradients, gradient text, glassmorphism-as-default,
over-rounded corners, hero-metric template, identical card grids, per-section
uppercase eyebrows, emojis in institutional copy.
