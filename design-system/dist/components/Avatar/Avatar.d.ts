import * as React from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";
import "./Avatar.css";
export type AvatarSize = "sm" | "md" | "lg";
export type AvatarStatus = "online" | "offline" | "away" | "busy";
export type AvatarProps = {
    /** Image source. Omitted (or a failing/absent image) always falls back to `fallback`. */
    src?: string;
    /** Alt text for the image. */
    alt?: string;
    /** Content rendered while there's no successfully-loaded image — initials, an icon, etc. */
    fallback: React.ReactNode;
    /** Named scale (`"sm" | "md" | "lg"`) or an exact pixel size. Defaults to `"md"` (32px). */
    size?: number | AvatarSize;
    /**
     * Optional presence dot rendered in the bottom-right corner, tokenized to
     * `--success`/`--faint`/`--warning`/`--danger` for online/offline/away/busy.
     * Omitted entirely (no DOM node at all) when `status` isn't passed.
     */
    status?: AvatarStatus;
    /**
     * Delay (ms) before the fallback is allowed to render, per Radix's
     * `Avatar.Fallback` `delayMs` prop. Defaults to `200`: long enough that an
     * image which resolves almost immediately (already cached, same-origin)
     * never flashes fallback-then-image, short enough that a missing/slow
     * image still reads as "loading" rather than a stall. Pass `0` for an
     * instant fallback when that flash isn't a concern.
     */
    delayMs?: number;
    className?: string;
} & Omit<React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>, "children">;
/**
 * Radix-backed Avatar [R], wrapping `Root`/`Image`/`Fallback`. Generic DS
 * primitive per design.md's D4 — used for chat message avatars and any
 * other user/agent representation, not chat-specific.
 */
export declare const Avatar: React.ForwardRefExoticComponent<{
    /** Image source. Omitted (or a failing/absent image) always falls back to `fallback`. */
    src?: string;
    /** Alt text for the image. */
    alt?: string;
    /** Content rendered while there's no successfully-loaded image — initials, an icon, etc. */
    fallback: React.ReactNode;
    /** Named scale (`"sm" | "md" | "lg"`) or an exact pixel size. Defaults to `"md"` (32px). */
    size?: number | AvatarSize;
    /**
     * Optional presence dot rendered in the bottom-right corner, tokenized to
     * `--success`/`--faint`/`--warning`/`--danger` for online/offline/away/busy.
     * Omitted entirely (no DOM node at all) when `status` isn't passed.
     */
    status?: AvatarStatus;
    /**
     * Delay (ms) before the fallback is allowed to render, per Radix's
     * `Avatar.Fallback` `delayMs` prop. Defaults to `200`: long enough that an
     * image which resolves almost immediately (already cached, same-origin)
     * never flashes fallback-then-image, short enough that a missing/slow
     * image still reads as "loading" rather than a stall. Pass `0` for an
     * instant fallback when that flash isn't a concern.
     */
    delayMs?: number;
    className?: string;
} & Omit<Omit<AvatarPrimitive.AvatarProps & React.RefAttributes<HTMLSpanElement>, "ref">, "children"> & React.RefAttributes<HTMLSpanElement>>;
