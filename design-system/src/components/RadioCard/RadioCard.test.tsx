import { useState } from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { RadioGroup } from "../RadioGroup/RadioGroup"
import { RadioCard } from "./RadioCard"

function Group({ initial = "a" }: { initial?: string }) {
  const [value, setValue] = useState(initial)
  return (
    <RadioGroup aria-label="Terminal" value={value} onValueChange={setValue}>
      <RadioCard value="a" title="Git Bash" meta="/bin/bash" selected={value === "a"}>
        <button type="button">detalhe de a</button>
      </RadioCard>
      <RadioCard value="b" title="Zsh" meta="/bin/zsh" selected={value === "b"}>
        <button type="button">detalhe de b</button>
      </RadioCard>
    </RadioGroup>
  )
}

describe("RadioCard", () => {
  it("renders one radio per card, named by its title", () => {
    render(<Group />)
    expect(screen.getByRole("radio", { name: "Git Bash" })).toBeInTheDocument()
    expect(screen.getByRole("radio", { name: "Zsh" })).toBeInTheDocument()
  })

  it("clicking anywhere on the header selects the card", async () => {
    const user = userEvent.setup()
    render(<Group />)

    await user.click(screen.getByText("/bin/zsh"))

    expect(screen.getByRole("radio", { name: "Zsh" })).toHaveAttribute("data-state", "checked")
  })

  it("shows the detail region only for the selected card", async () => {
    const user = userEvent.setup()
    render(<Group />)

    expect(screen.getByText("detalhe de a")).toBeInTheDocument()
    expect(screen.queryByText("detalhe de b")).not.toBeInTheDocument()

    await user.click(screen.getByRole("radio", { name: "Zsh" }))

    expect(screen.getByText("detalhe de b")).toBeInTheDocument()
    expect(screen.queryByText("detalhe de a")).not.toBeInTheDocument()
  })

  /**
   * The reason the detail region lives outside the `<label>`: inside one, a
   * click on any control in it would be forwarded to the radio and silently
   * re-select the card. This is the regression guard for that split.
   */
  it("a control inside the detail region does not re-trigger the radio", async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    render(
      <RadioGroup aria-label="Terminal" value="a" onValueChange={onValueChange}>
        <RadioCard value="a" title="Git Bash" selected>
          <button type="button">ver o comando</button>
        </RadioCard>
      </RadioGroup>
    )

    await user.click(screen.getByRole("button", { name: "ver o comando" }))

    expect(onValueChange).not.toHaveBeenCalled()
  })

  it("marks selected and disabled state on the card for styling", () => {
    const { container } = render(
      <RadioGroup aria-label="Terminal" value="a">
        <RadioCard value="a" title="Git Bash" selected />
        <RadioCard value="b" title="Zsh" disabled />
      </RadioGroup>
    )
    const cards = container.querySelectorAll(".hds-radio-card")

    expect(cards[0]).toHaveAttribute("data-selected")
    expect(cards[1]).not.toHaveAttribute("data-selected")
    expect(cards[1]).toHaveAttribute("data-disabled")
    expect(screen.getByRole("radio", { name: "Zsh" })).toBeDisabled()
  })

  it("renders the meta line as machine text when asked", () => {
    render(
      <RadioGroup aria-label="Terminal" value="a">
        <RadioCard value="a" title="Git Bash" meta={"C:\\Program Files\\Git\\bin\\bash.exe"} metaMono />
      </RadioGroup>
    )
    expect(screen.getByText("C:\\Program Files\\Git\\bin\\bash.exe")).toHaveAttribute("data-mono")
  })
})
