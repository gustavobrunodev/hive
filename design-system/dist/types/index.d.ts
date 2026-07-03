import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";
export type HostProps<T extends ElementType> = ComponentPropsWithoutRef<T>;
export type PolymorphicProps<D extends ElementType> = {
    as?: ElementType;
    className?: string;
    children?: ReactNode;
} & Omit<HostProps<D>, "as" | "className" | "children">;
