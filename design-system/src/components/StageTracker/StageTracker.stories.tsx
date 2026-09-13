import type { Meta, StoryObj } from "@storybook/react"

import { StageTracker } from "./StageTracker"

const meta = {
  title: "Navigation/StageTracker",
  component: StageTracker,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component: `
A plan that knows where it is — and lets you act on it.

**When to use / when not:** use it for a sequence the *user* drives, where the
interface's job is to say what is finished, what comes next, and what is still
ahead. Use **StepFlow** when the interface is driving and the user only watches
(a sign-in, an install) — its steps are inert by construction. Use
**SteppedList** for instructions performed at the reader's own pace, and
**Progress** for one continuous quantity rather than named stages.

**Do's & Don'ts**
- Do leave finished stages clickable. "Redo this" is ordinary, not an error.
- Do give each status its own verb via \`actionLabels\` — a row whose name never
  changes teaches nobody that a finished stage can be run again.
- Do fill \`cue\` whenever the rows are runnable. A row of text with a dot beside
  it does not look like a button, and an affordance that only appears on hover
  is invisible to anyone who never thought to hover.
- Do put "open what this made" in \`trailing\`, never on the row itself: one
  click cannot mean both "show me" and "run it again".
- Do reach for \`groups\` past six or so stages — chapters make a long plan
  scannable, and the ordinals keep counting across them so it still reads as one
  flow.
- Don't use it as a static diagram. A tracker that never changes state is a list.
`
      }
    }
  }
} satisfies Meta<typeof StageTracker>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    label: "Fluxo BMAD",
    stages: [
      { id: "research", label: "Pesquisa de domínio", hint: "pesquisa-dominio.md", status: "done" },
      { id: "brainstorm", label: "Brainstorming", hint: "brainstorming.md", status: "done" },
      { id: "prd", label: "PRD", hint: "Próxima etapa", status: "active" },
      { id: "architecture", label: "Arquitetura", status: "pending" },
      { id: "stories", label: "Criação de histórias", status: "pending" }
    ]
  }
}

export const Actionable: Story = {
  args: {
    ...Default.args,
    onSelect: () => {},
    actionLabels: {
      done: (label) => `Refazer ${label}`,
      active: (label) => `Iniciar ${label}`,
      pending: (label) => `Iniciar ${label}`
    }
  }
}

export const NotStarted: Story = {
  args: {
    label: "Fluxo",
    onSelect: () => {},
    stages: [
      { id: "research", label: "Pesquisa de domínio", hint: "Próxima etapa", status: "active" },
      { id: "brainstorm", label: "Brainstorming", status: "pending" },
      { id: "prd", label: "PRD", status: "pending" }
    ]
  }
}

/** Chapters, badges and a visible verb — the shape a long user-driven plan wants. */
export const Grouped: Story = {
  args: {
    label: "Fluxo",
    onSelect: () => {},
    actionLabels: {
      done: (label) => `Abrir ${label}`,
      active: (label) => `Iniciar ${label}`,
      pending: (label) => `Iniciar ${label}`
    },
    groups: [
      { id: "analysis", label: "Análise", meta: "1/2" },
      { id: "planning", label: "Planejamento", meta: "0/2" },
      { id: "solution", label: "Solucionamento", meta: "0/1" }
    ],
    stages: [
      {
        id: "research",
        group: "analysis",
        label: "Pesquisa de domínio",
        hint: "pesquisa-dominio.md",
        badge: "Opcional",
        status: "done"
      },
      {
        id: "brainstorm",
        group: "analysis",
        label: "Brainstorming",
        hint: "Ainda não iniciada",
        badge: "Opcional",
        status: "pending",
        cue: "▸"
      },
      {
        id: "prd",
        group: "planning",
        label: "PRD",
        hint: "Próxima etapa",
        status: "active",
        cue: "Iniciar"
      },
      {
        id: "ux",
        group: "planning",
        label: "UX Design",
        hint: "Ainda não iniciada",
        badge: "Opcional",
        status: "pending",
        cue: "▸"
      },
      {
        id: "architecture",
        group: "solution",
        label: "Arquitetura",
        hint: "Ainda não iniciada",
        status: "pending",
        cue: "▸"
      }
    ]
  }
}
