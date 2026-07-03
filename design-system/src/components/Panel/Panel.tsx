import type { ComponentPropsWithoutRef, ElementType } from "react"
import { cx } from "../../utils/cx"
import "./Panel.css"

export interface PanelProps extends ComponentPropsWithoutRef<"div"> {
  as?: ElementType
  cut?: boolean
  hover?: "none" | "lift" | "slide"
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
