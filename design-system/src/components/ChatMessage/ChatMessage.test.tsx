import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { ChatMessage } from "./ChatMessage"

describe("ChatMessage", () => {
  it("renders its content", () => {
    render(<ChatMessage role="assistant">Hello there</ChatMessage>)
    expect(screen.getByText("Hello there")).toBeInTheDocument()
  })

  it("applies role-specific alignment classes", () => {
    const { container: userContainer } = render(<ChatMessage role="user">Hi</ChatMessage>)
    expect(userContainer.firstChild).toHaveClass("hds-chat-message-user")

    const { container: assistantContainer } = render(<ChatMessage role="assistant">Hi</ChatMessage>)
    expect(assistantContainer.firstChild).toHaveClass("hds-chat-message-assistant")

    const { container: systemContainer } = render(<ChatMessage role="system">Session started</ChatMessage>)
    expect(systemContainer.firstChild).toHaveClass("hds-chat-message-system")
  })

  it("sets data-role for the given role", () => {
    const { container } = render(<ChatMessage role="assistant">Hi</ChatMessage>)
    expect(container.firstChild).toHaveAttribute("data-role", "assistant")
  })

  it("renders the avatar slot for user/assistant but not system", () => {
    const { container: userContainer } = render(
      <ChatMessage role="user" avatar={<span data-testid="avatar">U</span>}>
        Hi
      </ChatMessage>
    )
    expect(userContainer.querySelector('[data-testid="avatar"]')).toBeInTheDocument()

    render(
      <ChatMessage role="system" avatar={<span data-testid="avatar-2">S</span>}>
        Session started
      </ChatMessage>
    )
    expect(screen.queryByTestId("avatar-2")).not.toBeInTheDocument()
  })

  it("renders the timestamp slot", () => {
    render(
      <ChatMessage role="assistant" timestamp="2:04 PM">
        Hi
      </ChatMessage>
    )
    expect(screen.getByText("2:04 PM")).toBeInTheDocument()
  })

  it("renders the actions slot", () => {
    render(
      <ChatMessage role="assistant" actions={<button>Copy</button>}>
        Hi
      </ChatMessage>
    )
    expect(screen.getByRole("button", { name: "Copy" })).toBeInTheDocument()
  })

  it("omits the meta row entirely when neither timestamp nor actions are given", () => {
    const { container } = render(<ChatMessage role="assistant">Hi</ChatMessage>)
    expect(container.querySelector(".hds-chat-message-meta")).not.toBeInTheDocument()
  })

  it("merges a custom className", () => {
    const { container } = render(
      <ChatMessage role="assistant" className="extra">
        Hi
      </ChatMessage>
    )
    expect(container.firstChild).toHaveClass("hds-chat-message", "extra")
  })

  it("forwards a ref to the root element", () => {
    let node: HTMLDivElement | null = null
    render(
      <ChatMessage
        role="assistant"
        ref={(el) => {
          node = el
        }}
      >
        Hi
      </ChatMessage>
    )
    expect(node).not.toBeNull()
    expect(node).toHaveClass("hds-chat-message")
  })
})
