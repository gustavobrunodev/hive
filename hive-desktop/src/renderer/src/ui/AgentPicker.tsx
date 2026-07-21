import { Switch } from '@hive/design-system'
import { t } from '../i18n'
import { agentVisual } from './agentVisuals'
import { CheckIcon, StarIcon } from './icons'

/** Structural mirror of `main/agentRegistry.ts`'s `AgentMeta` (renderer-side mirror convention). */
export interface AgentMeta {
  id: string
  displayName: string
  description: string
  available: boolean
  installHint: string
  docsUrl: string
}

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
}

/**
 * The multi-agent picker (multi-agent) — one selectable-card list shared by the
 * first-run `AgentSetup` and the profile sheet, so enabling agents looks and
 * behaves identically in both. Each row is an agent's brand mark (accent-tinted)
 * + name + description with:
 *  - a `Switch` to enable/disable it (only available agents — the CLI was
 *    detected on this machine),
 *  - a "Padrão" star (single-select across the enabled set) to pick the default,
 *  - for an *unavailable* agent, a muted disabled row with the install hint and
 *    a "Como instalar" link that opens the vendor docs.
 *
 * Availability is honest: an unavailable agent can't be enabled or defaulted —
 * it shows exactly how to turn it on instead of pretending to work.
 */
export function AgentPicker({
  agents,
  enabled,
  defaultAgent,
  onToggle,
  onSetDefault,
  onInstall
}: AgentPickerProps): React.JSX.Element {
  const available = agents.filter((a) => a.available)
  const unavailable = agents.filter((a) => !a.available)

  function renderCard(agent: AgentMeta): React.JSX.Element {
    const visual = agentVisual(agent.id)
    const isEnabled = enabled.includes(agent.id)
    const isDefault = defaultAgent === agent.id && isEnabled

    return (
      <li
        key={agent.id}
        className="wb-agent-card"
        style={{ ['--agent-accent' as string]: `var(${visual.accentVar})` }}
        data-enabled={isEnabled || undefined}
        data-unavailable={!agent.available || undefined}
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
          {!agent.available && (
            <span className="wb-agent-card-install">
              <span className="wb-agent-card-hint">{agent.installHint}</span>
              <button
                type="button"
                className="wb-agent-install-link"
                onClick={() => onInstall(agent.docsUrl)}
                aria-label={t('agentSetup.installCtaAria', agent.displayName)}
              >
                {t('agentSetup.installCta')}
              </button>
            </span>
          )}
        </span>

        {agent.available && (
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
        )}
        {isEnabled && (
          <span className="wb-agent-card-check" aria-hidden="true">
            <CheckIcon size={13} />
          </span>
        )}
      </li>
    )
  }

  return (
    <div className="wb-agent-picker">
      {available.length > 0 && (
        <div className="wb-agent-group">
          <p className="wb-agent-group-label">{t('agentSetup.availableSectionLabel')}</p>
          <ul className="wb-agent-list">{available.map(renderCard)}</ul>
        </div>
      )}
      {unavailable.length > 0 && (
        <div className="wb-agent-group">
          <p className="wb-agent-group-label">{t('agentSetup.unavailableSectionLabel')}</p>
          <ul className="wb-agent-list">{unavailable.map(renderCard)}</ul>
        </div>
      )}
    </div>
  )
}
