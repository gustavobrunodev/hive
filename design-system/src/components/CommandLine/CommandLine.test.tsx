import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { CommandLine } from "./CommandLine"

const COMMAND = `bash.exe -c 'exec claude -p …'`

describe("CommandLine", () => {
  it("renders the command verbatim", () => {
    render(<CommandLine command={COMMAND} />)
    expect(screen.getByText(COMMAND, { exact: false })).toBeInTheDocument()
  })

  it("hides the prompt sigil from assistive tech", () => {
    const { container } = render(<CommandLine command={COMMAND} prompt="$" />)
    const sigil = container.querySelector(".hds-cmdline-prompt")

    expect(sigil).toHaveTextContent("$")
    expect(sigil).toHaveAttribute("aria-hidden", "true")
  })

  it("shows no copy control unless a handler is given", () => {
    render(<CommandLine command={COMMAND} />)
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })

  /**
   * The component never touches `navigator.clipboard`: an Electron renderer
   * can have the permission denied, and a control that silently no-ops is the
   * exact defect this repo already paid for once ("Copiar caminho").
   */
  it("hands the command to the host's clipboard on copy, then confirms", async () => {
    const user = userEvent.setup()
    const onCopy = vi.fn()
    render(<CommandLine command={COMMAND} onCopy={onCopy} copyLabel="Copiar" copiedLabel="Copiado" />)

    await user.click(screen.getByRole("button", { name: "Copiar" }))

    expect(onCopy).toHaveBeenCalledWith(COMMAND)
    expect(screen.getByRole("button", { name: "Copiado" })).toBeInTheDocument()
  })

  it("carries the overflow mode for its own scroller", () => {
    const { container } = render(<CommandLine command={COMMAND} overflow="scroll" />)
    expect(container.querySelector(".hds-cmdline")).toHaveAttribute("data-overflow", "scroll")
  })
})
