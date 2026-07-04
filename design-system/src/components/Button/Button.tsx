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

export function Button({
  variant = "primary",
  href,
  arrow = false,
  cut = true,
  className,
  children,
  ...rest
}: ButtonProps) {
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

  if (href) {
    return (
      <a className={classes} href={href} {...(rest as AnchorProps)}>
        {content}
      </a>
    )
  }
  return (
    <button type="button" className={classes} {...(rest as ButtonHostProps)}>
      {content}
    </button>
  )
}
