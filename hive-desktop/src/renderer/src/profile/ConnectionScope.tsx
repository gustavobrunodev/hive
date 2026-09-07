import { useState } from 'react'
import { Button, Tabs, TabsContent, TabsList, TabsTrigger } from '@hive/design-system'
import { t } from '../i18n'
import { AgentClaudeIcon, CheckCircleIcon, CloudKeyIcon, ExternalLinkIcon } from '../ui/icons'
import { useTicker } from '../chat/useTicker'
import { AwsScope } from './AwsScope'
import type { AwsSessionState } from '../aws/useAwsSession'
import { ClaudeSignInFlow } from '../claudeAuth/ClaudeSignInFlow'
import {
  accountLine,
  isLoginVisible,
  toneFor,
  type ClaudeAuthState
} from '../claudeAuth/claudeSession'
import type { ClaudeAuthSession, ClaudeStatus } from '../claudeAuth/useClaudeAuth'

/** Which half of the connection screen is being looked at. */
export type ConnectionLane = 'claude' | 'aws'

export interface ConnectionScopeProps {
  /**
   * The lane a deep link asked for, or `null` to follow detection. A turn that
   * died on an AWS session opens the AWS lane even on a machine that otherwise
   * reads as first-party — the user clicked something specific.
   */
  initialLane?: ConnectionLane | null
  claude: ClaudeAuthSession
  aws: AwsSessionState
  onOpenUrl: (url: string) => void
  onCopyUrl: (url: string) => void
  onReadClipboard: () => Promise<string>
}

/** Where to send someone whose machine has no `claude` at all. */
const CLAUDE_INSTALL_DOCS = 'https://docs.claude.com/en/docs/claude-code/setup'

const STATE_TITLE = {
  connected: 'claude.stateConnected',
  'signed-out': 'claude.stateSignedOut',
  'api-key': 'claude.stateApiKey',
  'third-party': 'claude.stateThirdParty',
  'no-cli': 'claude.stateNoCli',
  unknown: 'claude.stateUnknown'
} as const satisfies Record<ClaudeAuthState, string>

const STATE_HINT = {
  connected: 'claude.stateConnectedHint',
  'signed-out': 'claude.stateSignedOutHint',
  'api-key': 'claude.stateApiKeyHint',
  'third-party': 'claude.stateThirdPartyHint',
  'no-cli': 'claude.stateNoCliHint',
  unknown: 'claude.stateUnknownHint'
} as const satisfies Record<ClaudeAuthState, string>

/**
 * Perfil › Conexão do Claude — the standing answer to "how is this computer
 * authorised, and will the next message work?".
 *
 * ## Why the two lanes are one screen
 *
 * There are exactly two ways Claude Code authenticates: a Claude account
 * talking straight to Anthropic, or somebody else's cloud (Bedrock, Vertex)
 * holding the credentials. Hive used to know only the second one — the panel
 * was called "Conexão AWS" — so the majority of machines opened settings and
 * found a screen about a service they do not use, while the thing that had
 * actually stopped their message had no surface at all.
 *
 * Putting them side by side is not a menu of options: **the CLI decides**, and
 * the strip states which one it decided, with the other one still readable.
 * That is the whole point of the layout — a user who is about to switch their
 * team to Bedrock, or who just came off it, can see both readings without
 * changing anything.
 *
 * The tab that opens is the lane in use. Changing tabs changes nothing about
 * the machine: it is a place to look, not a switch to flip, and no control on
 * either side pretends otherwise.
 */
