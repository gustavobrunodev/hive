import { createElement } from "react"
import { render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { useAutosizeTextarea, type UseAutosizeTextareaOptions } from "./useAutosizeTextarea"

// jsdom performs no real layout, so `getComputedStyle`/`scrollHeight` never
// reflect actual rendered content there. These tests mock both at the DOM
// node level to exercise the hook's clamping/measurement logic
// deterministically — that's expected and standard for autosize hooks
// under jsdom, not a workaround for a hook bug.

type HarnessProps = {
  value: string
  options?: UseAutosizeTextareaOptions
}

function Harness({ value, options }: HarnessProps) {
  const ref = useAutosizeTextarea(value, options)
  return createElement("textarea", { ref, "data-testid": "ta", value, readOnly: true })
}

function mockComputedStyle(overrides: Partial<CSSStyleDeclaration>) {
  return vi.spyOn(window, "getComputedStyle").mockReturnValue({
    lineHeight: "20px",
    fontSize: "16px",
    paddingTop: "0px",
    paddingBottom: "0px",
    borderTopWidth: "0px",
    borderBottomWidth: "0px",
    ...overrides,
  } as CSSStyleDeclaration)
}

function mockScrollHeight(node: HTMLElement, height: number) {
  Object.defineProperty(node, "scrollHeight", { configurable: true, value: height })
}

describe("useAutosizeTextarea", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("does not throw when mounted", () => {
    expect(() => render(createElement(Harness, { value: "hello" }))).not.toThrow()
  })

  it("responds to a value change by recomputing height", () => {
    mockComputedStyle({})
    const { getByTestId, rerender } = render(createElement(Harness, { value: "a" }))
    const node = getByTestId("ta") as HTMLTextAreaElement
    mockScrollHeight(node, 20)

    rerender(createElement(Harness, { value: "a\nb\nc" }))
    mockScrollHeight(node, 60)

    rerender(createElement(Harness, { value: "a\nb\nc\nd" }))

    // The effect re-ran and set an explicit pixel height (rather than
    // leaving the default "auto"/empty style) in response to the value change.
    expect(node.style.height).toMatch(/px$/)
  })

  it("clamps height to maxRows when content exceeds it", () => {
    mockComputedStyle({ lineHeight: "20px" })
    const { getByTestId, rerender } = render(
      createElement(Harness, { value: "a", options: { minRows: 1, maxRows: 4 } })
    )
    const node = getByTestId("ta") as HTMLTextAreaElement
    mockScrollHeight(node, 1000)

    rerender(createElement(Harness, { value: "a\n".repeat(50), options: { minRows: 1, maxRows: 4 } }))

    expect(node.style.height).toBe("80px") // 20px line-height * 4 rows
    expect(node.style.overflowY).toBe("auto")
  })

  it("clamps height to minRows when content is smaller", () => {
    mockComputedStyle({ lineHeight: "20px" })
    const { getByTestId, rerender } = render(
      createElement(Harness, { value: "", options: { minRows: 3, maxRows: 6 } })
    )
    const node = getByTestId("ta") as HTMLTextAreaElement
    mockScrollHeight(node, 5)

    rerender(createElement(Harness, { value: "x", options: { minRows: 3, maxRows: 6 } }))

    expect(node.style.height).toBe("60px") // 20px line-height * 3 rows
    expect(node.style.overflowY).toBe("hidden")
  })

  it("falls back to a default line-height when computed style is unparsable", () => {
    mockComputedStyle({ lineHeight: "normal", fontSize: "" })
    const { getByTestId, rerender } = render(createElement(Harness, { value: "a" }))
    const node = getByTestId("ta") as HTMLTextAreaElement
    mockScrollHeight(node, 5)

    rerender(createElement(Harness, { value: "ab" }))

    // Default fallback line-height (20px) * minRows (1) = 20px min-height.
    expect(node.style.height).toBe("20px")
  })

  it("does not throw when getComputedStyle is unavailable", () => {
    const original = window.getComputedStyle
    // @ts-expect-error - simulate an environment without getComputedStyle
    window.getComputedStyle = undefined

    expect(() => render(createElement(Harness, { value: "a" }))).not.toThrow()

    window.getComputedStyle = original
  })

  it("does not throw when ResizeObserver is unavailable", () => {
    const original = window.ResizeObserver
    // @ts-expect-error - simulate an environment without ResizeObserver
    delete window.ResizeObserver

    expect(() => render(createElement(Harness, { value: "a" }))).not.toThrow()

    window.ResizeObserver = original
  })

  it("swallows measurement errors instead of throwing (e.g. a hostile getComputedStyle)", () => {
    vi.spyOn(window, "getComputedStyle").mockImplementation(() => {
      throw new Error("boom")
    })

    expect(() => render(createElement(Harness, { value: "a" }))).not.toThrow()
  })
})
