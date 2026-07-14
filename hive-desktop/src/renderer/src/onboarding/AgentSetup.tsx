import { useEffect, useState } from 'react'
import { Button, Spinner } from '@hive/design-system'
import { t } from '../i18n'
import { ChoiceGrid, type ChoiceOption } from '../ui/ChoiceCard'
import { BoltIcon, HiveCellIcon } from '../ui/icons'

/** Structural mirror of `main/agentRegistry.ts`'s `AgentMeta` — local copy, same
 *  convention `chat/Chat.tsx` uses for `AgentCapabilities`. */
interface AgentMeta {
  id: string
  displayName: string
  description: string
  available: boolean
}

interface AgentSetupProps {
  /** Called with the chosen agent id once the user confirms (persisted here). */
  onComplete: (agentId: string) => void
}

/**
 * First-run agent picker (agent-selection AG-R3.1). A required setup step:
 * choose which agent CLI drives the chat. Available agents are selectable;
 * declared-but-not-yet-available ones (e.g. Devin) render disabled with an
 * "Em breve" badge so the roadmap is visible without pretending they work.
 * Built on the shared `.wb-gate` onboarding shell + the `ChoiceGrid` radiogroup.
 */
export function AgentSetup({ onComplete }: AgentSetupProps): React.JSX.Element {
  const [agents, setAgents] = useState<AgentMeta[] | null>(null)
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    window.hive.profile.agents().then((list) => {
      if (cancelled) return
      setAgents(list)
      // Preselect the first available agent so the required step has a sane
      // default the user can just confirm.
      setSelected((current) => current ?? list.find((agent) => agent.available)?.id ?? null)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const options: ChoiceOption[] = (agents ?? []).map((agent) => ({
    id: agent.id,
    icon: agent.available ? <HiveCellIcon size={20} /> : <BoltIcon size={20} />,
    title: agent.displayName,
    description: agent.description,
    disabled: !agent.available,
    badge: agent.available ? undefined : t('agentSetup.comingSoon')
  }))

  function handleContinue(): void {
    if (selected) onComplete(selected)
  }

  return (
    <main className="wb-gate">
      <div className="wb-gate-card wb-setup-card">
        <h1 className="wb-gate-title">{t('agentSetup.title')}</h1>
        <p className="wb-gate-desc">{t('agentSetup.description')}</p>

        {agents === null ? (
          <div className="wb-pane-center">
            <Spinner label={t('common.loading')} />
          </div>
        ) : (
          <ChoiceGrid
            ariaLabel={t('agentSetup.title')}
            options={options}
            value={selected}
            onChange={setSelected}
          />
        )}

        <div className="wb-setup-actions">
          <Button
            cut={false}
            className="wb-btn wb-btn-lg hds-btn-primary"
            disabled={!selected}
            onClick={handleContinue}
          >
            {t('agentSetup.continueCta')}
          </Button>
        </div>
      </div>
    </main>
  )
}
