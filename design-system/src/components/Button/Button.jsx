import React from "react";
import { cx } from "../../utils/cx.js";
import "./Button.css";

export function Button({
  variant = "primary",
  href,
  arrow = false,
  cut = true,
  className,
  children,
  ...rest
}) {
  const classes = cx(
    "hds-btn",
    variant === "primary" ? "hds-btn-primary" : "hds-btn-ghost",
    cut && "cut-sm",
    className
  );

  const content = (
    <>
      {children}
      {arrow && (
        <span className="hds-btn-arrow" aria-hidden="true">
          →
        </span>
      )}
    </>
  );

  if (href) {
    return (
      <a className={classes} href={href} {...rest}>
        {content}
      </a>
    );
  }
  return (
    <button type="button" className={classes} {...rest}>
      {content}
    </button>
  );
}
