import { render, screen } from "@testing-library/react"
import { describe, expect, test } from "vitest"
import { Logo } from "./Logo"
import lockupSource from "../../../assets/logos/current_logo_lockup.svg?raw"
import markSource from "../../../assets/logos/current_logo_mark.svg?raw"

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
    ["black", "lockup"],
    ["black", "mark"],
    ["white", "lockup"],
    ["white", "mark"],
    ["current", "lockup"],
    ["current", "mark"],
  ] as const)("renders tone=%s mark=%s", (tone, mark) => {
    render(<Logo tone={tone} mark={mark} />)

    const logo = screen.getByRole("img", { name: "Hive" })
    expect(logo).toBeInTheDocument()
    expect(logo.innerHTML).not.toBe("")
  })

  test("tags the rendered element with its tone, so CSS can reach the current-tone groups", () => {
    render(<Logo tone="current" mark="lockup" data-testid="logo-el" />)

    expect(screen.getByTestId("logo-el")).toHaveAttribute("data-tone", "current")
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

/**
 * The component inlines its SVG through esbuild's `text` loader, which Vite
 * resolves to a URL in this environment — `innerHTML` here is a path, not
 * artwork. So the promises the chrome marks make (theme-following fills,
 * separately styleable groups, a crop that makes a CSS height mean what it
 * says) are asserted against the generated files themselves, which is where
 * they would actually break: `scripts/gen-logo-lockups.mjs` derives all six
 * from the delivered vertical stack.
 */
describe("chrome logo assets", () => {
  test.each([
    ["lockup", lockupSource],
    ["mark", markSource],
  ])("the current-tone %s inherits color instead of baking a fill", (_name, svg) => {
    expect(svg).toContain('fill="currentColor"')
    expect(svg).not.toMatch(/fill="#[0-9a-f]{3,6}"/i)
  })

  test("the lockup exposes the mark and the wordmark as separately styleable groups", () => {
    expect(lockupSource).toContain('class="hds-logo-mark"')
    expect(lockupSource).toContain('class="hds-logo-wordmark"')
  })

  test.each([
    ["lockup", lockupSource, "0 0 364.1559 100"],
    ["mark", markSource, "0 0 96.2633 100"],
  ])("the %s is cropped to the artwork, so a CSS height is the rendered height", (_n, svg, viewBox) => {
    // The delivered stacks sit on a 1408×768 canvas the drawing fills ~20% of:
    // a caller asking for a 20px logo gets a ~4px mark. Guard the crop.
    expect(svg).toContain(`viewBox="${viewBox}"`)
  })
})
