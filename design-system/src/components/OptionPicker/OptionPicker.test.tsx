import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { OptionPicker, type PickerGroup, type PickerOption } from "./OptionPicker"

const OPTIONS: PickerOption[] = [
  {
    id: "",
    label: "Automático",
    description: "Deixa a CLI escolher",
    group: "default",
  },
  {
    id: "opus",
    label: "Opus",
    description: "Melhor para tarefas complexas",
    meta: "200k",
    tags: [{ label: "raciocínio", tone: "accent" }],
    group: "recommended",
    keywords: "anthropic",
  },
  {
    id: "sonnet",
    label: "Sonnet",
    description: "Equilíbrio para o dia a dia",
    meta: "200k",
    hint: "claude-sonnet-5",
    group: "recommended",
  },
  { id: "haiku45", label: "Haiku 4.5", group: "legacy", disabled: true },
]

const GROUPS: PickerGroup[] = [
  { id: "default" },
  { id: "recommended", label: "Recomendados" },
  { id: "legacy", label: "Versões anteriores" },
]

function setup(props: Partial<React.ComponentProps<typeof OptionPicker>> = {}) {
  const onChange = vi.fn()
  render(
    <OptionPicker
      options={OPTIONS}
      groups={GROUPS}
      value="sonnet"
      onChange={onChange}
      ariaLabel="Escolher modelo"
      footer={<span>rodapé</span>}
      {...props}
    >
      <button type="button">Sonnet</button>
    </OptionPicker>
  )
  return onChange
}

/** Opens the panel through the trigger, as a user would. */
async function open(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Sonnet" }))
  return screen.findByRole("listbox", { name: "Escolher modelo" })
}

describe("OptionPicker", () => {
  it("stays closed until the trigger is used", () => {
    setup()
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument()
  })

  it("shows every option with its description, meta and tags", async () => {
    const user = userEvent.setup()
    setup()
    await open(user)
    expect(screen.getByText("Opus")).toBeInTheDocument()
    expect(screen.getByText("Melhor para tarefas complexas")).toBeInTheDocument()
    expect(screen.getByText("raciocínio")).toBeInTheDocument()
    expect(screen.getAllByText("200k")).toHaveLength(2)
    expect(screen.getByText("claude-sonnet-5")).toBeInTheDocument()
  })

  it("groups options under their declared headings, skipping empty groups", async () => {
    const user = userEvent.setup()
    setup({ options: OPTIONS.filter((option) => option.group !== "legacy") })
    await open(user)
    expect(screen.getByText("Recomendados")).toBeInTheDocument()
    expect(screen.queryByText("Versões anteriores")).not.toBeInTheDocument()
  })

  it("keeps an option whose group was never declared instead of dropping it", async () => {
    const user = userEvent.setup()
    setup({ options: [...OPTIONS, { id: "ghost", label: "Modelo novo", group: "unknown" }] })
    await open(user)
    expect(screen.getByText("Modelo novo")).toBeInTheDocument()
  })

  it("reports the chosen option and closes", async () => {
    const user = userEvent.setup()
    const onChange = setup()
    await open(user)
    await user.click(screen.getByText("Opus"))
    expect(onChange).toHaveBeenCalledWith("opus")
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument()
  })

  it("marks only the current value as the selected option", async () => {
    const user = userEvent.setup()
    setup()
    const list = await open(user)
    const chosen = list.querySelectorAll("[data-selected-option]")
    expect(chosen).toHaveLength(1)
    expect(chosen[0]).toHaveTextContent("Sonnet")
  })

  it("filters on keywords the label does not show", async () => {
    const user = userEvent.setup()
    setup({ searchable: true })
    await open(user)
    await user.keyboard("anthropic")
    expect(screen.getByText("Opus")).toBeInTheDocument()
    expect(screen.queryByText("Automático")).not.toBeInTheDocument()
  })

  it("hides the search field for a short list but still answers type-ahead", async () => {
    const user = userEvent.setup()
    setup()
    const list = await open(user)
    // Collapsed, not absent: cmdk binds its keyboard contract to the input, so
    // removing it would take the arrow keys with it.
    const search = document.querySelector(".hds-picker-search")
    expect(search).toHaveAttribute("data-collapsed")
    await user.keyboard("opus")
    expect(search).not.toHaveAttribute("data-collapsed")
    // Scoped to the list: "Sonnet" is also the trigger's own label.
    expect(within(list).queryByText("Sonnet")).not.toBeInTheDocument()
    expect(within(list).getByText("Opus")).toBeInTheDocument()
  })

  it("renders the footer slot alongside the list", async () => {
    const user = userEvent.setup()
    setup()
    await open(user)
    expect(screen.getByText("rodapé")).toBeInTheDocument()
  })

  it("shows the empty label when nothing matches", async () => {
    const user = userEvent.setup()
    setup({ searchable: true, emptyLabel: "Nenhum modelo" })
    await open(user)
    await user.keyboard("zzzz")
    expect(screen.getByText("Nenhum modelo")).toBeInTheDocument()
  })

  it("does not report a disabled option", async () => {
    const user = userEvent.setup()
    const onChange = setup()
    await open(user)
    await user.click(screen.getByText("Haiku 4.5"))
    expect(onChange).not.toHaveBeenCalled()
  })

  it("forgets the previous query when reopened", async () => {
    const user = userEvent.setup()
    setup({ searchable: true })
    await open(user)
    await user.keyboard("opus")
    await user.keyboard("{Escape}")
    await open(user)
    expect(screen.getByText("Automático")).toBeInTheDocument()
  })
})
