import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"
import { cx } from "../../utils/cx"
import "./Slider.css"

export type SliderProps = React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>

/**
 * Wraps Radix's Slider.Root/Track/Range/Thumb with DS tokens. Supports both
 * single-value and range (two-or-more-thumb) usage transparently: the number
 * of `Thumb`s rendered is derived from the length of the `value`/
 * `defaultValue` array, matching how Radix itself determines thumb count.
 * Falls back to a single thumb when neither is supplied (Radix's own
 * default: `defaultValue={[min]}`).
 */
export const Slider = React.forwardRef<HTMLSpanElement, SliderProps>(function Slider(
  { className, value, defaultValue, ...rest },
  ref
) {
  const thumbCount = (value ?? defaultValue)?.length ?? 1

  return (
    <SliderPrimitive.Root
      ref={ref}
      className={cx("hds-slider", className)}
      value={value}
      defaultValue={defaultValue}
      {...rest}
    >
      <SliderPrimitive.Track className="hds-slider-track">
        <SliderPrimitive.Range className="hds-slider-range" />
      </SliderPrimitive.Track>
      {Array.from({ length: thumbCount }, (_, index) => (
        <SliderPrimitive.Thumb key={index} className="hds-slider-thumb" />
      ))}
    </SliderPrimitive.Root>
  )
})

Slider.displayName = "Slider"
