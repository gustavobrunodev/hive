import { t } from '../i18n'
import { ChevronDownIcon } from './icons'
import { WorkspaceMark } from './WorkspaceMark'
import { WorkspaceSwitcher } from './WorkspaceSwitcher'
import { folderNameOf } from './workspaceName'
import type { WorkspacesStore } from './useWorkspaces'

interface WorkspaceChipProps {
  /** Absolute path of the active workspace. */
  workspace: string
  /** The registry store (see `useWorkspaces`) — shared with the `Ctrl+N` jump. */
  workspaces: WorkspacesStore
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Switch to `path`, routed through the caller's unsaved-work guard. */
  onSwitch: (path: string) => void
  /** Start the add-workspace flow. */
  onAdd: () => void
}

/**
 * The title-bar workspace chip and the switcher it anchors (multi-workspace).
 *
 * A component of its own rather than JSX inside `WorkUI`: the chip is a
 * self-contained subject (which workspace am I in, and how do I leave), and
 * `WorkUI` is already the app's largest function — inlining this pushed it
 * past the complexity budget and made the React compiler bail on the whole
 * component, taking five unrelated `useCallback`s' memoization with it.
 *
 * The chip carries the active workspace's own mark rather than a generic
 * folder icon: with a list of workspaces, recognising where you are has to be
 * possible before reading, and the mark is the same one the panel's rows wear.
 */
export function WorkspaceChip({
  workspace,
  workspaces,
  open,
  onOpenChange,
  onSwitch,
  onAdd
}: WorkspaceChipProps): React.JSX.Element {
  const entry = workspaces.list.find((candidate) => candidate.path === workspace)
  // The registry's name once it has loaded, the folder name until then — so
  // the chip is never blank on first paint while the list is still in flight.
  const name = entry?.displayName ?? folderNameOf(workspace)

  return (
    <WorkspaceSwitcher
      workspaces={workspaces.list}
      active={workspace}
      open={open}
      onOpenChange={onOpenChange}
      onReload={workspaces.reload}
      onSwitch={onSwitch}
      onAdd={onAdd}
    >
      <button
        type="button"
        className="wb-workspace-chip"
        data-tour="workspace"
        title={t('workUI.workspaceChipTitle', workspace)}
        aria-label={t('workspaces.chipAria', name)}
      >
        <WorkspaceMark path={workspace} name={name} size={18} className="wb-workspace-chip-mark" />
        <span className="wb-workspace-chip-name">{name}</span>
        {entry?.kind === 'light' && (
          <span className="wb-workspace-chip-light" title={t('workspaces.stateLightTitle')}>
            {t('workspaces.stateLight')}
          </span>
        )}
        <ChevronDownIcon size={14} className="wb-workspace-chip-caret" />
      </button>
    </WorkspaceSwitcher>
  )
}
