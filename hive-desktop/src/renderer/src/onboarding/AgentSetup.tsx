import { useEffect, useState } from 'react'
import { Button, Spinner } from '@hive/design-system'
import { t } from '../i18n'
import { AgentPicker, type AgentMeta } from '../ui/AgentPicker'

interface AgentSetupProps {
  /** Called with the enabled agent ids + the chosen default once the user confirms. */
  onComplete: (agentIds: string[], defaultAgent: string) => void
}

/**
 * First-run agent picker (multi-agent). A required setup step: enable one or
 * more agent CLIs to drive the chat. Availability is **detected** on this
 * machine — available agents can be toggled on (the first is pre-enabled as the
 * default); unavailable ones render disabled with an install hint + a "Como
 * instalar" link. The user can enable several and pick which is the default for
 * new conversations. Built on the shared `AgentPicker` so onboarding and the
 * profile sheet speak the same vocabulary.
 */
export function AgentSetup({ onComplete }: AgentSetupProps): React.JSX.Element {
  const [agents, setAgents] = useState<AgentMeta[] | null>(null)
  const [enabled, setEnabled] = useState<string[]>([])
  const [defaultAgent, setDefaultAgent] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    window.hive.profile.agents().then((list) => {
      if (cancelled) return
      setAgents(list)
      // Pre-enable every agent detected on this machine (the user can toggle
      // any off), with the first as the default for new conversations.
      const available = list.filter((agent) => agent.available).map((agent) => agent.id)
      if (available.length > 0) {
        setEnabled(available)
        setDefaultAgent(available[0])
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  function handleToggle(id: string, next: boolean): void {
    setEnabled((current) => {
      const nextEnabled = next ? [...current, id] : current.filter((x) => x !== id)
      // Keep the default coherent: if it fell out (or none set yet), adopt the
      // first still-enabled agent.
      setDefaultAgent((currentDefault) =>
        nextEnabled.includes(currentDefault ?? '') ? currentDefault : (nextEnabled[0] ?? null)
      )
      return nextEnabled
    })
  }

  function handleContinue(): void {
    if (enabled.length > 0 && defaultAgent) onComplete(enabled, defaultAgent)
  }

  return (
    <main className="wb-gate">
      <div className="wb-gate-card wb-setup-card wb-agent-setup-card">
        <h1 className="wb-gate-title">{t('agentSetup.title')}</h1>
        <p className="wb-gate-desc">{t('agentSetup.description')}</p>

        {agents === null ? (
          <div className="wb-pane-center">
            <Spinner label={t('agentSetup.detecting')} />
          </div>
        ) : (
          <AgentPicker
            agents={agents}
            enabled={enabled}
            defaultAgent={defaultAgent}
            onToggle={handleToggle}
            onSetDefault={setDefaultAgent}
            onInstall={(url) => void window.hive.openExternal(url)}
          />
        )}

        <div className="wb-setup-actions">
          <span className="wb-setup-selection-hint" role="status">
            {t('agentSetup.selectionHint', enabled.length)}
          </span>
          <Button
            cut={false}
            className="wb-btn wb-btn-lg hds-btn-primary"
            disabled={enabled.length === 0}
            onClick={handleContinue}
          >
            {t('agentSetup.continueCta')}
          </Button>
        </div>
      </div>
    </main>
  )
}
