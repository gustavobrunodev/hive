import type { Meta, StoryObj } from "@storybook/react"

import { StepFlow } from "./StepFlow"

const meta = {
  title: "Feedback/StepFlow",
  component: StepFlow,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component: `
A flow of steps that reports where it is: done, active, pending, failed.

**When to use / when not:** use it when the interface hands part of a task to
something outside itself — a browser sign-in, an install, an upload — and the
user needs to know whose turn it is. Use **SteppedList** for instructions the
reader performs at their own pace (it numbers; it does not track). Use
**Progress** when there is one continuous quantity rather than named stages.

**Do's & Don'ts**
- Do keep to three or four steps. A rail with eight nodes is a log, not a flow.
- Do give the active step a hint saying what the user should do now.
- Don't use it as a static diagram: a flow that never changes state is a list.
`
      }
    }
  }
} satisfies Meta<typeof StepFlow>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    label: "Entrada na AWS",
    steps: [
      { id: "start", label: "Preparando a solicitação", status: "done" },
      {
        id: "browser",
        label: "Autorize no navegador",
        hint: "Abrimos a página de login da sua conta",
        status: "active"
      },
      { id: "done", label: "Sessão renovada", status: "pending" }
    ]
  }
}

export const Failed: Story = {
  args: {
    label: "Entrada na AWS",
    steps: [
      { id: "start", label: "Preparando a solicitação", status: "done" },
      { id: "browser", label: "Autorize no navegador", status: "done" },
      {
        id: "done",
        label: "Sessão renovada",
        hint: "O login expirou antes da confirmação",
        status: "failed"
      }
    ]
  }
}

export const Horizontal: Story = {
  args: {
    label: "Instalação",
    orientation: "horizontal",
    steps: [
      { id: "1", label: "Baixar", status: "done" },
      { id: "2", label: "Instalar", status: "active" },
      { id: "3", label: "Verificar", status: "pending" }
    ]
  }
}
