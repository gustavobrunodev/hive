import { useState } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { CodeEditor, type CodeChangeMark } from "./CodeEditor"

const meta: Meta<typeof CodeEditor> = {
  title: "Forms/CodeEditor",
  component: CodeEditor,
  parameters: { layout: "fullscreen" },
}

export default meta
type Story = StoryObj<typeof CodeEditor>

const TS = `// Detecta o motor que a CLI vai usar de fato.
import { readFile } from 'node:fs/promises'

export interface Motor {
  id: string
  contexto: number
  padrao?: boolean
}

export async function detectar(caminho: string): Promise<Motor[]> {
  const bruto = await readFile(caminho, 'utf8')
  const dados = JSON.parse(bruto) as { modelos?: Motor[] }
  return (dados.modelos ?? []).filter((m) => m.contexto > 0)
}
`

const MD = `# Especificação do produto

Este documento descreve **o que** o Hive precisa entregar e *por quê*.
Ele é lido por PMs, tech leads e designers — veja [o roadmap](https://x.dev).

## Critérios de aceite

- [x] O editor colore o arquivo pela própria gramática
- [ ] A prévia ocupa a largura do painel

| Item | Estado |
| --- | --- |
| Editor | pronto |
`

const YAML = `appId: dev.hive.app
files:
  - 'out/**'
nsis:
  oneClick: false
  perMachine: true # exige elevação
`

/** A fixed-height frame, since the editor fills whatever it is given. */
function Frame({
  initial,
  filename,
  lineNumbers,
}: {
  initial: string
  filename: string
  lineNumbers?: boolean
}) {
  const [value, setValue] = useState(initial)
  return (
    <div style={{ display: "flex", height: 380 }}>
      <CodeEditor
        value={value}
        onChange={setValue}
        filename={filename}
        lineNumbers={lineNumbers}
        ariaLabel="Conteúdo do arquivo"
      />
    </div>
  )
}

export const TypeScript: Story = {
  render: () => <Frame initial={TS} filename="detectar.ts" />,
}

/**
 * Markdown is the grammar that carries real typography in its source, and the
 * one most of this product's files are written in.
 */
export const Markdown: Story = {
  render: () => <Frame initial={MD} filename="PRD.md" />,
}

export const Yaml: Story = {
  render: () => <Frame initial={YAML} filename="electron-builder.yml" />,
}

/** No grammar for the extension: plain ink, rather than a wrong colouring. */
export const Plain: Story = {
  render: () => <Frame initial={"anotações soltas\nsem gramática nenhuma\n"} filename="notas" />,
}

/**
 * Change marks, beside the numbers. Wrapping stays on: the marks are drawn
 * against each line's own block, so a line that soft-wraps carries its mark
 * down the whole height it occupies.
 */
export const WithMarks: Story = {
  render: function WithMarksStory() {
    const [value, setValue] = useState(TS)
    const marks = value
      .split("\n")
      .map((_, index): CodeChangeMark | null =>
        index % 7 === 0 ? "add" : index % 11 === 0 ? "modified" : index === 4 ? "deleted" : null
      )
    return (
      <div style={{ display: "flex", height: 380 }}>
        <CodeEditor
          value={value}
          onChange={setValue}
          filename="detectar.ts"
          ariaLabel="Conteúdo do arquivo"
          marks={marks}
        />
      </div>
    )
  },
}

/** Without the number column — a small embedded field rather than a file pane. */
export const Unnumbered: Story = {
  render: () => <Frame initial={TS} filename="detectar.ts" lineNumbers={false} />,
}
