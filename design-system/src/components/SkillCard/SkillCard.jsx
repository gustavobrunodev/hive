import React from "react";
import { Panel } from "../Panel/Panel.jsx";
import { PinChip } from "../PinChip/PinChip.jsx";
import { cx } from "../../utils/cx.js";
import "./SkillCard.css";

export function SkillGrid({ className, children, ...rest }) {
  return (
    <div className={cx("hds-skills", className)} {...rest}>
      {children}
    </div>
  );
}

export function SkillSpinePin({ driveLabel = "Conduz", drive = [], delegateLabel = "Delega", delegate = [] }) {
  return (
    <div className="hds-skill-spine-pin">
      {drive.length > 0 && (
        <div className="hds-pin-row">
          <span className="hds-pin-lbl">{driveLabel}</span>
          {drive.map((n) => (
            <PinChip key={n} variant="drive">
              {n}
            </PinChip>
          ))}
        </div>
      )}
      {delegate.length > 0 && (
        <div className="hds-pin-row">
          <span className="hds-pin-lbl">{delegateLabel}</span>
          {delegate.map((n) => (
            <PinChip key={n} variant="deleg">
              {n}
            </PinChip>
          ))}
        </div>
      )}
    </div>
  );
}

export function SkillCard({ role, title, lead = false, number, className, children, style, index, ...rest }) {
  return (
    <Panel
      as="article"
      hover="lift"
      accentBorder={lead}
      className={cx("hds-skill", lead && "hds-skill-lead", className)}
      style={index != null ? { ...style, "--i": index } : style}
      {...rest}
    >
      {number != null && <span className="hds-skill-num">{number}</span>}
      <div className="hds-skill-role">{role}</div>
      <h3>{title}</h3>
      {children}
    </Panel>
  );
}
