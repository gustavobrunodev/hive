import type { Meta, StoryObj } from "@storybook/react-vite"
import { ActivityBorder } from "./ActivityBorder"
import { PromptInput } from "../PromptInput/PromptInput"

const meta: Meta<typeof ActivityBorder> = {
  title: "Chat/ActivityBorder",
  component: ActivityBorder,
  parameters: { layout: "padded" },
}
export default meta

type Story = StoryObj<typeof ActivityBorder>

export const Working: Story = {
  args: { active: true },
  render: (args) => (
    <div style={{ maxWidth: 620 }}>
      <ActivityBorder {...args}>
        <PromptInput
          placeholder="Ask anything — the surface stays usable while it runs"
          streaming
          onStop={() => {}}
          onSubmit={() => {}}
        />
      </ActivityBorder>
    </div>
  ),
}

export const Idle: Story = { ...Working, args: { active: false } }

export const AroundAPanel: Story = {
  args: { active: true, radius: "12px", duration: "3.4s" },
  render: (args) => (
    <ActivityBorder {...args} style={{ maxWidth: 420 }}>
      <div
        style={{
          padding: 20,
          borderRadius: 12,
          border: "1px solid var(--border)",
          background: "var(--surface)",
        }}
      >
        Any bordered surface can carry the ring — match `radius` to its own.
      </div>
    </ActivityBorder>
  ),
}
