import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { MessageToken } from "./MessageToken"
import { ChatMessage } from "../ChatMessage/ChatMessage"

describe("MessageToken", () => {
  it("renders the marked text", () => {
    render(<MessageToken kind="command">/bmad-prd</MessageToken>)
    expect(screen.getByText("/bmad-prd")).toBeInTheDocument()
  })

  it("carries its kind as a data attribute", () => {
    const { container } = render(<MessageToken kind="file">docs/prd.md</MessageToken>)
    expect(container.querySelector(".hds-message-token")).toHaveAttribute("data-kind", "file")
  })

  it("draws a decorative slash glyph for a command", () => {
    const { container } = render(<MessageToken kind="command">/bmad-ux</MessageToken>)
    const glyph = container.querySelector(".hds-message-token-glyph")
    expect(glyph).toHaveAttribute("aria-hidden", "true")
  })

  it("draws no glyph for a file unless one is supplied", () => {
    const { container, rerender } = render(<MessageToken kind="file">a.md</MessageToken>)
    expect(container.querySelector(".hds-message-token-glyph")).toBeNull()
    rerender(
      <MessageToken kind="file" icon={<span data-testid="file-icon" />}>
        a.md
      </MessageToken>
    )
    expect(screen.getByTestId("file-icon")).toBeInTheDocument()
  })

  it("lets a caller replace the command glyph", () => {
    render(
      <MessageToken kind="command" icon={<span data-testid="own-glyph" />}>
        /x
      </MessageToken>
    )
    expect(screen.getByTestId("own-glyph")).toBeInTheDocument()
  })

  it("renders as a mark so the run stays part of the sentence", () => {
    const { container } = render(<MessageToken kind="command">/x</MessageToken>)
    expect(container.querySelector("mark.hds-message-token")).toBeInTheDocument()
  })

  it("reads its ground from the message it sits in", () => {
    const { container } = render(
      <ChatMessage role="user">
        <MessageToken kind="command">/bmad-prd</MessageToken> revisar o escopo
      </ChatMessage>
    )
    expect(container.querySelector(".hds-chat-message-user .hds-message-token")).toBeInTheDocument()
  })

  it("merges a custom className and spreads native props", () => {
    render(
      <MessageToken kind="file" className="extra" data-testid="tok">
        a.md
      </MessageToken>
    )
    expect(screen.getByTestId("tok")).toHaveClass("hds-message-token", "extra")
  })
})
