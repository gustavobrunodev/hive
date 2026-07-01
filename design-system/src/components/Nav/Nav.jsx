import React from "react";
import { BrandMark } from "../BrandMark/BrandMark.jsx";
import { Button } from "../Button/Button.jsx";
import { cx } from "../../utils/cx.js";
import "./Nav.css";

export function Nav({ brand, brandHref = "#top", links = [], cta, className, ...rest }) {
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
  );
}
