import type { ComponentPropsWithoutRef, ReactNode } from "react"
import { cx } from "../../utils/cx"
import "./SteppedList.css"

/**
 * Numbered vertical step list — a CSS `counter()`-driven `<ol>` with a
 * dashed connector between items. No `active`/current-step affordance is
 * built in; the numbering is purely sequential (see `SteppedListItem` for
 * per-step title/description).
 */
export interface SteppedListProps extends ComponentPropsWithoutRef<"ol"> {}

export function SteppedList({ className, children, ...rest }: SteppedListProps) {
  return (
    <ol className={cx("hds-steps-list", className)} {...rest}>
      {children}
    </ol>
  )
}

export interface SteppedListItemProps extends Omit<ComponentPropsWithoutRef<"li">, "title"> {
  /** Step heading, rendered above `description`. */
  title?: ReactNode
  /** Supporting copy under `title`. */
  description?: ReactNode
}

export function SteppedListItem({ title, description, className, children, ...rest }: SteppedListItemProps) {
  return (
    <li className={className} {...rest}>
      <div className="hds-st-t">{title}</div>
      <div className="hds-st-d">{description}</div>
      {children}
    </li>
  )
}
