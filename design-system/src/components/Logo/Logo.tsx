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
import lockupBlack from "../../../assets/logos/black_logo_lockup.svg"
import lockupWhite from "../../../assets/logos/white_logo_lockup.svg"
import lockupCurrent from "../../../assets/logos/current_logo_lockup.svg"
import markBlack from "../../../assets/logos/black_logo_mark.svg"
import markWhite from "../../../assets/logos/white_logo_mark.svg"
import markCurrent from "../../../assets/logos/current_logo_mark.svg"

type Tone = "color" | "black" | "white" | "current"
type Mark = "brain" | "simple" | "description" | "full" | "lockup" | "mark"

const DEFAULT_SVG = simpleColor

const SOURCES: Record<Tone, Partial<Record<Mark, string>>> = {
  color: { brain: brainColor, simple: simpleColor, description: descriptionColor, full: fullColor },
  black: {
    brain: brainBlack,
    simple: simpleBlack,
    description: descriptionBlack,
    lockup: lockupBlack,
    mark: markBlack,
  },
  white: {
    brain: brainWhite,
    simple: simpleWhite,
    description: descriptionWhite,
    lockup: lockupWhite,
    mark: markWhite,
  },
  current: { lockup: lockupCurrent, mark: markCurrent },
}

export interface LogoProps extends ComponentPropsWithoutRef<"span"> {
  /**
   * Color treatment of the SVG. `"current"` inherits the CSS `color` of its
   * container — the only tone that follows a theme without the caller
   * rendering one lockup per theme and hiding the wrong one. Default: "color".
   */
  tone?: Tone
  /**
   * Which lockup to render.
   *
   * `"lockup"` is the horizontal mark-then-wordmark arrangement for app chrome
   * (a title bar has height to spare in width, not in height); `"mark"` is the
   * symbol alone. Both are cropped to the artwork, so a CSS height sets the
   * rendered height — unlike the delivered `brain`/`simple`/`description`
   * stacks, which sit on a 1408×768 canvas the artwork fills only ~20% of.
   *
   * Not every tone has every mark (e.g. `"full"` is color-only); missing
   * combinations fall back to the default simple-color mark. Default: "simple".
   */
  mark?: Mark
}

export function Logo({ tone = "color", mark = "simple", className, ...rest }: LogoProps) {
  const svg = SOURCES[tone]?.[mark] ?? DEFAULT_SVG
  return (
    <span
      className={cx("hds-logo", className)}
      // Lets CSS reach the two groups of the `current` lockups without the
      // caller writing a descendant selector per surface (see Logo.css).
      data-tone={tone}
      role="img"
      aria-label="Hive"
      dangerouslySetInnerHTML={{ __html: svg }}
      {...rest}
    />
  )
}
