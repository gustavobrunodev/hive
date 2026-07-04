import type { Meta, StoryObj } from "@storybook/react"

import { Flow, SpineLabel, Step, Steps, Sub, Substeps } from "./Timeline"

const USAGE = `
**When to use / when not** — Timeline (\`Flow\`/\`Steps\`/\`Step\`/\`Substeps\`/
\`Sub\`) is a brand-register, illustrated process narrative: a numbered rail
of connected nodes for a case-study "how we worked" section or a product
"how it works" story, each step opening into a full \`Panel\` with a title,
skill chips, and optional nested sub-steps. It's heavier and more
decorative than \`SteppedList\` (plain numbered copy) or \`Tabs\` (view
switching) — reach for it specifically when the sequence itself is part of
the story being told, not just a UI affordance.

**Do's & Don'ts**
- Do set \`last\` on the final \`Step\` in a \`Steps\` group — it's what omits
  the trailing connector wire; forgetting it leaves a dangling line under
  the last node.
- Do use \`highlight\` sparingly, for the one step that should read as "the
  current/most important stage" — it swaps the rail node to the brand-filled
  treatment; using it on more than one step in the same flow defeats the
  emphasis.
- Do nest \`Substeps\`/\`Sub\` inside a \`Step\`'s children when a stage breaks
  down into 2–4 smaller activities — \`Sub\` is a compact
  label/skill/description card, not a full nested Step.
- Don't use \`Step\`'s \`skills\` for anything other than short skill/tool
  names — it renders each entry as a \`Chip\` (\`variant="skill"\`), which is
  sized for single words or short phrases, not sentences.

**A11y** — \`Step\`'s title renders as a real \`<h3>\` inside its \`Panel\`, so
the sequence is navigable via heading structure; make sure a \`Steps\` group
sits under an appropriate parent heading (h2) for correct nesting. The rail
node number and connector wire are purely decorative visual scaffolding with
no semantic role — the accessible content is the heading, description, and
skill chip text.

**Relevant tokens** — the rail connector and node use semantic-role tokens
(\`--surface\`, \`--border-strong\`, \`--ink\`), but the **highlighted node fill**
and the **spine-label swatch gradient** intentionally use raw brand
primitives — \`--bordo-sensatez\`, \`--coral\`, and \`--cinza-impacto\` — not a
semantic surface/ink role. Per \`.specs/project/STATE.md\`'s Lessons: no
dark-theme Layer-2 role resolves to these exact values, and forcing a role
swap would either change the intended dark rendering or introduce a
light-theme contrast bug in this fixed brand-tile combo (\`--cinza-impacto\`
text on a raw \`--bordo-sensatez\` background). This is a deliberate,
documented exception, not an oversight — do not "fix" it by swapping in
\`--accent\`/\`--ink\`.
`

const meta = {
  title: "Navigation/Timeline",
  component: Step,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: { description: { component: USAGE } },
  },
} satisfies Meta<typeof Step>

export default meta

type Story = StoryObj<typeof meta>

export const FullFlow: Story = {
  name: "Full flow (Flow + SpineLabel + Steps)",
  render: () => (
    <Flow>
      <SpineLabel>
        <b>Process</b> — from discovery to delivery
      </SpineLabel>
      <Steps>
        <Step number="01" title="Discover" skills={[{ label: "Research" }, { label: "Interviews" }]}>
          <p>Understand the problem space with stakeholders and users.</p>
        </Step>
        <Step
          number="02"
          title="Design"
          highlight
          skills={[{ label: "Facilitation", he: true }, { label: "Prototyping" }]}
        >
          <p>The current stage — shaping the solution with the team.</p>
          <Substeps>
            <Sub label="01" skill="Workshop">
              Align on constraints and success criteria.
            </Sub>
            <Sub label="02" skill="Prototype">
              Build a clickable draft for early feedback.
            </Sub>
          </Substeps>
        </Step>
        <Step number="03" title="Deliver" last skills={[{ label: "Engineering" }]}>
          <p>Ship, measure, and hand off documentation.</p>
        </Step>
      </Steps>
    </Flow>
  ),
}

export const HighlightedStep: Story = {
  args: {
    number: "02",
    title: "Design",
    highlight: true,
    skills: [{ label: "Facilitation", he: true }, { label: "Prototyping" }],
    children: <p>The current/emphasized stage in the sequence.</p>,
  },
}

export const DefaultStep: Story = {
  args: {
    number: "01",
    title: "Discover",
    skills: [{ label: "Research" }, { label: "Interviews" }],
    children: <p>Understand the problem space with stakeholders and users.</p>,
  },
}

export const LastStep: Story = {
  name: "Last step (no trailing wire)",
  args: {
    number: "03",
    title: "Deliver",
    last: true,
    skills: [{ label: "Engineering" }],
    children: <p>Ship, measure, and hand off documentation.</p>,
  },
}
