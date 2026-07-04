import type { ComponentPropsWithoutRef } from "react"
import { cx } from "../../utils/cx"
import "./Table.css"

export interface TableProps extends ComponentPropsWithoutRef<"div"> {
  /**
   * Clips the wrapper's corners with the DS's signature beveled-cut style
   * (shared with `Panel`/`Terminal`/`Button`). Defaults to `true`; pass
   * `false` for a plain rectangular table.
   */
  cut?: boolean
}

/**
 * Scrollable/bordered wrapper around a plain `<table>`. Renders only the
 * `.hds-table-wrap` div and `<table>` shell — callers own `<thead>`/`<tbody>`/
 * `<tr>`/`<th>`/`<td>` markup entirely, so real table semantics (scope,
 * headers) are the consumer's responsibility.
 */
export function Table({ cut = true, className, children, ...rest }: TableProps) {
  return (
    <div className={cx("hds-table-wrap", cut && "cut", className)} {...rest}>
      <table className="hds-table">{children}</table>
    </div>
  )
}

export interface PkgProps extends ComponentPropsWithoutRef<"span"> {}

/** Bold, tabular-numeral cell treatment for a package/identifier-style value (e.g. a version or code). */
export function Pkg({ className, children, ...rest }: PkgProps) {
  return (
    <span className={cx("hds-pkg", className)} {...rest}>
      {children}
    </span>
  )
}

export interface StackProps extends ComponentPropsWithoutRef<"span"> {}

/** Semi-bold cell treatment for a stack/technology-name value. */
export function Stack({ className, children, ...rest }: StackProps) {
  return (
    <span className={cx("hds-stack", className)} {...rest}>
      {children}
    </span>
  )
}

export interface CondProps extends ComponentPropsWithoutRef<"span"> {}

/** Muted, smaller cell treatment for a secondary/conditional-detail value. */
export function Cond({ className, children, ...rest }: CondProps) {
  return (
    <span className={cx("hds-cond", className)} {...rest}>
      {children}
    </span>
  )
}
