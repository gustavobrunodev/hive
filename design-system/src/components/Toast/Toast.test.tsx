import { act } from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ToastProvider, useToast } from "./Toast"

function Publisher(props: Parameters<ReturnType<typeof useToast>["toast"]>[0] & { label?: string } = {}) {
  const { toast } = useToast()
  const { label = "Publish", ...options } = props
  return <button onClick={() => toast(options)}>{label}</button>
}

function renderWithProvider(children: React.ReactNode) {
  return render(<ToastProvider>{children}</ToastProvider>)
}

describe("Toast / useToast", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it("publishes a toast with title, description, and variant class", async () => {
    const user = userEvent.setup()
    renderWithProvider(<Publisher title="Saved" description="Your changes were saved" variant="success" />)

    await user.click(screen.getByText("Publish"))

    const title = await screen.findByText("Saved")
    expect(title).toBeInTheDocument()
    expect(screen.getByText("Your changes were saved")).toBeInTheDocument()
    expect(title.closest(".hds-toast")).toHaveClass("hds-toast-success")
  })

  it("announces the toast via a role=status live region", async () => {
    const user = userEvent.setup()
    renderWithProvider(<Publisher title="Saved" />)

    await user.click(screen.getByText("Publish"))
    await screen.findByText("Saved")

    await waitFor(() => {
      const statuses = screen.getAllByRole("status")
      expect(statuses.some((node) => node.textContent?.includes("Saved"))).toBe(true)
    })
  })

  it("auto-dismisses after its duration", async () => {
    vi.useFakeTimers()
    renderWithProvider(<Publisher title="Ephemeral" duration={1000} />)

    fireEvent.click(screen.getByText("Publish"))
    expect(screen.getByText("Ephemeral")).toBeInTheDocument()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500)
    })

    expect(screen.queryByText("Ephemeral")).not.toBeInTheDocument()
  })

  it("pauses the dismiss timer on hover and resumes on unhover", async () => {
    vi.useFakeTimers()
    renderWithProvider(<Publisher title="Hoverable" duration={1000} />)

    fireEvent.click(screen.getByText("Publish"))
    const title = screen.getByText("Hoverable")
    const toastEl = title.closest(".hds-toast") as HTMLElement
    // Radix's pause/resume listens on the viewport's wrapper (role="region")
    // — pointermove bubbles up to it from any toast, but pointerleave does
    // NOT bubble, so it must be dispatched directly on the region itself
    // (mirrors a real cursor leaving the wrapper's bounding box).
    const region = screen.getByRole("region")

    // Hover before the timer fires — this should pause it.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500)
    })
    act(() => {
      fireEvent.pointerMove(toastEl)
    })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })
    expect(screen.getByText("Hoverable")).toBeInTheDocument()

    // Leaving resumes the timer, so it should dismiss shortly after.
    act(() => {
      fireEvent.pointerLeave(region)
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })
    expect(screen.queryByText("Hoverable")).not.toBeInTheDocument()
  })

  it("dismisses via the close button", async () => {
    const user = userEvent.setup()
    renderWithProvider(<Publisher title="Closable" />)

    await user.click(screen.getByText("Publish"))
    await screen.findByText("Closable")

    await user.click(screen.getByRole("button", { name: "Dismiss" }))
    await waitFor(() => expect(screen.queryByText("Closable")).not.toBeInTheDocument())
  })

  it("stacks multiple toasts from the same provider", async () => {
    const user = userEvent.setup()
    function TwoPublishers() {
      const { toast } = useToast()
      return (
        <>
          <button onClick={() => toast({ title: "First" })}>One</button>
          <button onClick={() => toast({ title: "Second" })}>Two</button>
        </>
      )
    }
    renderWithProvider(<TwoPublishers />)

    await user.click(screen.getByText("One"))
    await user.click(screen.getByText("Two"))

    expect(await screen.findByText("First")).toBeInTheDocument()
    expect(await screen.findByText("Second")).toBeInTheDocument()
  })

  it("throws when useToast is called outside a ToastProvider", () => {
    const originalError = console.error
    console.error = () => {}
    function Orphan() {
      useToast()
      return null
    }
    expect(() => render(<Orphan />)).toThrow(/ToastProvider/)
    console.error = originalError
  })
})
