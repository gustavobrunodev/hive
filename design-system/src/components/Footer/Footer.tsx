import type { ComponentPropsWithoutRef, ReactNode } from "react"
import { BrandMark } from "../BrandMark/BrandMark"
import { cx } from "../../utils/cx"
import "./Footer.css"

export interface FooterProps extends ComponentPropsWithoutRef<"footer"> {
  /** Content rendered next to the internal `BrandMark`, e.g. the product name. */
  brand?: ReactNode
  /** Short (≤42ch) supporting line shown beside the brand block. */
  tagline?: ReactNode
  /** Legal/utility links or text rendered in the bottom row. Omitted or empty hides the row entirely. Default: `[]`. */
  bottomItems?: ReactNode[]
}

export function Footer({ brand, tagline, bottomItems = [], className, ...rest }: FooterProps) {
  return (
    <footer className={cx("hds-ft", className)} {...rest}>
      <div className="wrap">
        <div className="hds-ft-top">
          <div className="hds-ft-brand">
            <BrandMark className="cut-sm" /> {brand}
          </div>
          <p className="hds-ft-tag">{tagline}</p>
        </div>
        {bottomItems.length > 0 && (
          <div className="hds-ft-bottom">
            {bottomItems.map((item, i) => (
              <span key={i}>{item}</span>
            ))}
          </div>
        )}
      </div>
    </footer>
  )
}
