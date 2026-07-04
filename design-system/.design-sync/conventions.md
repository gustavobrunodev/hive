## Setup

Hive ships its own fonts and base styles — `styles.css` already imports the real Funnel
Display / Inter / Inter Tight `@font-face` rules (from Google Fonts) and the tokens/base
CSS. **Do not add `<link>` font tags yourself** — they're already in the bundle.

Hive components are mostly "bare" (no background of their own) by design — they're meant
to sit on the brand's dark page background, not a white canvas. **Always wrap content in a
container with `background: var(--bordo)`** (or nest inside a component that supplies its
own dark surface, like `Panel`/`CaseCard`/`ValueCard`/`SkillCard`/`Badge`) — otherwise text
set in `--ink`/`--muted`/`--coral` renders illegibly on white. Give your outermost page
container `className="wrap"` for the brand's max-width + gutter.

## Styling idiom: tokens, not utility classes

Hive has no Tailwind-style utility-class vocabulary for spacing/layout — components take
typed props (`variant`, `hover`, `accentBorder`, `cut`, …), and your OWN layout glue (grids,
gaps, page sections) should use the design tokens directly as CSS custom properties:

| Token group | Names | Use for |
|---|---|---|
| Palette | `--bordo` `--bordo-2` `--coral` `--verde` | brand surfaces/accents |
| Semantic | `--ink` `--muted` `--surface` `--surface-2` `--border` `--border-strong` | text, raised surfaces, borders |
| Type | `--ff-display` (headings) `--ff-body` (text) `--ff-num` (numerals/metrics) | `font-family` |
| Spacing | `--s-1` … `--s-10` (4px → 128px, 4pt scale) | gap/padding/margin |
| Motion | `--ease-expo` `--ease-quart` | transition timing |

Two signature brand motifs are utility classes, not components: `.cut` / `.cut-sm`
(diagonal lean-right corner via `clip-path`) and `.dots` (the dot-dispersion gradient,
applied by `<DotsBackground />`, which needs a sized `position: relative` parent to be
visible). Most card-like components already default `cut={true}` internally — reach for
the raw `.cut`/`.cut-sm` class only on markup the library doesn't already wrap.

## Where the truth lives

Read the bound `_ds_bundle.css` (reachable from `styles.css`'s import chain) before
styling anything — it's the actual compiled CSS, tokens included. Each component's
`components/<group>/<Name>/<Name>.prompt.md` has its real prop contract and usage notes.

## Example

```jsx
import "@hive/design-system/dist/ds-bundle.css";
import { CaseGrid, CaseCard, Badge } from "@hive/design-system";

<div className="wrap" style={{ background: "var(--bordo)", padding: "var(--s-7) 0" }}>
  <CaseGrid style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "var(--s-4)" }}>
    <CaseCard tag="Engenharia" title="Revisão de PR" mode="Supervisionado">
      Comenta diretamente no pull request com achados e sugestões de fix.
    </CaseCard>
    <CaseCard tag="Operações" title="Triagem de incidentes" mode="Autônomo">
      Classifica o incidente e aciona o time responsável. <Badge variant="accent">Novo</Badge>
    </CaseCard>
  </CaseGrid>
</div>
```
