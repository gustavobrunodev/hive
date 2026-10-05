import type { Meta, StoryObj } from "@storybook/react"
import { useState } from "react"

import { BarChart, type BarChartDatum } from "./BarChart"

const LABELS = { showTable: "Ver tabela", showChart: "Ver gráfico", category: "Categoria", value: "Menções", share: "Participação" }

const DATA: BarChartDatum[] = [
  { id: "cotacao", label: "Cotação e taxas", value: 683, valueLabel: "683", shareLabel: "51%" },
  { id: "status", label: "Status e avisos", value: 338, valueLabel: "338", shareLabel: "25%" },
  { id: "beneficiario", label: "Cadastro do beneficiário", value: 196, valueLabel: "196", shareLabel: "15%" },
  { id: "comprovante", label: "Comprovantes", value: 133, valueLabel: "133", shareLabel: "10%" },
]

const meta = {
  title: "Data/BarChart",
  component: BarChart,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: `
Horizontal bars with **one series in emphasis and the rest in context**, and a
built-in "Ver tabela" that swaps the drawing for a table with the same numbers.

**When to use:** comparing a handful of categories where one is the subject —
the Dores of a Relatório by category.

**Do's & Don'ts**
- Do control \`emphasis\` from the host, so a sibling chart can follow it.
- Do pass \`part\` on the emphasised row to show one item inside its category.
- Don't colour every bar. Context is one quiet colour; emphasis is one strong one.
`,
      },
    },
  },
  args: { data: DATA, emphasis: "cotacao", labels: LABELS, title: "Dores por categoria", description: "Menções no período. Toque numa categoria para destacá-la." },
} satisfies Meta<typeof BarChart>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: (args) => {
    const [emphasis, setEmphasis] = useState<string | null>(args.emphasis)
    return <BarChart {...args} emphasis={emphasis} onEmphasisChange={setEmphasis} />
  },
}

export const WithFilteredDor: Story = {
  args: { emphasis: "status", data: DATA.map((datum) => (datum.id === "status" ? { ...datum, part: 120 } : datum)) },
}

export const AsTable: Story = { args: { defaultTable: true } }
