import { fireEvent, render, screen, within } from "@testing-library/react"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"
import { BarChart, barWidth, type BarChartDatum } from "./BarChart"

const LABELS = {
  showTable: "Ver tabela",
  showChart: "Ver gráfico",
  category: "Categoria",
  value: "Menções",
  share: "Participação",
}

const DATA: BarChartDatum[] = [
  { id: "cotacao", label: "Cotação e taxas", value: 680, valueLabel: "680", shareLabel: "50%" },
  { id: "status", label: "Status e avisos", value: 340, valueLabel: "340", shareLabel: "25%" },
  { id: "beneficiario", label: "Cadastro do beneficiário", value: 170, valueLabel: "170", shareLabel: "12,5%" },
  { id: "comprovante", label: "Comprovantes", value: 170, valueLabel: "170", shareLabel: "12,5%" },
]

/** A chart whose emphasis follows its own rows, as a host wires it. */
function Controlled({ data = DATA, initial = "cotacao" }: { data?: BarChartDatum[]; initial?: string }) {
  const [emphasis, setEmphasis] = useState<string | null>(initial)
  return <BarChart data={data} emphasis={emphasis} onEmphasisChange={setEmphasis} labels={LABELS} title="Dores por categoria" />
}

function bar(row: HTMLElement): HTMLElement {
  return row.querySelector(".hds-bars-bar") as HTMLElement
}

describe("BarChart", () => {
  it("C27c: shows, per category, its label, a bar, the value and the share", () => {
    render(<Controlled />)
    const rows = screen.getAllByRole("button", { pressed: undefined }).filter((b) => b.classList.contains("hds-bars-row"))
    expect(rows).toHaveLength(4)
    expect(rows[0]!).toHaveTextContent("Cotação e taxas")
    expect(rows[0]!).toHaveTextContent("680 · 50%")
    expect(bar(rows[0]!)).not.toBeNull()
    expect(rows[2]!).toHaveTextContent("170 · 12,5%")
  })

  it("C27c: the largest bar fills 74% of its track and the others are in proportion", () => {
    render(<Controlled />)
    const rows = screen.getAllByRole("button").filter((b) => b.classList.contains("hds-bars-row"))
    expect(bar(rows[0]!).style.width).toBe("74%")
    expect(bar(rows[1]!).style.width).toBe("37%")
    expect(bar(rows[2]!).style.width).toBe("18.5%")
    expect(barWidth(0, 0)).toBe(0)
  })

  it("C27c: one category is in emphasis and the rest in context; each row is a button with aria-pressed, and activating one moves the emphasis", () => {
    render(<Controlled />)
    const row = (name: RegExp): HTMLElement => screen.getByRole("button", { name })
    expect(row(/^Cotação e taxas/)).toHaveAttribute("aria-pressed", "true")
    expect(row(/^Cotação e taxas/)).toHaveAttribute("data-emphasis")
    for (const other of [/^Status e avisos/, /^Cadastro/, /^Comprovantes/]) {
      expect(row(other)).toHaveAttribute("aria-pressed", "false")
      expect(row(other)).not.toHaveAttribute("data-emphasis")
    }
    fireEvent.click(row(/^Status e avisos/))
    expect(row(/^Status e avisos/)).toHaveAttribute("aria-pressed", "true")
    expect(row(/^Cotação e taxas/)).toHaveAttribute("aria-pressed", "false")
  })

  it("names each row by its label, value and share, unless the host names it", () => {
    render(<BarChart data={[DATA[0]!, { ...DATA[1]!, ariaLabel: "Status: 340 menções" }, { id: "x", label: "Sem parte", value: 1 }]} emphasis={null} labels={LABELS} />)
    expect(screen.getByRole("button", { name: "Cotação e taxas: 680, 50%" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Status: 340 menções" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Sem parte: 1" })).toHaveTextContent("1")
  })

  it("C28: with a filtered item, the emphasised bar splits into the item, in emphasis, and the rest, washed", () => {
    const data = DATA.map((datum) => (datum.id === "status" ? { ...datum, part: 85 } : datum))
    render(<Controlled data={data} initial="status" />)
    const row = screen.getByRole("button", { name: /^Status e avisos/ })
    const part = row.querySelector(".hds-bars-part") as HTMLElement
    const rest = row.querySelector(".hds-bars-rest") as HTMLElement
    // The category is 37% of the track; the item is a quarter of the category.
    expect(part.style.width).toBe("9.25%")
    expect(rest.style.width).toBe("27.75%")
    // No other row splits.
    expect(screen.getByRole("button", { name: /^Cotação e taxas/ }).querySelector(".hds-bars-part")).toBeNull()
  })

  it("C28: a part is only drawn on the row in emphasis, and never wider than its bar", () => {
    const data = DATA.map((datum) => ({ ...datum, part: 10_000 }))
    render(<BarChart data={data} emphasis="cotacao" labels={LABELS} />)
    const rows = screen.getAllByRole("button").filter((b) => b.classList.contains("hds-bars-row"))
    expect((rows[0]!.querySelector(".hds-bars-part") as HTMLElement).style.width).toBe("74%")
    expect((rows[0]!.querySelector(".hds-bars-rest") as HTMLElement).style.width).toBe("0%")
    expect(rows[1]!.querySelector(".hds-bars-part")).toBeNull()
  })

  it("C30a: \"Ver tabela\" swaps the bars for a table with the same numbers; the same control, now \"Ver gráfico\" and pressed, swaps back", () => {
    render(<Controlled />)
    const toggle = screen.getByRole("button", { name: "Ver tabela" })
    expect(toggle).toHaveAttribute("aria-pressed", "false")
    fireEvent.click(toggle)

    const table = screen.getByRole("table")
    expect(within(table).getAllByRole("columnheader").map((th) => th.textContent)).toEqual(["Categoria", "Menções", "Participação"])
    const rows = within(table).getAllByRole("row").slice(1)
    expect(rows.map((row) => Array.from(row.children).map((cell) => cell.textContent))).toEqual([
      ["Cotação e taxas", "680", "50%"],
      ["Status e avisos", "340", "25%"],
      ["Cadastro do beneficiário", "170", "12,5%"],
      ["Comprovantes", "170", "12,5%"],
    ])
    expect(screen.queryByRole("button", { name: /^Cotação e taxas/ })).toBeNull()
    // Numeric cells are marked for right alignment and tabular figures.
    expect(rows[0]!.children[1]).toHaveClass("hds-chart-num")
    expect(rows[0]!.children[0]!.tagName).toBe("TH")

    const back = screen.getByRole("button", { name: "Ver gráfico" })
    expect(back).toBe(toggle)
    expect(back).toHaveAttribute("aria-pressed", "true")
    fireEvent.click(back)
    expect(screen.queryByRole("table")).toBeNull()
    expect(screen.getByRole("button", { name: /^Cotação e taxas/ })).toBeInTheDocument()
  })

  it("titles the figure, and can start on the table", () => {
    const onEmphasisChange = vi.fn()
    render(<BarChart data={DATA} emphasis={null} labels={LABELS} title="Dores por categoria" description="Menções no período." headingLevel={3} defaultTable onEmphasisChange={onEmphasisChange} />)
    expect(screen.getByRole("figure", { name: "Dores por categoria" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { level: 3, name: "Dores por categoria" })).toBeInTheDocument()
    expect(screen.getByText("Menções no período.")).toBeInTheDocument()
    expect(screen.getByRole("table")).toBeInTheDocument()
  })
})
