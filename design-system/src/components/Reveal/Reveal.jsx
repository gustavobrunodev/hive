import React from "react";
import { useReveal } from "../../hooks/useReveal.js";
import { cx } from "../../utils/cx.js";

export function Reveal({ as: Tag = "div", className, children, ...rest }) {
  const [ref, isIn] = useReveal();
  return (
    <Tag ref={ref} className={cx("reveal", isIn && "in", className)} {...rest}>
      {children}
    </Tag>
  );
}

export function Stagger({ as: Tag = "div", className, children, ...rest }) {
  const [ref, isIn] = useReveal();
  return (
    <Tag ref={ref} className={cx("stagger", isIn && "in", className)} {...rest}>
      {children}
    </Tag>
  );
}
