import React from "react"
import { cx } from "../../utils/cx"
import "./Button.css"

type AnchorProps = React.ComponentPropsWithoutRef<"a">
type ButtonHostProps = React.ComponentPropsWithoutRef<"button">

export type ButtonProps = {
  /** Visual style: `primary` (solid accent fill) or `ghost` (outlined, transparent). Defaults to `primary`. */
  variant?: "primary" | "ghost"
  /** Renders the button as an `<a>` pointing at this URL instead of a `<button>`. Native `disabled` has no effect on a link — omit `href` for a disabled action. */
  href?: string
  /** Appends a decorative trailing arrow glyph (`aria-hidden`) after the children. */
  arrow?: boolean
  /** Applies the brand's clipped-corner (`cut-sm`) silhouette. Defaults to `true`; set `false` for a plain rectangular button. */
  cut?: boolean
  className?: string
  children?: React.ReactNode
} & Omit<AnchorProps & ButtonHostProps, "href" | "className" | "children" | "type">

/**
 * Forwards its ref to the rendered `<button>`/`<a>`. Required, not a nicety:
 * every Radix `asChild` trigger (DropdownMenu, Popover, Tooltip, …) clones the
 * child through `Slot` and hands it a ref, and on React 18 a plain function
 * component silently drops it. The menu then has no anchor and Radix positions
 * it at the viewport origin — the Source Control commit split-button looked
 * dead for exactly this reason, its menu opening off-screen at (0, -180).
 */
export const Button = React.forwardRef<HTMLButtonElement | HTMLAnchorElement, ButtonProps>(
  function Button(
    { variant = "primary", href, arrow = false, cut = true, className, children, ...rest },
    ref
  ) {
    const classes = cx(
      "hds-btn",
      variant === "primary" ? "hds-btn-primary" : "hds-btn-ghost",
      cut && "cut-sm",
      className
    )

    const content = (
      <>
        {children}
        {arrow && (
          <span className="hds-btn-arrow" aria-hidden="true">
            →
          </span>
        )}
      </>
    )

    // The host element is chosen at runtime by `href`, which the ref type can't
    // discriminate — hence the cast on each branch rather than a widened ref.
    if (href) {
      return (
        <a
          ref={ref as React.Ref<HTMLAnchorElement>}
          className={classes}
          href={href}
          {...(rest as AnchorProps)}
        >
          {content}
        </a>
      )
    }
    return (
      <button
        ref={ref as React.Ref<HTMLButtonElement>}
        type="button"
        className={classes}
        {...(rest as ButtonHostProps)}
      >
        {content}
      </button>
    )
  }
)
