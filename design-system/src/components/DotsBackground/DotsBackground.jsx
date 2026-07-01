import React from "react";
import { cx } from "../../utils/cx.js";

export function DotsBackground({ className, ...rest }) {
  return <div className={cx("dots", className)} aria-hidden="true" {...rest} />;
}
