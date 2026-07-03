import type { ComponentPropsWithoutRef, CSSProperties, ReactNode } from "react"
import { Panel } from "../Panel/Panel"
import { PinChip } from "../PinChip/PinChip"
import { cx } from "../../utils/cx"
import "./SkillCard.css"

export interface SkillGridProps extends ComponentPropsWithoutRef<"div"> {}

export function SkillGrid({ className, children, ...rest }: SkillGridProps) {
  return (
    <div className={cx("hds-skills", className)} {...rest}>
      {children}
    </div>
  )
}

export interface SkillSpinePinProps {
  driveLabel?: ReactNode
  drive?: string[]
  delegateLabel?: ReactNode
  delegate?: string[]
}

export function SkillSpinePin({
  driveLabel = "Conduz",
  drive = [],
  delegateLabel = "Delega",
  delegate = [],
}: SkillSpinePinProps) {
  return (
    <div className="hds-skill-spine-pin">
      {drive.length > 0 && (
        <div className="hds-pin-row">
          <span className="hds-pin-lbl">{driveLabel}</span>
          {drive.map((n) => (
            <PinChip key={n} variant="drive">
              {n}
            </PinChip>
          ))}
        </div>
      )}
      {delegate.length > 0 && (
        <div className="hds-pin-row">
          <span className="hds-pin-lbl">{delegateLabel}</span>
          {delegate.map((n) => (
            <PinChip key={n} variant="deleg">
              {n}
            </PinChip>
          ))}
        </div>
      )}
    </div>
  )
}

export interface SkillCardProps extends Omit<ComponentPropsWithoutRef<"article">, "title" | "role"> {
  role?: ReactNode
  title?: ReactNode
  lead?: boolean
  number?: ReactNode
  index?: number
}

export function SkillCard({
  role,
  title,
  lead = false,
  number,
  className,
  children,
  style,
  index,
  ...rest
}: SkillCardProps) {
  return (
    <Panel
      as="article"
      hover="lift"
      accentBorder={lead}
      className={cx("hds-skill", lead && "hds-skill-lead", className)}
      style={index != null ? ({ ...style, "--i": index } as CSSProperties) : style}
      {...rest}
    >
      {number != null && <span className="hds-skill-num">{number}</span>}
      <div className="hds-skill-role">{role}</div>
      <h3>{title}</h3>
      {children}
    </Panel>
  )
}
