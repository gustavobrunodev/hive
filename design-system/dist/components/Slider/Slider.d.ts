import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import "./Slider.css";
export type SliderProps = React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>;
/**
 * Wraps Radix's Slider.Root/Track/Range/Thumb with DS tokens. Supports both
 * single-value and range (two-or-more-thumb) usage transparently: the number
 * of `Thumb`s rendered is derived from the length of the `value`/
 * `defaultValue` array, matching how Radix itself determines thumb count.
 * Falls back to a single thumb when neither is supplied (Radix's own
 * default: `defaultValue={[min]}`).
 */
export declare const Slider: React.ForwardRefExoticComponent<Omit<SliderPrimitive.SliderProps & React.RefAttributes<HTMLSpanElement>, "ref"> & React.RefAttributes<HTMLSpanElement>>;
