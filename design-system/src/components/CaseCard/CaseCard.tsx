import type { ComponentPropsWithoutRef, CSSProperties, ReactNode } from "react"
import { Panel } from "../Panel/Panel.jsx"
import { Badge } from "../Badge/Badge.jsx"
import { cx } from "../../utils/cx"
import "./CaseCard.css"

export interface CaseGridProps extends ComponentPropsWithoutRef<"div"> {}

/** Responsive grid layout container for a collection of `CaseCard`s. */
export function CaseGrid({ className, children, ...rest }: CaseGridProps) {
  return (
    <div className={cx("hds-cases", className)} {...rest}>
      {children}
    </div>
  )
}

export interface CaseCardProps extends Omit<ComponentPropsWithoutRef<"article">, "title"> {
  /** Small category/tag label above the title. */
  tag?: ReactNode
  /** Card heading, rendered as an `<h3>`. */
  title?: ReactNode
  /** Optional example-prompt line rendered after `children`, prefixed with a `›` marker. Omit if this case has no sample prompt. */
  prompt?: ReactNode
  /** Optional mode label rendered as a muted `Badge` at the end of the card. Omit if not applicable. */
  mode?: ReactNode
  /** Position within a `CaseGrid`, used to stagger this card's CSS entrance-animation delay via the `--i` custom property. Omit for no stagger. */
  index?: number
}

/** A `Panel`-based case-study/example card: tag, title, prose (`children`), optional sample prompt, and an optional mode badge. Typically laid out inside a `CaseGrid`. */
export function CaseCard({
  tag,
  title,
  prompt,
  mode,
  className,
  children,
  style,
  index,
  ...rest
}: CaseCardProps) {
  return (
    <Panel
      as="article"
      hover="lift"
      className={cx("hds-case", className)}
      style={index != null ? ({ ...style, "--i": index } as CSSProperties) : style}
      {...rest}
    >
      <div className="hds-case-tag">{tag}</div>
      <h3>{title}</h3>
      <p>{children}</p>
      {prompt && (
        <div className="hds-case-prompt">
          <span className="hds-case-prompt-pr">›</span>
          {prompt}
        </div>
      )}
      {mode && <Badge variant="muted">{mode}</Badge>}
    </Panel>
  )
}
