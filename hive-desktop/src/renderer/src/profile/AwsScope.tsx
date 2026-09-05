import { Button, Gauge } from '@hive/design-system'
import { t } from '../i18n'
import { AwsLoginFlow } from '../aws/AwsLoginFlow'
import {
  formatAccountId,
  formatExpiry,
  formatRemaining,
  isLoginVisible,
  sessionFraction,
  toneFor,
  type AwsState
} from '../aws/awsSession'
import type { AwsSessionState, AwsStatus } from '../aws/useAwsSession'
import { useTicker } from '../chat/useTicker'
import { CheckIcon, CloudKeyIcon, ExternalLinkIcon, ShieldCheckIcon } from '../ui/icons'

interface AwsScopeProps {
  session: AwsSessionState
  onOpenUrl: (url: string) => void
  onCopyUrl: (url: string) => void
}

/** Where the AWS CLI's own install page lives — the only way out of `no-cli`. */
const AWS_CLI_DOCS = 'https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html'

const STATE_TITLE = {
  ready: 'aws.stateReady',
  expiring: 'aws.stateExpiring',
  expired: 'aws.stateExpired',
  absent: 'aws.stateAbsent',
  unmanaged: 'aws.stateUnmanaged',
  'not-configured': 'aws.stateNotConfigured'
} as const satisfies Record<AwsState, string>

const SOURCE_LABEL = {
  'claude-settings': 'aws.sourceClaudeSettings',
  'auth-refresh-command': 'aws.sourceAuthRefresh',
  hive: 'aws.sourceHive',
  environment: 'aws.sourceEnvironment',
  default: 'aws.sourceDefault'
} as const satisfies Record<AwsStatus['profileSource'], string>

/**
 * Only the kinds that reach `unmanaged`. The two SSO kinds never do (they get
 * the countdown instead), so listing them here would be dead copy the reader
 * of this file has to check against the state machine.
 */
const KIND_LABEL = {
  static: 'aws.kindStatic',
  process: 'aws.kindProcess',
  'assume-role': 'aws.kindAssumeRole',
  unknown: 'aws.kindUnknown'
} as const

/** The sentence under the headline — different advice per state, never a generic one. */
function hintFor(status: AwsStatus): string {
  if (status.state === 'unmanaged') {
    const kind = status.authKind in KIND_LABEL ? (status.authKind as keyof typeof KIND_LABEL) : null
    return t('aws.stateUnmanagedHint', t(kind ? KIND_LABEL[kind] : 'aws.kindUnknown'))
  }
  if (status.state === 'not-configured') return t('aws.stateNotConfiguredHint', status.profile)
  if (status.state === 'ready') return t('aws.stateReadyHint')
  if (status.state === 'expiring') return t('aws.stateExpiringHint')
  if (status.state === 'expired') return t('aws.stateExpiredHint')
  return t('aws.stateAbsentHint')
}

/**
 * The session ring, or a shield when there is no session to count down.
 *
 * A gauge that reads zero for a profile using static keys would be a lie shaped
 * like a measurement — nothing is draining, so nothing should be drawn as
 * draining.
 */
function SessionDial({ status, now }: { status: AwsStatus; now: number }): React.JSX.Element {
  if (status.state === 'unmanaged' || status.state === 'not-configured') {
    return (
      <span className="wb-aws-dial-static" data-state={status.state} aria-hidden="true">
        <ShieldCheckIcon size={22} />
      </span>
    )
  }
  // Counts down between the minute-granularity refreshes, so the ring is never
  // visibly wrong while the panel is open.
  const remaining =
    status.expiresAt !== null ? Date.parse(status.expiresAt) - now : status.expiresInMs
  // "expirada" is already a complete reading; pairing it with "restantes"
  // makes the ring say "expirada restantes", which is not a sentence. Measured
  // on the real panel in the Hive theme.
  const spent = remaining === null || remaining <= 0
  return (
    <Gauge
      value={sessionFraction(remaining)}
      label={t('aws.ringLabel')}
      valueText={formatRemaining(remaining)}
      {...(spent ? {} : { caption: t('aws.ringCaption') })}
      size={84}
    >
      {formatRemaining(remaining)}
    </Gauge>
  )
}

