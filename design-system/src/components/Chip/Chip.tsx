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
  /** Visual/semantic category: `"tag"` (default, generic label), `"phase"` (workflow step, pairs with `active`), `"agent"` (agent/tool name), or `"skill"` (skill name, pairs with `tone`). */
  variant?: keyof typeof VARIANT_CLASS
  /** Only meaningful on `variant="phase"` — marks the current/selected phase with the accent treatment. Ignored for other variants. */
  active?: boolean
  /** Only meaningful on `variant="skill"` — pass `"he"` to apply the harness-engineer tone accent. Ignored for other variants and other tone values. */
  tone?: string
}

/**
 * Presentational label chip, purely a styled `<span>` — it has no built-in
 * dismiss/remove affordance. For a removable chip, compose your own trailing
 * button (e.g. an icon `Button`) alongside it; `Chip` itself stays static.
 */
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
