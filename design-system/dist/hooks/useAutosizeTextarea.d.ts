import { type RefObject } from "react";
export type UseAutosizeTextareaOptions = {
    minRows?: number;
    maxRows?: number;
};
/**
 * Resizes a `<textarea>` to fit its content between `minRows` and
 * `maxRows`, re-measuring on every `value` change (and on mount / element
 * resize, e.g. the textarea's width changing rewraps its lines).
 *
 * Follows `useReveal`'s ref-returning ergonomics: attach the returned ref
 * to the textarea, and pass the controlled `value` in so the effect knows
 * when content changed.
 *
 * jsdom doesn't perform real layout, so `getComputedStyle`/`scrollHeight`
 * report placeholder values there (and older environments may lack
 * `ResizeObserver` entirely) — every measurement is wrapped so a missing
 * or unusual environment degrades to a no-op instead of throwing.
 */
export declare function useAutosizeTextarea(value: string, { minRows, maxRows }?: UseAutosizeTextareaOptions): RefObject<HTMLTextAreaElement | null>;
