import React from "react";
import { cx } from "../../utils/cx.js";
import "./Table.css";

export function Table({ cut = true, className, children, ...rest }) {
  return (
    <div className={cx("hds-table-wrap", cut && "cut", className)} {...rest}>
      <table className="hds-table">{children}</table>
    </div>
  );
}

export function Pkg({ className, children, ...rest }) {
  return (
    <span className={cx("hds-pkg", className)} {...rest}>
      {children}
    </span>
  );
}

export function Stack({ className, children, ...rest }) {
  return (
    <span className={cx("hds-stack", className)} {...rest}>
      {children}
    </span>
  );
}

export function Cond({ className, children, ...rest }) {
  return (
    <span className={cx("hds-cond", className)} {...rest}>
      {children}
    </span>
  );
}
