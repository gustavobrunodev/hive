import type { ReactNode } from "react";
import "./OptionPicker.css";
/** Tone of a row's inline tag. Omit for the neutral treatment. */
export type OptionTagTone = "neutral" | "accent" | "success" | "warning";
export interface OptionTag {
    label: string;
    tone?: OptionTagTone;
}
/** One selectable row. Everything but `id`/`label` is optional detail. */
export interface PickerOption {
    /** Stable identity, compared against `value` and handed back to `onChange`. */
    id: string;
    /** The name, and the only part guaranteed to be shown. */
    label: string;
    /** One line of prose under the label. Wraps to at most two lines. */
    description?: string;
    /**
     * Fine print under the description, set in the mono face — for the thing
     * behind the name (a resolved id, a path, a version). Deliberately a
     * separate slot from `description`: it is evidence, not explanation, and
     * mixing the two into one sentence makes both harder to scan.
     */
    hint?: string;
    /** Right-aligned metric (a size, a count, a price). Set in the numeric face. */
    meta?: string;
    /** Small chips after the label. Two is the practical ceiling before the row gets noisy. */
    tags?: OptionTag[];
    /** Leading glyph, 20×20. Supply a real distinction; don't decorate every row alike. */
    icon?: ReactNode;
    /** Group key — must match a `PickerGroup.id` to be placed and labelled. */
    group?: string;
    /** Extra text the filter should match (aliases, vendor, ids the label hides). */
    keywords?: string;
    disabled?: boolean;
}
export interface PickerGroup {
    id: string;
    /** Header text. Omit for an unlabelled group — still a visual break. */
    label?: string;
}
export interface OptionPickerProps {
    options: PickerOption[];
    /** Group order and labels. Options whose group is missing here fall to the end, ungrouped. */
    groups?: PickerGroup[];
    /** The selected option's `id`. */
    value: string;
    onChange: (id: string) => void;
    /** The control that opens the panel. Rendered as the popover trigger via `asChild`. */
    children: ReactNode;
    /** Accessible name for the listbox — required, since the panel has no visible title. */
    ariaLabel: string;
    /**
     * Whether to show the filter field. `"auto"` (the default) shows it from
     * `searchThreshold` options up, which keeps a four-row picker from looking
     * like a search problem while a twenty-row one stays usable.
     */
    searchable?: boolean | "auto";
    searchThreshold?: number;
    searchPlaceholder?: string;
    /** Shown when the filter matches nothing. */
    emptyLabel?: string;
    /**
     * The row the consumer treats as **its default** — the one a fresh visit
     * lands on. Supplying it (together with `onPinChange`) turns on the pin
     * affordance: a toggle on every row, and the mark that says which row is
     * already the default.
     *
     * `null` is a real value ("nothing pinned"), and `undefined` means this
     * picker has no notion of a default at all — no pin control is rendered.
     */
    pinnedId?: string | null;
    /**
     * Toggles the pin. Receives the row's id when a row is pinned, and `null`
     * when the pinned row is unpinned. Required for the affordance to appear.
     */
    onPinChange?: (id: string | null) => void;
    /**
     * Heading for the hoisted pinned row. When given, the pinned row is lifted
     * out of its group into a section of its own at the top of the list — a
     * default you cannot find is not one you can trust. Omit to leave the row
     * where the catalogue put it.
     */
    pinGroupLabel?: string;
    /** Accessible name for a row's pin toggle, per state. */
    pinHint?: (label: string) => string;
    unpinHint?: (label: string) => string;
    /** Pinned above the list (a status line, a warning). */
    header?: ReactNode;
    /** Pinned below the list — the slot for a secondary control or provenance line. */
    footer?: ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    align?: "start" | "center" | "end";
    side?: "top" | "right" | "bottom" | "left";
    sideOffset?: number;
    /** Panel width in px. Defaults to 340. */
    width?: number;
    className?: string;
}
/**
 * A rich single-select: a popover of **described** rows, rather than a
 * `<select>` of bare labels.
 *
 * The difference is the point. A native select answers "which one is set?";
 * this answers "which one should I pick?" — every row carries the sentence
 * that makes it choosable (what it is good at, what it costs, what it really
 * resolves to), grouped so the recommended few sit above the long tail. That
 * is the shape a model picker needs, and a select can't hold it: options are
 * text nodes.
 *
 * Composition, not reinvention: Radix `Popover` supplies the portal, the focus
 * restore, Escape/outside-click dismiss and collision-aware placement; cmdk's
 * `Command` supplies filtering, the roving `aria-activedescendant` listbox and
 * the arrow/Enter contract. This layer supplies the row anatomy and the
 * tokenized surface.
 *
 * ## The hidden input
 *
 * cmdk binds its keyboard handling to the input, so a panel without one has no
 * arrow keys. When the list is short enough not to need a visible filter, the
 * input is still rendered — collapsed to zero height and transparent to the
 * eye, but focused — and it *unfolds* the moment the user types. So a short
 * picker looks like a menu and still answers type-ahead, and nobody types into
 * a field they can't see for longer than one keystroke.
 */
export declare function OptionPicker({ options, groups, value, onChange, children, ariaLabel, searchable, searchThreshold, searchPlaceholder, emptyLabel, pinnedId, onPinChange, pinGroupLabel, pinHint, unpinHint, header, footer, open, onOpenChange, align, side, sideOffset, width, className, }: OptionPickerProps): import("react").JSX.Element;
