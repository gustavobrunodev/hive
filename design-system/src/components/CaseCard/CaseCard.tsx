import type { ComponentPropsWithoutRef, CSSProperties, ReactNode } from "react"
import { Panel } from "../Panel/Panel.jsx"
import { Badge } from "../Badge/Badge.jsx"
import { cx } from "../../utils/cx"
import "./CaseCard.css"

export interface CaseGridProps extends ComponentPropsWithoutRef<"div"> {}

export function CaseGrid({ className, children, ...rest }: CaseGridProps) {
  return (
    <div className={cx("hds-cases", className)} {...rest}>
      {children}
    </div>
  )
}

export interface CaseCardProps extends Omit<ComponentPropsWithoutRef<"article">, "title"> {
  tag?: ReactNode
  title?: ReactNode
  prompt?: ReactNode
  mode?: ReactNode
  index?: number
}

export function CaseCard({
  tag,
  title,
  prompt,
  mode,
  className,
  children,
  style,
  index,
  ...rest
}: CaseCardProps) {
  return (
    <Panel
      as="article"
      hover="lift"
      className={cx("hds-case", className)}
      style={index != null ? ({ ...style, "--i": index } as CSSProperties) : style}
      {...rest}
    >
      <div className="hds-case-tag">{tag}</div>
      <h3>{title}</h3>
      <p>{children}</p>
      {prompt && (
        <div className="hds-case-prompt">
          <span className="hds-case-prompt-pr">›</span>
          {prompt}
        </div>
      )}
      {mode && <Badge variant="muted">{mode}</Badge>}
    </Panel>
  )
}
