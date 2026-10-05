import type { Meta, StoryObj } from "@storybook/react"

import { SourceNote } from "./SourceNote"

const meta = {
  title: "Data/SourceNote",
  component: SourceNote,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: `
A Dor as a sticky note, in the colour of the **source** it came from —
Likert, Voz do Cliente or FullStory (\`--source-<fonte>-*\` tokens).

**When to use:** a grid of problems where *where it came from* matters as much
as *what it is* — a column per source, a strip of "Dores em alta".

**Do's & Don'ts**
- Do keep the impact as a word. The seal's fill only repeats it.
- Do pass \`pressed\` when the note toggles a selection (citing it), and omit it
  when the note opens something — the two are different buttons.
- Don't recolour a note by status. The source hue is categorical; a status
  colour on top of it collides with the impact seal.
`,
      },
    },
  },
  args: {
    fonte: "likert",
    title: "Não consigo ver o histórico maior que 90 dias",
    volume: "1.932 menções",
    impact: "alto",
    impactLabel: "Alto",
    impactPrefix: "Impacto",
    trend: 14,
    trendLabel: "14%",
    style: { width: 200 },
  },
} satisfies Meta<typeof SourceNote>

export default meta
type Story = StoryObj<typeof meta>

export const Likert: Story = {}

export const VozDoCliente: Story = {
  args: {
    fonte: "voz",
    title: "Minha transação de câmbio estornou e não recebi nenhuma notificação",
    volume: "1.284 ligações",
    trend: 31,
    trendLabel: "31%",
  },
}

export const FullStory: Story = {
  args: {
    fonte: "fullstory",
    title: "Rage click no botão Confirmar remessa",
    volume: "2.140 clientes",
    impact: "medio",
    impactLabel: "Médio",
    trend: -4,
    trendLabel: "4%",
  },
}

export const Cited: Story = { args: { pressed: true, tilt: -1.2 } }
