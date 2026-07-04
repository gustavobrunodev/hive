import type { Meta, StoryObj } from "@storybook/react"

import { ValueCard, ValueGrid } from "./ValueCard"

/**
 * **Usage**
 *
 * - **When to use**: a short value-proposition pitch — a kicker, a title,
 *   and one supporting sentence. `ValueGrid` is the responsive grid meant
 *   to hold a collection of these; a lone `ValueCard` still renders fine
 *   outside a grid.
 * - **When not**: for a scenario/example with a sample prompt, use
 *   `CaseGrid`/`CaseCard`; for contrasting a small number of approaches, use
 *   `ModeSplit`/`ModeBlock`.
 * - **Do**: keep `children` to one short sentence — `ValueCard` is sized
 *   for a pitch, not an explanation.
 * - **Do**: pass `index` for entrance-animation stagger inside a
 *   `ValueGrid`, same convention as `CaseCard`/`SkillCard`.
 * - **Don't**: omit `kicker` — the decorative marker glyph before it
 *   (an `aria-hidden` `<em>`) is styled assuming a short label follows it;
 *   an empty kicker leaves a lone marker with nothing to anchor.
 * - **A11y**: `title` renders as `<h3>` — keep the grid under an `<h2>` or
 *   higher. The kicker's leading marker glyph is `aria-hidden="true"`,
 *   purely decorative; the kicker text itself is still announced normally.
 * - **Tokens**: `--accent` (kicker text + marker glyph), `--muted` (body
 *   text), `--surface` (`Panel` background), `--border` (`Panel` border).
 */
const meta = {
  title: "Data Display/ValueCard",
  component: ValueCard,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  args: {
    kicker: "Velocidade",
    title: "Do prompt ao deploy",
    children: "Menos etapas manuais entre a ideia e o código em produção.",
  },
  argTypes: {
    index: { control: "number" },
  },
} satisfies Meta<typeof ValueCard>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Grid: Story = {
  name: "ValueGrid (collection)",
  render: () => (
    <ValueGrid>
      <ValueCard index={0} kicker="Velocidade" title="Do prompt ao deploy">
        Menos etapas manuais entre a ideia e o código em produção.
      </ValueCard>
      <ValueCard index={1} kicker="Consistência" title="Um único design system">
        Componentes e tokens compartilhados entre todos os produtos.
      </ValueCard>
      <ValueCard index={2} kicker="Confiança" title="Cobertura de testes real">
        Métricas de cobertura acima de 90% em todo o pacote.
      </ValueCard>
    </ValueGrid>
  ),
}
