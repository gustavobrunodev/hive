import type { ComponentPropsWithoutRef, ReactNode } from "react"
import { Panel } from "../Panel/Panel.jsx"
import { cx } from "../../utils/cx"
import "./ModeBlock.css"

export interface ModeSplitProps extends ComponentPropsWithoutRef<"div"> {}

/** Side-by-side layout container for two (or more) `ModeBlock`s — e.g. contrasting "drive" vs "delegate" modes. */
export function ModeSplit({ className, children, ...rest }: ModeSplitProps) {
  return (
    <div className={cx("hds-modes-split", className)} {...rest}>
      {children}
    </div>
  )
}

export interface ModeBlockProps extends Omit<ComponentPropsWithoutRef<"article">, "title"> {
  /** Small eyebrow label above the title (e.g. "Modo 1"). */
  label?: ReactNode
  /** Block heading, rendered as an `<h3>`. */
  title?: ReactNode
  /** Highlights this block as the primary/recommended one with `Panel`'s accent border. Defaults to `false`. */
  primary?: boolean
  /** Optional bullet list rendered below `children`. Omit for no list. */
  items?: string[]
}

/** A `Panel`-based card describing one mode/approach — label, title, prose (`children`), and an optional bullet list. Typically paired inside a `ModeSplit`. */
export function ModeBlock({
  label,
  title,
  primary = false,
  items = [],
  className,
  children,
  ...rest
}: ModeBlockProps) {
  return (
    <Panel as="article" accentBorder={primary} className={cx("hds-mode-block", className)} {...rest}>
      <div className="hds-mode-lbl">{label}</div>
      <h3>{title}</h3>
      <p>{children}</p>
      {items.length > 0 && (
        <ul>
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
