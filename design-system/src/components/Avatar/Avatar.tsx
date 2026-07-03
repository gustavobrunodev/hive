import * as React from "react"
import * as AvatarPrimitive from "@radix-ui/react-avatar"
import { cx } from "../../utils/cx"
import "./Avatar.css"

export type AvatarSize = "sm" | "md" | "lg"

/**
 * Pixel scale for the named sizes, mirroring Spinner's `size` convention.
 * `sm` fits dense rows (message-list avatars, mention chips), `md` is the
 * general-purpose default (chat message avatars), `lg` suits a standalone
 * profile/settings header. Pass a `number` directly for anything else.
 */
const SIZE_SCALE: Record<AvatarSize, number> = {
  sm: 24,
  md: 32,
  lg: 40,
}

export type AvatarStatus = "online" | "offline" | "away" | "busy"

const STATUS_LABEL: Record<AvatarStatus, string> = {
  online: "Online",
  offline: "Offline",
  away: "Away",
  busy: "Busy",
}

function resolveSize(size: number | AvatarSize): number {
  return typeof size === "number" ? size : SIZE_SCALE[size]
}

export type AvatarProps = {
  /** Image source. Omitted (or a failing/absent image) always falls back to `fallback`. */
  src?: string
  /** Alt text for the image. */
  alt?: string
  /** Content rendered while there's no successfully-loaded image — initials, an icon, etc. */
  fallback: React.ReactNode
  /** Named scale (`"sm" | "md" | "lg"`) or an exact pixel size. Defaults to `"md"` (32px). */
  size?: number | AvatarSize
  /**
   * Optional presence dot rendered in the bottom-right corner, tokenized to
   * `--success`/`--faint`/`--warning`/`--danger` for online/offline/away/busy.
   * Omitted entirely (no DOM node at all) when `status` isn't passed.
   */
  status?: AvatarStatus
  /**
   * Delay (ms) before the fallback is allowed to render, per Radix's
   * `Avatar.Fallback` `delayMs` prop. Defaults to `200`: long enough that an
   * image which resolves almost immediately (already cached, same-origin)
   * never flashes fallback-then-image, short enough that a missing/slow
   * image still reads as "loading" rather than a stall. Pass `0` for an
   * instant fallback when that flash isn't a concern.
   */
  delayMs?: number
  className?: string
} & Omit<React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>, "children">

/**
 * Radix-backed Avatar [R], wrapping `Root`/`Image`/`Fallback`. Generic DS
 * primitive per design.md's D4 — used for chat message avatars and any
 * other user/agent representation, not chat-specific.
 */
export const Avatar = React.forwardRef<React.ElementRef<typeof AvatarPrimitive.Root>, AvatarProps>(
  ({ src, alt, fallback, size = "md", status, delayMs = 200, className, style, ...rest }, ref) => {
    const px = resolveSize(size)

    return (
      <AvatarPrimitive.Root
        ref={ref}
        className={cx("hds-avatar", className)}
        style={{ width: px, height: px, ...style }}
        {...rest}
      >
        {src && <AvatarPrimitive.Image className="hds-avatar-image" src={src} alt={alt} />}
        <AvatarPrimitive.Fallback className="hds-avatar-fallback" delayMs={delayMs}>
          {fallback}
        </AvatarPrimitive.Fallback>
        {status && (
          <span
            className={cx("hds-avatar-status", `hds-avatar-status-${status}`)}
            role="img"
            aria-label={STATUS_LABEL[status]}
          />
        )}
      </AvatarPrimitive.Root>
    )
  }
)
Avatar.displayName = "Avatar"
