import type { Meta, StoryObj } from "@storybook/react"

import { CaseCard, CaseGrid } from "./CaseCard"

/**
 * **Usage**
 *
 * - **When to use**: an example/case-study card — a concrete scenario with
 *   an optional sample prompt and mode label. `CaseGrid` is the responsive
 *   grid meant to hold a collection of these; `CaseCard` alone still renders
 *   correctly outside a grid.
 * - **When not**: for a small fixed set of contrasting approaches (not
 *   scenarios), use `ModeSplit`/`ModeBlock` instead; for a value-proposition
 *   pitch, use `ValueGrid`/`ValueCard`.
 * - **Do**: pass `index` when rendering a list inside `CaseGrid` — it feeds
 *   the card's `--i` CSS custom property, staggering its entrance animation
 *   so a grid of cards doesn't all animate in at once.
 * - **Do**: use `prompt` for a literal example input a user might type; use
 *   `mode` only when the case has a meaningful mode/category to tag (it
 *   renders as a muted `Badge`, so keep it short).
 * - **Don't**: omit `title` — it's the only heading (`<h3>`) inside the
 *   card; without it the card has no accessible structure beyond prose.
 * - **A11y**: `title` renders as `<h3>` — ensure the grid sits under an
 *   `<h2>` or higher in the surrounding page. `mode`'s `Badge` is
 *   presentational text only; don't rely on it alone to convey a state that
 *   isn't otherwise in the card's copy.
 * - **Tokens**: `--accent` (tag/prompt-marker text), `--muted` (body text),
 *   `--bg`/`--border`/`--ink` (prompt block), `--surface` (`Panel`
 *   background), `Badge`'s `--muted`/`--border` (mode label).
 */
const meta = {
  title: "Data Display/CaseCard",
  component: CaseCard,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  args: {
    tag: "Automação",
    title: "Triagem de PRs",
    prompt: "Revise os PRs abertos e sinalize os que quebram o build.",
    mode: "Delegado",
    children: "O agente varre os PRs abertos, roda o pipeline local e comenta com o resultado.",
  },
  argTypes: {
    index: { control: "number" },
  },
} satisfies Meta<typeof CaseCard>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithoutPrompt: Story = {
  name: "Without prompt",
  args: {
    prompt: undefined,
  },
}

export const WithoutMode: Story = {
  name: "Without mode badge",
  args: {
    mode: undefined,
  },
}

export const Grid: Story = {
  name: "CaseGrid (collection)",
  render: () => (
    <CaseGrid>
      <CaseCard
        index={0}
        tag="Automação"
        title="Triagem de PRs"
        prompt="Revise os PRs abertos e sinalize os que quebram o build."
        mode="Delegado"
      >
        O agente varre os PRs abertos, roda o pipeline local e comenta com o resultado.
      </CaseCard>
      <CaseCard index={1} tag="Pesquisa" title="Levantamento de concorrentes" mode="Conduzido">
        Você guia o agente por fontes específicas enquanto ele resume os achados.
      </CaseCard>
      <CaseCard
        index={2}
        tag="Documentação"
        title="Atualização de README"
        prompt="Atualize os exemplos de instalação para a versão mais recente."
      >
        O agente identifica trechos desatualizados e propõe o diff.
      </CaseCard>
    </CaseGrid>
  ),
}
