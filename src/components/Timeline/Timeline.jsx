import React from "react";
import { Panel } from "../Panel/Panel.jsx";
import { Chip } from "../Chip/Chip.jsx";
import { cx } from "../../utils/cx.js";
import "./Timeline.css";

export function SpineLabel({ children, ...rest }) {
  return (
    <div className="hds-spine-label" {...rest}>
      <span className="hds-sw" aria-hidden="true" />
      {children}
    </div>
  );
}

export function Flow({ className, children, ...rest }) {
  return (
    <div className={cx("hds-flow", className)} {...rest}>
      {children}
    </div>
  );
}

export function Steps({ className, children, ...rest }) {
  return (
    <div className={cx("hds-steps", className)} {...rest}>
      {children}
    </div>
  );
}

export function Step({ number, title, skills = [], highlight = false, last = false, className, children, ...rest }) {
  return (
    <div className={cx("hds-step", highlight && "hds-step-he", className)} {...rest}>
      <div className="hds-rail">
        <div className="hds-node cut-sm">{number}</div>
        {!last && <div className="hds-wire" aria-hidden="true" />}
      </div>
      <Panel className="hds-step-panel" hover="slide">
        <div className="hds-ph">
          <h3>{title}</h3>
          {skills.map((skill) => (
            <Chip key={skill.label} variant="skill" tone={skill.he ? "he" : undefined}>
              {skill.label}
            </Chip>
          ))}
        </div>
        {children}
      </Panel>
    </div>
  );
}

export function Substeps({ className, children, ...rest }) {
  return (
    <div className={cx("hds-substeps", className)} {...rest}>
      {children}
    </div>
  );
}

export function Sub({ label, skill, className, children, ...rest }) {
  return (
    <div className={cx("hds-sub", "cut-sm", className)} {...rest}>
      <div className="hds-sub-lbl">{label}</div>
      <div className="hds-sub-sk">{skill}</div>
      <p>{children}</p>
    </div>
  );
}
