import React from "react";
import { cx } from "../../utils/cx.js";
import "./SectionHeading.css";

export function SectionHeading({ eyebrow, lead, id, className, children, ...rest }) {
  return (
    <div className={cx("hds-s-head", className)} {...rest}>
      {eyebrow && <span className="hds-eyebrow">{eyebrow}</span>}
      <h2 id={id}>{children}</h2>
      <div className="hds-rule" />
      {lead && <p className="hds-lead">{lead}</p>}
    </div>
  );
}
