import { useState } from 'react'
import { Button } from '@hive/design-system'
import { t } from '../i18n'
import { ChoiceGrid } from '../ui/ChoiceCard'
import { FolderIcon, HiveCellIcon } from '../ui/icons'
import { WorkspaceMark } from '../ui/WorkspaceMark'
import { folderNameOf } from '../ui/workspaceName'

/** Renderer-side mirror of `main/configStore.ts`'s `WorkspaceKind`. */
export type WorkspaceKind = 'managed' | 'light'

interface WorkspaceKindChoiceProps {
  /** Absolute path of the folder the user just picked. Nothing is written to it yet. */
  path: string
  onConfirm: (kind: WorkspaceKind) => void
  /** Abandons the add — the active workspace is untouched. */
  onCancel: () => void
}

/**
 * The one moment the app asks what it may write into a folder
 * (multi-workspace).
 *
 * It appears for a **secondary** workspace with no BMAD on disk, and only
 * then: the first workspace ever opened is the primary and always gets BMAD,
 * and a folder that already carries a `_bmad/` is adopted rather than
 * questioned — the answer is already on disk, so asking would be noise.
 *
 * Three things make this a decision rather than a dialog to dismiss:
 *  - nothing is preselected. Both outcomes are legitimate, and one of them
 *    creates folders inside a directory the user may not own;
 *  - each card names the folders it creates, so the promise is checkable
 *    rather than adjectival;
 *  - the confirm button restates the outcome ("Instalar e abrir" /
 *    "Abrir sem instalar"), so the last thing read before the click is what
 *    the click does.
 */
export function WorkspaceKindChoice({
  path,
  onConfirm,
  onCancel
}: WorkspaceKindChoiceProps): React.JSX.Element {
  const [kind, setKind] = useState<WorkspaceKind | null>(null)
  const name = folderNameOf(path)

  return (
    <main className="wb-gate">
      <div className="wb-gate-card wb-setup-card wb-wskind-card">
        <header className="wb-wskind-head">
          <WorkspaceMark path={path} name={name} size={44} />
          <div className="wb-wskind-head-text">
            <h1 className="wb-gate-title">{t('workspaceKind.title', name)}</h1>
            <p className="wb-wskind-path" title={path}>
              {path}
            </p>
          </div>
        </header>
        <p className="wb-gate-desc">{t('workspaceKind.description')}</p>

        <ChoiceGrid
          ariaLabel={t('workspaceKind.groupLabel')}
          value={kind}
          onChange={(id) => setKind(id as WorkspaceKind)}
          options={[
            {
              id: 'managed',
              icon: <HiveCellIcon size={20} />,
              title: t('workspaceKind.managedTitle'),
              description: t('workspaceKind.managedDescription'),
              extra: <span className="wb-wskind-detail">{t('workspaceKind.managedDetail')}</span>
            },
            {
              id: 'light',
              icon: <FolderIcon size={20} />,
              title: t('workspaceKind.lightTitle'),
              description: t('workspaceKind.lightDescription'),
              extra: <span className="wb-wskind-detail">{t('workspaceKind.lightDetail')}</span>
            }
          ]}
        />

        <div className="wb-setup-actions">
          {/* The hint is the disabled button's explanation. Without it the CTA
              is a dead control with no stated reason, which reads as a bug. */}
          <span className="wb-setup-selection-hint" role="status">
            {kind === null ? t('workspaceKind.pickHint') : ''}
          </span>
          {/* Ghost, not the DS default: while nothing is chosen the CTA is
              deliberately disabled, and an accent-outlined "Cancelar" next to
              a dimmed "Continuar" made the escape hatch the loudest thing on
              the screen. */}
          <Button cut={false} variant="ghost" className="wb-btn" onClick={onCancel}>
            {t('workspaceKind.cancel')}
          </Button>
          <Button
            cut={false}
            className="wb-btn wb-btn-lg hds-btn-primary"
            disabled={kind === null}
            onClick={() => kind && onConfirm(kind)}
          >
            {/* The label is the outcome, so the last thing read before the
                click is what the click does — and stays neutral until there
                *is* an outcome to name. */}
            {kind === null
              ? t('workspaceKind.confirmPending')
              : kind === 'light'
                ? t('workspaceKind.confirmLight')
                : t('workspaceKind.confirmManaged')}
          </Button>
        </div>
      </div>
    </main>
  )
}
