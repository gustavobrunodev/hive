import { Button } from '@hive/design-system'
import { t } from '../i18n'
import { BrainIcon, RefreshIcon } from '../ui/icons'
import type { BrainSetup } from './useBrainSetup'

interface VaultGuardProps {
  /** The vault-setup flow — its phase decides which of the two states shows. */
  setup: BrainSetup
  /** Which surface is blocked, so the copy names the thing the user came to do. */
  verb: 'ingest' | 'ask'
  /** Launches setup from here; the host closes itself, since the chat takes over. */
  onStart: () => void
}

/**
 * The one "there is no base yet" state (SB-R3.3, SB-R9), shared by the
 * ingestion sheet and the ask dialog so a blocked user reads the same thing
 * either way — the product register's consistency rule, and cheaper than two
 * guards drifting apart.
 *
 * Two states, because "no vault" has two very different meanings:
 * nobody has set one up (invite), or one is being set up right now in the chat
 * (wait, with a way to re-check). Telling a user to "configure a base primeiro"
 * while the agent is asking them how to configure it is the bug this replaces.
 */
export function VaultGuard({ setup, verb, onStart }: VaultGuardProps): React.JSX.Element {
  if (setup.phase === 'running') {
    return (
      <div className="wb-brain-guard" data-state="running">
        <span className="wb-brain-guard-glyph" data-pulse="true" aria-hidden="true">
          <BrainIcon size={20} />
        </span>
        <div className="wb-brain-guard-text">
          <p className="wb-brain-guard-title" role="status">
            {t('secondBrain.setupRunningTitle')}
          </p>
          <p className="wb-brain-guard-desc">{t('secondBrain.setupRunningDescription')}</p>
        </div>
        <button type="button" className="wb-brain-textlink" onClick={setup.recheck}>
          <RefreshIcon size={12} />
          {t('secondBrain.setupRecheck')}
        </button>
      </div>
    )
  }

  return (
    <div className="wb-brain-guard">
      <span className="wb-brain-guard-glyph" aria-hidden="true">
        <BrainIcon size={20} />
      </span>
      <div className="wb-brain-guard-text">
        <p className="wb-brain-guard-title">{t('secondBrain.ingestNoVaultTitle')}</p>
        <p className="wb-brain-guard-desc">
          {verb === 'ask'
            ? t('secondBrain.askNoVaultDescription')
            : t('secondBrain.ingestNoVaultDescription')}
        </p>
      </div>
      <Button cut={false} className="wb-btn hds-btn-primary" onClick={onStart}>
        {t('secondBrain.emptyCta')}
      </Button>
      <p className="wb-brain-guard-note">{t('secondBrain.emptyCtaNote')}</p>
    </div>
  )
}
