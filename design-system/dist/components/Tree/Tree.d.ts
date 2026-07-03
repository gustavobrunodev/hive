import type { ReactNode } from "react";
import "./Tree.css";
export interface TreeNode {
    id: string;
    label: ReactNode;
    children?: TreeNode[];
    disabled?: boolean;
}
export interface TreeRenderState {
    level: number;
    expanded: boolean;
    selected: boolean;
    hasChildren: boolean;
}
export interface TreeProps {
    /** The hierarchy to render. */
    nodes: TreeNode[];
    /** `"single"` (default) replaces the selection on activate; `"multiple"` toggles membership. */
    selection?: "single" | "multiple";
    selectedIds?: string[];
    defaultSelectedIds?: string[];
    onSelectedIdsChange?: (ids: string[]) => void;
    expandedIds?: string[];
    defaultExpandedIds?: string[];
    onExpandedIdsChange?: (ids: string[]) => void;
    /** Render-prop for a node's row content. Defaults to a chevron (if it has children) + `node.label`. */
    renderLabel?: (node: TreeNode, state: TreeRenderState) => ReactNode;
    className?: string;
    "aria-label"?: string;
    "aria-labelledby"?: string;
}
/**
 * WAI-ARIA tree pattern: `role="tree"`/`"treeitem"`/`"group"`, roving
 * tabindex, arrow-key navigation, expand/collapse, `aria-expanded`/
 * `aria-selected`, single/multi-select. Data-driven (`nodes` prop) +
 * render-prop for row content (spec.md's P2 AC3).
 */
export declare function Tree({ nodes, selection, selectedIds: selectedIdsProp, defaultSelectedIds, onSelectedIdsChange, expandedIds: expandedIdsProp, defaultExpandedIds, onExpandedIdsChange, renderLabel, className, "aria-label": ariaLabel, "aria-labelledby": ariaLabelledBy, }: TreeProps): import("react").JSX.Element;
