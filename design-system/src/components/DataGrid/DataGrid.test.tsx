import { useState } from "react"
import { fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { DataGrid } from "./DataGrid"
import type { DataGridColumn, DataGridCursor } from "./DataGrid"

const columns: DataGridColumn[] = [
  { id: "name", label: "nome" },
  { id: "role", label: "papel", hint: "texto" },
  { id: "score", label: "nota", numeric: true },
]

const rows = [
  ["Ada", "engenheira", "10"],
  ["Grace", "almirante", "9"],
  ["Katherine", "", "8"],
]

function cellAt(row: number, column: number): HTMLElement {
  const body = screen.getAllByRole("row").slice(1)
  return within(body[row] as HTMLElement).getAllByRole("gridcell")[column] as HTMLElement
}

/** A controlled host — the grid reports edits, the caller owns the data. */
function Harness({
  readOnly,
  onChange,
}: {
  readOnly?: boolean
  onChange?: (row: number, column: number, value: string) => void
}) {
  const [data, setData] = useState(rows.map((row) => [...row]))
  return (
    <DataGrid
      columns={columns}
      rows={data}
      ariaLabel="Planilha"
      readOnly={readOnly}
      onCellChange={(row, column, value) => {
        onChange?.(row, column, value)
        setData((current) =>
          current.map((existing, index) =>
            index === row ? existing.map((cell, at) => (at === column ? value : cell)) : existing
          )
        )
      }}
    />
  )
}

describe("DataGrid", () => {
  it("renders a grid with a header row, a row gutter and every value", () => {
    render(<DataGrid columns={columns} rows={rows} ariaLabel="Planilha" />)
    const grid = screen.getByRole("grid", { name: "Planilha" })
    expect(grid).toHaveAttribute("aria-rowcount", "4")
    expect(grid).toHaveAttribute("aria-colcount", "4")
    expect(screen.getByRole("columnheader", { name: /nome/ })).toBeInTheDocument()
    expect(screen.getByRole("rowheader", { name: "1" })).toBeInTheDocument()
    expect(screen.getByText("Katherine")).toBeInTheDocument()
    expect(screen.getByText("engenheira")).toBeInTheDocument()
  })

  it("puts the single tab stop on the cursor cell and moves it with the arrow keys", async () => {
    const user = userEvent.setup()
    render(<DataGrid columns={columns} rows={rows} ariaLabel="Planilha" />)
    expect(cellAt(0, 0)).toHaveAttribute("tabindex", "0")
    expect(cellAt(1, 1)).toHaveAttribute("tabindex", "-1")

    cellAt(0, 0).focus()
    await user.keyboard("{ArrowRight}{ArrowDown}")
    expect(cellAt(1, 1)).toHaveFocus()
    expect(cellAt(1, 1)).toHaveAttribute("data-active", "true")

    await user.keyboard("{ArrowLeft}{ArrowUp}")
    expect(cellAt(0, 0)).toHaveFocus()
  })

  it("clamps navigation at the edges instead of wrapping", async () => {
    const user = userEvent.setup()
    render(<DataGrid columns={columns} rows={rows} ariaLabel="Planilha" />)
    cellAt(0, 0).focus()
    await user.keyboard("{ArrowUp}{ArrowLeft}")
    expect(cellAt(0, 0)).toHaveFocus()

    await user.keyboard("{End}")
    expect(cellAt(0, 2)).toHaveFocus()
    await user.keyboard("{Control>}{End}{/Control}")
    expect(cellAt(2, 2)).toHaveFocus()
    await user.keyboard("{Control>}{Home}{/Control}")
    expect(cellAt(0, 0)).toHaveFocus()
  })

  it("PageDown/PageUp run past the ends and stop there", async () => {
    const user = userEvent.setup()
    render(<DataGrid columns={columns} rows={rows} ariaLabel="Planilha" />)
    cellAt(0, 0).focus()
    await user.keyboard("{PageDown}")
    expect(cellAt(2, 0)).toHaveFocus()
    await user.keyboard("{PageUp}")
    expect(cellAt(0, 0)).toHaveFocus()
  })

  it("marks the cursor's column header and row number, not just the cell", async () => {
    const user = userEvent.setup()
    render(<DataGrid columns={columns} rows={rows} ariaLabel="Planilha" />)
    cellAt(0, 0).focus()
    await user.keyboard("{ArrowRight}{ArrowDown}")
    expect(screen.getByRole("columnheader", { name: /papel/ })).toHaveAttribute("data-current", "true")
    expect(screen.getByRole("rowheader", { name: "2" })).toHaveAttribute("data-current", "true")
    expect(screen.getByRole("rowheader", { name: "1" })).not.toHaveAttribute("data-current")
  })

  it("Enter opens the editor and commits into the next row down", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    cellAt(0, 0).focus()

    await user.keyboard("{Enter}")
    const input = screen.getByRole("textbox")
    expect(input).toHaveValue("Ada")

    await user.clear(input)
    await user.type(input, "Lovelace{Enter}")
    expect(onChange).toHaveBeenCalledWith(0, 0, "Lovelace")
    expect(screen.getByText("Lovelace")).toBeInTheDocument()
    expect(cellAt(1, 0)).toHaveFocus()
  })

  it("typing a character opens the editor with that character, replacing the value", async () => {
    const user = userEvent.setup()
    render(<Harness />)
    cellAt(1, 1).focus()
    await user.keyboard("x")
    expect(screen.getByRole("textbox")).toHaveValue("x")
  })

  it("Escape restores the value and hands focus back to the cell", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    cellAt(0, 0).focus()
    await user.keyboard("{F2}")
    await user.type(screen.getByRole("textbox"), "zzz")
    await user.keyboard("{Escape}")

    expect(screen.queryByRole("textbox")).not.toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByText("Ada")).toBeInTheDocument()
    expect(cellAt(0, 0)).toHaveFocus()
  })

  it("a double-click opens the editor and a blur commits it", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    await user.dblClick(cellAt(2, 1))
    await user.type(screen.getByRole("textbox"), "matemática")
    fireEvent.blur(screen.getByRole("textbox"))
    expect(onChange).toHaveBeenCalledWith(2, 1, "matemática")
  })

  it("commits nothing when the value came back unchanged", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    cellAt(0, 0).focus()
    await user.keyboard("{Enter}")
    fireEvent.blur(screen.getByRole("textbox"))
    expect(onChange).not.toHaveBeenCalled()
  })

  it("Tab inside the editor commits and steps sideways; Shift+Tab steps back", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    cellAt(0, 0).focus()
    await user.keyboard("{Enter}")
    await user.clear(screen.getByRole("textbox"))
    await user.type(screen.getByRole("textbox"), "Ada L.")
    await user.tab()
    expect(onChange).toHaveBeenCalledWith(0, 0, "Ada L.")
    expect(cellAt(0, 1)).toHaveFocus()

    await user.keyboard("{Enter}")
    await user.tab({ shift: true })
    expect(cellAt(0, 0)).toHaveFocus()
  })

  it("Shift+Enter in the editor commits upward", async () => {
    const user = userEvent.setup()
    render(<Harness />)
    cellAt(2, 0).focus()
    await user.keyboard("{Enter}")
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter", shiftKey: true })
    expect(cellAt(1, 0)).toHaveFocus()
  })

  it("Tab walks cell to cell, wrapping rows, and lets the two ends fall out of the grid", async () => {
    const user = userEvent.setup()
    render(<DataGrid columns={columns} rows={rows} ariaLabel="Planilha" />)
    cellAt(0, 2).focus()
    await user.tab()
    expect(cellAt(1, 0)).toHaveFocus()
    await user.tab({ shift: true })
    expect(cellAt(0, 2)).toHaveFocus()

    cellAt(2, 2).focus()
    await user.tab()
    expect(cellAt(2, 2)).not.toHaveFocus()
  })

  it("Delete clears a cell, and does nothing on one that is already empty", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    cellAt(0, 1).focus()
    await user.keyboard("{Delete}")
    expect(onChange).toHaveBeenCalledWith(0, 1, "")

    onChange.mockClear()
    cellAt(2, 1).focus()
    await user.keyboard("{Backspace}")
    expect(onChange).not.toHaveBeenCalled()
  })

  it("read-only keeps navigation but refuses every edit gesture", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness readOnly onChange={onChange} />)
    cellAt(0, 0).focus()
    await user.keyboard("{Enter}")
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument()

    await user.keyboard("q{Delete}")
    expect(onChange).not.toHaveBeenCalled()
    await user.keyboard("{ArrowDown}")
    expect(cellAt(1, 0)).toHaveFocus()
  })

  it("honours a controlled cursor and reports every move", async () => {
    const user = userEvent.setup()
    const onCursorChange = vi.fn()
    const cursor: DataGridCursor = { row: 1, column: 2 }
    render(
      <DataGrid
        columns={columns}
        rows={rows}
        ariaLabel="Planilha"
        cursor={cursor}
        onCursorChange={onCursorChange}
      />
    )
    expect(cellAt(1, 2)).toHaveAttribute("data-active", "true")
    cellAt(1, 2).focus()
    await user.keyboard("{ArrowUp}")
    expect(onCursorChange).toHaveBeenCalledWith({ row: 0, column: 2 })
  })

  it("clicking a cell moves the cursor to it", async () => {
    const user = userEvent.setup()
    const onCursorChange = vi.fn()
    render(<DataGrid columns={columns} rows={rows} ariaLabel="Planilha" onCursorChange={onCursorChange} />)
    await user.click(cellAt(2, 1))
    expect(onCursorChange).toHaveBeenCalledWith({ row: 2, column: 1 })
    expect(cellAt(2, 1)).toHaveAttribute("data-active", "true")
  })

  it("pads short rows out to the column count", () => {
    render(<DataGrid columns={columns} rows={[["só uma"]]} ariaLabel="Planilha" />)
    expect(screen.getAllByRole("gridcell")).toHaveLength(3)
    expect(cellAt(0, 2)).toHaveAttribute("data-empty", "true")
  })

  it("shows the empty slot instead of a body when there are no rows", () => {
    render(<DataGrid columns={columns} rows={[]} ariaLabel="Planilha" empty={<p>Sem linhas</p>} />)
    expect(screen.getByText("Sem linhas")).toBeInTheDocument()
    expect(screen.queryAllByRole("gridcell")).toHaveLength(0)
  })

  it("right-aligns a numeric column's header over its own digits", () => {
    render(<DataGrid columns={columns} rows={rows} ariaLabel="Planilha" />)
    expect(screen.getByRole("columnheader", { name: /nota/ })).toHaveAttribute("data-numeric", "true")
    expect(screen.getByRole("columnheader", { name: /nome/ })).not.toHaveAttribute("data-numeric")
  })

  it("renders the optional gutter override, column actions and footer", () => {
    render(
      <DataGrid
        columns={columns}
        rows={rows}
        ariaLabel="Planilha"
        rowHeader={(index) => `L${index}`}
        columnActions={(index) => <button type="button">menu {index}</button>}
        footer={<div>rodapé</div>}
        colorColumns
      />
    )
    expect(screen.getByRole("rowheader", { name: "L0" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "menu 2" })).toBeInTheDocument()
    expect(screen.getByText("rodapé")).toBeInTheDocument()
    expect(screen.getByRole("columnheader", { name: /nome/ })).toHaveAttribute("data-hue", "0")
  })

  it("drops the gutter (and its column) when rowHeader is false", () => {
    render(<DataGrid columns={columns} rows={rows} ariaLabel="Planilha" rowHeader={false} />)
    expect(screen.queryAllByRole("rowheader")).toHaveLength(0)
    expect(screen.getByRole("grid")).toHaveAttribute("aria-colcount", "3")
    expect(cellAt(0, 0)).toHaveAttribute("aria-colindex", "1")
  })
})
