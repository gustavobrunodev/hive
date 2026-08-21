import { useCallback, useMemo, useRef, useState } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@hive/design-system'
import { t } from '../i18n'
import { FolderPlusIcon, SearchIcon } from './icons'
import { WorkspaceRow } from './WorkspaceRow'
import { WorkspaceActionDialog, type PendingWorkspaceAction } from './WorkspaceActionDialog'
import { matchesQuery, panelOrder, type WorkspaceInfo } from './useWorkspaces'

export interface WorkspaceSwitcherProps {
  /** The registry, MRU-ordered (see `useWorkspaces`). */
  workspaces: WorkspaceInfo[]
  /** Absolute path of the active workspace. */
  active: string
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Re-read the registry after an edit. */
  onReload: () => void
  /** Switch to `path` — routed through the caller's unsaved-work guard. */
  onSwitch: (path: string) => void
  /** Start the add-workspace flow (native picker → the kind question). */
  onAdd: () => void
  /** The topbar chip. */
  children: React.ReactNode
}

type PanelProps = Omit<WorkspaceSwitcherProps, 'open' | 'children'> & {
  onAction: (action: PendingWorkspaceAction) => void
}

/**
 * The panel's body. A component of its own, mounted only while the popover is
 * open, so the filter field resets by *unmounting* rather than by an effect
 * that fights React — the filter from the last visit is never what you want
 * on the next one.
 */
function SwitcherPanel({
  workspaces,
  active,
  onOpenChange,
  onSwitch,
  onAdd,
  onAction
}: PanelProps): React.JSX.Element {
  const [query, setQuery] = useState('')
  const rowRefs = useRef(new Map<string, HTMLButtonElement>())
  const inputRef = useRef<HTMLInputElement>(null)

  // Positions come from the *unfiltered* order, so the `Ctrl+N` a row
  // advertises stays true while the list is being filtered.
  const all = useMemo(() => panelOrder(workspaces), [workspaces])
  const visible = useMemo(() => all.filter((entry) => matchesQuery(entry, query)), [all, query])
  const primary = visible.filter((entry) => entry.primary)
  const others = visible.filter((entry) => !entry.primary)
  // Arrow keys walk only the rows that can actually be opened: the active one
  // and a folder that has gone missing stay readable and reachable by Tab
  // (they are `aria-disabled`, not `disabled`), but stepping *onto* them would
  // strand the arrows on a row that does nothing.
  const focusable = visible.filter((entry) => entry.path !== active && !entry.missing)

  const focusRow = useCallback((path: string | undefined) => {
    if (path) rowRefs.current.get(path)?.focus()
  }, [])

  const moveFocus = useCallback(
    (fromPath: string, delta: number) => {
      if (focusable.length === 0) return
      const index = focusable.findIndex((entry) => entry.path === fromPath)
      const next = index + delta
      // Walking up past the first row returns to the filter field, which is
      // where the list came from — the list never traps focus.
      if (next < 0) {
        inputRef.current?.focus()
        return
      }
      focusRow(focusable[Math.min(next, focusable.length - 1)]?.path)
    },
    [focusable, focusRow]
  )

  const handleRowKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>, path: string) => {
      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault()
          moveFocus(path, 1)
          break
        case 'ArrowUp':
          event.preventDefault()
          moveFocus(path, -1)
          break
        case 'Home':
          event.preventDefault()
          focusRow(focusable[0]?.path)
          break
        case 'End':
          event.preventDefault()
          focusRow(focusable[focusable.length - 1]?.path)
          break
      }
    },
    [moveFocus, focusRow, focusable]
  )

  /** Enter in the filter field opens the first row that can actually be opened. */
  const handleInputKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        focusRow(focusable[0]?.path)
        return
      }
      if (event.key !== 'Enter') return
      const target = focusable[0]
      if (!target) return
      event.preventDefault()
      onOpenChange(false)
      onSwitch(target.path)
    },
    [focusable, onSwitch, onOpenChange, focusRow]
  )

  const handleSelect = useCallback(
    (path: string) => {
      onOpenChange(false)
      onSwitch(path)
    },
    [onSwitch, onOpenChange]
  )

  const rowActions = {
    onSelect: handleSelect,
    onPromote: (entry: WorkspaceInfo) => onAction({ kind: 'promote', entry }),
    onAdopt: (entry: WorkspaceInfo) => onAction({ kind: 'adopt', entry }),
    onRename: (entry: WorkspaceInfo) => onAction({ kind: 'rename', entry }),
    onForget: (entry: WorkspaceInfo) => onAction({ kind: 'forget', entry })
  }

  const renderRow = (entry: WorkspaceInfo): React.JSX.Element => (
    <WorkspaceRow
      key={entry.path}
      entry={entry}
      active={entry.path === active}
      position={all.indexOf(entry) + 1}
      // One tab stop for the whole list (the ARIA roving-tabindex pattern):
      // Tab reaches the list, arrows move inside it, Tab leaves it. It lands
      // on the first *openable* row, so Tab never stops on a dead control.
      tabIndex={focusable[0]?.path === entry.path ? 0 : -1}
      onKeyDown={(event) => handleRowKeyDown(event, entry.path)}
      rowRef={(element) => {
        if (element) rowRefs.current.set(entry.path, element)
        else rowRefs.current.delete(entry.path)
      }}
      {...rowActions}
    />
  )

  return (
    <>
      <div className="wb-ws-search">
        <SearchIcon size={14} className="wb-ws-search-icon" />
        <input
          ref={inputRef}
          type="text"
          className="wb-ws-search-input"
          value={query}
          autoFocus
          placeholder={t('workspaces.searchPlaceholder')}
          aria-label={t('workspaces.searchPlaceholder')}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleInputKeyDown}
        />
        <kbd className="wb-ws-search-kbd">{t('workspaces.openShortcut')}</kbd>
      </div>

      {visible.length === 0 ? (
        <p className="wb-ws-empty">{t('workspaces.searchEmpty')}</p>
      ) : (
        <div className="wb-ws-scroll">
          {primary.length > 0 && (
            <>
              <p className="wb-ws-group">{t('workspaces.sectionPrimary')}</p>
              <ul className="wb-ws-list">{primary.map(renderRow)}</ul>
            </>
          )}
          {others.length > 0 && (
            <>
              <p className="wb-ws-group">{t('workspaces.sectionOthers')}</p>
              <ul className="wb-ws-list">{others.map(renderRow)}</ul>
            </>
          )}
        </div>
      )}

      <button
        type="button"
        className="wb-ws-add"
        onClick={() => {
          onOpenChange(false)
          onAdd()
        }}
      >
        <FolderPlusIcon size={15} />
        {t('workspaces.addCta')}
      </button>
    </>
  )
}

