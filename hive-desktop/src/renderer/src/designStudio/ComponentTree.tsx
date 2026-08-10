import { Tree } from '@hive/design-system'
import { t } from '../i18n'
import type { ScreenDocument, ScreenNode } from './documentModel'
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
 */

export interface ComponentTreeProps {
  document: ScreenDocument
  selectedComponentId: string | null
  onSelect: (componentId: string | null) => void
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
  onSelect
}: ComponentTreeProps): React.JSX.Element | null {
  if (document.root === null) return null

  return (
    <Tree
      className="wb-dstudio-tree"
      aria-label={t('designStudio.treeAria')}
      nodes={[toTreeNode(document.root)]}
      defaultExpandedIds={allNodeIds(document.root)}
      selectedIds={selectedComponentId === null ? [] : [selectedComponentId]}
      onSelectedIdsChange={(ids) => onSelect(ids[0] ?? null)}
    />
  )
}
