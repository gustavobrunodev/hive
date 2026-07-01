import React from "react";
import { Panel } from "../Panel/Panel.jsx";
import { Badge } from "../Badge/Badge.jsx";
import { cx } from "../../utils/cx.js";
import "./CaseCard.css";

export function CaseGrid({ className, children, ...rest }) {
  return (
    <div className={cx("hds-cases", className)} {...rest}>
      {children}
    </div>
  );
}

export function CaseCard({ tag, title, prompt, mode, className, children, style, index, ...rest }) {
  return (
    <Panel
      as="article"
      hover="lift"
      className={cx("hds-case", className)}
      style={index != null ? { ...style, "--i": index } : style}
      {...rest}
    >
      <div className="hds-case-tag">{tag}</div>
      <h3>{title}</h3>
      <p>{children}</p>
      {prompt && (
        <div className="hds-case-prompt">
          <span className="hds-case-prompt-pr">›</span>
          {prompt}
        </div>
      )}
      {mode && <Badge variant="muted">{mode}</Badge>}
    </Panel>
  );
}
