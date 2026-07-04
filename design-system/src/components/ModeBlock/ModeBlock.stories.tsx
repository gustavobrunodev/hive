import type { Meta, StoryObj } from "@storybook/react"

import { ModeBlock, ModeSplit } from "./ModeBlock"

/**
 * **Usage**
 *
 * - **When to use**: contrasting exactly two (or a few) approaches/modes side
 *   by side — e.g. "drive it yourself" vs "delegate to an agent". `ModeSplit`
 *   is the grid that pairs `ModeBlock`s; a lone `ModeBlock` outside a split
 *   still renders fine but loses the side-by-side contrast it's designed for.
 * - **When not**: for an open-ended collection of many items (not a
 *   deliberate few-way contrast), use `CaseGrid`/`CaseCard` or
 *   `ValueGrid`/`ValueCard` instead — `ModeBlock` reads as "pick one of
 *   these," not "browse this list."
 * - **Do**: set `primary` on the recommended/default mode — it applies
 *   `Panel`'s accent border so one option visually leads.
 * - **Do**: use `items` for a short scannable bullet list of what the mode
 *   includes; use `children` (prose) for the framing sentence above it.
 * - **Don't**: mark more than one `ModeBlock` `primary` within the same
 *   `ModeSplit` — it dilutes the "recommended choice" signal.
 * - **A11y**: `title` renders as an `<h3>`, so a heading hierarchy above the
 *   `ModeSplit` should use `<h2>` or higher. Both blocks are static content
 *   (no interactive role) — if modes are actually selectable, wrap each in
 *   your own button/radio semantics; `ModeBlock` doesn't provide it.
 * - **Tokens**: `--accent` (label/bullet marker), `--muted` (body/list text),
 *   `--border`/`--border-strong` (`Panel`'s default vs `accentBorder` state),
 *   `--surface` (`Panel` background).
 */
const meta = {
  title: "Data Display/ModeBlock",
  component: ModeBlock,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  args: {
    label: "Modo 1",
    title: "Conduza você mesmo",
    primary: false,
    items: ["Controle total do fluxo", "Ideal para tarefas exploratórias"],
    children: "Você comanda cada etapa diretamente, com o agente executando sob demanda.",
  },
  argTypes: {
    primary: { control: "boolean" },
    items: { control: "object" },
  },
} satisfies Meta<typeof ModeBlock>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Primary: Story = {
  args: {
    primary: true,
    label: "Modo 2",
    title: "Delegue ao agente",
    items: ["O agente decide os próximos passos", "Ideal para tarefas bem definidas"],
    children: "Você descreve o objetivo; o agente planeja e executa o fluxo inteiro.",
  },
}

export const WithoutItems: Story = {
  name: "Without items list",
  args: {
    items: [],
  },
}

export const Split: Story = {
  name: "ModeSplit (paired)",
  render: () => (
    <ModeSplit>
      <ModeBlock label="Modo 1" title="Conduza você mesmo" items={["Controle total do fluxo", "Ideal para tarefas exploratórias"]}>
        Você comanda cada etapa diretamente, com o agente executando sob demanda.
      </ModeBlock>
      <ModeBlock
        label="Modo 2"
        title="Delegue ao agente"
        primary
        items={["O agente decide os próximos passos", "Ideal para tarefas bem definidas"]}
      >
        Você descreve o objetivo; o agente planeja e executa o fluxo inteiro.
      </ModeBlock>
    </ModeSplit>
  ),
}
