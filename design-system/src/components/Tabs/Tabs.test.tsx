import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./Tabs"

function BasicTabs(props: Partial<React.ComponentProps<typeof TabsList>> = {}) {
  return (
    <Tabs defaultValue="account">
      <TabsList aria-label="Settings" {...props}>
        <TabsTrigger value="account">Account</TabsTrigger>
        <TabsTrigger value="billing">Billing</TabsTrigger>
        <TabsTrigger value="support" disabled>
          Support
        </TabsTrigger>
      </TabsList>
      <TabsContent value="account">Account panel</TabsContent>
      <TabsContent value="billing">Billing panel</TabsContent>
      <TabsContent value="support">Support panel</TabsContent>
    </Tabs>
  )
}

describe("Tabs", () => {
  it("renders a tablist with tabs and the active panel", () => {
    render(<BasicTabs />)

    expect(screen.getByRole("tablist", { name: "Settings" })).toBeInTheDocument()
    expect(screen.getAllByRole("tab")).toHaveLength(3)

    const panel = screen.getByRole("tabpanel")
    expect(panel).toHaveTextContent("Account panel")
    expect(screen.queryByText("Billing panel")).not.toBeInTheDocument()
  })

  it("marks the defaultValue trigger as active", () => {
    render(<BasicTabs />)

    expect(screen.getByRole("tab", { name: "Account" })).toHaveAttribute("data-state", "active")
    expect(screen.getByRole("tab", { name: "Billing" })).toHaveAttribute("data-state", "inactive")
  })

  it("clicking a trigger switches the active tab and shows the right panel", async () => {
    const user = userEvent.setup()
    render(<BasicTabs />)

    await user.click(screen.getByRole("tab", { name: "Billing" }))

    expect(screen.getByRole("tab", { name: "Billing" })).toHaveAttribute("data-state", "active")
    expect(screen.getByRole("tab", { name: "Account" })).toHaveAttribute("data-state", "inactive")

    const panel = screen.getByRole("tabpanel")
    expect(panel).toHaveTextContent("Billing panel")
    expect(screen.queryByText("Account panel")).not.toBeInTheDocument()
  })

  it("moves focus and switches the active tab via arrow-key navigation", async () => {
    const user = userEvent.setup()
    render(<BasicTabs />)

    const account = screen.getByRole("tab", { name: "Account" })
    const billing = screen.getByRole("tab", { name: "Billing" })

    account.focus()
    expect(account).toHaveFocus()

    // Radix's roving-focus-group defers the actual focus move to a
    // setTimeout(0) and only auto-selects on focus while an internal
    // "arrow key is physically held" ref is true (reset on keyup).
    // `user.keyboard("{ArrowRight}")` fires keydown+keyup back-to-back,
    // resetting that ref before the deferred focus/select runs — so we
    // hold the key down explicitly and release it only after the
    // selection lands (same pattern as RadioGroup.test.tsx).
    await user.keyboard("{ArrowRight>}")
    await waitFor(() => expect(billing).toHaveFocus())
    await waitFor(() => expect(billing).toHaveAttribute("data-state", "active"))
    await user.keyboard("{/ArrowRight}")

    expect(account).toHaveAttribute("data-state", "inactive")
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Billing panel")
  })

  it("skips a disabled trigger during keyboard navigation", async () => {
    const user = userEvent.setup()
    render(<BasicTabs />)

    const support = screen.getByRole("tab", { name: "Support" })
    expect(support).toBeDisabled()
    expect(support).toHaveAttribute("data-disabled")

    const billing = screen.getByRole("tab", { name: "Billing" })
    const account = screen.getByRole("tab", { name: "Account" })
    billing.focus()
    expect(billing).toHaveFocus()

    // Roving focus loops past the disabled "Support" trigger back to
    // "Account" rather than landing on the disabled tab.
    await user.keyboard("{ArrowRight>}")
    await waitFor(() => expect(account).toHaveFocus())
    await user.keyboard("{/ArrowRight}")

    expect(support).not.toHaveFocus()
  })

  it("does not activate a disabled trigger on click", async () => {
    const user = userEvent.setup()
    render(<BasicTabs />)

    await user.click(screen.getByRole("tab", { name: "Support" }))

    expect(screen.getByRole("tab", { name: "Support" })).toHaveAttribute("data-state", "inactive")
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Account panel")
  })

  it('applies the segmented variant class on TabsList', () => {
    render(<BasicTabs variant="segmented" />)

    expect(screen.getByRole("tablist")).toHaveClass("hds-tabs-list", "hds-tabs-list-segmented")
  })

  it("defaults TabsList to the underline variant class", () => {
    render(<BasicTabs />)

    expect(screen.getByRole("tablist")).toHaveClass("hds-tabs-list", "hds-tabs-list-underline")
  })

  it("merges a custom className on Tabs, TabsList, TabsTrigger, and TabsContent", () => {
    render(
      <Tabs defaultValue="a" className="extra-root">
        <TabsList aria-label="Demo" className="extra-list">
          <TabsTrigger value="a" className="extra-trigger">
            A
          </TabsTrigger>
        </TabsList>
        <TabsContent value="a" className="extra-content">
          A panel
        </TabsContent>
      </Tabs>
    )

    expect(screen.getByRole("tablist").parentElement).toHaveClass("hds-tabs", "extra-root")
    expect(screen.getByRole("tablist")).toHaveClass("hds-tabs-list", "extra-list")
    expect(screen.getByRole("tab", { name: "A" })).toHaveClass("hds-tabs-trigger", "extra-trigger")
    expect(screen.getByRole("tabpanel")).toHaveClass("hds-tabs-content", "extra-content")
  })
})
