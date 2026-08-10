import { Button } from '@hive/design-system'
import { useState } from 'react'
import { t } from '../i18n'
import { AddComponent } from './AddComponent'
import type {
  CapabilityViolation,
  Command,
  ComponentCatalog,
  ScreenDocument
} from './documentModel'
import { moveInsideCommand, moveOutsideCommand, removeCommand } from './treeEdits'

/**
 * Design Studio (M18) — T5.6. Removing and moving, at the foot of the Árvore
 * (DS-R7 AC-2/AC-3/AC-5).
 *
 * **Move is indent/outdent, not drag-and-drop.** Two reasons, and both are
 * requirements rather than taste: the Studio has to be fully operable from the
 * keyboard (DS-R18), and a drag is the one gesture a keyboard cannot make. Two
 * buttons — inwards, into the sibling above; outwards, beside the parent —
 * reach any position in a tree the size of a Tela, and each one is an ordinary
 * `MoveComponent`, so it undoes like everything else.
 *
 * **A refused move is refused by main, not here.** The cycle guard lives in
 * `validate()` because that is the single gate every source passes, the chat
 * included; a second copy of the rule in this file could only ever drift from
 * it. What this file does is show the reason and leave the tree exactly as it
 * was — a drop that silently does nothing is not one of the two failure forms
 * DS-R17 allows.
 *
 * **Removing the selected Component clears the selection** (DS-R7 AC-5): an
 * Inspetor pointed at a node that no longer exists would be a panel about
 * nothing.
 */

export interface TreeActionsProps {
  catalog: ComponentCatalog | null
  document: ScreenDocument
  selectedComponentId: string | null
  onSelect: (componentId: string | null) => void
  onEdit: (command: Command) => Promise<CapabilityViolation | null>
  /** The add picker's open state, owned by the tab so the empty stage can open it (T5.7). */
  addOpen?: boolean
  onAddOpenChange?: (open: boolean) => void
}

export function TreeActions({
  catalog,
  document,
  selectedComponentId,
  onSelect,
  onEdit,
  addOpen,
  onAddOpenChange
}: TreeActionsProps): React.JSX.Element {
  const [violation, setViolation] = useState<string | null>(null)

  const send = (command: Command | null, onLanded?: () => void): void => {
    if (command === null) return
    void onEdit(command).then((refusal) => {
      setViolation(refusal?.reason ?? null)
      if (refusal === null) onLanded?.()
    })
  }

  const inside = moveInsideCommand(document, catalog, selectedComponentId)
  const outside = moveOutsideCommand(document, catalog, selectedComponentId)

  return (
    <div className="wb-dstudio-tree-actions">
      <AddComponent
        catalog={catalog}
        document={document}
        selectedComponentId={selectedComponentId}
        onAdd={onEdit}
        open={addOpen}
        onOpenChange={onAddOpenChange}
      />
      <div className="wb-dstudio-tree-buttons">
        <Button
          variant="ghost"
          disabled={inside === null}
          onClick={() => send(inside)}
          title={t('designStudio.treeMoveInsideHint')}
        >
          {t('designStudio.treeMoveInside')}
        </Button>
        <Button
          variant="ghost"
          disabled={outside === null}
          onClick={() => send(outside)}
          title={t('designStudio.treeMoveOutsideHint')}
        >
          {t('designStudio.treeMoveOutside')}
        </Button>
        <Button
          variant="ghost"
          disabled={selectedComponentId === null}
          onClick={() =>
            send(
              selectedComponentId === null ? null : removeCommand(selectedComponentId),
              // The node is gone, so the selection that pointed at it is too.
              () => onSelect(null)
            )
          }
        >
          {t('designStudio.treeRemove')}
        </Button>
      </div>
      {violation !== null && (
        <p className="wb-dstudio-tree-error" role="alert">
          {violation}
        </p>
      )}
    </div>
  )
}
