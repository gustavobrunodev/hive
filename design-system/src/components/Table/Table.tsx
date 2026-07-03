import type { ComponentPropsWithoutRef } from "react"
import { cx } from "../../utils/cx"
import "./Table.css"

export interface TableProps extends ComponentPropsWithoutRef<"div"> {
  cut?: boolean
}

export function Table({ cut = true, className, children, ...rest }: TableProps) {
  return (
    <div className={cx("hds-table-wrap", cut && "cut", className)} {...rest}>
      <table className="hds-table">{children}</table>
    </div>
  )
}

export interface PkgProps extends ComponentPropsWithoutRef<"span"> {}

export function Pkg({ className, children, ...rest }: PkgProps) {
  return (
    <span className={cx("hds-pkg", className)} {...rest}>
      {children}
    </span>
  )
}

export interface StackProps extends ComponentPropsWithoutRef<"span"> {}

export function Stack({ className, children, ...rest }: StackProps) {
  return (
    <span className={cx("hds-stack", className)} {...rest}>
      {children}
    </span>
  )
}

export interface CondProps extends ComponentPropsWithoutRef<"span"> {}

export function Cond({ className, children, ...rest }: CondProps) {
  return (
    <span className={cx("hds-cond", className)} {...rest}>
      {children}
    </span>
  )
}
