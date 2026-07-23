import type { HTMLAttributes, KeyboardEvent, MouseEvent } from 'react'
import { t } from '../i18n'
import { FileTypeIcon } from './fileIcons'
import { CloseIcon } from './icons'
import type { EditorTab } from './useEditorTabs'

export interface EditorTabsProps {
  tabs: EditorTab[]
  activePath: string | null
  /** Paths with unsaved edits — the tab shows the dirty dot (VS Code: swaps with the close × on hover). */
  dirtyPaths: ReadonlySet<string>
  onSelect: (path: string) => void
  onPin: (path: string) => void
  onClose: (path: string) => void
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

/**
 * VS Code-style editor tab strip: single-click activates, double-click pins
 * a preview tab, middle-click closes, the dirty dot swaps to a close × on
 * hover. Tabs are `role="tab"` divs (a close *button* lives inside, so the
 * tab itself can't be a native button) with Enter/Space activation.
 */
export function EditorTabs({
  tabs,
  activePath,
  dirtyPaths,
  onSelect,
  onPin,
  onClose,
  dragProps,
  trailing
}: EditorTabsProps): React.JSX.Element {
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

  return (
    <div className="wb-tabs" role="tablist" aria-label={t('explorer.tabsLabel')} {...dragProps}>
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
}
