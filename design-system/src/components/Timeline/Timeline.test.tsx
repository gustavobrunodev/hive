import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { Flow, SpineLabel, Steps, Step, Substeps, Sub } from "./Timeline"

describe("SpineLabel", () => {
  it("renders children alongside the swatch element", () => {
    render(<SpineLabel>Phase label</SpineLabel>)
    expect(screen.getByText("Phase label")).toBeInTheDocument()
  })

  it("applies the base class to the wrapper", () => {
    render(<SpineLabel data-testid="spine">Label</SpineLabel>)
    expect(screen.getByTestId("spine")).toHaveClass("hds-spine-label")
  })

  it("renders an aria-hidden swatch span", () => {
    render(<SpineLabel data-testid="spine">Label</SpineLabel>)
    const swatch = screen.getByTestId("spine").querySelector(".hds-sw")
    expect(swatch).toBeInTheDocument()
    expect(swatch).toHaveAttribute("aria-hidden", "true")
  })

  it("spreads rest props onto the host div", () => {
    render(
      <SpineLabel data-testid="spine" title="hint">
        Label
      </SpineLabel>
    )
    expect(screen.getByTestId("spine")).toHaveAttribute("title", "hint")
  })
})

describe("Flow", () => {
  it("renders children inside the flow container", () => {
    render(
      <Flow>
        <span>Flow content</span>
      </Flow>
    )
    expect(screen.getByText("Flow content")).toBeInTheDocument()
  })

  it("applies the base flow class alongside a custom className", () => {
    render(
      <Flow className="custom-flow" data-testid="flow">
        content
      </Flow>
    )
    expect(screen.getByTestId("flow")).toHaveClass("hds-flow", "custom-flow")
  })

  it("spreads rest props onto the host div", () => {
    render(
      <Flow data-testid="flow" title="hint">
        content
      </Flow>
    )
    expect(screen.getByTestId("flow")).toHaveAttribute("title", "hint")
  })
})

describe("Steps", () => {
  it("renders children inside the steps container", () => {
    render(
      <Steps>
        <span>Step content</span>
      </Steps>
    )
    expect(screen.getByText("Step content")).toBeInTheDocument()
  })

  it("applies the base steps class alongside a custom className", () => {
    render(
      <Steps className="custom-steps" data-testid="steps">
        content
      </Steps>
    )
    expect(screen.getByTestId("steps")).toHaveClass("hds-steps", "custom-steps")
  })

  it("spreads rest props onto the host div", () => {
    render(
      <Steps data-testid="steps" title="hint">
        content
      </Steps>
    )
    expect(screen.getByTestId("steps")).toHaveAttribute("title", "hint")
  })
})

describe("Step", () => {
  it("renders the number and title", () => {
    render(<Step number={1} title="Discover" />)
    expect(screen.getByText("1")).toBeInTheDocument()
    expect(screen.getByRole("heading", { level: 3, name: "Discover" })).toBeInTheDocument()
  })

  it("renders children inside the panel", () => {
    render(
      <Step number={1} title="Discover">
        <p>Body text</p>
      </Step>
    )
    expect(screen.getByText("Body text")).toBeInTheDocument()
  })

  it("defaults skills to an empty list and renders no chips", () => {
    render(<Step number={1} title="Discover" />)
    expect(document.querySelector(".hds-chip")).not.toBeInTheDocument()
  })

  it("renders a chip for each skill without the he tone by default", () => {
    render(
      <Step
        number={1}
        title="Discover"
        skills={[{ label: "Research" }, { label: "Synthesis" }]}
      />
    )
    const research = screen.getByText("Research")
    const synthesis = screen.getByText("Synthesis")
    expect(research).toBeInTheDocument()
    expect(synthesis).toBeInTheDocument()
    expect(research).not.toHaveClass("tone-he")
    expect(synthesis).not.toHaveClass("tone-he")
  })

  it("applies the he tone to a skill chip flagged with he", () => {
    render(<Step number={1} title="Discover" skills={[{ label: "Facilitation", he: true }]} />)
    expect(screen.getByText("Facilitation")).toHaveClass("tone-he")
  })

  it("does not apply the highlight class by default", () => {
    render(<Step number={1} title="Discover" data-testid="step" />)
    expect(screen.getByTestId("step")).not.toHaveClass("hds-step-he")
  })

  it("applies the highlight class when highlight is true", () => {
    render(<Step number={1} title="Discover" highlight data-testid="step" />)
    expect(screen.getByTestId("step")).toHaveClass("hds-step", "hds-step-he")
  })

  it("renders the wire connector when last is false (default)", () => {
    render(<Step number={1} title="Discover" data-testid="step" />)
    const wire = screen.getByTestId("step").querySelector(".hds-wire")
    expect(wire).toBeInTheDocument()
    expect(wire).toHaveAttribute("aria-hidden", "true")
  })

  it("omits the wire connector when last is true", () => {
    render(<Step number={1} title="Discover" last data-testid="step" />)
    expect(screen.getByTestId("step").querySelector(".hds-wire")).not.toBeInTheDocument()
  })

  it("passes a custom className through to the outer wrapper", () => {
    render(<Step number={1} title="Discover" className="custom-step" data-testid="step" />)
    expect(screen.getByTestId("step")).toHaveClass("hds-step", "custom-step")
  })

  it("spreads rest props onto the outer wrapper", () => {
    render(<Step number={1} title="Discover" data-testid="step" lang="en" />)
    expect(screen.getByTestId("step")).toHaveAttribute("lang", "en")
  })
})

describe("Substeps", () => {
  it("renders children inside the substeps container", () => {
    render(
      <Substeps>
        <span>Substep content</span>
      </Substeps>
    )
    expect(screen.getByText("Substep content")).toBeInTheDocument()
  })

  it("applies the base substeps class alongside a custom className", () => {
    render(
      <Substeps className="custom-substeps" data-testid="substeps">
        content
      </Substeps>
    )
    expect(screen.getByTestId("substeps")).toHaveClass("hds-substeps", "custom-substeps")
  })

  it("spreads rest props onto the host div", () => {
    render(
      <Substeps data-testid="substeps" title="hint">
        content
      </Substeps>
    )
    expect(screen.getByTestId("substeps")).toHaveAttribute("title", "hint")
  })
})

describe("Sub", () => {
  it("renders label, skill and children", () => {
    render(
      <Sub label="Explore" skill="Interviews">
        Talk to five users.
      </Sub>
    )
    expect(screen.getByText("Explore")).toBeInTheDocument()
    expect(screen.getByText("Interviews")).toBeInTheDocument()
    expect(screen.getByText("Talk to five users.")).toBeInTheDocument()
  })

  it("applies the base classes alongside a custom className", () => {
    render(
      <Sub label="Explore" skill="Interviews" className="custom-sub" data-testid="sub">
        body
      </Sub>
    )
    expect(screen.getByTestId("sub")).toHaveClass("hds-sub", "cut-sm", "custom-sub")
  })

  it("renders children inside a paragraph element", () => {
    render(
      <Sub label="Explore" skill="Interviews">
        body copy
      </Sub>
    )
    expect(screen.getByText("body copy").tagName).toBe("P")
  })

  it("spreads rest props onto the host div", () => {
    render(
      <Sub label="Explore" skill="Interviews" data-testid="sub" title="hint">
        body
      </Sub>
    )
    expect(screen.getByTestId("sub")).toHaveAttribute("title", "hint")
  })
})
