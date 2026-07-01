import React from "react";
import { cx } from "../../utils/cx.js";
import "./BrandMark.css";

export function BrandMark({ letter = "Z", className }) {
  return (
    <span className={cx("hds-zmark", className)}>
      <span>{letter}</span>
    </span>
  );
}
