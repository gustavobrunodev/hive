import { useCallback, useMemo, useRef, useState } from "react"
import type { KeyboardEvent, ReactNode } from "react"
import { cx } from "../../utils/cx"
import { useControllableState } from "../../hooks/useControllableState"
import "./Tree.css"

export interface TreeNode {
  id: string
  label: ReactNode
  children?: TreeNode[]
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
  expandable?: boolean
  disabled?: boolean
}

export interface TreeRenderState {
  level: number
  expanded: boolean
  selected: boolean
  /** Literal truth: this node has at least one child to show. */
  hasChildren: boolean
  /** Whether the row behaves as a container — `hasChildren`, or `node.expandable`. */
  expandable: boolean
}

export interface TreeProps {
  /** The hierarchy to render. */
  nodes: TreeNode[]
  /** `"single"` (default) replaces the selection on activate; `"multiple"` toggles membership. */
  selection?: "single" | "multiple"
  /** Controlled: the currently selected node ids. Pair with `onSelectedIdsChange`. */
  selectedIds?: string[]
  /** Uncontrolled initial selection. Ignored if `selectedIds` is provided. */
  defaultSelectedIds?: string[]
  /** Fires whenever the selection changes (click or Enter/Space on the active node). */
  onSelectedIdsChange?: (ids: string[]) => void
  /** Controlled: the currently expanded node ids. Pair with `onExpandedIdsChange`. */
  expandedIds?: string[]
  /** Uncontrolled initial expansion. Ignored if `expandedIds` is provided. */
  defaultExpandedIds?: string[]
  /** Fires whenever a node is expanded or collapsed (click on the chevron or ArrowRight/ArrowLeft). */
  onExpandedIdsChange?: (ids: string[]) => void
  /** Render-prop for a node's row content. Defaults to a chevron (if it has children) + `node.label`. */
  renderLabel?: (node: TreeNode, state: TreeRenderState) => ReactNode
  className?: string
  /** Accessible name for the `role="tree"` root. Provide this or `aria-labelledby`. */
  "aria-label"?: string
  /** Accessible name reference for the `role="tree"` root, e.g. a heading id. */
  "aria-labelledby"?: string
}

interface FlatItem {
  node: TreeNode
  level: number
  parentId: string | null
  /** Branch-ness, not child count — see `TreeNode.expandable`. */
  expandable: boolean
}

/** Modifier state derived from the triggering click/keyboard event. */
export interface ActivateMods {
  /** Ctrl/Cmd-click: toggle membership instead of replacing the selection. */
  toggle: boolean
  /** Shift-click: replace the selection with the visible-order range from the anchor. */
  range: boolean
}

/** Whether a node has children to render right now. */
function hasChildrenOf(node: TreeNode): boolean {
  return Boolean(node.children && node.children.length > 0)
}

/** Whether a node is a container: it has children, or it declares itself one. */
function isBranch(node: TreeNode): boolean {
  return node.expandable === true || hasChildrenOf(node)
}

function flattenVisible(
  nodes: TreeNode[],
  expandedIds: ReadonlySet<string>,
  level = 0,
  parentId: string | null = null
): FlatItem[] {
  const out: FlatItem[] = []
  for (const node of nodes) {
    out.push({ node, level, parentId, expandable: isBranch(node) })
    if (hasChildrenOf(node) && expandedIds.has(node.id)) {
      out.push(...flattenVisible(node.children as TreeNode[], expandedIds, level + 1, node.id))
    }
  }
  return out
}

