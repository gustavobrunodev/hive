import type { ElementType } from "react"
import type { PolymorphicProps } from "../../types/index"
import { useReveal } from "../../hooks/useReveal"
import { cx } from "../../utils/cx"

/**
 * Fades/slides a single block in once it crosses into the viewport
 * (`IntersectionObserver`, 16% threshold, fires once). Renders already
 * revealed with no observer when `prefers-reduced-motion: reduce` is set or
 * `IntersectionObserver` is unsupported. `as` picks the rendered tag
 * (defaults to `div`).
 */
export function Reveal<D extends ElementType = "div">({
  as,
  className,
  children,
  ...rest
}: PolymorphicProps<D>) {
  const Tag = (as ?? "div") as ElementType
  const [ref, isIn] = useReveal()
  return (
    <Tag ref={ref} className={cx("reveal", isIn && "in", className)} {...rest}>
      {children}
    </Tag>
  )
}

/**
 * Like `Reveal`, but staggers each direct child in with a per-item delay
 * (driven by a `--i` custom property set on each child) instead of animating
 * as a single block.
 */
export function Stagger<D extends ElementType = "div">({
  as,
  className,
  children,
  ...rest
}: PolymorphicProps<D>) {
  const Tag = (as ?? "div") as ElementType
  const [ref, isIn] = useReveal()
  return (
    <Tag ref={ref} className={cx("stagger", isIn && "in", className)} {...rest}>
      {children}
    </Tag>
  )
}
