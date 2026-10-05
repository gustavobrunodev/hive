import { forwardRef } from "react"
import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react"
import { cx } from "../../utils/cx"
import "./SourceNote.css"

/** The data source a note comes from. Each one has its own categorical colour (`--source-<fonte>-*`). */
export type SourceNoteFonte = "likert" | "voz" | "fullstory"

/** How much a Dor weighs: drawn as a word, never as a colour alone. */
export type SourceNoteImpact = "alto" | "medio" | "baixo"

export interface SourceNoteProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "title"> {
  /** Which source — picks the note's fill and ink. */
  fonte: SourceNoteFonte
  /** The Dor, in the customer's words. Clamped to three lines. */
  title: string
  /** The volume with its unit, already formatted ("1.932 menções"). */
  volume: ReactNode
  /** The source's glyph, drawn beside the volume. Decorative. */
  icon?: ReactNode
  /** The impact level, for the seal's mark. */
  impact: SourceNoteImpact
  /** The impact as a word ("Alto"). */
  impactLabel: string
  /** Read before the impact by assistive tech only ("Impacto"). */
  impactPrefix?: string
  /** The change over the period: its sign picks the arrow. */
  trend: number
  /** The change as text ("14%", "estável"). */
  trendLabel: string
  /**
   * A note that toggles a selection (cited / not cited) passes it here; it
   * becomes `aria-pressed` and shows the check. Omit for a note that opens
   * something.
   */
  pressed?: boolean
  /** A slight tilt, in degrees, for the sticky-note look. Zero by default. */
  tilt?: number
}

function TrendArrow({ trend }: { trend: number }) {
  const d = trend > 0 ? "M3 9l6-6M4.5 3H9v4.5" : trend < 0 ? "M3 3l6 6M9 4.5V9H4.5" : "M2.5 6h7"
  return (
    <svg className="hds-note-trend-glyph" viewBox="0 0 12 12" width="11" height="11" aria-hidden="true">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/**
 * A Dor as a sticky note, in the colour of the source it came from — the
 * Design Studio's unit of "where it hurts".
 *
 * The fill and ink are the source's own tokens (`--source-<fonte>-bg`,
 * `--source-<fonte>-ink`), a categorical pair measured at AA in both themes,
 * so three columns of notes read as three sources at a glance. The impact is a
 * word on a seal, not a status colour: status hues on a categorical fill
 * would fight it, and colour alone says nothing to a screen reader.
 *
 * It is a `button`: a note always does something — opens the Dor, or cites it
 * (`pressed`). The focus ring is its own, because a coloured fill swallows the
 * app's default one.
 */
export const SourceNote = forwardRef<HTMLButtonElement, SourceNoteProps>(function SourceNote(
  {
    fonte,
    title,
    volume,
    icon,
    impact,
    impactLabel,
    impactPrefix,
    trend,
    trendLabel,
    pressed,
    tilt = 0,
    className,
    style,
    type = "button",
    ...rest
  },
  ref
) {
  const paint: CSSProperties & Record<"--hds-note-tilt", string> = {
    background: `var(--source-${fonte}-bg)`,
    color: `var(--source-${fonte}-ink)`,
    "--hds-note-tilt": `${tilt}deg`,
    ...style,
  }
  return (
    <button
      ref={ref}
      type={type}
      className={cx("hds-note", className)}
      data-fonte={fonte}
      aria-pressed={pressed}
      style={paint}
      {...rest}
    >
      {pressed !== undefined && (
        <span className="hds-note-check" data-on={pressed || undefined} aria-hidden="true">
          <svg viewBox="0 0 12 12" width="10" height="10">
            <path d="M2.5 6.2l2.3 2.3 4.7-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      )}
      <span className="hds-note-title">{title}</span>
      <span className="hds-note-foot">
        <span className="hds-note-volume">
          {icon && (
            <span className="hds-note-icon" aria-hidden="true">
              {icon}
            </span>
          )}
          <span>{volume}</span>
        </span>
        <span className="hds-note-impact" data-impact={impact}>
          {impactPrefix && <span className="hds-note-sr">{impactPrefix} </span>}
          {impactLabel}
        </span>
        <span className="hds-note-trend" data-trend={trend > 0 ? "up" : trend < 0 ? "down" : "flat"}>
          <TrendArrow trend={trend} />
          {trendLabel}
        </span>
      </span>
    </button>
  )
})

SourceNote.displayName = "SourceNote"