function defaultRenderLabel(node: TreeNode, state: TreeRenderState): ReactNode {
  return (
    <>
      {state.expandable && (
        <svg
          className="hds-tree-chevron"
          width="12"
          height="12"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
        >
          <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      <span className="hds-tree-label-text">{node.label}</span>
    </>
  )
}

/**
 * WAI-ARIA tree pattern: `role="tree"`/`"treeitem"`/`"group"`, roving
 * tabindex, arrow-key navigation, expand/collapse, `aria-expanded`/
 * `aria-selected`, single/multi-select. Data-driven (`nodes` prop) +
 * render-prop for row content (spec.md's P2 AC3).
 */
export function Tree({
  nodes,
  selection = "single",
  selectedIds: selectedIdsProp,
  defaultSelectedIds = [],
  onSelectedIdsChange,
  expandedIds: expandedIdsProp,
  defaultExpandedIds = [],
  onExpandedIdsChange,
  renderLabel = defaultRenderLabel,
  className,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
}: TreeProps) {
  const [selectedIds, setSelectedIds] = useControllableState<string[]>({
    value: selectedIdsProp,
    defaultValue: defaultSelectedIds,
    onChange: onSelectedIdsChange,
  })
  const [expandedIds, setExpandedIds] = useControllableState<string[]>({
    value: expandedIdsProp,
    defaultValue: defaultExpandedIds,
    onChange: onExpandedIdsChange,
  })

  const expandedSet = useMemo(() => new Set(expandedIds), [expandedIds])
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])
  const flat = useMemo(() => flattenVisible(nodes, expandedSet), [nodes, expandedSet])
  const enabledFlat = useMemo(() => flat.filter((item) => !item.node.disabled), [flat])

  const [activeId, setActiveId] = useState<string | null>(() => enabledFlat[0]?.node.id ?? null)
  const activeIdRef = useRef(activeId)
  activeIdRef.current = activeId

  const anchorIdRef = useRef<string | null>(null)

  const itemRefs = useRef(new Map<string, HTMLLIElement>())
  const typeAheadRef = useRef<{ text: string; timeout: ReturnType<typeof setTimeout> | null }>({
    text: "",
    timeout: null,
  })

  const focusItem = useCallback((id: string | null) => {
    if (!id) return
    setActiveId(id)
    itemRefs.current.get(id)?.focus()
  }, [])

  const expand = useCallback(
    (id: string) => {
      if (expandedSet.has(id)) return
      setExpandedIds([...expandedIds, id])
    },
    [expandedSet, expandedIds, setExpandedIds]
  )

  const collapse = useCallback(
    (id: string) => {
      if (!expandedSet.has(id)) return
      setExpandedIds(expandedIds.filter((existing) => existing !== id))
    },
    [expandedSet, expandedIds, setExpandedIds]
  )

  const activate = useCallback(
    (id: string, mods: ActivateMods = { toggle: false, range: false }) => {
      if (selection === "multiple") {
        const anchor = anchorIdRef.current
        if (mods.range && anchor) {
          const anchorIndex = enabledFlat.findIndex((item) => item.node.id === anchor)
          const targetIndex = enabledFlat.findIndex((item) => item.node.id === id)
          if (anchorIndex !== -1 && targetIndex !== -1) {
            const [start, end] = anchorIndex <= targetIndex ? [anchorIndex, targetIndex] : [targetIndex, anchorIndex]
            setSelectedIds(enabledFlat.slice(start, end + 1).map((item) => item.node.id))
            return
          }
        }
        if (mods.toggle) {
          setSelectedIds(
            selectedSet.has(id) ? selectedIds.filter((existing) => existing !== id) : [...selectedIds, id]
          )
          anchorIdRef.current = id
          return
        }
        setSelectedIds([id])
        anchorIdRef.current = id
      } else {
        setSelectedIds([id])
      }
    },
    [selection, selectedSet, selectedIds, setSelectedIds, enabledFlat]
  )

  /**
   * Arrow-key focus move, optionally extending the multi-selection (Shift +
   * Arrow — the keyboard half of Shift-click, required by the WAI-ARIA
   * multi-select tree pattern; without it the range gesture is mouse-only).
   * The anchor is seeded from the row focus is leaving, so the first
   * Shift+Arrow of a session grows from where the user actually is rather
   * than collapsing the selection to the destination row.
   */
  const moveFocus = useCallback(
    (toId: string, fromId: string, extend: boolean) => {
      focusItem(toId)
      if (!extend || selection !== "multiple") return
      if (!anchorIdRef.current) anchorIdRef.current = fromId
      activate(toId, { toggle: false, range: true })
    },
    [focusItem, selection, activate]
  )

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLUListElement>) => {
      const currentId = activeIdRef.current
      if (!currentId) return
      const currentIndex = enabledFlat.findIndex((item) => item.node.id === currentId)
      if (currentIndex === -1) return
      const current = enabledFlat[currentIndex]
      if (!current) return

      switch (event.key) {
        case "ArrowDown": {
          event.preventDefault()
          const next = enabledFlat[currentIndex + 1]
          if (next) moveFocus(next.node.id, currentId, event.shiftKey)
          break
        }
        case "ArrowUp": {
          event.preventDefault()
          const prev = enabledFlat[currentIndex - 1]
          if (prev) moveFocus(prev.node.id, currentId, event.shiftKey)
          break
        }
        case "ArrowRight": {
          event.preventDefault()
          if (current.expandable && !expandedSet.has(current.node.id)) {
            expand(current.node.id)
          } else if (current.expandable) {
            const next = enabledFlat[currentIndex + 1]
            if (next && next.parentId === current.node.id) focusItem(next.node.id)
          }
          break
        }
        case "ArrowLeft": {
          event.preventDefault()
          if (current.expandable && expandedSet.has(current.node.id)) {
            collapse(current.node.id)
          } else if (current.parentId) {
            focusItem(current.parentId)
          }
          break
        }
        case "Home": {
          event.preventDefault()
          const first = enabledFlat[0]
          if (first) focusItem(first.node.id)
          break
        }
        case "End": {
          event.preventDefault()
          const last = enabledFlat[enabledFlat.length - 1]
          if (last) focusItem(last.node.id)
          break
        }
        case "Enter":
        case " ": {
          event.preventDefault()
          activate(current.node.id, { toggle: false, range: false })
          break
        }
        default: {
          if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
            const char = event.key.toLowerCase()
            const buffer = typeAheadRef.current
            if (buffer.timeout) clearTimeout(buffer.timeout)
            buffer.text += char
            buffer.timeout = setTimeout(() => {
              buffer.text = ""
            }, 500)

            const searchable = enabledFlat
              .map((item, index) => ({ item, index }))
              .filter(({ item }) => typeof item.node.label === "string")
            const startAt = currentIndex + 1
            const match =
              searchable.find(
                ({ item, index }) =>
                  index >= startAt && (item.node.label as string).toLowerCase().startsWith(buffer.text)
              ) ??
              searchable.find(({ item }) => (item.node.label as string).toLowerCase().startsWith(buffer.text))
            if (match) focusItem(match.item.node.id)
          }
        }
      }
    },
    [enabledFlat, expandedSet, expand, collapse, activate, focusItem, moveFocus]
  )

  return (
    <ul
      role="tree"
      className={cx("hds-tree", className)}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      aria-multiselectable={selection === "multiple" ? "true" : undefined}
      onKeyDown={handleKeyDown}
    >
      {nodes.map((node) => (
        <TreeItem
          key={node.id}
          node={node}
          level={1}
          expandedSet={expandedSet}
          selectedSet={selectedSet}
          activeId={activeId}
          renderLabel={renderLabel}
          itemRefs={itemRefs}
          onFocus={setActiveId}
          onToggleExpand={(id) => (expandedSet.has(id) ? collapse(id) : expand(id))}
          onActivate={activate}
        />
      ))}
    </ul>
  )
}

