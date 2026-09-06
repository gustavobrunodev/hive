import { forwardRef } from "react"
import type { ComponentPropsWithoutRef, ElementRef, ReactNode } from "react"
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu"
import { cx } from "../../utils/cx"
import "./DropdownMenu.css"

/** An action menu's open/close state — wraps Radix's `DropdownMenu.Root`. */
export const DropdownMenu = DropdownMenuPrimitive.Root

export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger

export type DropdownMenuContentProps = ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>

/** The portalled menu panel — tokenized surface on `--z-dropdown`. */
export const DropdownMenuContent = forwardRef<ElementRef<typeof DropdownMenuPrimitive.Content>, DropdownMenuContentProps>(
  function DropdownMenuContent({ className, sideOffset = 6, ...rest }, ref) {
    return (
      <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.Content
          ref={ref}
          sideOffset={sideOffset}
          className={cx("hds-dropdown-menu-content", className)}
          {...rest}
        />
      </DropdownMenuPrimitive.Portal>
    )
  }
)

DropdownMenuContent.displayName = "DropdownMenuContent"

export type DropdownMenuItemProps = ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & {
  /** Tints the item as a destructive action (e.g. delete). */
  variant?: "default" | "danger"
  /**
   * Leading visual, rendered into a reserved tile that tints with the row's
   * own highlight. `aria-hidden`: an icon beside a label it duplicates is
   * noise to a screen reader, and every icon here has a label beside it.
   */
  icon?: ReactNode
  /**
   * A second line under the label, for a menu whose items are *choices*
   * rather than plain commands — two ways to do the same thing, where the
   * title alone cannot say which is which ("do workspace" vs "do computador").
   *
   * Unlike `shortcut`, this is NOT hidden from the accessible name: it is the
   * item's own content, and the distinction it carries is exactly what a
   * screen-reader user needs to pick the right row. Pass `textValue` when the
   * extra words would spoil Radix's type-ahead.
   */
  description?: ReactNode
  /**
   * Right-aligned shortcut hint (e.g. "⌘K"). Rendered `aria-hidden`: it is a
   * visual reminder of a binding, not part of what the item *is*, and folding
   * it into the accessible name turns "Recortar" into "Recortar Ctrl+X" for
   * every screen-reader user and every name-based query. Announce the binding
   * with `aria-keyshortcuts` on the item instead — that attribute takes the
   * canonical key names, which this prop (localized glyphs on macOS) is not.
   */
  shortcut?: ReactNode
}

export const DropdownMenuItem = forwardRef<ElementRef<typeof DropdownMenuPrimitive.Item>, DropdownMenuItemProps>(
  function DropdownMenuItem({ className, variant = "default", icon, description, shortcut, children, ...rest }, ref) {
    // A described row is a taller object with its own rhythm: the label stacks,
    // the icon aligns to the title rather than to the block's centre, and the
    // shortcut has to stop pretending it belongs on the second line. One flag
    // switches all of that, so a plain item keeps the single-line metrics it
    // has always had.
    const stacked = description !== undefined && description !== null && description !== false
    return (
      <DropdownMenuPrimitive.Item
        ref={ref}
        className={cx(
          "hds-dropdown-menu-item",
          stacked && "hds-dropdown-menu-item-stacked",
          variant === "danger" && "hds-dropdown-menu-item-danger",
          className,
        )}
        {...rest}
      >
        {icon && <span className="hds-dropdown-menu-item-icon" aria-hidden="true">{icon}</span>}
        {/* A plain item keeps the flat label it always had — the row IS the
            label, and consumers that pass their own icon inline rely on its
            spacing. Only a described item gains the wrapper. */}
        {stacked ? (
          <span className="hds-dropdown-menu-item-label">
            <span className="hds-dropdown-menu-item-title">{children}</span>
            <span className="hds-dropdown-menu-item-desc">{description}</span>
          </span>
        ) : (
          <span className="hds-dropdown-menu-item-label">{children}</span>
        )}
        {shortcut && <span className="hds-dropdown-menu-shortcut" aria-hidden="true">{shortcut}</span>}
      </DropdownMenuPrimitive.Item>
    )
  }
)

DropdownMenuItem.displayName = "DropdownMenuItem"

