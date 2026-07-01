import React from "react";
import { cx } from "../../utils/cx.js";
import "./Panel.css";

export function Panel({
  as: Tag = "div",
  cut = true,
  hover = "none",
  accentBorder = false,
  className,
  children,
  ...rest
}) {
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
  );
}
