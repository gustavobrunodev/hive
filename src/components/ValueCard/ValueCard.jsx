import React from "react";
import { Panel } from "../Panel/Panel.jsx";
import { cx } from "../../utils/cx.js";
import "./ValueCard.css";

export function ValueGrid({ className, children, ...rest }) {
  return (
    <div className={cx("hds-val-grid", className)} {...rest}>
      {children}
    </div>
  );
}

export function ValueCard({ kicker, title, className, children, style, index, ...rest }) {
  return (
    <Panel
      as="article"
      className={cx("hds-val", className)}
      style={index != null ? { ...style, "--i": index } : style}
      {...rest}
    >
      <div className="hds-val-k">
        <em aria-hidden="true" />
        {kicker}
      </div>
      <h3>{title}</h3>
      <p>{children}</p>
    </Panel>
  );
}
