import React from "react";
import { cx } from "../../utils/cx.js";
import "./Callout.css";

export function Callout({ variant = "limits", label = "Gate", icon = "!", cut = false, className, children, ...rest }) {
  if (variant === "gate") {
    return (
      <div className={cx("hds-callout", "hds-callout-gate", className)} {...rest}>
        <b className="hds-callout-label">{label}</b>
        <span>{children}</span>
      </div>
    );
  }
  return (
    <div className={cx("hds-callout", "hds-callout-limits", cut && "cut-sm", className)} {...rest}>
      <span className="hds-callout-icon" aria-hidden="true">
        {icon}
      </span>
      <p>{children}</p>
    </div>
  );
}
