import type { Meta, StoryObj } from "@storybook/react"

import { LineChart } from "./LineChart"

const WEEKS = ["7 jul", "14 jul", "21 jul", "28 jul", "4 ago", "11 ago", "18 ago", "25 ago", "1 set", "8 set", "15 set", "22 set", "29 set"]

const meta = {
  title: "Data/LineChart",
  component: LineChart,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: `
One series over time on a **single Y axis**, read with a crosshair — by the
pointer, or by the keyboard (←/→, Home, End), each reading announced in a live
region. Built-in "Ver tabela" swaps the drawing for the same numbers.

**When to use:** a week-by-week recurrence of the category in focus.

**Do's & Don'ts**
- Do give \`ariaLabel\` a sentence that states the trend ("de 40 para 64 por semana").
- Don't plot two unrelated scales on it: one axis, one series in emphasis.
`,
      },
    },
  },
  args: {
    points: WEEKS.map((label, i) => ({ label, value: 40 + Math.round(6 * Math.sin(i)) + i })),
    seriesLabel: "Status e avisos",
    ariaLabel: "Recorrência semanal de Status e avisos. Use as setas para ler cada semana.",
    labels: { showTable: "Ver tabela", showChart: "Ver gráfico", point: "Semana de", value: "Menções" },
    title: "Recorrência semana a semana",
    description: "Quantas vezes as Dores de Status e avisos aparecem por semana.",
  },
} satisfies Meta<typeof LineChart>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Thirty_days: Story = { args: { points: WEEKS.slice(-4).map((label, i) => ({ label, value: 50 + i * 3 })) } }

export const AsTable: Story = { args: { defaultTable: true } }
