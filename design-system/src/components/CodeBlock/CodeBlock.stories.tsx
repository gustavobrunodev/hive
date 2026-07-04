import type { Meta, StoryObj } from "@storybook/react"

import { CodeBlock, Cor, Cmt } from "./CodeBlock"

/**
 * **Usage**
 *
 * - **When to use**: a static, copyable code/command snippet — install
 *   instructions, a config example, a CLI command. `Cor`/`Cmt` let you
 *   hand-color specific tokens (identifiers, comments) within it.
 * - **When not**: this is not a real syntax highlighter — there's no
 *   language parser/tokenizer, only two manually-applied inline spans. For
 *   large multi-line source with automatic language-aware highlighting,
 *   this component is the wrong tool; it's built for short, curated
 *   snippets where you control every colored token by hand.
 * - **Do**: pass the exact copyable string via `copyText` — it's decoupled
 *   from `children`, so `children` can include markup (line breaks, `Cor`/
 *   `Cmt` spans) that would look wrong pasted verbatim, while `copyText`
 *   stays plain text.
 * - **Do**: customize `copyLabel`/`copiedLabel` if "Copiar"/"Copiado"
 *   don't fit your locale or context.
 * - **Don't**: rely on `Cor`/`Cmt` for anything beyond visual color — they
 *   carry no semantic meaning, just `.hds-code-cor`/`.hds-code-cmt`
 *   classes.
 * - **A11y**: the copy button is a real `<button type="button">` — focusable
 *   and operable via keyboard by default. Its accessible name comes from
 *   its own visible label text (`copyLabel`/`copiedLabel`), which already
 *   changes on success; there's no separate `aria-live` announcement, so a
 *   screen-reader user relies on refocusing/rereading the button to notice
 *   the "Copiado" state change.
 * - **Tokens**: `--surface`/`--surface-2` (block/button bg), `--border`
 *   (block border), `--ink`/`--muted` (default/comment text), `--accent`
 *   (highlighted `Cor` text), `--success` (copied state), `--focus`
 *   (button focus ring), `--ff-body`.
 */
const meta = {
  title: "Data Display/CodeBlock",
  component: CodeBlock,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  args: {
    copyText: "npm install @hive/design-system",
    copyLabel: "Copiar",
    copiedLabel: "Copiado",
  },
} satisfies Meta<typeof CodeBlock>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: (args) => (
    <CodeBlock {...args}>
      <Cmt># instala a dependência</Cmt>
      {"\n"}
      npm install <Cor>@hive/design-system</Cor>
    </CodeBlock>
  ),
}

export const WithoutCopyText: Story = {
  name: "Without copyText (no-op copy)",
  args: {
    copyText: undefined,
  },
  render: (args) => (
    <CodeBlock {...args}>
      <Cmt># exemplo somente leitura</Cmt>
      {"\n"}
      echo <Cor>"hello"</Cor>
    </CodeBlock>
  ),
}

export const CustomLabels: Story = {
  args: {
    copyText: "hive deploy --env production",
    copyLabel: "Copy",
    copiedLabel: "Copied!",
  },
  render: (args) => (
    <CodeBlock {...args}>
      <Cmt># deploy to production</Cmt>
      {"\n"}
      hive deploy --env <Cor>production</Cor>
    </CodeBlock>
  ),
}

export const MultiLine: Story = {
  name: "Multi-line snippet",
  args: {
    copyText: 'import { Button } from "@hive/design-system"\n\nexport function Example() {\n  return <Button>Ok</Button>\n}',
  },
  render: (args) => (
    <CodeBlock {...args}>
      <Cmt>// example.tsx</Cmt>
      {"\n"}
      import {"{"} <Cor>Button</Cor> {"}"} from <Cor>"@hive/design-system"</Cor>
      {"\n\n"}
      export function Example() {"{"}
      {"\n  "}return &lt;Button&gt;Ok&lt;/Button&gt;
      {"\n"}
      {"}"}
    </CodeBlock>
  ),
}
