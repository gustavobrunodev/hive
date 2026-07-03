import type { ComponentPropsWithoutRef } from "react"
import { cx } from "../../utils/cx"
import "./Chip.css"

const VARIANT_CLASS = {
  tag: "hds-chip-tag",
  phase: "hds-chip-phase",
  agent: "hds-chip-agent",
  skill: "hds-chip-skill",
} as const

export interface ChipProps extends ComponentPropsWithoutRef<"span"> {
  variant?: keyof typeof VARIANT_CLASS
  active?: boolean
  tone?: string
}

export function Chip({ variant = "tag", active = false, tone, className, children, ...rest }: ChipProps) {
  return (
    <span
      className={cx(
        "hds-chip",
        VARIANT_CLASS[variant],
        variant === "phase" && active && "is-active",
        variant === "skill" && tone === "he" && "tone-he",
        className
      )}
      {...rest}
    >
      {children}
    </span>
  )
}
