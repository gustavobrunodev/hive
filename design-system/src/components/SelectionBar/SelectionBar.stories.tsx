import type { Meta, StoryObj } from "@storybook/react"
import { useState } from "react"

import { SelectionBar } from "./SelectionBar"

/**
 * **Usage**
 *
 * - **When to use**: a list whose rows can be acted on in bulk — delete many,
 *   move many, archive many. The bar appears when the first row is ticked and
 *   goes when the last one is unticked; it is the *state the list is in*, not a
 *   toolbar the list always has.
 * - **When not**: for a list with exactly one bulk action and no count worth
 *   stating — a single button above the list is less machinery. And never as a
 *   permanent header: a bar that is always there stops meaning "something is
 *   selected".
 * - **Do**: keep `label` short enough for the narrowest column the list lives
 *   in, and pass the full sentence as `ariaLabel` — a screen reader has no
 *   width. Put the destructive action last in `actions`.
 * - **Don't**: ask a destructive question in a modal over this bar. Use
 *   `prompt`, which asks in the bar and leaves the ticked rows visible behind
 *   it — the thing a scrim would dim is exactly what the user is deciding
 *   about.
 * - **A11y**: a `group` named by the count, a tri-state `checkbox` for
 *   select-all (`mixed` while only some rows are ticked — an unchecked box over
 *   three highlighted rows is a lie), and a dismiss that always exists, because
 *   "untick them one by one" is not a way out.
 */
const meta = {
  title: "Data/SelectionBar",
  component: SelectionBar,
  parameters: { layout: "padded" },
} satisfies Meta<typeof SelectionBar>

export default meta
type Story = StoryObj<typeof meta>

const BASE = {
  selectAllLabel: "Selecionar todas as conversas",
  dismissLabel: "Sair da seleção",
  onSelectAllChange: () => {},
  onDismiss: () => {},
}

export const Some: Story = {
  args: {
    ...BASE,
    count: 3,
    total: 12,
    label: "3 selecionadas",
    ariaLabel: "3 conversas selecionadas",
    actions: (
      <button type="button" className="hds-btn hds-btn-ghost">
        Excluir
      </button>
    ),
  },
}

export const All: Story = {
  args: { ...Some.args, count: 12, label: "12 selecionadas" },
}

/** The destructive question, asked in the bar so the rows stay visible. */
export const Asking: Story = {
  args: {
    ...Some.args,
    prompt: "Excluir 3 conversas?",
    actions: (
      <>
        <button type="button" className="hds-btn hds-btn-ghost">
          Excluir
        </button>
        <button type="button" className="hds-btn hds-btn-ghost">
          Cancelar
        </button>
      </>
    ),
  },
}

/** Live: ticking rows drives the bar, and the bar drives the rows. */
export const OverAList: Story = {
  args: { ...BASE, count: 0, total: 4, label: "" },
  render: () => {
    const rows = ["Revisar o PRD", "Plano de testes", "Refatorar o explorer", "Notas da sprint"]
    const [picked, setPicked] = useState<string[]>(["Plano de testes"])
    return (
      <div style={{ display: "grid", gap: 8, maxWidth: 420 }}>
        {picked.length > 0 && (
          <SelectionBar
            {...BASE}
            count={picked.length}
            total={rows.length}
            label={`${picked.length} selecionadas`}
            ariaLabel={`${picked.length} conversas selecionadas`}
            onSelectAllChange={(checked) => setPicked(checked ? [...rows] : [])}
            onDismiss={() => setPicked([])}
            actions={
              <button type="button" className="hds-btn hds-btn-ghost">
                Excluir
              </button>
            }
          />
        )}
        {rows.map((row) => (
          <label key={row} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input
              type="checkbox"
              checked={picked.includes(row)}
              onChange={() =>
                setPicked((current) =>
                  current.includes(row) ? current.filter((id) => id !== row) : [...current, row]
                )
              }
            />
            {row}
          </label>
        ))}
      </div>
    )
  },
}
