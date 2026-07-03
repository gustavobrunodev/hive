import type { ComponentPropsWithoutRef, Ref } from "react";
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";
import "./ScrollArea.css";
export type ScrollAreaProps = ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root> & {
    /** Ref to the underlying scrollable viewport element — the real `overflow: auto` node, for consumers that need to read/set scroll position (e.g. `MessageList`'s pin-to-latest behavior). */
    viewportRef?: Ref<HTMLDivElement>;
};
/**
 * A viewport with a tokenized, thumb-only scrollbar overlay — wraps Radix's
 * `ScrollArea.Root`/`Viewport`/`Scrollbar`/`Thumb`/`Corner`. Radix's
 * `Viewport` always renders with real `overflow: auto` under the hood
 * regardless of whether the custom overlay mounts, so native scrolling
 * (mouse wheel, trackpad, keyboard, touch) keeps working even if the
 * scrollbar visuals don't render (spec.md P2 AC2's "degrade to native
 * scroll when unsupported"). This layer only supplies minimal styling — a
 * thin thumb, no arrows/track chrome — per PRODUCT.md's ban on reinvented
 * scrollbars: it should read as "a slightly nicer native scrollbar," never
 * a novel widget (design.md's D1 / Radix → DS mapping).
 *
 * Ships both a vertical and a horizontal scrollbar since either axis may
 * overflow depending on content (message log vs. a wide file tree row);
 * `Corner` fills the gap between the two when both are visible. Nothing
 * here sets `overflow: hidden` on an ancestor of portalled content — only
 * `Viewport` scroll-clips its own children, so popovers/tooltips rendered
 * inside a `ScrollArea` (which portal to `document.body`) are never
 * clipped by it.
 */
export declare const ScrollArea: import("react").ForwardRefExoticComponent<Omit<ScrollAreaPrimitive.ScrollAreaProps & import("react").RefAttributes<HTMLDivElement>, "ref"> & {
    /** Ref to the underlying scrollable viewport element — the real `overflow: auto` node, for consumers that need to read/set scroll position (e.g. `MessageList`'s pin-to-latest behavior). */
    viewportRef?: Ref<HTMLDivElement>;
} & import("react").RefAttributes<HTMLDivElement>>;
