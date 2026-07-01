import React from "react";
import { cx } from "../../utils/cx.js";
import "./Badge.css";

export function Badge({ variant = "accent", className, children, ...rest }) {
  return (
    <span
      className={cx("hds-badge", variant === "accent" ? "hds-badge-accent" : "hds-badge-muted", className)}
      {...rest}
    >
      {children}
    </span>
  );
}
