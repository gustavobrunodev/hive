import type { ComponentPropsWithoutRef, CSSProperties, ReactNode } from "react"
import { Panel } from "../Panel/Panel"
import { cx } from "../../utils/cx"
import "./ValueCard.css"

export interface ValueGridProps extends ComponentPropsWithoutRef<"div"> {}

export function ValueGrid({ className, children, ...rest }: ValueGridProps) {
  return (
    <div className={cx("hds-val-grid", className)} {...rest}>
      {children}
    </div>
  )
}

export interface ValueCardProps extends Omit<ComponentPropsWithoutRef<"article">, "title"> {
  kicker?: ReactNode
  title?: ReactNode
  index?: number
}

export function ValueCard({
  kicker,
  title,
  className,
  children,
  style,
  index,
  ...rest
}: ValueCardProps) {
  return (
    <Panel
      as="article"
      className={cx("hds-val", className)}
      style={index != null ? ({ ...style, "--i": index } as CSSProperties) : style}
      {...rest}
    >
      <div className="hds-val-k">
        <em aria-hidden="true" />
        {kicker}
      </div>
      <h3>{title}</h3>
      <p>{children}</p>
    </Panel>
  )
}
