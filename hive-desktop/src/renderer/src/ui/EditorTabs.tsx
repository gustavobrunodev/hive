import { useCallback, useState } from 'react'
import type { HTMLAttributes, KeyboardEvent, MouseEvent } from 'react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger
} from '@hive/design-system'
import { t } from '../i18n'
import { FileTypeIcon } from './fileIcons'
import {
  CheckCircleIcon,
  CloseAllIcon,
  CloseIcon,
  CloseOthersIcon,
  CloseRightIcon,
  CopyIcon,
  ExternalFolderIcon,
  PinIcon,
  TargetIcon
} from './icons'
import type { EditorTab } from './useEditorTabs'

/** The per-tab actions the strip's right-click menu needs from `WorkUI`. */
export interface EditorTabActions {
  /** Every tab but this one. */
  closeOthers: (path: string) => void
  /** Everything after this one in the strip. */
  closeToTheRight: (path: string) => void
  /** Every tab with no unsaved changes. */
  closeSaved: () => void
  /** The whole strip. */
  closeAll: () => void
  /** Turns a preview tab into a kept one (VS Code's "Keep Open"). */
  keepOpen: (path: string) => void
  /** Puts the file's path on the clipboard — absolute or workspace-relative. */
  copyPath: (filePath: string, kind: 'absolute' | 'relative') => void
  /** Points the file tree at the file (and brings the Explorer back if it is not showing). */
  revealInTree: (filePath: string) => void
  /** Hands the file to the host's file manager. */
  revealInOs: (filePath: string) => void
}

export interface EditorTabsProps {
  tabs: EditorTab[]
  activePath: string | null
  /** Paths with unsaved edits — the tab shows the dirty dot (VS Code: swaps with the close × on hover). */
  dirtyPaths: ReadonlySet<string>
  onSelect: (path: string) => void
  onPin: (path: string) => void
  onClose: (path: string) => void
  /** The right-click menu's actions. Omitted (tests, isolated renders) leaves the strip menu-less. */
  actions?: EditorTabActions
  /** customizable-layout: the strip doubles as the viewer pane's drag handle. */
  dragProps?: HTMLAttributes<HTMLElement>
  /** Rendered at the strip's right edge (the pane's ↔ move menu). */
  trailing?: React.ReactNode
}

/** Last path segment. */
function tabName(path: string): string {
  const i = path.lastIndexOf('/')
  return i === -1 ? path : path.slice(i + 1)
}

/** What the right-click menu is acting on: one tab, resolved to what it can offer. */
interface TabTarget {
  /** The tab's key — what the close actions take. */
  path: string
  /** The real file behind it, when there is one (a commit's diff has none). */
  filePath: string | null
  /** A preview tab can still be kept; a pinned one has nothing to offer there. */
  preview: boolean
  /** Whether anything to its right is still open. */
  hasTabsToTheRight: boolean
  /** Whether any tab on the strip is clean — "Fechar as salvas" would be a no-op otherwise. */
  hasSavedTabs: boolean
}

/**
 * The tab menu, VS Code's set in VS Code's order: the close family first
 * (where the hand is already going), then keeping this one, then what the
 * file *is* — its path, and where it lives on disk and in the tree.
 *
 * Items that cannot do anything are disabled rather than hidden: a menu whose
 * shape changes from tab to tab has to be re-read every time, and the whole
 * point of matching this menu is that it does not.
 */
function TabMenuItems({
  target,
  actions,
  onCloseTarget
}: {
  target: TabTarget
  actions: EditorTabActions
  /** "Fechar" — the same guarded close the tab's own × runs. */
  onCloseTarget: () => void
}): React.JSX.Element {
  const { path, filePath } = target
  return (
    <>
      <ContextMenuItem onSelect={onCloseTarget}>
        <CloseIcon size={14} />
        {t('explorer.tabMenuClose')}
      </ContextMenuItem>
      <ContextMenuItem onSelect={() => actions.closeOthers(path)}>
        <CloseOthersIcon size={14} />
        {t('explorer.tabMenuCloseOthers')}
      </ContextMenuItem>
      <ContextMenuItem
        disabled={!target.hasTabsToTheRight}
        onSelect={() => actions.closeToTheRight(path)}
      >
        <CloseRightIcon size={14} />
        {t('explorer.tabMenuCloseToTheRight')}
      </ContextMenuItem>
      {/* The app's mark for "nothing pending" — the same one the Source
          Control panel uses. "Saved" is that state, not a fourth kind of close. */}
      <ContextMenuItem disabled={!target.hasSavedTabs} onSelect={() => actions.closeSaved()}>
        <CheckCircleIcon size={14} />
        {t('explorer.tabMenuCloseSaved')}
      </ContextMenuItem>
      <ContextMenuItem onSelect={() => actions.closeAll()}>
        <CloseAllIcon size={14} />
        {t('explorer.tabMenuCloseAll')}
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem disabled={!target.preview} onSelect={() => actions.keepOpen(path)}>
        <PinIcon size={14} />
        {t('explorer.tabMenuKeepOpen')}
      </ContextMenuItem>
      <ContextMenuSeparator />
      {/* Below the separator, as in the explorer's own row menu: these leave
          every open editor exactly as it was — they hand a path to the
          clipboard, to the tree, or to the OS. */}
      <ContextMenuItem
        disabled={filePath === null}
        shortcut={t('explorer.keyCopyRelativePath', window.hive.platform)}
        onSelect={() => filePath !== null && actions.copyPath(filePath, 'relative')}
      >
        <CopyIcon size={14} />
        {t('explorer.menuCopyRelativePath')}
      </ContextMenuItem>
      <ContextMenuItem
        disabled={filePath === null}
        shortcut={t('explorer.keyCopyPath', window.hive.platform)}
        onSelect={() => filePath !== null && actions.copyPath(filePath, 'absolute')}
      >
        <CopyIcon size={14} />
        {t('explorer.menuCopyPath')}
      </ContextMenuItem>
      <ContextMenuItem
        disabled={filePath === null}
        onSelect={() => filePath !== null && actions.revealInTree(filePath)}
      >
        <TargetIcon size={14} />
        {t('explorer.tabMenuRevealInTree')}
      </ContextMenuItem>
      <ContextMenuItem
        disabled={filePath === null}
        onSelect={() => filePath !== null && actions.revealInOs(filePath)}
      >
        <ExternalFolderIcon size={14} />
        {t('explorer.menuRevealInOs', window.hive.platform)}
      </ContextMenuItem>
    </>
  )
}

