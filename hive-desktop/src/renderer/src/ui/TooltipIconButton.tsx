import { forwardRef } from 'react'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@hive/design-system'

export interface TooltipIconButtonProps extends Omit<
  ComponentPropsWithoutRef<'button'>,
  'aria-label' | 'title'
> {
  /** Accessible name — required: an icon-only control must never ship nameless. */
  label: string
  /**
   * Tooltip text, when it should differ from the accessible name. Defaults to
   * `label`, which is the right answer nearly always: a hint that contradicts
   * the name is two different promises about one button.
   */
  hint?: string
  /** Marks the control as the one whose surface is currently on screen. */
  active?: boolean
  children: ReactNode
}

/**
 * An icon-only chrome button with a **real** tooltip.
 *
 * `IconButton` uses the native `title` attribute, which is right for the dense
 * pane toolbars it was built for — it costs nothing and never portals. The
 * navbar is the opposite case: four controls with no text at all, on the
 * surface a first-time user meets first, where the ~1s browser delay and the
 * unstyled OS bubble are exactly the "Electron-app jank" PRODUCT.md lists as
 * an anti-reference. The DS `Tooltip` opens in 350ms, is themed, and — the
 * part `title` cannot do — appears on **keyboard focus** too.
 *
 * Deliberately no `title`: both would fire, and the native one would sit on
 * top of the styled one a second later.
 *
 * Requires a `TooltipProvider` ancestor (the workbench mounts one around the
 * navbar) so a hand sweeping the row doesn't restart the delay per button.
 */
export const TooltipIconButton = forwardRef<HTMLButtonElement, TooltipIconButtonProps>(
  function TooltipIconButton({ label, hint, active, className, children, ...rest }, ref) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            ref={ref}
            type="button"
            className={['wb-icon-btn', className].filter(Boolean).join(' ')}
            aria-label={label}
            data-active={active || undefined}
            {...rest}
          >
            {children}
          </button>
        </TooltipTrigger>
        <TooltipContent>{hint ?? label}</TooltipContent>
      </Tooltip>
    )
  }
)
