import { forwardRef } from "react"
import type { ComponentPropsWithoutRef, ElementRef } from "react"
import * as AccordionPrimitive from "@radix-ui/react-accordion"
import { cx } from "../../utils/cx"
import "./Accordion.css"

export type AccordionProps = ComponentPropsWithoutRef<typeof AccordionPrimitive.Root>

/**
 * A vertically-stacked set of collapsible sections — wraps Radix's
 * `Accordion.Root`. `type` (`"single" | "multiple"`) has no implicit
 * default in Radix and is left required here so a consumer always makes an
 * explicit choice between "one section open at a time" and "any number open
 * simultaneously"; `collapsible`/`value`/`defaultValue`/`onValueChange` pass
 * straight through. Roving-tabindex keyboard nav between triggers
 * (ArrowUp/ArrowDown/Home/End) is delegated to Radix (design.md's D1).
 */
export const Accordion = forwardRef<ElementRef<typeof AccordionPrimitive.Root>, AccordionProps>(
  function Accordion({ className, ...rest }, ref) {
    return <AccordionPrimitive.Root ref={ref} className={cx("hds-accordion", className)} {...rest} />
  }
)

Accordion.displayName = "Accordion"

export type AccordionItemProps = ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>

/** A single collapsible section. `disabled` removes the item's trigger from interaction and the tab order (Radix sets the native `disabled` attribute). */
export const AccordionItem = forwardRef<ElementRef<typeof AccordionPrimitive.Item>, AccordionItemProps>(
  function AccordionItem({ className, ...rest }, ref) {
    return <AccordionPrimitive.Item ref={ref} className={cx("hds-accordion-item", className)} {...rest} />
  }
)

AccordionItem.displayName = "AccordionItem"

export type AccordionTriggerProps = ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger>

/**
 * The always-visible header of an `AccordionItem` — wraps Radix's
 * `Accordion.Header` + `Accordion.Trigger`. Renders a trailing chevron that
 * rotates 180° on `data-state="open"`.
 */
export const AccordionTrigger = forwardRef<ElementRef<typeof AccordionPrimitive.Trigger>, AccordionTriggerProps>(
  function AccordionTrigger({ className, children, ...rest }, ref) {
    return (
      <AccordionPrimitive.Header className="hds-accordion-header">
        <AccordionPrimitive.Trigger ref={ref} className={cx("hds-accordion-trigger", className)} {...rest}>
          <span className="hds-accordion-trigger-text">{children}</span>
          <svg
            className="hds-accordion-chevron"
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
          >
            <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </AccordionPrimitive.Trigger>
      </AccordionPrimitive.Header>
    )
  }
)

AccordionTrigger.displayName = "AccordionTrigger"

export type AccordionContentProps = ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>

/**
 * The collapsible body of an `AccordionItem` — wraps Radix's
 * `Accordion.Content`. Radix unmounts the content from the DOM once the
 * close animation finishes, so a closed item's content is not just hidden,
 * it is absent. Height is animated from `0` to Radix's
 * `--radix-accordion-content-height` custom property (the standard Radix
 * height-transition technique); an inner wrapper carries the padding so the
 * padding box never fights the animated height. `prefers-reduced-motion:
 * reduce` collapses the animation to near-zero duration for an instant
 * show/hide instead of an animated height (Accordion.css).
 */
export const AccordionContent = forwardRef<ElementRef<typeof AccordionPrimitive.Content>, AccordionContentProps>(
  function AccordionContent({ className, children, ...rest }, ref) {
    return (
      <AccordionPrimitive.Content ref={ref} className={cx("hds-accordion-content", className)} {...rest}>
        <div className="hds-accordion-content-inner">{children}</div>
      </AccordionPrimitive.Content>
    )
  }
)

AccordionContent.displayName = "AccordionContent"
