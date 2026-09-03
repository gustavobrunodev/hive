/**
 * Keeps a scrollable element **inside a portal** scrollable while an ancestor
 * modal holds a scroll lock.
 *
 * ## The failure this exists for
 *
 * Radix's `Dialog` locks page scroll with `react-remove-scroll`, which puts a
 * non-passive `wheel` listener on `document` and calls `preventDefault()` on
 * every wheel whose target is neither inside the locked subtree nor inside one
 * of the lock's declared *shards*. `Dialog` declares exactly one shard: its own
 * `Content`.
 *
 * A `Popover` (or any other portalled surface) opened from inside that dialog
 * does **not** render into `Content` — it renders into `document.body`. So its
 * list is outside the lock, outside the shard, and every wheel event over it is
 * cancelled before the browser can scroll anything. Measured in the app's skill
 * creator: the same model picker scrolled 200px per wheel tick in the composer
 * and exactly 0 inside the dialog.
 *
 * Nothing about it looks broken — the panel is there, the scrollbar is there,
 * the keyboard still works — which is why it survived: it is invisible to the
 * DOM-level tests, and only reproducible by driving a real wheel over a real
 * popover that a real dialog happens to be holding open.
 *
 * ## The fix
 *
 * Stop the event at the scroller. The lock's handler sits on `document`, at the
 * end of the bubble path; a listener on the scrolling element itself runs first
 * and `stopPropagation()` means the document handler is never called, so
 * nothing cancels the default and the browser scrolls the element normally.
 *
 * Two properties make this safe rather than a fight with the lock:
 *
 *  - It is **passive** — it never cancels anything itself, it only declines to
 *    let a cancel happen upstream.
 *  - The element must set `overscroll-behavior: contain`, so that reaching
 *    either end does not chain the scroll to the page behind the modal — the
 *    one thing the lock was there to prevent. The lock stays fully in force for
 *    every other target on the page.
 *
 * ## Why it takes a node and not a ref
 *
 * Because a ref is a trap here, and a silent one. Radix's `Portal` renders
 * `null` on its first pass and only mounts its children after a layout effect
 * has told it the document exists — so on the commit where `open` flips true,
 * the portalled subtree is not in the DOM yet. An effect keyed on `open` reads
 * `ref.current === null`, binds nothing, and never runs again, because the
 * commit that finally creates the node changes no state this hook watches.
 * That is not a race that sometimes bites: it is the only order these two
 * things ever happen in. A callback ref hands the node over at the moment it
 * attaches, which is the only moment that is correct.
 *
 * @param node The element that actually scrolls (`overflow: auto`), or `null`
 *             while the surface is closed.
 */
export declare function useScrollLockEscape(node: HTMLElement | null): void;
