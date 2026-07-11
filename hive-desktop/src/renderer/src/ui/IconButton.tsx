import { forwardRef } from 'react'
import type { ComponentPropsWithoutRef } from 'react'

export interface IconButtonProps extends Omit<ComponentPropsWithoutRef<'button'>, 'aria-label'> {
  /** Accessible name — required: an icon-only control must never ship nameless (DS PRODUCT.md, screen-reader support). Also used as the hover tooltip (`title`). */
  label: string
}

/**
 * Quiet 30×30 icon-only button for app chrome (theme toggle, pane actions).
 * The DS `Button` is a 48px-tall text CTA — the wrong shape for toolbar
 * chrome — so this app-level control fills the gap using the same role
 * tokens and the full state set (hover/focus-visible/active/disabled).
 */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, className, children, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      type="button"
      className={['wb-icon-btn', className].filter(Boolean).join(' ')}
      aria-label={label}
      title={label}
      {...rest}
    >
      {children}
    </button>
  )
})
