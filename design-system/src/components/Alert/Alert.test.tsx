import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { Alert } from "./Alert"

describe("Alert", () => {
  it("defaults to the info variant", () => {
    render(<Alert>Heads up</Alert>)
    expect(screen.getByText("Heads up").closest(".hds-alert")).toHaveClass("hds-alert-info")
  })

  it.each([
    ["info", "hds-alert-info"],
    ["success", "hds-alert-success"],
    ["warning", "hds-alert-warning"],
    ["danger", "hds-alert-danger"],
  ] as const)("renders the %s variant with its class", (variant, expectedClass) => {
    render(<Alert variant={variant}>Body</Alert>)
    expect(screen.getByText("Body").closest(".hds-alert")).toHaveClass("hds-alert", expectedClass)
  })

  it("renders the icon slot when provided", () => {
    render(
      <Alert icon={<svg data-testid="alert-icon" />} variant="warning">
        Body
      </Alert>
    )
    expect(screen.getByTestId("alert-icon").closest(".hds-alert-icon")).toBeInTheDocument()
  })

  it("does not render an icon wrapper when no icon is passed", () => {
    const { container } = render(<Alert>Body</Alert>)
    expect(container.querySelector(".hds-alert-icon")).not.toBeInTheDocument()
  })

  it("renders a title", () => {
    render(<Alert title="Something happened">Body copy</Alert>)
    expect(screen.getByText("Something happened")).toHaveClass("hds-alert-title")
  })

  it("renders children as the description body", () => {
    render(<Alert title="Title">Description text</Alert>)
    expect(screen.getByText("Description text")).toHaveClass("hds-alert-description")
  })

  it("merges a custom className", () => {
    render(<Alert className="extra">Body</Alert>)
    expect(screen.getByText("Body").closest(".hds-alert")).toHaveClass("hds-alert", "hds-alert-info", "extra")
  })

  it("has no default role", () => {
    render(<Alert>Body</Alert>)
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
  })

  it("passes through a consumer-supplied role", () => {
    render(<Alert role="alert">Something failed</Alert>)
    expect(screen.getByRole("alert")).toHaveTextContent("Something failed")
  })

  it("forwards a ref to the root element", () => {
    let node: HTMLDivElement | null = null
    render(
      <Alert
        ref={(el) => {
          node = el
        }}
      >
        Body
      </Alert>
    )
    expect(node).toBeInstanceOf(HTMLDivElement)
  })
})
