import { Button } from '@hive/design-system'
import { t } from '../i18n'
import type { RoleAction } from '../ui/ActionRail'
import { BrainIcon, FileTextIcon, GaugeIcon, PlusIcon } from '../ui/icons'
import type { SecondBrainStore } from './useSecondBrain'
import { VaultHealthCard } from './VaultHealthCard'
import { WikiTree } from './WikiTree'
import { SECOND_BRAIN_INGEST, SECOND_BRAIN_LINT, SECOND_BRAIN_SETUP } from './secondBrainPrompts'

interface SecondBrainPanelProps {
  /** Vault status + health for the active workspace (SB-R2, SB-R10). */
  store: SecondBrainStore
  /** Launches a Second Brain slash command through the chat (SB-R2.4, D-SB-5). */
  onLaunch: (action: RoleAction) => void
  /** Opens the ask surface (SB-R9.1) — the panel's primary action. */
  onAsk: () => void
  /** Opens a vault file in the editor (SB-R2.3, wired by the T8 wiki browser). */
  onOpenFile: (path: string) => void
}

/** One secondary launcher: icon + label, launches its slash command. */
function ActionButton({
  label,
  hint,
  icon,
  onClick
}: {
  label: string
  hint: string
  icon: React.ReactNode
  onClick: () => void
}): React.JSX.Element {
  return (
    <button type="button" className="wb-brain-action" title={hint} onClick={onClick}>
      <span className="wb-brain-action-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="wb-brain-action-label">{label}</span>
    </button>
  )
}

/**
 * The "Second Brain" sidebar view (M12, SB-R2): the squad knowledge base's home.
 * With no vault it shows an inviting empty state whose CTA launches the
 * `/second-brain` setup wizard (SB-R2.2).
 *
 * With a vault, the view is ordered by how often each thing is worth doing.
 * **Perguntar à base** leads — a knowledge base is read far more often than it
 * is written, so asking is the primary action here and everywhere else
 * (`Ctrl+Shift+K`, the floating button). Feeding and tending it follow as a
 * quieter pair, then the base's own health (SB-R10), then the wiki itself.
 */
export function SecondBrainPanel({
  store,
  onLaunch,
  onAsk,
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
        {/* SB-R9.1: asking is the base's reason to exist — it gets the weight,
            the accent, and the keyboard shortcut printed right on it. */}
        <button type="button" className="wb-brain-ask-cta" data-tour="brain-ask" onClick={onAsk}>
          <span className="wb-brain-ask-cta-icon" aria-hidden="true">
            <BrainIcon size={16} />
          </span>
          <span className="wb-brain-ask-cta-text">
            <span className="wb-brain-ask-cta-label">{t('secondBrain.ask')}</span>
            <span className="wb-brain-ask-cta-hint">{t('secondBrain.askHint')}</span>
          </span>
          <kbd className="wb-brain-ask-cta-kbd">{t('secondBrain.askShortcut')}</kbd>
        </button>

        <div className="wb-brain-action-pair">
          <ActionButton
            label={t('secondBrain.ingest')}
            hint={t('secondBrain.ingestHint')}
            icon={<PlusIcon size={14} />}
            onClick={() => onLaunch(SECOND_BRAIN_INGEST)}
          />
          <ActionButton
            label={t('secondBrain.lint')}
            hint={t('secondBrain.lintHint')}
            icon={<GaugeIcon size={14} />}
            onClick={() => onLaunch(SECOND_BRAIN_LINT)}
          />
        </div>
      </section>

      {/* SB-R10: the documented lint cadence, tracked and shown rather than
          left to memory. Its CTA launches the same `/second-brain-lint`. */}
      <VaultHealthCard
        health={store.health}
        onLint={() => onLaunch(SECOND_BRAIN_LINT)}
        onSnooze={store.snoozeHealth}
      />

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
