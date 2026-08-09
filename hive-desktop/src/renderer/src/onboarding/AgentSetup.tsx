import { useCallback, useEffect, useState } from 'react'
import { Button, Spinner } from '@hive/design-system'
import { t } from '../i18n'
import { AgentPicker, type AgentMeta } from '../ui/AgentPicker'

interface AgentSetupProps {
  /** Called with the enabled agent ids + the chosen default once the user confirms. */
  onComplete: (agentIds: string[], defaultAgent: string) => void
}

/**
 * First-run agent picker (multi-agent + agent-onboarding). A required setup
 * step: enable one or more agent CLIs to drive the chat. Availability is
 * **detected** on this machine, the scan is re-runnable, and the two
 * npm-published CLIs can be installed from the card itself — see `AgentPicker`
 * for why the screen is shaped that way.
 *
 * This host owns the *list*: it seeds the enabled set from what was detected,
 * folds in an agent that finishes installing (enabling it, since installing an
 * agent is unambiguous consent to use it), and keeps the default coherent.
 */
export function AgentSetup({ onComplete }: AgentSetupProps): React.JSX.Element {
  const [agents, setAgents] = useState<AgentMeta[]>([])
  // Separate from `agents` being empty: "we haven't looked yet" and "we looked
  // and found nothing" are different screens, and conflating them into
  // `AgentMeta[] | null` put a `?? []` on every later read of the list.
  const [detecting, setDetecting] = useState(true)
  const [enabled, setEnabled] = useState<string[]>([])
  const [defaultAgent, setDefaultAgent] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    let cancelled = false
    window.hive.profile.agents().then((list) => {
      if (cancelled) return
      setAgents(list)
      setDetecting(false)
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

  /**
   * Switches on agents that just became usable — found by a re-scan, or
   * installed from a card — and gives the first of them the default when
   * nothing holds it yet. Shared by both paths because both mean the same
   * thing to the user: this one works now.
   */
  function adopt(ids: string[]): void {
    if (ids.length === 0) return
    setEnabled((current) => [...current, ...ids.filter((id) => !current.includes(id))])
    setDefaultAgent((current) => current ?? ids[0])
  }

  const handleRefresh = useCallback(() => {
    setRefreshing(true)
    // What we already knew about *before* asking again. Only an agent that
    // crosses from missing to found gets switched on: re-enabling one the user
    // deliberately turned off would make "procurar de novo" quietly overrule a
    // choice they made on this very screen.
    const knownAvailable = new Set(
      agents.filter((agent) => agent.available).map((agent) => agent.id)
    )
    window.hive.profile
      .agents(true)
      .then((list) => {
        setAgents(list)
        const appeared = list
          .filter((agent) => agent.available && !knownAvailable.has(agent.id))
          .map((agent) => agent.id)
        adopt(appeared)
      })
      .finally(() => setRefreshing(false))
  }, [agents])

  const handleInstalled = useCallback((agent: AgentMeta) => {
    setAgents((current) => current.map((entry) => (entry.id === agent.id ? agent : entry)))
    adopt([agent.id])
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

        {detecting ? (
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
            startInstall={(id, onEvent) => window.hive.profile.installAgent(id, onEvent)}
            onInstalled={handleInstalled}
            onRefresh={handleRefresh}
            refreshing={refreshing}
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
