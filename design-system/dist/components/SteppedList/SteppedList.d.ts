import type { ComponentPropsWithoutRef, ReactNode } from "react";
import "./SteppedList.css";
export interface SteppedListProps extends ComponentPropsWithoutRef<"ol"> {
}
export declare function SteppedList({ className, children, ...rest }: SteppedListProps): import("react").JSX.Element;
export interface SteppedListItemProps extends Omit<ComponentPropsWithoutRef<"li">, "title"> {
    title?: ReactNode;
    description?: ReactNode;
}
export declare function SteppedListItem({ title, description, className, children, ...rest }: SteppedListItemProps): import("react").JSX.Element;
