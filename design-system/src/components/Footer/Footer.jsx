import React from "react";
import { BrandMark } from "../BrandMark/BrandMark.jsx";
import { cx } from "../../utils/cx.js";
import "./Footer.css";

export function Footer({ brand, tagline, bottomItems = [], className, ...rest }) {
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
  );
}
