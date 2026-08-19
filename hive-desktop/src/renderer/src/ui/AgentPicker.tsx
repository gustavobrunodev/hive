import { useCallback, useEffect, useRef, useState } from 'react'
import { Button, Spinner, Switch } from '@hive/design-system'
import { t } from '../i18n'
import { agentVisual } from './agentVisuals'
import { copyText } from './clipboard'
import {
  AlertTriangleIcon,
  CheckIcon,
  CopyIcon,
  DownloadIcon,
  ExternalLinkIcon,
  RefreshIcon,
  StarIcon
} from './icons'

/** Structural mirror of `main/agentRegistry.ts`'s `AgentMeta` (renderer-side mirror convention). */
export interface AgentMeta {
  id: string
  displayName: string
  description: string
  available: boolean
  /** What the detected CLI answered `--version` with, or `null`. */
  version: string | null
  /** The binary we looked for on `PATH`. */
  detectCommand: string
  installHint: string
  /** Whether Hive can install this agent itself. */
  installable: boolean
  /** The exact command Hive would run, or `null`. */
  installCommand: string | null
  docsUrl: string
}

/** Structural mirror of `main/agentInstaller.ts`'s `AgentInstallEvent`. */
export type AgentInstallEvent =
  | { type: 'progress'; message: string }
  | { type: 'done'; agent: AgentMeta }
  | {
      type: 'error'
      reason:
        'not-installable' | 'npm-missing' | 'permission' | 'network' | 'not-detected' | 'failed'
      detail?: string
    }

type InstallState =
  | { status: 'idle' }
  | { status: 'running'; line: string | null }
  | { status: 'failed'; reason: string; detail?: string }

interface AgentPickerProps {
  agents: AgentMeta[]
  /** Currently enabled agent ids (the switcher's pool). */
  enabled: string[]
  /** The default agent (new conversations start on it) — must be an enabled id. */
  defaultAgent: string | null
  /** Toggle an available agent on/off. */
  onToggle: (id: string, next: boolean) => void
  /** Promote an enabled agent to the default. */
  onSetDefault: (id: string) => void
  /** Open the agent's install docs (host default browser). */
  onInstall: (docsUrl: string) => void
  /** Starts an install, streaming events; returns a cancel function. */
  startInstall: (agentId: string, onEvent: (event: AgentInstallEvent) => void) => () => void
  /** An install finished and the CLI re-probed clean — the host swaps in the fresh metadata. */
  onInstalled: (agent: AgentMeta) => void
  /** Re-run detection across every agent (AO-R2). */
  onRefresh: () => void
  /** Whether a detection run is in flight (drives the strip's busy state). */
  refreshing: boolean
}

/**
 * The multi-agent picker (multi-agent + agent-onboarding) — one list shared by
 * the first-run `AgentSetup` and the profile sheet, so enabling agents looks
 * and behaves identically in both.
 *
 * It answers three questions in the order a user actually asks them, which is
 * also the order of the three groups:
 *
 *  1. **What can I use right now?** Detected CLIs, with the version the probe
 *     read back as evidence — a bare green dot asks the user to take our word
 *     for it, and this screen's whole credibility problem was that its word
 *     was wrong (the app reported "not installed" for a CLI that ran fine in
 *     every terminal; see `main/cliEnv.ts`).
 *  2. **What can I turn on without leaving?** The npm-published CLIs, each
 *     with an **Instalar** button that runs `npm i -g` inside the app and
 *     reports progress on the card. This is the point of the feature: the
 *     product exists so a non-CLI-fluent user never opens a terminal, and this
 *     was the one screen that required it.
 *  3. **What needs someone else?** Devin — an account and a browser login we
 *     can't do for them — keeps the docs link and gains no button we couldn't
 *     honour.
 *
 * Detection is re-runnable from here (the strip at the top), because "I just
 * installed it" is the exact moment the old screen had no answer for.
 */
