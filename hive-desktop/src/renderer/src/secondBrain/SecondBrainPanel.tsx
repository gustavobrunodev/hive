import { Button } from '@hive/design-system'
import { t } from '../i18n'
import type { RoleAction } from '../ui/ActionRail'
import { BrainIcon, FileTextIcon } from '../ui/icons'
import type { SecondBrainStore } from './useSecondBrain'
import { WikiTree } from './WikiTree'
import {
  SECOND_BRAIN_INGEST,
  SECOND_BRAIN_LINT,
  SECOND_BRAIN_QUERY,
  SECOND_BRAIN_SETUP
} from './secondBrainPrompts'

interface SecondBrainPanelProps {
  /** Vault status for the active workspace (SB-R2). */
  store: SecondBrainStore
  /** Launches a Second Brain slash command through the chat (SB-R2.4, D-SB-5). */
  onLaunch: (action: RoleAction) => void
  /** Opens a vault file in the editor (SB-R2.3, wired by the T8 wiki browser). */
  onOpenFile: (path: string) => void
}

/** One action launcher: label + one-line hint, launches its slash command. */
function ActionButton({
  label,
  hint,
  onClick
}: {
  label: string
  hint: string
  onClick: () => void
}): React.JSX.Element {
  return (
    <button type="button" className="wb-brain-action" onClick={onClick}>
      <span className="wb-brain-action-label">{label}</span>
      <span className="wb-brain-action-hint">{hint}</span>
    </button>
  )
}

/**
 * The "Second Brain" sidebar view (M12, SB-R2): the squad knowledge base's home.
 * With no vault it shows an inviting empty state whose CTA launches the
 * `/second-brain` setup wizard (SB-R2.2). With a vault it shows a header (name +
 * raw-pending chip) and the Ingerir / Consultar / Organizar action row, each
 * launching its slash command through the chat (SB-R2.4). The wiki browser
 * (index + tree) is layered in by T8.
 */
export function SecondBrainPanel({
  store,
  onLaunch,
  onOpenFile
}: SecondBrainPanelProps): React.JSX.Element {
  if (!store.hasVault) {
    return (
      <div className="wb-brain-panel" aria-label={t('secondBrain.panelTitle')}>
        <div className="wb-brain-empty">
          <BrainIcon size={40} className="wb-brain-empty-icon" />
          <p className="wb-brain-empty-title">{t('secondBrain.emptyTitle')}</p>
          <p className="wb-brain-empty-desc">{t('secondBrain.emptyDescription')}</p>
          <Button cut={false} className="wb-btn" onClick={() => onLaunch(SECOND_BRAIN_SETUP)}>
            {t('secondBrain.emptyCta')}
          </Button>
        </div>
      </div>
    )
  }

  // The vault's workspace-relative folder name — the prefix every fs bridge
  // call needs (the bridge speaks workspace-relative paths, never absolute).
  const vaultRel = store.vaultName ?? 'second-brain'

  return (
    <div className="wb-brain-panel" aria-label={t('secondBrain.panelTitle')}>
      <header className="wb-brain-head">
        <span className="wb-brain-title">{store.vaultName ?? t('secondBrain.panelTitle')}</span>
        {store.rawPending > 0 && (
          <span className="wb-brain-pending-chip">
            {t('secondBrain.pendingChip', store.rawPending)}
          </span>
        )}
      </header>

      <section className="wb-brain-actions" aria-label={t('secondBrain.actionsTitle')}>
        <ActionButton
          label={t('secondBrain.ingest')}
          hint={t('secondBrain.ingestHint')}
          onClick={() => onLaunch(SECOND_BRAIN_INGEST)}
        />
        <ActionButton
          label={t('secondBrain.query')}
          hint={t('secondBrain.queryHint')}
          onClick={() => onLaunch(SECOND_BRAIN_QUERY)}
        />
        <ActionButton
          label={t('secondBrain.lint')}
          hint={t('secondBrain.lintHint')}
          onClick={() => onLaunch(SECOND_BRAIN_LINT)}
        />
      </section>

      {/* SB-R2.3: the vault's structure — the wiki index and the wiki/ tree.
          Both open in the existing editor/viewer on click (Markdown gets M7's
          real preview). Paths are workspace-relative, like every fs bridge call. */}
      <section className="wb-brain-wiki" aria-label={t('secondBrain.wikiTitle')}>
        <h3 className="wb-brain-section-title">{t('secondBrain.wikiTitle')}</h3>
        <button
          type="button"
          className="wb-brain-wiki-row wb-brain-wiki-index"
          onClick={() => onOpenFile(`${vaultRel}/wiki/index.md`)}
          aria-label={t('secondBrain.openFileAria', `${vaultRel}/wiki/index.md`)}
        >
          <FileTextIcon size={14} className="wb-brain-wiki-icon" />
          <span className="wb-brain-wiki-name">{t('secondBrain.indexTitle')}</span>
        </button>
        <WikiTree
          workspace={store.workspace}
          rootRelPath={`${vaultRel}/wiki`}
          onOpenFile={onOpenFile}
          omitRootFile="index.md"
        />
      </section>
    </div>
  )
}