/**
 * Where a selectable item shows that it is selected.
 *
 * `"leading"` is the default and the right answer for a plain list of labels:
 * the mark sits in a reserved gutter, so the labels stay aligned whether they
 * are checked or not.
 *
 * `"trailing"` is for rows that already carry a leading visual of their own —
 * a swatch, a preview, an avatar. Stacking a selection dot to the left of one
 * puts two circles in a row and makes the reader work out which one means
 * "current"; moving the mark to the far edge keeps one meaning per position,
 * which is also what the platform menus do. It becomes a check rather than a
 * dot, because at the end of a row a dot reads as a bullet.
 */
export type DropdownMenuIndicatorPlacement = "leading" | "trailing"

/** The two selection glyphs, shared by CheckboxItem and RadioItem. */
function CheckGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 8.5l3 3 7-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function DotGlyph() {
  return (
    <svg width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden="true">
      <circle cx="4" cy="4" r="4" fill="currentColor" />
    </svg>
  )
}

/**
 * The indicator slot itself. Leading renders into the absolutely-positioned
 * gutter the item reserves; trailing is an ordinary flex child pushed to the
 * edge, so it never overlaps content and never needs a gutter.
 */
function ItemIndicatorSlot({ placement, glyph }: { placement: DropdownMenuIndicatorPlacement; glyph: "check" | "dot" }) {
  return (
    <span
      className={
        placement === "leading" ? "hds-dropdown-menu-item-indicator" : "hds-dropdown-menu-item-check"
      }
    >
      <DropdownMenuPrimitive.ItemIndicator>
        {glyph === "check" ? <CheckGlyph /> : <DotGlyph />}
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
  )
}

export type DropdownMenuCheckboxItemProps = ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.CheckboxItem> & {
  /** Which edge carries the selection mark. Default: `"leading"`. */
  indicator?: DropdownMenuIndicatorPlacement
}

export const DropdownMenuCheckboxItem = forwardRef<
  ElementRef<typeof DropdownMenuPrimitive.CheckboxItem>,
  DropdownMenuCheckboxItemProps
>(function DropdownMenuCheckboxItem({ className, children, indicator = "leading", ...rest }, ref) {
  return (
    <DropdownMenuPrimitive.CheckboxItem ref={ref} className={cx("hds-dropdown-menu-item", className)} {...rest}>
      {indicator === "leading" && <ItemIndicatorSlot placement="leading" glyph="check" />}
      {children}
      {indicator === "trailing" && <ItemIndicatorSlot placement="trailing" glyph="check" />}
    </DropdownMenuPrimitive.CheckboxItem>
  )
})

DropdownMenuCheckboxItem.displayName = "DropdownMenuCheckboxItem"

export const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup

export type DropdownMenuRadioItemProps = ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.RadioItem> & {
  /** Which edge carries the selection mark. Default: `"leading"`. */
  indicator?: DropdownMenuIndicatorPlacement
}

export const DropdownMenuRadioItem = forwardRef<ElementRef<typeof DropdownMenuPrimitive.RadioItem>, DropdownMenuRadioItemProps>(
  function DropdownMenuRadioItem({ className, children, indicator = "leading", ...rest }, ref) {
    return (
      <DropdownMenuPrimitive.RadioItem ref={ref} className={cx("hds-dropdown-menu-item", className)} {...rest}>
        {indicator === "leading" && <ItemIndicatorSlot placement="leading" glyph="dot" />}
        {children}
        {indicator === "trailing" && <ItemIndicatorSlot placement="trailing" glyph="check" />}
      </DropdownMenuPrimitive.RadioItem>
    )
  }
)

DropdownMenuRadioItem.displayName = "DropdownMenuRadioItem"

export type DropdownMenuSeparatorProps = ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>

export const DropdownMenuSeparator = forwardRef<ElementRef<typeof DropdownMenuPrimitive.Separator>, DropdownMenuSeparatorProps>(
  function DropdownMenuSeparator({ className, ...rest }, ref) {
    return <DropdownMenuPrimitive.Separator ref={ref} className={cx("hds-dropdown-menu-separator", className)} {...rest} />
  }
)

DropdownMenuSeparator.displayName = "DropdownMenuSeparator"

export type DropdownMenuLabelProps = ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label>

export const DropdownMenuLabel = forwardRef<ElementRef<typeof DropdownMenuPrimitive.Label>, DropdownMenuLabelProps>(
  function DropdownMenuLabel({ className, ...rest }, ref) {
    return <DropdownMenuPrimitive.Label ref={ref} className={cx("hds-dropdown-menu-label", className)} {...rest} />
  }
)

DropdownMenuLabel.displayName = "DropdownMenuLabel"
