import type { ElementType } from "react"
import type { PolymorphicProps } from "../../types/index"
import { useReveal } from "../../hooks/useReveal"
import { cx } from "../../utils/cx"

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
