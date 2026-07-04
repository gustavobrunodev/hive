import { useState } from "react"
import type { Meta, StoryObj } from "@storybook/react"

import { Textarea } from "./Textarea"

const meta = {
  title: "Forms/Textarea",
  component: Textarea,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: `
Autosizing multi-line text field. Mirrors \`Input\`'s visual language
(same border/radius/focus treatment) but grows/shrinks between \`minRows\` and
\`maxRows\` as content changes, then scrolls internally past \`maxRows\`.

**When to use / when not**
- Use for any free-form multi-line text: comments, descriptions, chat
  composers. For a single line, use \`Input\` instead — this component always
  renders at least \`minRows\` tall even for one word.
- Use \`onSubmit\` + the default \`submitOnEnter\` for chat-composer-style
  "Enter to send, Shift+Enter for a newline" — that split is fixed and not
  configurable (by design: it's the universal convention, not a per-instance
  choice).

**Do's & Don'ts**
- Do control \`minRows\`/\`maxRows\` to fit the surface (e.g. \`minRows={1}\` for
  a compact composer, \`minRows={3}\` for a description field) rather than
  fighting the default with CSS height overrides.
- Do pass either \`value\`+\`onChange\` (controlled) or \`defaultValue\`
  (uncontrolled) — never both \`value\` and no \`onChange\`, which the
  component tolerates internally (it always renders controlled under the
  hood via \`useControllableState\`) but which will look frozen to the user
  since your \`value\` prop would never update.
- Don't set \`submitOnEnter={false}\` without also giving users another
  visible way to submit (e.g. a send button) — Shift+Enter-only submission
  isn't discoverable.

**A11y**
- Renders a real \`<textarea>\`; native attributes (\`required\`,
  \`aria-label\`, \`name\`, ...) pass straight through.
- \`error\` sets \`aria-invalid="true"\` the same way \`Input\` does — pair with
  \`Field\`'s \`error\`/\`aria-describedby\` wiring for an announced reason.
- The autosize behavior is purely visual (height), so it never changes tab
  order or focus behavior.

**Relevant tokens**: \`--surface\`, \`--border\`/\`--border-strong\` (hover),
\`--focus\` (focus ring), \`--danger\` (error), \`--ink\`, \`--faint\`
(placeholder/disabled).
        `,
      },
    },
  },
  args: {
    placeholder: "Escreva sua mensagem...",
    minRows: 1,
    maxRows: 8,
  },
  argTypes: {
    error: { control: "boolean" },
    disabled: { control: "boolean" },
    minRows: { control: "number" },
    maxRows: { control: "number" },
  },
} satisfies Meta<typeof Textarea>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {},
}

export const WithError: Story = {
  args: {
    error: true,
    defaultValue: "Este campo é obrigatório.",
  },
}

export const Disabled: Story = {
  args: {
    disabled: true,
    defaultValue: "Indisponível",
  },
}

export const AutosizeDemo: Story = {
  name: "Autosize (minRows=2, maxRows=5)",
  args: {
    minRows: 2,
    maxRows: 5,
    defaultValue:
      "Digite ou cole um texto longo aqui — o campo cresce linha a linha até 5 linhas visíveis e então passa a rolar internamente em vez de continuar crescendo.",
  },
  render: (args) => {
    function Demo() {
      const [value, setValue] = useState(args.defaultValue as string)
      return (
        <div style={{ width: 320 }}>
          <Textarea {...args} value={value} onChange={(e) => setValue(e.target.value)} defaultValue={undefined} />
        </div>
      )
    }
    return <Demo />
  },
}

export const SubmitOnEnter: Story = {
  name: "Chat composer (submitOnEnter)",
  args: {
    placeholder: "Enter envia, Shift+Enter quebra linha",
    onSubmit: () => alert("Enviado!"),
  },
}
