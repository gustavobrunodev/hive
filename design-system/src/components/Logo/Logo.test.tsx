import { render, screen } from "@testing-library/react"
import { describe, expect, test } from "vitest"
import { Logo } from "./Logo"

describe("Logo", () => {
  test("renders with default tone/mark (color/simple)", () => {
    render(<Logo />)

    const logo = screen.getByRole("img", { name: "Hive" })
    expect(logo).toHaveClass("hds-logo")
    expect(logo.innerHTML).not.toBe("")
  })

  test.each([
    ["color", "brain"],
    ["color", "simple"],
    ["color", "description"],
    ["color", "full"],
    ["black", "brain"],
    ["black", "simple"],
    ["black", "description"],
    ["white", "brain"],
    ["white", "simple"],
    ["white", "description"],
  ] as const)("renders tone=%s mark=%s", (tone, mark) => {
    render(<Logo tone={tone} mark={mark} />)

    const logo = screen.getByRole("img", { name: "Hive" })
    expect(logo).toBeInTheDocument()
    expect(logo.innerHTML).not.toBe("")
  })

  test("falls back to default mark when tone has no matching mark (e.g. black/full)", () => {
    render(<Logo tone="black" mark="full" />)

    const logo = screen.getByRole("img", { name: "Hive" })
    expect(logo.innerHTML).not.toBe("")
  })

  test("merges custom className and spreads extra props", () => {
    render(<Logo className="extra" data-testid="logo-el" />)

    const logo = screen.getByTestId("logo-el")
    expect(logo).toHaveClass("hds-logo", "extra")
  })
})
