import type { ComponentPropsWithoutRef, ReactNode } from "react"
import { cx } from "../../utils/cx"
import "./SectionHeading.css"

export type SectionHeadingProps = {
  eyebrow?: ReactNode
  lead?: ReactNode
} & ComponentPropsWithoutRef<"div">

export function SectionHeading({ eyebrow, lead, id, className, children, ...rest }: SectionHeadingProps) {
  return (
    <div className={cx("hds-s-head", className)} {...rest}>
      {eyebrow && <span className="hds-eyebrow">{eyebrow}</span>}
      <h2 id={id}>{children}</h2>
      <div className="hds-rule" />
      {lead && <p className="hds-lead">{lead}</p>}
    </div>
  )
}
