import type { Meta, StoryObj } from "@storybook/react"
import { useState } from "react"

import { PasteField } from "./PasteField"

const meta = {
  title: "Forms/PasteField",
  component: PasteField,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component: `
A one-line field for a value the user **copied from somewhere else**: a
verification code, a token, an invite id.

**When to use / when not:** use it at the point a flow comes back from another
window and needs the thing the user is holding. Use **Input** in a **Field**
when the value is typed rather than carried, and **CodeBlock**/**OutputBlock**
when the value is being shown rather than asked for.

**Do's & Don'ts**
- Do wire \`onPaste\` to the platform's clipboard read — the paste is the gesture.
- Do keep typing possible: a clipboard can be refused, and a dead end there
  ends the whole flow.
- Don't clear the value on a rejection. A wrong code is a retry, not a restart.
`
      }
    }
  }
} satisfies Meta<typeof PasteField>

export default meta
type Story = StoryObj<typeof meta>

function Controlled(props: {
  error?: string
  busy?: boolean
  initial?: string
  withPaste?: boolean
}) {
  const [value, setValue] = useState(props.initial ?? "")
  return (
    <div style={{ maxWidth: 420 }}>
      <PasteField
        label="Código do navegador"
        description="A página do Claude mostrou um código depois que você autorizou."
        value={value}
        onValueChange={setValue}
        onSubmit={(committed) => window.alert(`enviado: ${committed}`)}
        submitLabel="Conectar"
        pasteLabel="Colar"
        placeholder="cole o código aqui"
        submitOnPaste
        {...(props.withPaste === false ? {} : { onPaste: () => "cod-9f21-a7c4" })}
        {...(props.error ? { error: props.error } : {})}
        {...(props.busy ? { busy: true } : {})}
      />
    </div>
  )
}

export const Default: Story = {
  args: { label: "Código", value: "", onValueChange: () => {} },
  render: () => <Controlled />
}

export const Rejected: Story = {
  args: { label: "Código", value: "", onValueChange: () => {} },
  render: () => (
    <Controlled initial="cod-9f21" error="Código não aceito. Copie o código inteiro e cole de novo." />
  )
}

export const Checking: Story = {
  args: { label: "Código", value: "", onValueChange: () => {} },
  render: () => <Controlled initial="cod-9f21-a7c4" busy />
}

export const TypedOnly: Story = {
  args: { label: "Código", value: "", onValueChange: () => {} },
  render: () => <Controlled withPaste={false} />
}
