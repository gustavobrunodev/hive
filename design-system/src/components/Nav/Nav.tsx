import type { ComponentPropsWithoutRef, ReactNode } from "react"
import { BrandMark } from "../BrandMark/BrandMark"
import { Button } from "../Button/Button"
import { cx } from "../../utils/cx"
import "./Nav.css"

export interface NavLink {
  /** Destination URL for the link. */
  href: string
  /** Link text/content. */
  label: ReactNode
}

export interface NavCta {
  /** Destination URL; rendered via `Button`'s `href` prop (so it's an `<a>`, not a `<button>`). */
  href: string
  /** Button text/content. */
  label: ReactNode
}

export interface NavProps extends ComponentPropsWithoutRef<"header"> {
  /** Text/content next to the mark, inside the brand link. */
  brand?: ReactNode
  /** Destination for the brand link (mark + `brand`). Defaults to `"#top"`. */
  brandHref?: string
  /** Primary nav links, rendered left-to-right after the brand and before the CTA. Omit/empty hides the links row entirely (and on narrow viewports, Nav.css hides it regardless — pair with a separate mobile menu if needed). */
  links?: NavLink[]
  /** Single call-to-action button, right-aligned after the links. Omit to render no CTA. */
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
