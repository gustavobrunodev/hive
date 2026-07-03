import React from "react"
import { cx } from "../../utils/cx"
import "./Button.css"

type AnchorProps = React.ComponentPropsWithoutRef<"a">
type ButtonHostProps = React.ComponentPropsWithoutRef<"button">

export type ButtonProps = {
  variant?: "primary" | "ghost"
  href?: string
  arrow?: boolean
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
