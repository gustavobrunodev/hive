import React from "react";
import { Chip } from "../Chip/Chip.jsx";
import { cx } from "../../utils/cx.js";
import "./Terminal.css";

export function Terminal({ title, command, output, phases = [], cut = true, className, ...rest }) {
  return (
    <div className={cx("hds-term", cut && "cut", className)} {...rest}>
      <div className="hds-term-bar">
        <i />
        <i />
        <i />
        <span>{title}</span>
      </div>
      <div className="hds-term-body">
        <div className="hds-term-line">
          <span className="hds-term-pr">›</span>
          <span className="hds-term-cmd">{command}</span>
          <span className="hds-term-cur" aria-hidden="true" />
        </div>
        {output && <p className="hds-term-out">{output}</p>}
        {phases.length > 0 && (
          <div className="hds-term-phases" aria-hidden="true">
            {phases.map((phase) => (
              <Chip key={phase.label} variant="phase" active={phase.active}>
                {phase.label}
              </Chip>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
