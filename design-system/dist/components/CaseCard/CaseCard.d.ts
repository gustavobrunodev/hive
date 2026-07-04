import type { ComponentPropsWithoutRef, ReactNode } from "react";
import "./CaseCard.css";
export interface CaseGridProps extends ComponentPropsWithoutRef<"div"> {
}
/** Responsive grid layout container for a collection of `CaseCard`s. */
export declare function CaseGrid({ className, children, ...rest }: CaseGridProps): import("react").JSX.Element;
export interface CaseCardProps extends Omit<ComponentPropsWithoutRef<"article">, "title"> {
    /** Small category/tag label above the title. */
    tag?: ReactNode;
    /** Card heading, rendered as an `<h3>`. */
    title?: ReactNode;
    /** Optional example-prompt line rendered after `children`, prefixed with a `›` marker. Omit if this case has no sample prompt. */
    prompt?: ReactNode;
    /** Optional mode label rendered as a muted `Badge` at the end of the card. Omit if not applicable. */
    mode?: ReactNode;
    /** Position within a `CaseGrid`, used to stagger this card's CSS entrance-animation delay via the `--i` custom property. Omit for no stagger. */
    index?: number;
}
/** A `Panel`-based case-study/example card: tag, title, prose (`children`), optional sample prompt, and an optional mode badge. Typically laid out inside a `CaseGrid`. */
export declare function CaseCard({ tag, title, prompt, mode, className, children, style, index, ...rest }: CaseCardProps): import("react").JSX.Element;
