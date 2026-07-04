import type { ComponentPropsWithoutRef, ReactNode } from "react"
import { cx } from "../../utils/cx"
import "./Breadcrumb.css"

export interface BreadcrumbItemData {
  /** Segment text/content. */
  label: ReactNode
  /** Renders the segment as an `<a>`. Ignored on the trailing (current) item. */
  href?: string
  /** Renders the segment as a `<button>` instead of a static `<span>`; mutually exclusive with `href` in practice (href wins if both are set). */
  onClick?: () => void
}

const ELLIPSIS = Symbol("hds-breadcrumb-ellipsis")

type CollapsedEntry = BreadcrumbItemData | typeof ELLIPSIS

/**
 * Collapses the middle of a deep item list into a single, non-interactive
 * ellipsis segment while always preserving the first and last item.
 *
 * When collapsing kicks in (`items.length > maxItems`), the total number of
 * rendered segments — first item + ellipsis + trailing items — is capped at
 * `maxItems` (minimum: first, ellipsis, last).
 */
function collapseItems(items: BreadcrumbItemData[], maxItems?: number): CollapsedEntry[] {
  const first = items[0]
  if (!maxItems || items.length <= maxItems || !first) {
    return items
  }

  const tailCount = Math.max(maxItems - 2, 1)
  const tail = items.slice(items.length - tailCount)
  return [first, ELLIPSIS, ...tail]
}

export interface BreadcrumbItemProps extends Omit<ComponentPropsWithoutRef<"span">, "onClick"> {
  /** Renders as `<a href>` instead of a static `<span>`. */
  href?: string
  /** Renders as `<button type="button">` instead of a static `<span>`. */
  onClick?: () => void
  /** Marks this segment as the trailing, non-interactive page you're on: sets `aria-current="page"` and always renders a `<span>` regardless of `href`/`onClick`. */
  current?: boolean
}

export function BreadcrumbItem({
  href,
  onClick,
  current = false,
  className,
  children,
  ...rest
}: BreadcrumbItemProps) {
  const classes = cx("hds-breadcrumb-segment", current && "is-current", className)

  if (current) {
    return (
      <span className={classes} aria-current="page" {...rest}>
        {children}
      </span>
    )
  }

  if (href) {
    return (
      <a className={classes} href={href}>
        {children}
      </a>
    )
  }

  if (onClick) {
    return (
      <button type="button" className={classes} onClick={onClick}>
        {children}
      </button>
    )
  }

  return (
    <span className={classes} {...rest}>
      {children}
    </span>
  )
}

export interface BreadcrumbProps extends Omit<ComponentPropsWithoutRef<"nav">, "children"> {
  /** Ordered trail from root to current page. The last entry always renders as the current segment (`aria-current="page"`), regardless of whether it has `href`/`onClick`. */
  items: BreadcrumbItemData[]
  /** Caps the number of rendered segments (first + ellipsis + trailing items) once `items.length` exceeds it; the first and last items are always preserved. Omit for no truncation. */
  maxItems?: number
}

export function Breadcrumb({ items, maxItems, className, ...rest }: BreadcrumbProps) {
  const entries = collapseItems(items, maxItems)
  const lastIndex = entries.length - 1

  return (
    <nav aria-label="Breadcrumb" className={cx("hds-breadcrumb", className)} {...rest}>
      <ol className="hds-breadcrumb-list">
        {entries.map((entry, index) => {
          const isLast = index === lastIndex

          if (entry === ELLIPSIS) {
            return (
              <li key="hds-breadcrumb-ellipsis" className="hds-breadcrumb-item">
                <span className="hds-breadcrumb-ellipsis" aria-hidden="true">
                  …
                </span>
              </li>
            )
          }

          return (
            <li key={index} className="hds-breadcrumb-item">
              <BreadcrumbItem href={entry.href} onClick={entry.onClick} current={isLast}>
                {entry.label}
              </BreadcrumbItem>
              {!isLast && (
                <span className="hds-breadcrumb-separator" aria-hidden="true">
                  /
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
