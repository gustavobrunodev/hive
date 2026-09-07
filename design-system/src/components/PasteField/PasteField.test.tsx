import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { useState } from "react"
import { PasteField } from "./PasteField"

/** A controlled host, since the field holds no value of its own. */
function Harness(props: {
  onSubmit?: (value: string) => void
  onPaste?: () => Promise<string | null> | string | null
  submitOnPaste?: boolean
  error?: string
  busy?: boolean
  initial?: string
}) {
  const [value, setValue] = useState(props.initial ?? "")
  return (
    <PasteField
      label="Código do navegador"
      description="Cole o código que a página mostrou."
      value={value}
      onValueChange={setValue}
      submitLabel="Conectar"
      pasteLabel="Colar"
      placeholder="cole aqui"
      {...props}
    />
  )
}

describe("PasteField", () => {
  it("labels the control and its description, so the box never asks anonymously", () => {
    render(<Harness />)
    const input = screen.getByLabelText("Código do navegador")
    expect(input).toHaveAccessibleDescription("Cole o código que a página mostrou.")
  })

  it("commits on Enter and on the submit control alike", async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    render(<Harness onSubmit={onSubmit} />)

    await user.type(screen.getByLabelText("Código do navegador"), "abc-123{Enter}")
    expect(onSubmit).toHaveBeenCalledWith("abc-123")

    await user.click(screen.getByRole("button", { name: "Conectar" }))
    expect(onSubmit).toHaveBeenCalledTimes(2)
  })

  it("trims what it commits — a copied code arrives with whitespace attached", async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    render(<Harness onSubmit={onSubmit} initial="  abc-123  " />)
    await user.click(screen.getByRole("button", { name: "Conectar" }))
    expect(onSubmit).toHaveBeenCalledWith("abc-123")
  })

  it("never commits an empty value", async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    render(<Harness onSubmit={onSubmit} />)
    const input = screen.getByLabelText("Código do navegador")
    await user.type(input, "   {Enter}")
    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByRole("button", { name: "Conectar" })).toBeDisabled()
  })

  it("fills itself from the paste source, and can commit in the same click", async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    render(<Harness onSubmit={onSubmit} onPaste={() => "pasted-code"} submitOnPaste />)

    await user.click(screen.getByRole("button", { name: "Colar" }))
    expect(screen.getByLabelText("Código do navegador")).toHaveValue("pasted-code")
    expect(onSubmit).toHaveBeenCalledWith("pasted-code")
  })

  it("leaves the field alone when the paste source has nothing (or refuses)", async () => {
    const user = userEvent.setup()
    render(<Harness onPaste={() => null} />)
    await user.click(screen.getByRole("button", { name: "Colar" }))
    expect(screen.getByLabelText("Código do navegador")).toHaveValue("")

    // A clipboard the platform refuses must not break the field: typing still
    // works, and no error is invented over a control that is fine.
    render(
      <PasteField
        label="Outro"
        value=""
        onValueChange={vi.fn()}
        onPaste={() => Promise.reject(new Error("denied"))}
        pasteLabel="Colar"
      />
    )
    const buttons = screen.getAllByRole("button", { name: "Colar" })
    await user.click(buttons[buttons.length - 1] as HTMLElement)
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  it("renders no paste control when there is no source to paste from", () => {
    render(<PasteField label="Código" value="" onValueChange={vi.fn()} />)
    expect(screen.queryByRole("button", { name: "Colar" })).not.toBeInTheDocument()
  })

  it("announces a rejected value and keeps it, because a wrong paste is a retry", () => {
    render(<Harness initial="wrong" error="Código não aceito." />)
    expect(screen.getByRole("alert")).toHaveTextContent("Código não aceito.")
    const input = screen.getByLabelText("Código do navegador")
    expect(input).toHaveValue("wrong")
    expect(input).toHaveAttribute("aria-invalid", "true")
  })

  it("locks while a value is being checked", () => {
    render(<Harness busy initial="abc" onPaste={() => "x"} onSubmit={vi.fn()} />)
    expect(screen.getByLabelText("Código do navegador")).toBeDisabled()
    expect(screen.getByRole("button", { name: "Colar" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Conectar" })).toBeDisabled()
  })

  it("focuses itself when the flow says it is the user's turn", () => {
    render(
      <PasteField label="Código" value="" onValueChange={vi.fn()} autoFocus submitLabel="Ir" />
    )
    expect(screen.getByLabelText("Código")).toHaveFocus()
  })
})
