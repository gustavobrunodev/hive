import type { ComponentPropsWithoutRef, ReactNode } from "react"
import { cx } from "../../utils/cx"
import "./SectionHeading.css"

export type SectionHeadingProps = {
  /** Small label rendered above the heading (e.g. a section kicker). Omitted entirely when not provided — no empty slot is reserved. */
  eyebrow?: ReactNode
  /** Supporting paragraph rendered below the rule, capped at a readable measure (~60ch). Omitted entirely when not provided. */
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
