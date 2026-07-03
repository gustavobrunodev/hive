import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { CodeBlock, Cor, Cmt } from "./CodeBlock"

describe("CodeBlock", () => {
  let writeText: ReturnType<typeof vi.fn>

  // `userEvent.setup()` installs its own `navigator.clipboard` stub (via its
  // `writeToClipboard` default), so our mock must be applied *after* setup,
  // otherwise it gets clobbered before the click fires.
  function setupUser() {
    const user = userEvent.setup()
    writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
      writable: true,
    })
    return user
  }

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("renders children inside a pre element", () => {
    render(<CodeBlock copyText="npm install">npm install</CodeBlock>)
    expect(screen.getByText("npm install", { selector: "pre" })).toBeInTheDocument()
  })

  it("renders the default copy label", () => {
    render(<CodeBlock copyText="npm install">code</CodeBlock>)
    expect(screen.getByRole("button", { name: "Copiar" })).toBeInTheDocument()
  })

  it("merges a custom className with the base class", () => {
    render(
      <CodeBlock copyText="x" className="extra">
        code
      </CodeBlock>
    )
    const button = screen.getByRole("button", { name: "Copiar" })
    expect(button.parentElement).toHaveClass("hds-code", "extra")
  })

  it("spreads rest props onto the host div", () => {
    render(
      <CodeBlock copyText="x" data-testid="block">
        code
      </CodeBlock>
    )
    expect(screen.getByTestId("block")).toHaveClass("hds-code")
  })

  it("sets data-copy on the copy button to copyText", () => {
    render(<CodeBlock copyText="hello world">code</CodeBlock>)
    expect(screen.getByRole("button", { name: "Copiar" })).toHaveAttribute("data-copy", "hello world")
  })

  it("copies copyText to the clipboard and shows the copied label, then reverts", async () => {
    const user = setupUser()
    render(<CodeBlock copyText="npm install @hive/design-system">code</CodeBlock>)

    const button = screen.getByRole("button", { name: "Copiar" })
    await user.click(button)

    expect(writeText).toHaveBeenCalledWith("npm install @hive/design-system")
    expect(await screen.findByRole("button", { name: "Copiado" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Copiado" })).toHaveClass("hds-copy-ok")

    expect(
      await screen.findByRole("button", { name: "Copiar" }, { timeout: 2500 })
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Copiar" })).not.toHaveClass("hds-copy-ok")
  }, 5000)

  it("supports custom copyLabel and copiedLabel", async () => {
    const user = setupUser()
    render(
      <CodeBlock copyText="x" copyLabel="Copy" copiedLabel="Copied!">
        code
      </CodeBlock>
    )

    expect(screen.getByRole("button", { name: "Copy" })).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Copy" }))
    expect(await screen.findByRole("button", { name: "Copied!" })).toBeInTheDocument()
  })

  it("writes an empty string when copyText is omitted", async () => {
    const user = setupUser()
    render(<CodeBlock>code</CodeBlock>)
    await user.click(screen.getByRole("button", { name: "Copiar" }))
    expect(writeText).toHaveBeenCalledWith("")
  })

  it("clears a pending revert timeout when clicked again before it fires", async () => {
    const user = setupUser()
    render(<CodeBlock copyText="again">code</CodeBlock>)

    const button = screen.getByRole("button", { name: "Copiar" })
    await user.click(button)
    expect(await screen.findByRole("button", { name: "Copiado" })).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Copiado" }))
    expect(writeText).toHaveBeenCalledTimes(2)
    expect(screen.getByRole("button", { name: "Copiado" })).toBeInTheDocument()
  })
})

describe("Cor", () => {
  it("renders children with the hds-code-cor class", () => {
    render(<Cor>const x = 1</Cor>)
    const el = screen.getByText("const x = 1")
    expect(el).toHaveClass("hds-code-cor")
    expect(el.tagName).toBe("SPAN")
  })
})

describe("Cmt", () => {
  it("renders children with the hds-code-cmt class", () => {
    render(<Cmt>// comment</Cmt>)
    const el = screen.getByText("// comment")
    expect(el).toHaveClass("hds-code-cmt")
    expect(el.tagName).toBe("SPAN")
  })
})
