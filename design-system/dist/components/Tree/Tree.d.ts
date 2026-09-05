import type { ReactNode } from "react";
import "./Tree.css";
export interface TreeNode {
    id: string;
    label: ReactNode;
    children?: TreeNode[];
    /**
     * Marks the node as a container even while `children` is empty or absent.
     *
     * "Has children right now" and "is a branch" are different questions, and
     * answering the second with the first is why an empty folder used to render
     * as a leaf: no chevron, no `aria-expanded`, and a click that did nothing at
     * all. Every file manager disagrees — an empty folder still opens, and the
     * arrow still turns — and so does any tree that loads its children lazily,
     * where nothing is known about them until the row is opened.
     */
    expandable?: boolean;
    disabled?: boolean;
}
export interface TreeRenderState {
    level: number;
    expanded: boolean;
    selected: boolean;
    /** Literal truth: this node has at least one child to show. */
    hasChildren: boolean;
    /** Whether the row behaves as a container — `hasChildren`, or `node.expandable`. */
    expandable: boolean;
}
export interface TreeProps {
    /** The hierarchy to render. */
    nodes: TreeNode[];
    /** `"single"` (default) replaces the selection on activate; `"multiple"` toggles membership. */
    selection?: "single" | "multiple";
    /** Controlled: the currently selected node ids. Pair with `onSelectedIdsChange`. */
    selectedIds?: string[];
    /** Uncontrolled initial selection. Ignored if `selectedIds` is provided. */
    defaultSelectedIds?: string[];
    /** Fires whenever the selection changes (click or Enter/Space on the active node). */
    onSelectedIdsChange?: (ids: string[]) => void;
    /** Controlled: the currently expanded node ids. Pair with `onExpandedIdsChange`. */
    expandedIds?: string[];
    /** Uncontrolled initial expansion. Ignored if `expandedIds` is provided. */
    defaultExpandedIds?: string[];
    /** Fires whenever a node is expanded or collapsed (click on the chevron or ArrowRight/ArrowLeft). */
    onExpandedIdsChange?: (ids: string[]) => void;
    /** Render-prop for a node's row content. Defaults to a chevron (if it has children) + `node.label`. */
    renderLabel?: (node: TreeNode, state: TreeRenderState) => ReactNode;
    className?: string;
    /** Accessible name for the `role="tree"` root. Provide this or `aria-labelledby`. */
    "aria-label"?: string;
    /** Accessible name reference for the `role="tree"` root, e.g. a heading id. */
    "aria-labelledby"?: string;
}
/** Modifier state derived from the triggering click/keyboard event. */
export interface ActivateMods {
    /** Ctrl/Cmd-click: toggle membership instead of replacing the selection. */
    toggle: boolean;
    /** Shift-click: replace the selection with the visible-order range from the anchor. */
    range: boolean;
}
/**
 * WAI-ARIA tree pattern: `role="tree"`/`"treeitem"`/`"group"`, roving
 * tabindex, arrow-key navigation, expand/collapse, `aria-expanded`/
 * `aria-selected`, single/multi-select. Data-driven (`nodes` prop) +
 * render-prop for row content (spec.md's P2 AC3).
 */
export declare function Tree({ nodes, selection, selectedIds: selectedIdsProp, defaultSelectedIds, onSelectedIdsChange, expandedIds: expandedIdsProp, defaultExpandedIds, onExpandedIdsChange, renderLabel, className, "aria-label": ariaLabel, "aria-labelledby": ariaLabelledBy, }: TreeProps): import("react").JSX.Element;
