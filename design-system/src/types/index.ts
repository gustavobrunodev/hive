import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react"

// Props that spread onto a host element of tag T, plus children/className already implied.
export type HostProps<T extends ElementType> = ComponentPropsWithoutRef<T>

// Polymorphic component props: `as` chooses the rendered element (default D).
export type PolymorphicProps<D extends ElementType> = {
  as?: ElementType
  className?: string
  children?: ReactNode
} & Omit<HostProps<D>, "as" | "className" | "children">