/** One `dt`/`dd` pair — omitted entirely when the value is unknown. */
function Fact({ label, value }: { label: string; value: string | null }): React.JSX.Element | null {
  if (!value) return null
  return (
    <div className="wb-aws-fact">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

/**
 * The profile list.
 *
 * Every row states whether it already has a live session, which is what turns
 * switching from a gamble into a decision — the alternative is picking one and
 * finding out from a failed message. The pinned choice is a radio-ish list
 * rather than a dropdown because there are rarely more than four profiles and
 * the *comparison* is the point.
 */
function ProfileList({
  status,
  pinned,
  onChoose
}: {
  status: AwsStatus
  pinned: boolean
  onChoose: (name: string | null) => void
}): React.JSX.Element | null {
  if (status.profiles.length === 0) return null
  return (
    <section className="wb-aws-profiles" aria-label={t('aws.switchTitle')}>
      <h4 className="wb-aws-profiles-title">{t('aws.switchTitle')}</h4>
      <p className="wb-aws-profiles-hint">{t('aws.switchHint')}</p>
      <ul className="wb-aws-profile-list">
        <li>
          <button
            type="button"
            className="wb-aws-profile"
            data-selected={!pinned || undefined}
            aria-pressed={!pinned}
            onClick={() => onChoose(null)}
          >
            <span className="wb-aws-profile-check" aria-hidden="true">
              {!pinned && <CheckIcon size={13} />}
            </span>
            <span className="wb-aws-profile-body">
              <span className="wb-aws-profile-name">{t('aws.profileAutoLabel')}</span>
              <span className="wb-aws-profile-meta">{t('aws.profileAutoHint')}</span>
            </span>
          </button>
        </li>
        {status.profiles.map((profile) => {
          const selected = pinned && profile.name === status.profile
          return (
            <li key={profile.name}>
              <button
                type="button"
                className="wb-aws-profile"
                data-selected={selected || undefined}
                aria-pressed={selected}
                onClick={() => onChoose(profile.name)}
              >
                <span className="wb-aws-profile-check" aria-hidden="true">
                  {selected && <CheckIcon size={13} />}
                </span>
                <span className="wb-aws-profile-body">
                  <span className="wb-aws-profile-name">{profile.name}</span>
                  <span className="wb-aws-profile-meta">
                    {[formatAccountId(profile.accountId), profile.roleName, profile.region]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
                <span
                  className="wb-aws-profile-session"
                  data-signed-in={profile.signedIn || undefined}
                >
                  {profile.signedIn ? t('aws.profileSignedIn') : t('aws.profileSignedOut')}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/**
 * Perfil › Conexão AWS — the standing answer to "will Claude work right now,
 * and as whom?".
 *
 * ## Why this screen exists at all
 *
 * The failure it replaces was silent until it was loud: a session expired
 * overnight, and the user found out from a turn that died quoting
 * `Error running awsAuthRefresh` — a sentence about a *repair* they had never
 * heard of, naming a file they had never opened. Everything that mattered
 * (which profile, which account, how much session was left, whether the AWS
 * CLI was even installed) existed only on disk.
 *
 * The panel leads with the one number that decides the day — how much session
 * is left, drawn as a ring so it is read before it is parsed — and then the
 * identity underneath it, because the second question is always "as whom?".
 * The profile list is last: it is a change, and changes belong under the state
 * they change.
 */
export function AwsScope({ session, onOpenUrl, onCopyUrl }: AwsScopeProps): React.JSX.Element {
  const { status, login } = session
  const now = useTicker(true)

  if (!status) return <div className="wb-aws-skeleton" aria-hidden="true" />

  if (!status.active) {
    return (
      <div className="wb-aws-scope">
        <div className="wb-aws-empty">
          <span className="wb-aws-empty-mark" aria-hidden="true">
            <CloudKeyIcon size={20} />
          </span>
          <h3 className="wb-aws-empty-title">{t('aws.inactiveTitle')}</h3>
          <p className="wb-aws-empty-hint">{t('aws.inactiveHint')}</p>
        </div>
      </div>
    )
  }

  const tone = toneFor(status.state)
  const expiry = formatExpiry(status.expiresAt)
  const canConnect = status.state !== 'unmanaged' && status.cliAvailable

  return (
    <div className="wb-aws-scope">
      <section className="wb-aws-card" data-tone={tone}>
        <SessionDial status={status} now={now} />
        <div className="wb-aws-card-body">
          <h3 className="wb-aws-card-title">{t(STATE_TITLE[status.state])}</h3>
          <p className="wb-aws-card-hint">{hintFor(status)}</p>
          {expiry && status.state !== 'unmanaged' && (
            <p className="wb-aws-card-expiry">{t('aws.expiresAt', expiry)}</p>
          )}
        </div>
        {canConnect && (
          <Button
            className="wb-btn wb-btn-sm wb-aws-card-cta"
            variant={status.state === 'ready' ? 'ghost' : 'primary'}
            onClick={() => session.connect()}
          >
            {status.state === 'absent' ? t('aws.connectCta') : t('aws.reconnectCta')}
          </Button>
        )}
      </section>

      {isLoginVisible(login.phase) && (
        <AwsLoginFlow
          state={login}
          now={now}
          onOpenUrl={onOpenUrl}
          onCopyUrl={onCopyUrl}
          onCancel={session.cancel}
          onRetry={() => session.connect()}
        />
      )}

      {!status.cliAvailable && (
        <section className="wb-aws-nocli">
          <h4 className="wb-aws-nocli-title">{t('aws.noCliTitle')}</h4>
          <p className="wb-aws-nocli-hint">{t('aws.noCliHint')}</p>
          <Button
            className="wb-btn wb-btn-sm"
            variant="ghost"
            onClick={() => onOpenUrl(AWS_CLI_DOCS)}
          >
            <ExternalLinkIcon size={14} aria-hidden="true" />
            {t('aws.noCliCta')}
          </Button>
        </section>
      )}

      <dl className="wb-aws-facts">
        <Fact label={t('aws.profileLabel')} value={status.profile} />
        <Fact label={t('aws.accountLabel')} value={formatAccountId(status.accountId)} />
        <Fact label={t('aws.roleLabel')} value={status.roleName} />
        <Fact label={t('aws.regionLabel')} value={status.region} />
      </dl>
      <p className="wb-aws-source">{t(SOURCE_LABEL[status.profileSource])}</p>

      <ProfileList
        status={status}
        pinned={status.profileSource === 'hive'}
        onChoose={session.chooseProfile}
      />
    </div>
  )
}
