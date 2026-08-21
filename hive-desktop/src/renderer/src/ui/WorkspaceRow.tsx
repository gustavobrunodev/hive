import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@hive/design-system'
import { relativeTimeLabel, t } from '../i18n'
import { AlertTriangleIcon, HiveCellIcon, MoreIcon } from './icons'
import { WorkspaceMark } from './WorkspaceMark'
import { locationOf } from './workspacePath'
import { workspaceState, type WorkspaceState } from './workspaceVisuals'
import type { WorkspaceInfo } from './useWorkspaces'

const STATE_LABEL: Record<WorkspaceState, string> = {
  managed: t('workspaces.stateManaged'),
  light: t('workspaces.stateLight'),
  pending: t('workspaces.statePending'),
  missing: t('workspaces.stateMissing')
}

/** The state's glyph: the app's own cell for BMAD, a warning for a folder that is gone, a neutral ring otherwise. */
function StateIcon({ state }: { state: WorkspaceState }): React.JSX.Element {
  if (state === 'managed') return <HiveCellIcon size={11} />
  if (state === 'missing') return <AlertTriangleIcon size={11} />
  return <span className="wb-ws-row-state-dot" aria-hidden="true" />
}

export interface WorkspaceRowActions {
  onSelect: (path: string) => void
  onPromote: (entry: WorkspaceInfo) => void
  onAdopt: (entry: WorkspaceInfo) => void
  onRename: (entry: WorkspaceInfo) => void
  onForget: (entry: WorkspaceInfo) => void
}

/**
 * Everything a row can do besides open. Extracted so the row itself stays a
 * layout concern: which entries appear depends on the workspace's state, and
 * that branching is the whole content of this component.
 */
function RowMenu({
  entry,
  onPromote,
  onAdopt,
  onRename,
  onForget
}: { entry: WorkspaceInfo } & Omit<WorkspaceRowActions, 'onSelect'>): React.JSX.Element {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="wb-ws-row-menu"
          aria-label={t('workspaces.rowMenuLabel', entry.displayName)}
        >
          <MoreIcon size={15} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="wb-ws-row-menu-content">
        {!entry.primary && !entry.missing && (
          <DropdownMenuItem onSelect={() => onPromote(entry)}>
            {t('workspaces.actionSetPrimary')}
          </DropdownMenuItem>
        )}
        {entry.kind === 'light' && !entry.missing && (
          <DropdownMenuItem onSelect={() => onAdopt(entry)}>
            {t('workspaces.actionAdopt')}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={() => onRename(entry)}>
          {t('workspaces.actionRename')}
        </DropdownMenuItem>
        {!entry.primary && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onForget(entry)}>
              {t('workspaces.actionForget')}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

interface WorkspaceRowProps extends WorkspaceRowActions {
  entry: WorkspaceInfo
  active: boolean
  /** 1-based position in the panel's order; positions 1–9 advertise their `Ctrl+N` jump. */
  position: number
  /** Roving tabindex: exactly one row in the list is in the tab order. */
  tabIndex: number
  onKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>) => void
  rowRef: (element: HTMLButtonElement | null) => void
}

/**
 * One workspace in the switcher: its mark, its name, where it lives, and what
 * it is. Two lines, so a list of eight is still scannable in one glance.
 *
 * The row is a button (switch to this workspace) with a sibling menu button
 * for everything else — deliberately siblings rather than nested, so neither
 * control swallows the other's click or its place in the tab order.
 */
export function WorkspaceRow({
  entry,
  active,
  position,
  tabIndex,
  onKeyDown,
  rowRef,
  onSelect,
  ...menuActions
}: WorkspaceRowProps): React.JSX.Element {
  const state = workspaceState(entry)
  const stateLabel = STATE_LABEL[state]
  const inert = active || entry.missing

  return (
    <li className="wb-ws-row" data-active={active || undefined} data-state={state}>
      <button
        type="button"
        ref={rowRef}
        className="wb-ws-row-main"
        tabIndex={tabIndex}
        // The active workspace can't be "switched to" — its row stays in the
        // list (it's where you are, and hiding it would make the list jump
        // when you switch) but reads as current instead of actionable. Same
        // for a folder that has gone missing.
        //
        // `aria-disabled`, not `disabled`: both rows still carry information
        // worth reading, and a truly disabled button is unfocusable — which
        // silently stranded the arrow keys on whichever row came before it.
        aria-current={active ? 'true' : undefined}
        aria-disabled={inert || undefined}
        title={entry.path}
        aria-label={t('workspaces.rowAria', entry.displayName, stateLabel, entry.path)}
        onKeyDown={onKeyDown}
        onClick={() => {
          if (inert) return
          onSelect(entry.path)
        }}
      >
        <WorkspaceMark
          path={entry.path}
          name={entry.displayName}
          size={30}
          missing={entry.missing}
        />
        <span className="wb-ws-row-text">
          <span className="wb-ws-row-top">
            <span className="wb-ws-row-name">{entry.displayName}</span>
            {active && <span className="wb-ws-row-active">{t('workspaces.activeTag')}</span>}
            {entry.lastOpenedAt > 0 && (
              // On the name's line, right-aligned: the second line is where
              // the two facts that identify a workspace live (what it is, and
              // where), and three columns down there left none of them
              // readable. Guarded rather than always rendered — a never-opened
              // entry (only reachable through a hand-edited config) carries
              // epoch 0, and "1 de jan. de 1970" would be a lie dressed as data.
              <span className="wb-ws-row-time">{relativeTimeLabel(entry.lastOpenedAt)}</span>
            )}
          </span>
          <span className="wb-ws-row-meta">
            <span
              className="wb-ws-row-state"
              title={state === 'light' ? t('workspaces.stateLightTitle') : undefined}
            >
              <StateIcon state={state} />
              {stateLabel}
            </span>
            <span className="wb-ws-row-sep" aria-hidden="true" />
            <span className="wb-ws-row-path">{locationOf(entry.path)}</span>
          </span>
        </span>
      </button>
      <span className="wb-ws-row-tail">
        {position <= 9 && !active && (
          <span className="wb-ws-row-jump" aria-hidden="true">
            {t('workspaces.jumpShortcut', position)}
          </span>
        )}
        <RowMenu entry={entry} {...menuActions} />
      </span>
    </li>
  )
}
