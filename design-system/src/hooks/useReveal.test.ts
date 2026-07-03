import { createElement } from "react"
import { render } from "@testing-library/react"
import { act } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { useReveal } from "./useReveal"

// Harness component: mounts the hook's ref onto a real DOM node so the
// hook's effect (which bails out until `ref.current` exists) actually runs,
// and exposes the current `isIn` value via a data attribute for assertions.
function Harness() {
  const [ref, isIn] = useReveal()
  return createElement("div", { ref, "data-testid": "target", "data-in": String(isIn) })
}

describe("useReveal", () => {
  const originalIntersectionObserver = window.IntersectionObserver
  const originalMatchMedia = window.matchMedia

  afterEach(() => {
    window.IntersectionObserver = originalIntersectionObserver
    window.matchMedia = originalMatchMedia
    vi.restoreAllMocks()
  })

  it("sets isIn to true once IntersectionObserver reports isIntersecting", () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: false })

    let observedCallback: IntersectionObserverCallback | undefined
    const observe = vi.fn()
    const unobserve = vi.fn()
    const disconnect = vi.fn()

    class StubIntersectionObserver {
      constructor(callback: IntersectionObserverCallback) {
        observedCallback = callback
      }
      observe = observe
      unobserve = unobserve
      disconnect = disconnect
    }

    window.IntersectionObserver = StubIntersectionObserver as unknown as typeof IntersectionObserver

    const { getByTestId } = render(createElement(Harness))
    const target = getByTestId("target")

    expect(target.getAttribute("data-in")).toBe("false")
    expect(observe).toHaveBeenCalledWith(target)

    act(() => {
      observedCallback?.(
        [{ isIntersecting: true, target } as unknown as IntersectionObserverEntry],
        {} as IntersectionObserver
      )
    })

    expect(getByTestId("target").getAttribute("data-in")).toBe("true")
    expect(unobserve).toHaveBeenCalledWith(target)
  })

  it("sets isIn to true immediately when reduced motion is preferred", () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true })

    const { getByTestId } = render(createElement(Harness))

    expect(getByTestId("target").getAttribute("data-in")).toBe("true")
  })

  it("sets isIn to true immediately when IntersectionObserver is unavailable", () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: false })
    // @ts-expect-error - simulate an environment without IntersectionObserver
    delete window.IntersectionObserver

    const { getByTestId } = render(createElement(Harness))

    expect(getByTestId("target").getAttribute("data-in")).toBe("true")
  })

  it("does nothing when the ref never attaches to a node", () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: false })

    // Harness that never forwards the ref, so `ref.current` stays null
    // and the effect's early-return guard is exercised.
    function NoRefHarness() {
      const [, isIn] = useReveal()
      return createElement("div", { "data-testid": "target", "data-in": String(isIn) })
    }

    const { getByTestId } = render(createElement(NoRefHarness))

    expect(getByTestId("target").getAttribute("data-in")).toBe("false")
  })
})
