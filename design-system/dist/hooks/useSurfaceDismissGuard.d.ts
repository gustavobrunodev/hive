import type { Ref } from "react";
/**
 * Keeps a modal surface from dismissing itself when the click was **on the
 * surface**.
 *
 * ## The failure this exists for
 *
 * Open a `DropdownMenu` inside a `Dialog` — the agent selector in the Skill
 * Studio's "Nova skill" form — and click the trigger a second time to close
 * it. The menu closes *and the whole dialog goes with it*, taking the briefing
 * being typed. Measured in the real app, not deduced:
 *
 * ```
 * while menu open → body: none · dialog content: none · overlay: auto
 *                   elementFromPoint(pill) = div.hds-dialog-overlay
 * ```
 *
 * Four independent facts compose into it:
 *
 *  1. Radix's `DropdownMenu` is **modal by default**: while open it sets
 *     `body { pointer-events: none }` and, as the highest dismissable layer,
 *     forces `pointer-events: none` onto the dialog content underneath it.
 *  2. Radix's `Dialog.Overlay` hardcodes `pointer-events: auto`. With the
 *     content disabled, the overlay is what the hit-test finds — so a click
 *     aimed at a control *inside* the dialog is delivered as a click
 *     **outside** the dialog's layer node.
 *  3. `@radix-ui/react-dialog` asks for `deferPointerDownOutside`, so the
 *     dismiss decision is not made on `pointerdown` — it is postponed to the
 *     `click` that follows.
 *  4. By then the menu has closed, and `react-dismissable-layer`'s cleanup has
 *     already removed it from `layersWithOutsidePointerEventsDisabled`. The
 *     dialog is the highest such layer again, its own guard passes, and it
 *     dismisses.
 *
 * Each step is reasonable alone. Together they mean *any* dialog hosting a
 * modal popover has a region — its own body — where a click closes it.
 *
 * It is invisible to synthetic tests: `locator.click()` presses and releases
 * inside one tick, before React has flushed the closing menu's layer cleanup,
 * so the deferred check still sees the dialog as covered and declines. Only a
 * gesture with a real gap between `pointerdown` and `click` — which is every
 * human click — reaches step 4.
 *
 * ## The fix
 *
 * A pointer-down whose coordinates land inside the surface's own box is not an
 * outside interaction, whatever the hit-test says it landed on. Preventing the
 * event's default is what `DismissableLayer` reads before calling `onDismiss`,
 * so the surface stays and the legitimate gesture — a click on the overlay
 * *beside* the surface — still closes it.
 *
 * Geometry rather than `contains(target)`: the target genuinely is the overlay,
 * which genuinely is outside the content, so no ancestor test can tell the two
 * cases apart. Where the pointer was can.
 *
 * @param forwarded The consumer's ref for the same node, composed in so the
 *                  surface keeps handing its element out.
 */
export declare function useSurfaceDismissGuard<T extends HTMLElement>(forwarded: Ref<T> | undefined): {
    /** Callback ref for the surface node — pass as the content's `ref`. */
    ref: (node: T | null) => void;
    /** Pass as the content's `onPointerDownOutside` (composed with the consumer's). */
    onPointerDownOutside: (event: OutsideInteractionEvent) => void;
};
/**
 * The shape both of Radix's outside-interaction events share, described
 * structurally so this hook does not import from a package the design system
 * only depends on transitively.
 */
export interface OutsideInteractionEvent {
    detail: {
        originalEvent: {
            clientX: number;
            clientY: number;
        };
    };
    preventDefault: () => void;
}
