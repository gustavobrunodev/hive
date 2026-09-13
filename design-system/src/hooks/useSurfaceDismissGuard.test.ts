import { createElement, createRef } from "react"
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { useSurfaceDismissGuard } from "./useSurfaceDismissGuard"
import type { OutsideInteractionEvent } from "./useSurfaceDismissGuard"

/**
 * The guard's decision is pure geometry, so the harness measures rather than
 * renders a modal: jsdom has no layout, and a `getBoundingClientRect` of zeros
 * is exactly the "still animating" case the hook is written to let through.
 */
function Harness({
  forwarded,
  onReady
}: {
  forwarded?: React.Ref<HTMLDivElement>
  onReady: (guard: ReturnType<typeof useSurfaceDismissGuard<HTMLDivElement>>) => void
}) {
  const guard = useSurfaceDismissGuard<HTMLDivElement>(forwarded)
  onReady(guard)
  return createElement("div", { ref: guard.ref, "data-testid": "surface" })
}

/** One outside-interaction event, at a point. */
function pointerAt(x: number, y: number): OutsideInteractionEvent & { prevented: boolean } {
  const event = {
    detail: { originalEvent: { clientX: x, clientY: y } },
    prevented: false,
    preventDefault(): void {
      event.prevented = true
    }
  }
  return event
}

/** Puts a real box on the node — jsdom reports zeros for everything. */
function measure(node: HTMLElement, box: { x: number; y: number; width: number; height: number }): void {
  vi.spyOn(node, "getBoundingClientRect").mockReturnValue({
    x: box.x,
    y: box.y,
    left: box.x,
    top: box.y,
    right: box.x + box.width,
    bottom: box.y + box.height,
    width: box.width,
    height: box.height,
    toJSON: () => ({})
  } as DOMRect)
}

describe("useSurfaceDismissGuard", () => {
  it("prevents the dismissal of a pointer-down that landed on the surface", () => {
    let guard!: ReturnType<typeof useSurfaceDismissGuard<HTMLDivElement>>
    render(createElement(Harness, { onReady: (value) => (guard = value) }))
    measure(screen.getByTestId("surface"), { x: 100, y: 80, width: 400, height: 300 })

    const inside = pointerAt(300, 200)
    guard.onPointerDownOutside(inside)
    expect(inside.prevented).toBe(true)

    // The edges belong to the surface: a click on its border is a click on it.
    const onEdge = pointerAt(100, 380)
    guard.onPointerDownOutside(onEdge)
    expect(onEdge.prevented).toBe(true)
  })

  it("leaves a genuine outside click alone, on either axis", () => {
    let guard!: ReturnType<typeof useSurfaceDismissGuard<HTMLDivElement>>
    render(createElement(Harness, { onReady: (value) => (guard = value) }))
    measure(screen.getByTestId("surface"), { x: 100, y: 80, width: 400, height: 300 })

    const points: [number, number][] = [
      [99, 200],
      [501, 200],
      [300, 79],
      [300, 381]
    ]
    for (const [x, y] of points) {
      const outside = pointerAt(x, y)
      guard.onPointerDownOutside(outside)
      expect(outside.prevented, `(${x},${y}) devia continuar sendo clique de fora`).toBe(false)
    }
  })

  it("declines to guard a surface with no box yet (mid-animation, or unmounted)", () => {
    let guard!: ReturnType<typeof useSurfaceDismissGuard<HTMLDivElement>>
    const { unmount } = render(createElement(Harness, { onReady: (value) => (guard = value) }))
    // jsdom's own zeros — no `measure` call.
    const zeroed = pointerAt(0, 0)
    guard.onPointerDownOutside(zeroed)
    expect(zeroed.prevented).toBe(false)

    unmount()
    const afterUnmount = pointerAt(300, 200)
    guard.onPointerDownOutside(afterUnmount)
    expect(afterUnmount.prevented).toBe(false)
  })

  it("keeps handing the node to the consumer's ref, object or callback", () => {
    const objectRef = createRef<HTMLDivElement>()
    render(createElement(Harness, { forwarded: objectRef, onReady: () => {} }))
    expect(objectRef.current).toBe(screen.getByTestId("surface"))

    const seen: (HTMLDivElement | null)[] = []
    const { unmount } = render(
      createElement(Harness, { forwarded: (node: HTMLDivElement | null) => seen.push(node), onReady: () => {} })
    )
    expect(seen.filter(Boolean)).toHaveLength(1)
    unmount()
    expect(seen[seen.length - 1]).toBeNull()
  })
})
