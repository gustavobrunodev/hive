import type { ComponentPropsWithoutRef } from "react"
import { cx } from "../../utils/cx"
import "./Logo.css"

import brainColor from "../../../assets/logos/brain_colored.svg"
import brainBlack from "../../../assets/logos/black_logo_brain.svg"
import brainWhite from "../../../assets/logos/white_logo_brain.svg"
import simpleColor from "../../../assets/logos/colored_simple_logo.svg"
import simpleBlack from "../../../assets/logos/black_logo_simple.svg"
import simpleWhite from "../../../assets/logos/white_logo_simple.svg"
import descriptionColor from "../../../assets/logos/colored_logo_with_description.svg"
import descriptionBlack from "../../../assets/logos/black_logo_with_description.svg"
import descriptionWhite from "../../../assets/logos/white_logo_with_description.svg"
import fullColor from "../../../assets/logos/full_logo.svg"

type Tone = "color" | "black" | "white"
type Mark = "brain" | "simple" | "description" | "full"

const DEFAULT_SVG = simpleColor

const SOURCES: Record<Tone, Partial<Record<Mark, string>>> = {
  color: { brain: brainColor, simple: simpleColor, description: descriptionColor, full: fullColor },
  black: { brain: brainBlack, simple: simpleBlack, description: descriptionBlack },
  white: { brain: brainWhite, simple: simpleWhite, description: descriptionWhite },
}

export interface LogoProps extends ComponentPropsWithoutRef<"span"> {
  /** Color treatment of the SVG. Default: "color". */
  tone?: Tone
  /** Which lockup to render. Not every tone has every mark (e.g. "full" is color-only); missing combinations fall back to the default simple-color mark. Default: "simple". */
  mark?: Mark
}

export function Logo({ tone = "color", mark = "simple", className, ...rest }: LogoProps) {
  const svg = SOURCES[tone]?.[mark] ?? DEFAULT_SVG
  return (
    <span
      className={cx("hds-logo", className)}
      role="img"
      aria-label="Hive"
      dangerouslySetInnerHTML={{ __html: svg }}
      {...rest}
    />
  )
}