export function ConnectionScope({
  initialLane = null,
  claude,
  aws,
  onOpenUrl,
  onCopyUrl,
  onReadClipboard
}: ConnectionScopeProps): React.JSX.Element {
  const status = claude.status
  const onBedrock = status?.state === 'third-party' || aws.status?.active === true
  // The user's pick, or none yet — **not** a copy of the detected lane. Both
  // readings arrive asynchronously (one of them costs a spawn), so seeding
  // state from them on first render pins the panel to whatever was true before
  // the machine had answered: a Bedrock user would open the sheet and find the
  // account lane, permanently.
  const [picked, setPicked] = useState<ConnectionLane | null>(initialLane)
  const lane: ConnectionLane = picked ?? (onBedrock ? 'aws' : 'claude')

  return (
    <div className="wb-conn-scope">
      <Tabs
        value={lane}
        onValueChange={(next) => setPicked(next as ConnectionLane)}
        className="wb-conn-tabs"
      >
        <TabsList className="wb-conn-lanes" variant="segmented">
          <TabsTrigger value="claude" className="wb-conn-lane">
            <span className="wb-conn-lane-mark" aria-hidden="true">
              <AgentClaudeIcon size={14} />
            </span>
            <span className="wb-conn-lane-text">
              <span className="wb-conn-lane-name">{t('claude.laneClaude')}</span>
              <span className="wb-conn-lane-meta">{claudeLaneMeta(status)}</span>
            </span>
            {!onBedrock && <LaneBadge />}
          </TabsTrigger>
          <TabsTrigger value="aws" className="wb-conn-lane">
            <span className="wb-conn-lane-mark" aria-hidden="true">
              <CloudKeyIcon size={14} />
            </span>
            <span className="wb-conn-lane-text">
              <span className="wb-conn-lane-name">{t('claude.laneBedrock')}</span>
              <span className="wb-conn-lane-meta">
                {onBedrock ? t('claude.laneBedrockOn') : t('claude.laneBedrockOff')}
              </span>
            </span>
            {onBedrock && <LaneBadge />}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="claude" className="wb-conn-panel">
          <ClaudeLane
            claude={claude}
            onOpenUrl={onOpenUrl}
            onCopyUrl={onCopyUrl}
            onReadClipboard={onReadClipboard}
          />
        </TabsContent>
        <TabsContent value="aws" className="wb-conn-panel">
          <AwsScope session={aws} onOpenUrl={onOpenUrl} onCopyUrl={onCopyUrl} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

/** "Em uso" — which lane the CLI actually authenticates through right now. */
function LaneBadge(): React.JSX.Element {
  return <span className="wb-conn-lane-badge">{t('claude.laneInUse')}</span>
}

/** The lane strip's one-line reading of the account, before the panel is opened. */
function claudeLaneMeta(status: ClaudeStatus | null): string {
  if (!status) return t('claude.laneReading')
  if (status.state === 'connected') {
    return accountLine(status.account) ?? t(STATE_TITLE.connected)
  }
  return t(STATE_TITLE[status.state as ClaudeAuthState])
}

/**
 * The first-party half: what the account is, and the one control that changes
 * it.
 *
 * The headline is the state and the sentence under it is the *consequence* —
 * "the next message will work", "the next message will stop here" — because
 * that is the question the panel gets opened to answer. The live sign-in
 * unfolds in place underneath rather than in a dialog, so the code field lands
 * in the surface the user is already looking at.
 */
function ClaudeLane({
  claude,
  onOpenUrl,
  onCopyUrl,
  onReadClipboard
}: {
  claude: ClaudeAuthSession
  onOpenUrl: (url: string) => void
  onCopyUrl: (url: string) => void
  onReadClipboard: () => Promise<string>
}): React.JSX.Element {
  const now = useTicker(true)
  const status = claude.status
  if (!status) return <div className="wb-aws-skeleton" aria-hidden="true" />

  const tone = toneFor(status.state)
  const account = accountLine(status.account)
  const canConnect = status.state !== 'no-cli' && status.state !== 'third-party'

  return (
    <div className="wb-claude-scope">
      <section className="wb-claude-card" data-tone={tone}>
        <span className="wb-claude-card-mark" data-tone={tone} aria-hidden="true">
          {status.state === 'connected' ? (
            <CheckCircleIcon size={22} />
          ) : (
            <AgentClaudeIcon size={22} />
          )}
        </span>
        <div className="wb-claude-card-body">
          <h3 className="wb-claude-card-title">{t(STATE_TITLE[status.state])}</h3>
          <p className="wb-claude-card-hint">{t(STATE_HINT[status.state])}</p>
          {account && <p className="wb-claude-card-account">{account}</p>}
        </div>
        {canConnect && (
          <Button
            className="wb-btn wb-btn-sm wb-claude-card-cta"
            variant={status.state === 'connected' ? 'ghost' : 'primary'}
            onClick={() => claude.connect()}
          >
            {status.state === 'connected' ? t('claude.switchCta') : t('claude.connectCta')}
          </Button>
        )}
      </section>

      {isLoginVisible(claude.login.phase) && (
        <ClaudeSignInFlow
          state={claude.login}
          now={now}
          onOpenUrl={onOpenUrl}
          onCopyUrl={onCopyUrl}
          onSubmitCode={claude.submitCode}
          onReadClipboard={onReadClipboard}
          onCancel={claude.cancel}
          onRetry={() => claude.connect()}
        />
      )}

      {status.state === 'no-cli' && (
        <section className="wb-claude-nocli">
          <h4 className="wb-claude-nocli-title">{t('claude.noCliTitle')}</h4>
          <p className="wb-claude-nocli-hint">{t('claude.noCliHint')}</p>
          <Button
            className="wb-btn wb-btn-sm"
            variant="ghost"
            onClick={() => onOpenUrl(CLAUDE_INSTALL_DOCS)}
          >
            <ExternalLinkIcon size={14} aria-hidden="true" />
            {t('claude.noCliCta')}
          </Button>
        </section>
      )}

      <p className="wb-claude-scope-note">{t('claude.scopeNote')}</p>
    </div>
  )
}
