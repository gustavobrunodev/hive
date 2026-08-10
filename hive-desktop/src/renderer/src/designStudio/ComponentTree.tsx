import { Tree } from '@hive/design-system'
import { t } from '../i18n'
import { TreeActions } from './TreeActions'
import type {
  CapabilityViolation,
  Command,
  ComponentCatalog,
  ScreenDocument,
  ScreenNode
} from './documentModel'
import { allNodeIds } from './screenTree'

/**
 * Design Studio (M18) — T5.1. The Tela's structure, and the other half of the
 * selection (DS-R5 AC-5).
 *
 * Selection is **bidirectional and single**: the same id drives the highlight
 * here and the outline on the stage, so clicking a nested Component in the
 * Preview scrolls it into view as the selected row, and clicking a row outlines
 * it in the frame. There is no second "tree selection" to keep in sync, because
 * a second copy is exactly how the two would end up disagreeing.
 *
 * The DS `Tree` brings the WAI-ARIA tree pattern with it — roving tabindex,
 * arrow-key navigation, `aria-selected` — which is why this file maps a
 * `ScreenDocument` into `TreeNode[]` and does nothing else with the keyboard.
 *
 * The tree is expanded down its whole depth by default: a Tela is a handful of
 * nodes, and a collapsed root would hide the very structure the pane exists to
 * show.
 *
 * T5.5/T5.6 add the structural edit: with `onEdit` wired, the pane also carries
 * add, remove and move, and it carries them **even for an empty Tela** — a Tela
 * with no Components still has to offer the way to its first one (DS-R7).
 */

export interface ComponentTreeProps {
  document: ScreenDocument
  selectedComponentId: string | null
  onSelect: (componentId: string | null) => void
  /** The active catalog — the only source the add picker draws from (T5.5, DS-R7 AC-1). */
  catalog?: ComponentCatalog | null
  /** Dispatches an edit of the structure. Absent = a read-only Árvore. */
  onEdit?: (command: Command) => Promise<CapabilityViolation | null>
  /** The add picker's open state, when the tab owns it (T5.7). */
  addOpen?: boolean
  onAddOpenChange?: (open: boolean) => void
}

/** The DS `Tree`'s node shape, restated because the package exports the component, not the type. */
interface TreeRow {
  id: string
  label: string
  children?: TreeRow[]
}

/** A node's row label: the tag, which is the only name a Component has (design §3.1). */
function toTreeNode(node: ScreenNode): TreeRow {
  return {
    id: node.id,
    label: node.tag,
    ...(node.children.length > 0 ? { children: node.children.map(toTreeNode) } : {})
  }
}

export function ComponentTree({
  document,
  selectedComponentId,
  onSelect,
  catalog,
  onEdit,
  addOpen,
  onAddOpenChange
}: ComponentTreeProps): React.JSX.Element | null {
  if (document.root === null && onEdit === undefined) return null

  return (
    <>
      {document.root !== null && (
        <Tree
          className="wb-dstudio-tree"
          aria-label={t('designStudio.treeAria')}
          nodes={[toTreeNode(document.root)]}
          defaultExpandedIds={allNodeIds(document.root)}
          selectedIds={selectedComponentId === null ? [] : [selectedComponentId]}
          onSelectedIdsChange={(ids) => onSelect(ids[0] ?? null)}
        />
      )}
      {onEdit && (
        <TreeActions
          catalog={catalog ?? null}
          document={document}
          selectedComponentId={selectedComponentId}
          onSelect={onSelect}
          onEdit={onEdit}
          addOpen={addOpen}
          onAddOpenChange={onAddOpenChange}
        />
      )}
    </>
  )
}
