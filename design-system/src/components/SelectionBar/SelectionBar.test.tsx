import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { SelectionBar } from "./SelectionBar"

/** Renders the bar with spies and returns them. */
function setup(props: Partial<React.ComponentProps<typeof SelectionBar>> = {}) {
  const onSelectAllChange = vi.fn()
  const onDismiss = vi.fn()
  render(
    <SelectionBar
      count={2}
      total={5}
      label="2 selecionadas"
      selectAllLabel="Selecionar todas as conversas"
      dismissLabel="Sair da seleção"
      onSelectAllChange={onSelectAllChange}
      onDismiss={onDismiss}
      actions={<button type="button">Excluir</button>}
      {...props}
    />
  )
  return { onSelectAllChange, onDismiss }
}

describe("SelectionBar", () => {
  it("states the count and groups the whole bar under it", () => {
    setup()
    expect(screen.getByRole("group", { name: "2 selecionadas" })).toBeInTheDocument()
    expect(screen.getByText("2 selecionadas")).toBeInTheDocument()
  })

  /**
   * A bar in a narrow column has room for "3 selecionadas" and not for "3
   * conversas selecionadas" — but a screen reader has no width, and the noun is
   * exactly what says *what* was selected.
   */
  it("lets the accessible name carry the full sentence when the visible one is short", () => {
    setup({ label: "2 selecionadas", ariaLabel: "2 conversas selecionadas" })
    expect(screen.getByRole("group", { name: "2 conversas selecionadas" })).toBeInTheDocument()
    expect(screen.getByText("2 selecionadas")).toBeInTheDocument()
  })

  /**
   * Tri-state is the whole reason this is a component: "some" rendered as
   * unchecked is a bar claiming nothing is selected while rows sit highlighted
   * underneath it.
   */
  it("reports the select-all control as mixed while only some rows are selected", () => {
    setup({ count: 2, total: 5 })
    expect(
      screen.getByRole("checkbox", { name: "Selecionar todas as conversas" })
    ).toHaveAttribute("aria-checked", "mixed")
  })

  it("reports it checked once every row is selected", () => {
    setup({ count: 5, total: 5 })
    expect(screen.getByRole("checkbox", { name: "Selecionar todas as conversas" })).toBeChecked()
  })

  it("selects everything from a partial selection", async () => {
    const user = userEvent.setup()
    const { onSelectAllChange } = setup({ count: 2, total: 5 })
    await user.click(screen.getByRole("checkbox", { name: "Selecionar todas as conversas" }))
    expect(onSelectAllChange).toHaveBeenCalledWith(true)
  })

  it("clears everything from a full one", async () => {
    const user = userEvent.setup()
    const { onSelectAllChange } = setup({ count: 5, total: 5 })
    await user.click(screen.getByRole("checkbox", { name: "Selecionar todas as conversas" }))
    expect(onSelectAllChange).toHaveBeenCalledWith(false)
  })

  it("always offers a way out of selection mode", async () => {
    const user = userEvent.setup()
    const { onDismiss } = setup()
    await user.click(screen.getByRole("button", { name: "Sair da seleção" }))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it("renders the bulk actions it was given", () => {
    setup()
    expect(screen.getByRole("button", { name: "Excluir" })).toBeInTheDocument()
  })

  /**
   * While the bar is asking about the selection, "select all" would change the
   * subject of the question and the ✕ would be a second cancel beside the real
   * one. Both give way to the question.
   */
  it("swaps the count, the select-all and the ✕ for a question", () => {
    setup({
      prompt: "Excluir 2 conversas?",
      actions: (
        <>
          <button type="button">Excluir</button>
          <button type="button">Cancelar</button>
        </>
      ),
    })
    expect(screen.getByText("Excluir 2 conversas?")).toBeInTheDocument()
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Sair da seleção" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeInTheDocument()
  })

  it("announces the count politely as it changes", () => {
    setup()
    expect(screen.getByText("2 selecionadas")).toHaveAttribute("aria-live", "polite")
  })
})