export function AgentPicker({
  agents,
  enabled,
  defaultAgent,
  onToggle,
  onSetDefault,
  onInstall,
  startInstall,
  onInstalled,
  onRefresh,
  refreshing
}: AgentPickerProps): React.JSX.Element {
  const [installs, setInstalls] = useState<Record<string, InstallState>>({})
  const [copied, setCopied] = useState<string | null>(null)
  // Cancels for in-flight installs, so unmounting mid-install kills npm rather
  // than leaving it writing into a global prefix with nobody listening.
  const cancels = useRef(new Map<string, () => void>())

  useEffect(() => {
    const pending = cancels.current
    return () => {
      for (const cancel of pending.values()) cancel()
      pending.clear()
    }
  }, [])

  const install = useCallback(
    (agent: AgentMeta) => {
      cancels.current.get(agent.id)?.()
      setInstalls((current) => ({ ...current, [agent.id]: { status: 'running', line: null } }))
      const cancel = startInstall(agent.id, (event) => {
        if (event.type === 'progress') {
          setInstalls((current) => ({
            ...current,
            [agent.id]: { status: 'running', line: event.message }
          }))
          return
        }
        cancels.current.delete(agent.id)
        if (event.type === 'done') {
          setInstalls((current) => ({ ...current, [agent.id]: { status: 'idle' } }))
          onInstalled(event.agent)
          return
        }
        setInstalls((current) => ({
          ...current,
          [agent.id]: {
            status: 'failed',
            reason: t(`agentSetup.installError.${event.reason}`),
            detail: event.detail
          }
        }))
      })
      cancels.current.set(agent.id, cancel)
    },
    [startInstall, onInstalled]
  )

  function copyCommand(agent: AgentMeta): void {
    if (!agent.installCommand) return
    void copyText(agent.installCommand)
    setCopied(agent.id)
    window.setTimeout(() => setCopied((current) => (current === agent.id ? null : current)), 2000)
  }

  const ready = agents.filter((agent) => agent.available)
  const installable = agents.filter((agent) => !agent.available && agent.installable)
  const manual = agents.filter((agent) => !agent.available && !agent.installable)

  /** The enable/default controls — only a detected agent gets them. */
  function renderControls(agent: AgentMeta): React.JSX.Element {
    const isEnabled = enabled.includes(agent.id)
    const isDefault = defaultAgent === agent.id && isEnabled
    return (
      <span className="wb-agent-card-controls">
        <button
          type="button"
          className="wb-agent-default-btn"
          data-active={isDefault || undefined}
          disabled={!isEnabled}
          onClick={() => onSetDefault(agent.id)}
          aria-pressed={isDefault}
          aria-label={t('profile.agentSetDefaultAria', agent.displayName)}
          title={t('profile.agentDefaultBadge')}
        >
          <StarIcon size={15} filled={isDefault} />
        </button>
        <Switch
          checked={isEnabled}
          onCheckedChange={(checked) => onToggle(agent.id, checked === true)}
          aria-label={t('agentSetup.toggleAria', agent.displayName)}
        />
      </span>
    )
  }

  /** The install affordance + whatever state it is currently in. */
  function renderInstall(agent: AgentMeta): React.JSX.Element {
    const state = installs[agent.id] ?? { status: 'idle' }

    if (state.status === 'running') {
      return (
        <div className="wb-agent-card-install" data-state="running">
          <p className="wb-agent-install-status">
            <Spinner size={14} />
            <span>{t('agentSetup.installing', agent.displayName)}</span>
          </p>
          {state.line && (
            <p className="wb-agent-install-line" title={state.line}>
              {state.line}
            </p>
          )}
        </div>
      )
    }

    if (state.status === 'failed') {
      return (
        <div className="wb-agent-card-install" data-state="failed">
          <p className="wb-agent-install-error">
            <AlertTriangleIcon size={14} />
            <span>{state.reason}</span>
          </p>
          {state.detail && (
            <details className="wb-agent-install-detail">
              <summary>{t('agentSetup.installOutputLabel')}</summary>
              <pre>{state.detail}</pre>
            </details>
          )}
          <div className="wb-agent-install-row">
            <Button
              cut={false}
              className="wb-btn wb-btn-sm hds-btn-primary"
              onClick={() => install(agent)}
              aria-label={t('agentSetup.retryInstallAria', agent.displayName)}
            >
              <RefreshIcon size={13} />
              {t('agentSetup.retryInstall')}
            </Button>
            {agent.installCommand && (
              <button
                type="button"
                className="wb-agent-install-link"
                onClick={() => copyCommand(agent)}
                aria-label={t('agentSetup.copyCommandAria', agent.displayName)}
              >
                {copied === agent.id ? <CheckIcon size={12} /> : <CopyIcon size={12} />}
                {copied === agent.id ? t('agentSetup.copied') : t('agentSetup.copyCommand')}
              </button>
            )}
            {renderDocsLink(agent, 'quiet')}
          </div>
        </div>
      )
    }

    return (
      <div className="wb-agent-card-install">
        {agent.installCommand && (
          // Above the button, not below it: this says what the click is about
          // to run on the user's machine, which is only useful *before* it runs.
          <p className="wb-agent-install-command">
            {t('agentSetup.installRuns')} <code>{agent.installCommand}</code>
          </p>
        )}
        <div className="wb-agent-install-row">
          <Button
            cut={false}
            className="wb-btn wb-btn-sm hds-btn-primary"
            onClick={() => install(agent)}
            aria-label={t('agentSetup.installNowAria', agent.displayName)}
          >
            <DownloadIcon size={14} />
            {t('agentSetup.installNow')}
          </Button>
          {renderDocsLink(agent, 'quiet')}
        </div>
      </div>
    )
  }

  /**
   * The vendor-docs escape hatch. `quiet` when a real button sits next to it:
   * two chips of equal weight would make the user choose between "install" and
   * "read about installing", which is not a choice worth offering.
   */
  function renderDocsLink(agent: AgentMeta, weight: 'quiet' | 'chip' = 'chip'): React.JSX.Element {
    return (
      <button
        type="button"
        className="wb-agent-install-link"
        data-quiet={weight === 'quiet' || undefined}
        onClick={() => onInstall(agent.docsUrl)}
        aria-label={t('agentSetup.installCtaAria', agent.displayName)}
      >
        {t('agentSetup.installCta')}
        <ExternalLinkIcon size={12} />
      </button>
    )
  }

  /** The one line under the description that differs per group. */
  function renderStatusLine(agent: AgentMeta): React.JSX.Element {
    if (agent.available) {
      // Evidence, not reassurance: the command we found and what it answered.
      // This is the line that would have made the original bug report ("I
      // installed it and Hive can't see it") self-diagnosing.
      return (
        <span className="wb-agent-card-found">
          <code>{agent.detectCommand}</code>
          {agent.version && <span>{agent.version}</span>}
        </span>
      )
    }
    if (agent.installable) return renderInstall(agent)
    return (
      <span className="wb-agent-card-install">
        <span className="wb-agent-card-hint">{agent.installHint}</span>
        <span className="wb-agent-install-row">{renderDocsLink(agent)}</span>
      </span>
    )
  }

  function renderCard(agent: AgentMeta): React.JSX.Element {
    const visual = agentVisual(agent.id)
    const isEnabled = enabled.includes(agent.id)
    const isDefault = defaultAgent === agent.id && isEnabled
    const state = installs[agent.id]?.status ?? 'idle'

    return (
      <li
        key={agent.id}
        className="wb-agent-card"
        style={{ ['--agent-accent' as string]: `var(${visual.accentVar})` }}
        data-enabled={isEnabled || undefined}
        data-unavailable={!agent.available || undefined}
        data-installable={(!agent.available && agent.installable) || undefined}
        data-installing={state === 'running' || undefined}
      >
        <span className="wb-agent-card-mark" aria-hidden="true">
          <visual.icon size={20} />
        </span>
        <span className="wb-agent-card-body">
          <span className="wb-agent-card-title">
            {agent.displayName}
            {isDefault && (
              <span className="wb-agent-card-default">{t('profile.agentDefaultBadge')}</span>
            )}
          </span>
          <span className="wb-agent-card-desc">{agent.description}</span>
          {renderStatusLine(agent)}
        </span>

        {agent.available && renderControls(agent)}
      </li>
    )
  }

  function renderGroup(label: string, list: AgentMeta[]): React.JSX.Element | null {
    if (list.length === 0) return null
    return (
      <div className="wb-agent-group">
        <p className="wb-agent-group-label">{label}</p>
        <ul className="wb-agent-list">{list.map(renderCard)}</ul>
      </div>
    )
  }

  return (
    <div className="wb-agent-picker">
      <div className="wb-agent-scan" data-busy={refreshing || undefined}>
        {/* `aria-live`, not `role="status"`: the announcement is the same, and
            the picker's hosts (the setup footer, the sheet's "Salvo") already
            own a status region each — a third would make "the" status
            ambiguous to a screen reader and to a test alike. */}
        <p className="wb-agent-scan-text" aria-live="polite">
          {refreshing
            ? t('agentSetup.detecting')
            : t('agentSetup.scanSummary', ready.length, agents.length)}
        </p>
        <button
          type="button"
          className="wb-agent-scan-btn"
          onClick={onRefresh}
          disabled={refreshing}
        >
          <RefreshIcon size={13} />
          {t('agentSetup.rescan')}
        </button>
      </div>

      {ready.length === 0 && !refreshing && (
        <p className="wb-agent-empty">{t('agentSetup.emptyAvailable')}</p>
      )}

      {renderGroup(t('agentSetup.availableSectionLabel'), ready)}
      {renderGroup(t('agentSetup.installableSectionLabel'), installable)}
      {renderGroup(t('agentSetup.manualSectionLabel'), manual)}
    </div>
  )
}
