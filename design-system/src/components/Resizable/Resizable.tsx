import { forwardRef } from "react"
import type { ComponentPropsWithoutRef, ElementRef } from "react"
import { Group, Panel, Separator } from "react-resizable-panels"
import { cx } from "../../utils/cx"
import "./Resizable.css"

/**
 * A resizable pane group — thin DS wrapper over `react-resizable-panels`'
 * `Group`. Panels persist their size via the library's own `defaultLayout`/
 * `onLayoutChanged` props (a controllable-state pattern: the app owns the
 * layout value and decides whether/where to persist it, e.g. `localStorage`)
 * rather than a bespoke hook here.
 */
export type ResizableProps = ComponentPropsWithoutRef<typeof Group>

export const Resizable = forwardRef<ElementRef<typeof Group>, ResizableProps>(function Resizable(
  { className, orientation = "horizontal", ...rest },
  ref
) {
  return <Group elementRef={ref} orientation={orientation} className={cx("hds-resizable", className)} {...rest} />
})

Resizable.displayName = "Resizable"

export type ResizablePanelProps = ComponentPropsWithoutRef<typeof Panel>

/** One pane within a `Resizable` group. Supports `minSize`/`maxSize`/`collapsible` per `react-resizable-panels`. */
export const ResizablePanel = forwardRef<ElementRef<typeof Panel>, ResizablePanelProps>(function ResizablePanel(
  { className, ...rest },
  ref
) {
  return <Panel elementRef={ref} className={cx("hds-resizable-panel", className)} {...rest} />
})

ResizablePanel.displayName = "ResizablePanel"

export type ResizableHandleProps = ComponentPropsWithoutRef<typeof Separator> & {
  /** Renders a small visual grip (three dots) in the handle's hit area. Off by default. */
  withGrip?: boolean
}

/**
 * The draggable divider between two panels. `react-resizable-panels`'
 * `Separator` already renders `role="separator"` + full WAI-ARIA properties
 * and supports keyboard resizing (arrow keys / Home / End / Enter) natively
 * — this layer only supplies tokenized styling on top (spec.md's P2 AC1).
 */
export const ResizableHandle = forwardRef<ElementRef<typeof Separator>, ResizableHandleProps>(function ResizableHandle(
  { className, withGrip = false, ...rest },
  ref
) {
  return (
    <Separator elementRef={ref} className={cx("hds-resizable-handle", className)} {...rest}>
      {withGrip && (
        <span className="hds-resizable-handle-grip" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      )}
    </Separator>
  )
})

ResizableHandle.displayName = "ResizableHandle"
