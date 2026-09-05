import type { Meta, StoryObj } from "@storybook/react"

import { DataGrid } from "./DataGrid"

const USAGE = `
**When to use / when not** — DataGrid is for tabular data the user *works in*:
walks with the arrow keys, edits cell by cell, scans against a header that
stays put. Use \`Table\` instead when the rows are read-only content in a
document — a pricing table, a summary — where a grid's cursor and roving
tabindex are overhead the reader never asked for.

**Do's & Don'ts**
- Do own the data. The grid never mutates: \`onCellChange(row, column, value)\`
  reports a committed edit and the caller decides what the next \`rows\` are.
- Do give every column a stable \`id\` — it is the React key for the cell
  column, and reusing one across two columns swaps their contents on reorder.
- Do reach for \`colorColumns\` when the columns are told apart by *position*
  rather than by content (a raw CSV, a fixed-width export). Don't switch it on
  for a table whose columns already read as different things — six hues on
  data that doesn't need them is decoration.
- Don't nest an interactive control inside a cell's value. The cell IS the
  control; a button inside it competes with the cursor for the same click.
  \`columnActions\` exists for the one case that needs it — a per-column menu
  in the header, outside the cell grid.

**A11y** — WAI-ARIA grid pattern over a real \`<table role="grid">\`: one
roving tabindex (only the cursor cell is in the Tab order), Arrow keys to
move, Home/End for the row's ends and Ctrl+Home/End for the grid's,
PageUp/PageDown by a screenful, Enter/F2 to edit, Escape to cancel, and
Enter/Tab to commit and move on. Typing a printable character opens the
editor seeded with it. Tab walks cell to cell, but at the first and last cell
it is left to the browser — that is how focus gets out of the grid.

**Relevant tokens** — \`--surface\` (header), \`--bg\` (gutter, editing cell),
\`--surface-2\` (row hover), \`--selected-bg\`/\`--selected\` (crosshair),
\`--focus\` (cursor ring), \`--border\`/\`--border-strong\` (rules),
\`--muted\` (row numbers, header hint), \`--code-*\` (the \`colorColumns\` ramp),
\`--ff-mono\`.
`

const columns = [
  { id: "name", label: "produto" },
  { id: "owner", label: "responsável", hint: "squad" },
  { id: "stage", label: "estágio" },
  { id: "score", label: "impacto", numeric: true },
]

const rows = [
  ["Onboarding guiado", "Sally", "Descoberta", "8"],
  ["Console de MCP", "Winston", "Em construção", "13"],
  ["Editor de planilhas", "Amelia", "Em revisão", "21"],
  ["Busca no workspace", "John", "Entregue", "5"],
  ["Segundo cérebro", "Murat", "Descoberta", "3"],
]

const meta = {
  title: "Data/DataGrid",
  component: DataGrid,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: { description: { component: USAGE } },
  },
} satisfies Meta<typeof DataGrid>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    ariaLabel: "Iniciativas",
    columns,
    rows,
  },
}

export const ColouredColumns: Story = {
  name: "Coloured columns (positional data)",
  args: {
    ariaLabel: "Iniciativas",
    columns: columns.map((column) => ({ ...column, hint: undefined })),
    rows,
    colorColumns: true,
  },
}

export const ReadOnly: Story = {
  args: {
    ariaLabel: "Iniciativas",
    columns,
    rows,
    readOnly: true,
  },
}

export const NoGutter: Story = {
  name: "No row numbers",
  args: {
    ariaLabel: "Iniciativas",
    columns,
    rows,
    rowHeader: false,
  },
}

export const Empty: Story = {
  args: {
    ariaLabel: "Iniciativas",
    columns,
    rows: [],
    empty: "Nenhuma linha ainda.",
  },
}