/**
 * VS Code-style editor tab strip: single-click activates, double-click pins
 * a preview tab, middle-click closes, the dirty dot swaps to a close × on
 * hover, and right-click opens the tab menu (close family, keep open, path
 * and reveal). Tabs are `role="tab"` divs (a close *button* lives inside, so
 * the tab itself can't be a native button) with Enter/Space activation.
 */
export function EditorTabs({
  tabs,
  activePath,
  dirtyPaths,
  onSelect,
  onPin,
  onClose,
  actions,
  dragProps,
  trailing
}: EditorTabsProps): React.JSX.Element {
  // Which tab the menu is about. Captured in the capture phase, ahead of
  // Radix's own native `contextmenu` listener on the trigger — the same
  // technique the file tree uses for its row-scoped menu.
  const [menuTarget, setMenuTarget] = useState<TabTarget | null>(null)

  const handleTabKeyDown = (event: KeyboardEvent, path: string): void => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onSelect(path)
    }
  }

  // Middle-click closes (VS Code muscle memory).
  const handleAuxClick = (event: MouseEvent, path: string): void => {
    if (event.button === 1) {
      event.preventDefault()
      onClose(path)
    }
  }

  const handleContextMenuCapture = useCallback(
    (event: MouseEvent) => {
      const row = (event.target as HTMLElement).closest?.('[data-tab-path]')
      const path = row instanceof HTMLElement ? row.dataset.tabPath : undefined
      const index = path === undefined ? -1 : tabs.findIndex((tab) => tab.path === path)
      const tab = index === -1 ? undefined : tabs[index]
      if (tab === undefined) {
        setMenuTarget(null)
        return
      }
      setMenuTarget({
        path: tab.path,
        filePath: tab.kind === 'file' ? tab.path : (tab.git?.path ?? null),
        preview: !tab.pinned,
        hasTabsToTheRight: index < tabs.length - 1,
        hasSavedTabs: tabs.some((candidate) => !dirtyPaths.has(candidate.path))
      })
    },
    [tabs, dirtyPaths]
  )

  const strip = (
    <div
      className="wb-tabs"
      role="tablist"
      aria-label={t('explorer.tabsLabel')}
      onContextMenuCapture={handleContextMenuCapture}
      {...dragProps}
    >
      <div className="wb-tabs-row">
        {tabs.map((tab) => {
          const dirty = dirtyPaths.has(tab.path)
          const active = tab.path === activePath
          // Diff/conflict tabs show the file's basename (not the synthetic
          // key) and a git indicator; the underlying real path drives the icon.
          const filePath = tab.git?.path ?? tab.path
          const name = tab.label ?? tabName(tab.path)
          return (
            <div
              key={tab.path}
              role="tab"
              tabIndex={0}
              aria-selected={active}
              title={filePath}
              className="wb-tab"
              data-tab-path={tab.path}
              data-active={active || undefined}
              data-preview={!tab.pinned || undefined}
              data-dirty={dirty || undefined}
              data-kind={tab.kind !== 'file' ? tab.kind : undefined}
              onClick={() => onSelect(tab.path)}
              onDoubleClick={() => onPin(tab.path)}
              onAuxClick={(event) => handleAuxClick(event, tab.path)}
              onKeyDown={(event) => handleTabKeyDown(event, tab.path)}
            >
              <FileTypeIcon path={filePath} size={14} />
              <span className="wb-tab-name">{name}</span>
              <button
                type="button"
                className="wb-tab-close"
                aria-label={t('explorer.closeTabLabel', name)}
                onClick={(event) => {
                  event.stopPropagation()
                  onClose(tab.path)
                }}
                onDoubleClick={(event) => event.stopPropagation()}
              >
                <span className="wb-tab-close-x">
                  <CloseIcon size={13} />
                </span>
                <span className="wb-tab-dirty-dot" aria-hidden="true" />
              </button>
            </div>
          )
        })}
      </div>
      {trailing && <div className="wb-tabs-trailing wb-pane-header-actions">{trailing}</div>}
    </div>
  )

  if (!actions) return strip

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{strip}</ContextMenuTrigger>
      {menuTarget && (
        <ContextMenuContent className="wb-tree-context-menu">
          <TabMenuItems
            target={menuTarget}
            actions={actions}
            onCloseTarget={() => onClose(menuTarget.path)}
          />
        </ContextMenuContent>
      )}
    </ContextMenu>
  )
}
