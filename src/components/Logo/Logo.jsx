import React from "react";
import { cx } from "../../utils/cx.js";
import "./Logo.css";

import brainColor from "../../../assets/logos/brain_colored.svg";
import brainBlack from "../../../assets/logos/black_logo_brain.svg";
import brainWhite from "../../../assets/logos/white_logo_brain.svg";
import simpleColor from "../../../assets/logos/colored_simple_logo.svg";
import simpleBlack from "../../../assets/logos/black_logo_simple.svg";
import simpleWhite from "../../../assets/logos/white_logo_simple.svg";
import descriptionColor from "../../../assets/logos/colored_logo_with_description.svg";
import descriptionBlack from "../../../assets/logos/black_logo_with_description.svg";
import descriptionWhite from "../../../assets/logos/white_logo_with_description.svg";
import fullColor from "../../../assets/logos/full_logo.svg";

const SOURCES = {
  color: { brain: brainColor, simple: simpleColor, description: descriptionColor, full: fullColor },
  black: { brain: brainBlack, simple: simpleBlack, description: descriptionBlack },
  white: { brain: brainWhite, simple: simpleWhite, description: descriptionWhite },
};

export function Logo({ tone = "color", mark = "simple", className, ...rest }) {
  const svg = SOURCES[tone]?.[mark] ?? SOURCES.color.simple;
  return (
    <span
      className={cx("hds-logo", className)}
      role="img"
      aria-label="Hive"
      dangerouslySetInnerHTML={{ __html: svg }}
      {...rest}
    />
  );
}