/**
 * The workspace switcher (multi-workspace) — the panel behind the topbar chip.
 *
 * It replaces the flat "Abrir pasta… / Recentes" menu the single-workspace era
 * shipped. A menu was right when a workspace was just a path that had been
 * opened once; a workspace is now a *place* with a name, a kind and a rank, so
 * the surface is a list you can filter, jump into by number, and act on.
 *
 * Shape notes:
 *  - The list is a plain roving-tabindex list, not a `cmdk` palette. Each row
 *    carries a second control (its `⋯` menu), which a `role="option"` row
 *    can't hold without swallowing it — the same reason `ChoiceGrid` hand-rolls
 *    its radiogroup instead of leaning on a primitive.
 *  - The action dialogs are rendered here but portalled out of the popover, so
 *    confirming one doesn't fight the popover's own dismiss. They outlive the
 *    panel on purpose: choosing an action closes it.
 */
export function WorkspaceSwitcher({
  open,
  onOpenChange,
  onReload,
  onSwitch,
  children,
  ...panel
}: WorkspaceSwitcherProps): React.JSX.Element {
  const [pending, setPending] = useState<PendingWorkspaceAction | null>(null)

  /** Every row action closes the panel first — its dialog is the next surface. */
  const requestAction = useCallback(
    (action: PendingWorkspaceAction) => {
      onOpenChange(false)
      setPending(action)
    },
    [onOpenChange]
  )

  return (
    <>
      <Popover open={open} onOpenChange={onOpenChange}>
        <PopoverTrigger asChild>{children}</PopoverTrigger>
        {/* Mounted only while open — the same conditional-content pattern
            `SessionHistory` and the old chip menu use, so the panel's filter
            field and every row's menu exist exactly when they can be reached,
            and the filter resets by unmounting rather than by an effect. */}
        {open && (
          <PopoverContent
            align="start"
            className="wb-ws-panel"
            aria-label={t('workspaces.panelLabel')}
          >
            <SwitcherPanel
              {...panel}
              onOpenChange={onOpenChange}
              onReload={onReload}
              onSwitch={onSwitch}
              onAction={requestAction}
            />
          </PopoverContent>
        )}
      </Popover>

      <WorkspaceActionDialog
        pending={pending}
        onClose={() => setPending(null)}
        onReload={onReload}
        onSwitch={onSwitch}
      />
    </>
  )
}
