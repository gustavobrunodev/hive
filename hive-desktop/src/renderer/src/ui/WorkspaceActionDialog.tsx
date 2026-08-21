import { useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Input
} from '@hive/design-system'
import { t } from '../i18n'
import { folderNameOf } from './workspaceName'
import type { WorkspaceInfo } from './useWorkspaces'

/**
 * A row action the user has asked for and not yet confirmed
 * (multi-workspace). Every one of these either writes to disk or changes what
 * the app considers its main workspace, so none of them fires straight off a
 * menu item.
 */
export type PendingWorkspaceAction =
  | { kind: 'promote'; entry: WorkspaceInfo }
  | { kind: 'adopt'; entry: WorkspaceInfo }
  | { kind: 'rename'; entry: WorkspaceInfo }
  | { kind: 'forget'; entry: WorkspaceInfo }

interface WorkspaceActionDialogProps {
  pending: PendingWorkspaceAction | null
  onClose: () => void
  onReload: () => void
  /**
   * Opens `path`, routed through the caller's unsaved-work guard. Promote and
   * adopt both end here: the install gate is a full surface bound to one
   * workspace, so the only honest way to "instalar o BMAD aqui" is to take
   * the user there and run it.
   */
  onSwitch: (path: string) => void
}

/** The rename form — the one action that asks for input rather than a yes/no. */
function RenameDialog({
  entry,
  onClose,
  onReload
}: {
  entry: WorkspaceInfo
  onClose: () => void
  onReload: () => void
}): React.JSX.Element {
  // Seeded once: the caller keys this component on the workspace path, so
  // opening the dialog on a second row remounts it rather than re-seeding it
  // from an effect (which React flags as a cascading render, and which is a
  // longer way to say "this is a different form").
  const [value, setValue] = useState(entry.name ?? '')

  function submit(): void {
    void window.hive.workspaces.rename(entry.path, value).then(onReload)
    onClose()
  }

  return (
    <Dialog open onOpenChange={(open: boolean) => !open && onClose()}>
      <DialogContent className="wb-ws-rename">
        <DialogTitle>{t('workspaces.renameTitle', entry.displayName)}</DialogTitle>
        <DialogDescription>{t('workspaces.renameDescription')}</DialogDescription>
        {/* No `<form>`: the DS `Button` doesn't take a `type`, so a submit
            button here would have to be a bare `<button>` outside the app's
            button vocabulary. Enter is wired on the field instead, which is
            the only thing the form element was buying. */}
        <label className="wb-ws-rename-label" htmlFor="wb-ws-rename-input">
          {t('workspaces.renameLabel')}
        </label>
        <Input
          id="wb-ws-rename-input"
          value={value}
          autoFocus
          placeholder={folderNameOf(entry.path)}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') submit()
          }}
        />
        <p className="wb-ws-rename-hint">{t('workspaces.renameHint', folderNameOf(entry.path))}</p>
        <div className="wb-dialog-actions">
          {/* Ghost: this is a two-button confirm, where "Cancelar" is the
              escape hatch, not a peer action. The app's three-way guards
              (`UnsavedGuardDialog`, `ReviewSwitchDialog`) keep the outlined
              default because there every button really is an alternative. */}
          <Button variant="ghost" className="wb-btn" onClick={onClose}>
            {t('workspaces.cancel')}
          </Button>
          <Button className="wb-btn hds-btn-primary" onClick={submit}>
            {t('workspaces.renameSave')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** Copy + effect for the three confirm-and-go actions, kept out of the JSX. */
function confirmSpec(
  pending: Exclude<PendingWorkspaceAction, { kind: 'rename' }>,
  handlers: { onReload: () => void; onSwitch: (path: string) => void }
): { title: string; body: string; confirm: string; danger: boolean; run: () => void } {
  const { entry } = pending
  switch (pending.kind) {
    case 'promote':
      return {
        title: t('workspaces.promoteTitle', entry.displayName),
        body: entry.provisioned
          ? t('workspaces.promoteBodyReady')
          : t('workspaces.promoteBodyInstall'),
        confirm: t('workspaces.promoteConfirm'),
        danger: false,
        run: () => {
          void window.hive.workspaces.setPrimary(entry.path).then(() => {
            handlers.onReload()
            handlers.onSwitch(entry.path)
          })
        }
      }
    case 'adopt':
      return {
        title: t('workspaces.adoptTitle', entry.displayName),
        body: t('workspaces.adoptBody'),
        confirm: t('workspaces.adoptConfirm'),
        danger: false,
        run: () => {
          void window.hive.workspaces.adopt(entry.path).then(() => {
            handlers.onReload()
            handlers.onSwitch(entry.path)
          })
        }
      }
    case 'forget':
      return {
        title: t('workspaces.forgetTitle', entry.displayName),
        body: t('workspaces.forgetBody'),
        confirm: t('workspaces.forgetConfirm'),
        // Destructive *to the list*, never to the disk — the copy says so, and
        // the button colour agrees that something is being removed.
        danger: true,
        run: () => {
          void window.hive.workspaces.forget(entry.path).then(handlers.onReload)
        }
      }
  }
}

/**
 * Renders whichever row action is pending (multi-workspace). One component for
 * all four so the confirm-then-reload sequence is written once — the failure
 * mode this avoids is three near-identical dialogs drifting apart in copy,
 * button order and what they do afterwards.
 */
export function WorkspaceActionDialog({
  pending,
  onClose,
  onReload,
  onSwitch
}: WorkspaceActionDialogProps): React.JSX.Element | null {
  if (!pending) return null
  if (pending.kind === 'rename') {
    return (
      <RenameDialog
        key={pending.entry.path}
        entry={pending.entry}
        onClose={onClose}
        onReload={onReload}
      />
    )
  }

  const spec = confirmSpec(pending, { onReload, onSwitch })
  return (
    <AlertDialog open onOpenChange={(open: boolean) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogTitle>{spec.title}</AlertDialogTitle>
        <AlertDialogDescription>{spec.body}</AlertDialogDescription>
        <div className="wb-dialog-actions">
          <AlertDialogCancel className="wb-btn" onClick={onClose}>
            {t('workspaces.cancel')}
          </AlertDialogCancel>
          <AlertDialogAction
            variant={spec.danger ? 'danger' : 'default'}
            onClick={() => {
              spec.run()
              onClose()
            }}
          >
            {spec.confirm}
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  )
}
