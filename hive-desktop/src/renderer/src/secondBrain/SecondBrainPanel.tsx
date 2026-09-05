import { Button } from '@hive/design-system'
import { t } from '../i18n'
import type { RoleAction } from '../ui/ActionRail'
import {
  BrainIcon,
  CheckCircleIcon,
  CloseIcon,
  FileTextIcon,
  GaugeIcon,
  ChatBubbleIcon,
  MicIcon,
  PlusIcon,
  RefreshIcon
} from '../ui/icons'
import { FileTree } from '../explorer/Explorer'
import type { BrainSetup } from './useBrainSetup'
import type { SecondBrainStore } from './useSecondBrain'
import { VaultHealthCard } from './VaultHealthCard'
import { SECOND_BRAIN_INGEST, SECOND_BRAIN_LINT } from './secondBrainPrompts'

interface SecondBrainPanelProps {
  /** Vault status + health for the active workspace (SB-R2, SB-R10). */
  store: SecondBrainStore
  /** Launches a Second Brain slash command through the chat (SB-R2.4, D-SB-5). */
  onLaunch: (action: RoleAction) => void
  /** Opens the ask surface (SB-R9.1) — the panel's primary action. */
  onAsk: () => void
  /** Opens a vault file in the editor (SB-R2.3) — the same tab machinery the Explorer opens into. */
  onOpenFile: (path: string, opts?: { pin?: boolean }) => void
  /** The vault-setup flow: launch it, re-probe for it, acknowledge it. */
  setup: BrainSetup
  /** Opens the capture sheet — the hand-off after a base is created. */
  onIngest: () => void
  /** The file the editor currently has open — kept highlighted in the vault tree, like the Explorer's. */
  selectedPath?: string | null
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
 * What a configured base actually gives back, in the order the user will meet
 * it: ask it, feed it, keep it. Three lines rather than three cards — the rail
 * is 200-400px wide and cards here would be decoration standing in for content.
 */
const PROMISES = [
  { key: 'promiseAsk', icon: <ChatBubbleIcon size={13} /> },
  { key: 'promiseCapture', icon: <MicIcon size={13} /> },
  { key: 'promiseOwn', icon: <FileTextIcon size={13} /> }
] as const

/**
 * SB-R2.2 — no base yet. An invitation that says what the base is for, and
 * (just as important) what pressing the button will do: the command runs as an
 * interview in a *new* conversation, which is a surprise worth spending one
 * line to prevent.
 */
function BrainInvite({ onStart }: { onStart: () => void }): React.JSX.Element {
  return (
    <div className="wb-brain-empty">
      <span className="wb-brain-empty-glyph" aria-hidden="true">
        <BrainIcon size={26} />
      </span>
      <p className="wb-brain-empty-title">{t('secondBrain.emptyTitle')}</p>
      <p className="wb-brain-empty-desc">{t('secondBrain.emptyDescription')}</p>
      <ul className="wb-brain-promises">
        {PROMISES.map(({ key, icon }) => (
          <li key={key} className="wb-brain-promise">
            <span className="wb-brain-promise-icon" aria-hidden="true">
              {icon}
            </span>
            {t(`secondBrain.${key}`)}
          </li>
        ))}
      </ul>
      <Button cut={false} className="wb-btn hds-btn-primary wb-brain-empty-cta" onClick={onStart}>
        {t('secondBrain.emptyCta')}
      </Button>
      <p className="wb-brain-empty-note">{t('secondBrain.emptyCtaNote')}</p>
    </div>
  )
}

/**
 * The setup is running: the agent is interviewing the user in the chat and the
 * vault appears here on its own the moment it hits disk (the store watches the
 * workspace). Two escape hatches, both quiet: re-probe now, or run the command
 * again if the conversation went nowhere.
 */
function BrainSetupRunning({ setup }: { setup: BrainSetup }): React.JSX.Element {
  return (
    <div className="wb-brain-empty" data-state="running">
      <span className="wb-brain-empty-glyph" data-pulse="true" aria-hidden="true">
        <BrainIcon size={26} />
      </span>
      <p className="wb-brain-empty-title" role="status">
        {t('secondBrain.setupRunningTitle')}
      </p>
      <p className="wb-brain-empty-desc">{t('secondBrain.setupRunningDescription')}</p>
      <span className="wb-brain-waiting" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <div className="wb-brain-empty-links">
        <button type="button" className="wb-brain-textlink" onClick={setup.recheck}>
          <RefreshIcon size={12} />
          {t('secondBrain.setupRecheck')}
        </button>
        <button type="button" className="wb-brain-textlink" onClick={setup.start}>
          {t('secondBrain.setupRelaunch')}
        </button>
      </div>
    </div>
  )
}

/**
 * SB-R2.2 → SB-R3: the base exists *because the user just made it*. Confirming
 * that and naming the one next step that makes it useful beats dropping them
 * into a panel of equal-weight actions and hoping.
 */
function BrainReadyBanner({
  vaultName,
  onIngest,
  onDismiss
}: {
  vaultName: string
  onIngest: () => void
  onDismiss: () => void
}): React.JSX.Element {
  return (
    <div className="wb-brain-ready" role="status">
      <span className="wb-brain-ready-glyph" aria-hidden="true">
        <CheckCircleIcon size={15} />
      </span>
      <div className="wb-brain-ready-text">
        <p className="wb-brain-ready-title">{t('secondBrain.readyTitle', vaultName)}</p>
        <p className="wb-brain-ready-desc">{t('secondBrain.readyDescription')}</p>
        <button type="button" className="wb-brain-ready-cta" onClick={onIngest}>
          {t('secondBrain.readyCta')}
        </button>
      </div>
      <button
        type="button"
        className="wb-brain-ready-close"
        aria-label={t('secondBrain.readyDismiss')}
        onClick={onDismiss}
      >
        <CloseIcon size={12} />
      </button>
    </div>
  )
}

/**
 * The "Second Brain" sidebar view (M12, SB-R2): the squad knowledge base's home.
 * With no vault it shows an inviting empty state whose CTA launches the
 * `/second-brain` setup wizard (SB-R2.2) — and, while that wizard runs, it says
 * so instead of pretending nothing was asked.
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
  onOpenFile,
  setup,
  onIngest,
  selectedPath
}: SecondBrainPanelProps): React.JSX.Element {
  if (!store.hasVault) {
    return (
      <div className="wb-brain-panel" aria-label={t('secondBrain.panelTitle')}>
        {setup.phase === 'running' ? (
          <BrainSetupRunning setup={setup} />
        ) : (
          <BrainInvite onStart={setup.start} />
        )}
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

      {setup.phase === 'ready' && (
        <BrainReadyBanner
          vaultName={vaultRel}
          onIngest={() => {
            setup.dismiss()
            onIngest()
          }}
          onDismiss={setup.dismiss}
        />
      )}

      <div className="wb-brain-top">
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
      </div>

      {/* SB-R2.3: the vault's own files, browsed with the *same* explorer the
          "Arquivos" view uses — rooted at the vault folder instead of the
          workspace. A knowledge base is a folder of documents; giving it a
          second, poorer file list (no icons, no rename, no context menu, no
          drag) taught two different sets of file-manager behaviours for one
          product. `wiki/` opens on arrival so the base's front door — its
          index — is one click away instead of behind a closed folder. */}
      <section className="wb-brain-files" aria-label={t('secondBrain.wikiTitle')}>
        <FileTree
          workspace={store.workspace}
          rootPath={vaultRel}
          title={t('secondBrain.wikiTitle')}
          initialExpandedPaths={[`${vaultRel}/wiki`]}
          selectedPath={selectedPath ?? null}
          onOpenFile={onOpenFile}
        />
      </section>
    </div>
  )
}
