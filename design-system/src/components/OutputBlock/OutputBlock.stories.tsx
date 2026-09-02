import type { Meta, StoryObj } from "@storybook/react"
import { OutputBlock } from "./OutputBlock"

const meta = {
  title: "Data/OutputBlock",
  component: OutputBlock,
  parameters: {
    docs: {
      description: {
        component:
          "A framed block of machine output — a command's answer, a tool result, a log " +
          "excerpt. Recessed rather than raised: it is a window cut into the surface, not a " +
          "card sitting on it. Ships no strings; every label is passed in, so the host owns i18n.",
      },
    },
  },
} satisfies Meta<typeof OutputBlock>

export default meta
type Story = StoryObj<typeof meta>

const VERIFY = `> hive-desktop@0.1.0 verify
> npm run typecheck && npm run lint && npm run test

✓ typecheck
✓ lint — 0 problemas
✓ 1614 testes em 132 arquivos (28,4s)`

export const Default: Story = {
  args: { text: VERIFY, label: "Resultado", meta: "7 linhas" },
}

/** A command, with the shell's own punctuation in front of it. */
export const Command: Story = {
  args: { text: "npm run verify -- --reporter=dot", prompt: "$", label: "Comando" },
}

/** Past the cap the block clips, fades, and offers to grow in place. */
export const Capped: Story = {
  args: {
    text: Array.from({ length: 40 }, (_, i) => `src/renderer/src/chat/file-${i}.tsx`).join("\n"),
    label: "Resultado",
    meta: "40 linhas",
    maxLines: 8,
    moreLabel: (hidden: number) => `Mostrar mais ${hidden} linhas`,
    lessLabel: "Mostrar menos",
    note: "1 240 caracteres não exibidos",
  },
}

/** When the output *is* the failure, the frame says so before the text is read. */
export const Failure: Story = {
  args: {
    text: "npm ERR! code ELIFECYCLE\nnpm ERR! errno 1\nnpm ERR! hive-desktop@0.1.0 verify: `npm run typecheck`\nnpm ERR! Exit status 1",
    tone: "danger",
    label: "Resultado",
    meta: "4 linhas",
  },
}

/** The result has not arrived yet: the frame is there, its content is not. */
export const Pending: Story = {
  args: { text: "", pending: true, label: "Resultado" },
}

/** A tool that answered with nothing — a different fact from one that was never captured. */
export const Empty: Story = {
  args: { text: "", label: "Resultado", emptyLabel: "A ferramenta não retornou conteúdo." },
}

/** With a copy control. The component owns no clipboard access; the host does. */
export const Copyable: Story = {
  args: {
    text: VERIFY,
    label: "Resultado",
    onCopy: (text: string) => console.log(text),
    copyLabel: "Copiar",
    copiedLabel: "Copiado",
  },
}
