import type { ComponentPropsWithoutRef, ReactNode } from "react"
import { cx } from "../../utils/cx"
import "./Breadcrumb.css"

export interface BreadcrumbItemData {
  label: ReactNode
  href?: string
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
  href?: string
  onClick?: () => void
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
  items: BreadcrumbItemData[]
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
