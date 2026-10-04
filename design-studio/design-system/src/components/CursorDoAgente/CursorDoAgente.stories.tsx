import type { Meta, StoryObj } from "@storybook/react"
import React from "react"
import leia from "./README.md?raw"
import { CursorDoAgente } from "./CursorDoAgente"

const meta = {
  title: "Quadro/CursorDoAgente",
  component: CursorDoAgente,
  tags: ["autodocs"],
  args: { nome: "Claude", x: 24, y: 8 },
  parameters: { docs: { description: { component: leia } }, claudeDesign: { altura: 120 } },
  decorators: [(Historia) => <div style={{ position: "relative", height: 70 }}><Historia /></div>],
} satisfies Meta<typeof CursorDoAgente>

export default meta
type Story = StoryObj<typeof meta>

export const Vitrine: Story = {
  render: () => (
    <>
      <CursorDoAgente nome="Claude" x={24} y={8} />
      <CursorDoAgente nome="Devin" x={220} y={8} />
    </>
  ),
}
export const Claude: Story = {}
export const Oculto: Story = { args: { visivel: false } }
