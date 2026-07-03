import type { ComponentPropsWithoutRef, ReactNode } from "react"
import { BrandMark } from "../BrandMark/BrandMark"
import { Button } from "../Button/Button"
import { cx } from "../../utils/cx"
import "./Nav.css"

export interface NavLink {
  href: string
  label: ReactNode
}

export interface NavCta {
  href: string
  label: ReactNode
}

export interface NavProps extends ComponentPropsWithoutRef<"header"> {
  brand?: ReactNode
  brandHref?: string
  links?: NavLink[]
  cta?: NavCta
}

export function Nav({
  brand,
  brandHref = "#top",
  links = [],
  cta,
  className,
  ...rest
}: NavProps) {
  return (
    <header className={cx("hds-nav", className)} {...rest}>
      <div className="wrap hds-nav-inner">
        <a className="hds-brand" href={brandHref}>
          <BrandMark className="cut-sm" /> {brand}
        </a>
        {links.length > 0 && (
          <nav className="hds-nav-links" aria-label="Navegação principal">
            {links.map((link) => (
              <a key={link.href} href={link.href}>
                {link.label}
              </a>
            ))}
          </nav>
        )}
        {cta && (
          <Button href={cta.href} className="hds-nav-cta">
            {cta.label}
          </Button>
        )}
      </div>
    </header>
  )
}
