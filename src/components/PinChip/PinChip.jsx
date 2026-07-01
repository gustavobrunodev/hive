import React from "react";
import { cx } from "../../utils/cx.js";
import "./PinChip.css";

export function PinChip({ variant = "drive", className, children, ...rest }) {
  return (
    <span
      className={cx("hds-pin-chip", variant === "drive" ? "hds-pin-chip-drive" : "hds-pin-chip-deleg", className)}
      {...rest}
    >
      {children}
    </span>
  );
}
