import React from "react";
import { cx } from "../../utils/cx.js";
import "./SteppedList.css";

export function SteppedList({ className, children, ...rest }) {
  return (
    <ol className={cx("hds-steps-list", className)} {...rest}>
      {children}
    </ol>
  );
}

export function SteppedListItem({ title, description, className, children, ...rest }) {
  return (
    <li className={className} {...rest}>
      <div className="hds-st-t">{title}</div>
      <div className="hds-st-d">{description}</div>
      {children}
    </li>
  );
}
