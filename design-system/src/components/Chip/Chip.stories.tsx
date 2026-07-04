import type { Meta, StoryObj } from "@storybook/react"

import { Chip } from "./Chip"

/**
 * **Usage**
 *
 * - **When to use**: a labeled tag drawn from one of four vocabularies —
 *   generic tag (`"tag"`), a workflow phase that can be current
 *   (`"phase"` + `active`), an agent/tool name (`"agent"`), or a skill
 *   name that can carry the harness-engineer tone (`"skill"` + `tone="he"`).
 *   `Terminal`'s phase row is built from `variant="phase"` chips.
 * - **When not**: for a single emphasized label with no variant taxonomy,
 *   use `Badge` instead — `Chip` exists specifically for these four
 *   semantic categories.
 * - **Do**: pair `active` only with `variant="phase"` and `tone="he"` only
 *   with `variant="skill"` — the component ignores both on other variants
 *   by design (see the class logic in `Chip.tsx`), so combining them
 *   elsewhere is silently a no-op, not an error.
 * - **Don't**: expect a built-in remove/dismiss affordance — `Chip` is a
 *   static, presentational `<span>`. A removable-chip pattern (common in
 *   filter UIs) isn't implemented here; compose your own trailing icon
 *   button next to it if you need one.
 * - **A11y**: no implicit role beyond its text content. For a `"phase"`
 *   chip acting as a step indicator, consider whether the active phase
 *   also needs to be announced via `aria-current` on the wrapping list
 *   item — `Chip` itself doesn't add it.
 * - **Tokens**: `--surface`/`--border`/`--ink` (base), `--accent`/
 *   `--border-strong` (active phase / skill tone-he), `--bg`,
 *   `--cinza-impacto`, `--ff-body`.
 */
const meta = {
  title: "Data Display/Chip",
  component: Chip,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  args: {
    children: "harness-engineer",
    variant: "tag",
  },
  argTypes: {
    variant: {
      control: "radio",
      options: ["tag", "phase", "agent", "skill"],
    },
    active: { control: "boolean" },
    tone: { control: "text" },
  },
} satisfies Meta<typeof Chip>

export default meta

type Story = StoryObj<typeof meta>

export const Tag: Story = {
  args: { variant: "tag", children: "typescript" },
}

export const Agent: Story = {
  args: { variant: "agent", children: "Cursor" },
}

export const PhaseInactive: Story = {
  name: "Phase (inactive)",
  args: { variant: "phase", children: "Plan" },
}

export const PhaseActive: Story = {
  name: "Phase (active)",
  args: { variant: "phase", active: true, children: "Execute" },
}

export const SkillDefault: Story = {
  name: "Skill (default tone)",
  args: { variant: "skill", children: "code-review" },
}

export const SkillHeTone: Story = {
  name: 'Skill (tone="he")',
  args: { variant: "skill", tone: "he", children: "harness-engineer" },
}

export const Overview: Story = {
  render: () => (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      <Chip variant="tag">typescript</Chip>
      <Chip variant="agent">Cursor</Chip>
      <Chip variant="phase">Plan</Chip>
      <Chip variant="phase" active>
        Execute
      </Chip>
      <Chip variant="skill">code-review</Chip>
      <Chip variant="skill" tone="he">
        harness-engineer
      </Chip>
    </div>
  ),
}
