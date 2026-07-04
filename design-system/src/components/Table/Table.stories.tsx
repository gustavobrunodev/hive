import type { Meta, StoryObj } from "@storybook/react"

import { Table, Pkg, Stack, Cond } from "./Table"

/**
 * `Table` is a thin bordered/scrollable wrapper around a plain `<table>` —
 * it renders only the `.hds-table-wrap` div and the `<table>` shell.
 * `Pkg`, `Stack`, and `Cond` are cell-content typography primitives meant to
 * be dropped inside your own `<td>`s (bold identifier, semi-bold name, muted
 * detail, respectively); none of them render table structure.
 *
 * **Usage**
 *
 * - **When to use**: tabular data with real rows/columns a reader compares
 *   across (a stack/skill/pricing matrix). Not for a simple label/value
 *   list — use `Field`/definition markup or a card grid instead.
 * - **When not**: don't reach for `Table` to lay out unrelated content in a
 *   grid just for the border — that's what `Panel`/CSS grid are for.
 * - **Do**: always author real `<thead>`/`<tbody>`/`<tr>`/`<th scope="col">`
 *   markup as `children` — `Table` does not generate or infer headers.
 * - **Do**: use `Pkg`/`Stack`/`Cond` for the three recurring cell voices
 *   (identifier, name, secondary detail) instead of ad-hoc inline styles.
 * - **Don't**: nest interactive controls inside cells without also handling
 *   focus order — `Table` doesn't manage focus/keyboard nav itself.
 * - **A11y**: because markup is fully caller-owned, screen-reader table
 *   semantics are only as good as the `<th scope="col">`/`<td>` structure
 *   you author — the DS wrapper does not enforce it. Row hover (`:hover`)
 *   is decorative only; it's not a substitute for focus styles on any
 *   interactive cell content.
 * - **Tokens**: `--border`/`--surface` (wrapper), `--bordo-sensatez`/
 *   `--cinza-impacto` (header row — a fixed brand-tile combo, intentionally
 *   raw rather than semantic, matching the header's dark-on-dark contrast
 *   need in both themes), `--surface-2` (row hover), `--ink`/`--muted`
 *   (`Pkg`/`Stack` vs `Cond`), `--ff-body`/`--ff-num`.
 */
const meta = {
  title: "Data Display/Table",
  component: Table,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  argTypes: {
    cut: { control: "boolean" },
  },
} satisfies Meta<typeof Table>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: (args) => (
    <Table {...args}>
      <thead>
        <tr>
          <th scope="col">Pacote</th>
          <th scope="col">Stack</th>
          <th scope="col">Condição</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            <Pkg>hive-cli</Pkg>
          </td>
          <td>
            <Stack>Node 20 / TypeScript</Stack>
          </td>
          <td>
            <Cond>Requer acesso ao registry interno</Cond>
          </td>
        </tr>
        <tr>
          <td>
            <Pkg>hive-design-system</Pkg>
          </td>
          <td>
            <Stack>React 18 / Vite</Stack>
          </td>
          <td>
            <Cond>Peer deps: react, react-dom</Cond>
          </td>
        </tr>
        <tr>
          <td>
            <Pkg>hive-agents</Pkg>
          </td>
          <td>
            <Stack>Python 3.12</Stack>
          </td>
          <td>
            <Cond>Opcional — apenas orquestração</Cond>
          </td>
        </tr>
      </tbody>
    </Table>
  ),
}

export const NoCut: Story = {
  args: {
    cut: false,
  },
  render: (args) => (
    <Table {...args}>
      <thead>
        <tr>
          <th scope="col">Pacote</th>
          <th scope="col">Stack</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            <Pkg>hive-cli</Pkg>
          </td>
          <td>
            <Stack>Node 20</Stack>
          </td>
        </tr>
      </tbody>
    </Table>
  ),
}

export const CellPrimitives: Story = {
  name: "Pkg / Stack / Cond",
  render: () => (
    <Table cut={false}>
      <thead>
        <tr>
          <th scope="col">Voz</th>
          <th scope="col">Exemplo</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Pkg</td>
          <td>
            <Pkg>v2.4.1</Pkg>
          </td>
        </tr>
        <tr>
          <td>Stack</td>
          <td>
            <Stack>TypeScript</Stack>
          </td>
        </tr>
        <tr>
          <td>Cond</td>
          <td>
            <Cond>Somente em produção</Cond>
          </td>
        </tr>
      </tbody>
    </Table>
  ),
}
