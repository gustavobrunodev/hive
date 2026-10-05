import type { ButtonHTMLAttributes, ReactNode } from "react";
import "./SourceNote.css";
/** The data source a note comes from. Each one has its own categorical colour (`--source-<fonte>-*`). */
export type SourceNoteFonte = "likert" | "voz" | "fullstory";
/** How much a Dor weighs: drawn as a word, never as a colour alone. */
export type SourceNoteImpact = "alto" | "medio" | "baixo";
export interface SourceNoteProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "title"> {
    /** Which source — picks the note's fill and ink. */
    fonte: SourceNoteFonte;
    /** The Dor, in the customer's words. Clamped to three lines. */
    title: string;
    /** The volume with its unit, already formatted ("1.932 menções"). */
    volume: ReactNode;
    /** The source's glyph, drawn beside the volume. Decorative. */
    icon?: ReactNode;
    /** The impact level, for the seal's mark. */
    impact: SourceNoteImpact;
    /** The impact as a word ("Alto"). */
    impactLabel: string;
    /** Read before the impact by assistive tech only ("Impacto"). */
    impactPrefix?: string;
    /** The change over the period: its sign picks the arrow. */
    trend: number;
    /** The change as text ("14%", "estável"). */
    trendLabel: string;
    /**
     * A note that toggles a selection (cited / not cited) passes it here; it
     * becomes `aria-pressed` and shows the check. Omit for a note that opens
     * something.
     */
    pressed?: boolean;
    /** A slight tilt, in degrees, for the sticky-note look. Zero by default. */
    tilt?: number;
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
export declare const SourceNote: import("react").ForwardRefExoticComponent<SourceNoteProps & import("react").RefAttributes<HTMLButtonElement>>;
