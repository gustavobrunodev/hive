import type { ComponentPropsWithoutRef, ElementType } from "react"
import { cx } from "../../utils/cx"
import "./Panel.css"

export interface PanelProps extends ComponentPropsWithoutRef<"div"> {
  /** Element/component to render as the root tag (e.g. `"article"`, `"section"`). Defaults to `"div"`. */
  as?: ElementType
  /** Renders the brand's diagonal cut-corner motif (`.cut`). Defaults to `true` — a brand-register signature; keep `false` for dense product UI chrome. */
  cut?: boolean
  /** Adds a hover transition: `"lift"` translates the panel up, `"slide"` translates it sideways. `"none"` (default) is static. */
  hover?: "none" | "lift" | "slide"
  /** Applies a subtle warm accent border color instead of the default neutral `--border`. Off by default. */
  accentBorder?: boolean
}

export function Panel({
  as: Tag = "div",
  cut = true,
  hover = "none",
  accentBorder = false,
  className,
  children,
  ...rest
}: PanelProps) {
  return (
    <Tag
      className={cx(
        "hds-panel",
        cut && "cut",
        accentBorder && "hds-panel-accent-border",
        hover !== "none" && "hds-panel-interactive",
        hover === "lift" && "hds-panel-hover-lift",
        hover === "slide" && "hds-panel-hover-slide",
        className
      )}
      {...rest}
    >
      {children}
    </Tag>
  )
}
