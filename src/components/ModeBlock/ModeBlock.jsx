import React from "react";
import { Panel } from "../Panel/Panel.jsx";
import { cx } from "../../utils/cx.js";
import "./ModeBlock.css";

export function ModeSplit({ className, children, ...rest }) {
  return (
    <div className={cx("hds-modes-split", className)} {...rest}>
      {children}
    </div>
  );
}

export function ModeBlock({ label, title, primary = false, items = [], className, children, ...rest }) {
  return (
    <Panel as="article" accentBorder={primary} className={cx("hds-mode-block", className)} {...rest}>
      <div className="hds-mode-lbl">{label}</div>
      <h3>{title}</h3>
      <p>{children}</p>
      {items.length > 0 && (
        <ul>
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