interface TreeItemProps {
  node: TreeNode
  level: number
  expandedSet: ReadonlySet<string>
  selectedSet: ReadonlySet<string>
  activeId: string | null
  renderLabel: (node: TreeNode, state: TreeRenderState) => ReactNode
  itemRefs: React.MutableRefObject<Map<string, HTMLLIElement>>
  onFocus: (id: string) => void
  onToggleExpand: (id: string) => void
  onActivate: (id: string, mods: ActivateMods) => void
}

function TreeItem({
  node,
  level,
  expandedSet,
  selectedSet,
  activeId,
  renderLabel,
  itemRefs,
  onFocus,
  onToggleExpand,
  onActivate,
}: TreeItemProps) {
  const hasChildren = hasChildrenOf(node)
  const expandable = isBranch(node)
  const expanded = expandedSet.has(node.id)
  const selected = selectedSet.has(node.id)
  const isActive = activeId === node.id

  return (
    <li
      ref={(el) => {
        if (el) itemRefs.current.set(node.id, el)
        else itemRefs.current.delete(node.id)
      }}
      role="treeitem"
      id={`hds-tree-item-${node.id}`}
      aria-selected={node.disabled ? undefined : selected}
      aria-expanded={expandable ? expanded : undefined}
      aria-disabled={node.disabled ? "true" : undefined}
      aria-level={level}
      tabIndex={node.disabled ? undefined : isActive ? 0 : -1}
      className={cx(
        "hds-tree-item",
        selected && "hds-tree-item-selected",
        node.disabled && "hds-tree-item-disabled"
      )}
      onClick={(event) => {
        event.stopPropagation()
        if (node.disabled) return
        onFocus(node.id)
        onActivate(node.id, {
          toggle: event.ctrlKey || event.metaKey,
          range: event.shiftKey,
        })
      }}
      onMouseDown={(event) => {
        // A Shift-click is a *range* gesture, but the browser also reads it as
        // "extend the text selection", which paints the row labels between the
        // two clicks as selected text. Suppressing it here (mousedown is where
        // the browser starts that selection) leaves the click itself intact.
        if (event.shiftKey) event.preventDefault()
      }}
      onFocus={(event) => {
        event.stopPropagation()
        if (!node.disabled) onFocus(node.id)
      }}
    >
      <div className="hds-tree-row" style={{ paddingLeft: `calc(${level - 1} * var(--s-5))` }}>
        {expandable ? (
          // A `<span>`, not a `<button aria-hidden>`. The `li` already carries
          // `role="treeitem"` and the row's whole click behaviour, so the
          // wrapper never needed to be interactive — and `aria-hidden` on it
          // hid the ONLY thing that could name the row, leaving every folder
          // as a nameless `treeitem` (WCAG 4.1.2). It also made any
          // interactive content a consumer renders through `renderLabel` —
          // Hive's per-row actions menu — both a `<button>` nested inside a
          // `<button>` and a focusable node inside a hidden subtree.
          // Leaves already used a `<span>`; folders now match them.
          <span
            className="hds-tree-toggle"
            onClick={(event) => {
              event.stopPropagation()
              if (node.disabled) return
              const mods = { toggle: event.ctrlKey || event.metaKey, range: event.shiftKey }
              // A parent row's whole label is this wrapper, so before this it
              // was the *only* thing a click on a folder could do: expand.
              // That made a folder unselectable, unable to anchor a range, and
              // unable to end one — a Shift-click meant to extend the
              // selection collapsed the folder instead, reordering the very
              // list the range is measured over. Selection now happens on
              // every click (OS file managers select the folder they expand),
              // and expanding is suppressed under a modifier, where the user
              // is selecting rather than navigating.
              onFocus(node.id)
              onActivate(node.id, mods)
              if (!mods.toggle && !mods.range) onToggleExpand(node.id)
            }}
          >
            {renderLabel(node, { level, expanded, selected, hasChildren, expandable })}
          </span>
        ) : (
          <span className="hds-tree-toggle hds-tree-toggle-leaf">
            {renderLabel(node, { level, expanded, selected, hasChildren, expandable })}
          </span>
        )}
      </div>
      {/* An expanded branch with nothing in it owns no group: an empty
          `role="group"` announces a list that isn't there. The chevron and
          `aria-expanded` still turn, which is the part that was missing. */}
      {hasChildren && expanded && (
        <ul role="group">
          {(node.children as TreeNode[]).map((child) => (
            <TreeItem
              key={child.id}
              node={child}
              level={level + 1}
              expandedSet={expandedSet}
              selectedSet={selectedSet}
              activeId={activeId}
              renderLabel={renderLabel}
              itemRefs={itemRefs}
              onFocus={onFocus}
              onToggleExpand={onToggleExpand}
              onActivate={onActivate}
            />
          ))}
        </ul>
      )}
    </li>
  )
}
