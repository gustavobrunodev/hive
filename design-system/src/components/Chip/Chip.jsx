import React from "react";
import { cx } from "../../utils/cx.js";
import "./Chip.css";

const VARIANT_CLASS = {
  tag: "hds-chip-tag",
  phase: "hds-chip-phase",
  agent: "hds-chip-agent",
  skill: "hds-chip-skill",
};

export function Chip({ variant = "tag", active = false, tone, className, children, ...rest }) {
  return (
    <span
      className={cx(
        "hds-chip",
        VARIANT_CLASS[variant],
        variant === "phase" && active && "is-active",
        variant === "skill" && tone === "he" && "tone-he",
        className
      )}
      {...rest}
    >
      {children}
    </span>
  );
}
