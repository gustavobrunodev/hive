import { useState } from 'react'
import type { HTMLAttributes, ReactNode } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@hive/design-system'
import { t } from '../i18n'
import { IconButton } from './IconButton'
import { GripIcon, MoveHorizontalIcon } from './icons'

/**
 * Movable-layout affordances (customizable-layout): every workbench pane
 * carries (1) a drag surface — its header, marked with a six-dot grip — and
 * (2) a keyboard/menu path to the same reordering ("Mover para a esquerda/
 * direita"), so the layout is never drag-only. `WorkUI` owns the order
 * state + persistence; these are the presentational pieces.
 *
 * **Both disappear when there is only one pane on screen.** A grip that drags
 * a pane onto nothing and a menu whose every item is disabled are not quiet
 * affordances, they are furniture: they teach a rearrangement that cannot
 * happen, and they spend the top-left corner — the most valuable real estate
 * a window has — saying "CONVERSA" over the only thing on screen. `WorkUI`
 * decides (`soloPane`) and simply stops passing `dragProps`/`actions`; this
 * file's rule is the narrower one below: **the grip is the mark of a drag
 * surface, so no drag means no grip.**
 */

export interface PaneMoveMenuProps {
  /** Human pane name, used in the trigger's accessible label. */
  paneName: string
  canMoveLeft: boolean
  canMoveRight: boolean
  onMoveLeft: () => void
  onMoveRight: () => void
}

/** The ↔ dropdown every pane header (and the file viewer's action row) mounts. Content renders only while open — same pattern as the workspace chip menu, so there's never a stray `role="menu"` in the tree. */
export function PaneMoveMenu({
  paneName,
  canMoveLeft,
  canMoveRight,
  onMoveLeft,
  onMoveRight
}: PaneMoveMenuProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <IconButton label={t('workUI.paneMoveMenuLabel', paneName)} className="wb-pane-move-btn">
          <MoveHorizontalIcon size={14} />
        </IconButton>
      </DropdownMenuTrigger>
      {open && (
        <DropdownMenuContent align="end">
          <DropdownMenuItem disabled={!canMoveLeft} onSelect={onMoveLeft}>
            {t('workUI.paneMoveLeft')}
          </DropdownMenuItem>
          <DropdownMenuItem disabled={!canMoveRight} onSelect={onMoveRight}>
            {t('workUI.paneMoveRight')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      )}
    </DropdownMenu>
  )
}

export interface PaneHeaderProps {
  /** Uppercase pane title (e.g. "Arquivos", "Conversa"). */
  title: string
  /** Drag-source wiring from `WorkUI` (`draggable`, `onDragStart`, `onDragEnd`). */
  dragProps?: HTMLAttributes<HTMLElement>
  /** Trailing controls — typically a `PaneMoveMenu`, plus pane-specific actions. */
  actions?: ReactNode
  /**
   * Always-visible pane actions (session-history's "Nova conversa"/history
   * triggers) — primary affordances of the pane's content, so unlike
   * `actions` (layout plumbing, quiet until the pane is engaged) they never
   * hide behind hover.
   */
  primaryActions?: ReactNode
}

/** Slim pane header: grip + label as the drag surface, actions at the end. */
export function PaneHeader({
  title,
  dragProps,
  actions,
  primaryActions
}: PaneHeaderProps): React.JSX.Element {
  return (
    // A `<div>`, not a `<header>`. This strip is a pane's toolbar, not the
    // document's banner — but a `<header>` that is not inside a sectioning
    // element computes as `role="banner"`, so two panes on screen gave the app
    // three banner landmarks (the title bar plus one per pane) where the spec
    // allows one. The pane's name reaches the accessibility tree through the
    // `aria-label` on its `ResizablePanel`, not through this element.
    <div
      className="wb-pane-header"
      data-static={dragProps === undefined || undefined}
      {...dragProps}
    >
      {/* The grip is the *mark* of the drag surface, not decoration beside the
          title — so a header that is not draggable does not wear one. Six dots
          promising a gesture that does nothing is worse than no dots. */}
      {dragProps !== undefined && <GripIcon size={12} className="wb-pane-grip" />}
      <span className="wb-pane-header-label">{title}</span>
      {primaryActions !== undefined && primaryActions !== null && (
        <div className="wb-pane-header-primary">{primaryActions}</div>
      )}
      {actions !== undefined && actions !== null && (
        <div className="wb-pane-header-actions">{actions}</div>
      )}
    </div>
  )
}
