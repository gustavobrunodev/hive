import type { ComponentPropsWithoutRef, ReactNode } from "react"
// @ts-expect-error Panel.jsx has not been migrated to TS yet (parallel task, out of scope here)
import { Panel } from "../Panel/Panel.jsx"
import { cx } from "../../utils/cx"
import "./ModeBlock.css"

export interface ModeSplitProps extends ComponentPropsWithoutRef<"div"> {}

export function ModeSplit({ className, children, ...rest }: ModeSplitProps) {
  return (
    <div className={cx("hds-modes-split", className)} {...rest}>
      {children}
    </div>
  )
}

export interface ModeBlockProps extends Omit<ComponentPropsWithoutRef<"article">, "title"> {
  label?: ReactNode
  title?: ReactNode
  primary?: boolean
  items?: string[]
}

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
