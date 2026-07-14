import { useEffect, useState } from 'react'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@hive/design-system'
import { roleMeta, t } from '../i18n'
import { ChoiceGrid, type ChoiceOption } from './ChoiceCard'
import { SELECTABLE_ROLE_IDS, roleIcon } from './roleVisuals'
import { BoltIcon, HiveCellIcon } from './icons'

/** Structural mirror of `main/agentRegistry.ts`'s `AgentMeta`. */
interface AgentMeta {
  id: string
  displayName: string
  description: string
  available: boolean
}

interface ProfileSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  role: string | null
  agent: string | null
  onRoleChange: (roleId: string) => void
  onAgentChange: (agentId: string) => void
}

/**
 * Profile / settings surface (role-personalization RP-R6, agent-selection
 * AG-R3.2) — a right-side `Sheet` (settings keep the work context visible
 * behind them, better than a center modal). Two sections, both reusing the
 * `ChoiceGrid` radiogroup in its `list` variant: change your **role** (updates
 * the rail + intent grid live) and your **agent** (re-binds the chat session).
 * Changes propagate through lifted state in `App` — no relaunch.
 */
export function ProfileSheet({
  open,
  onOpenChange,
  role,
  agent,
  onRoleChange,
  onAgentChange
}: ProfileSheetProps): React.JSX.Element {
  const [agents, setAgents] = useState<AgentMeta[]>([])

  useEffect(() => {
    let cancelled = false
    window.hive.profile.agents().then((list) => {
      if (!cancelled) setAgents(list)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const roleOptions: ChoiceOption[] = SELECTABLE_ROLE_IDS.map((roleId) => {
    const meta = roleMeta(roleId)
    const Icon = roleIcon(roleId)
    return {
      id: roleId,
      icon: <Icon size={20} />,
      title: meta.name,
      description: meta.description
    }
  })

  const agentOptions: ChoiceOption[] = agents.map((entry) => ({
    id: entry.id,
    icon: entry.available ? <HiveCellIcon size={20} /> : <BoltIcon size={20} />,
    title: entry.displayName,
    description: entry.description,
    disabled: !entry.available,
    badge: entry.available ? undefined : t('agentSetup.comingSoon')
  }))

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="wb-profile-sheet">
        <SheetTitle>{t('profile.title')}</SheetTitle>
        <SheetDescription>{t('profile.description')}</SheetDescription>

        <div className="wb-profile-section">
          <h3 className="wb-profile-section-label">{t('profile.roleSectionLabel')}</h3>
          <ChoiceGrid
            ariaLabel={t('profile.roleSectionLabel')}
            options={roleOptions}
            value={role}
            onChange={onRoleChange}
            variant="list"
          />
        </div>

        <div className="wb-profile-section">
          <h3 className="wb-profile-section-label">{t('profile.agentSectionLabel')}</h3>
          <ChoiceGrid
            ariaLabel={t('profile.agentSectionLabel')}
            options={agentOptions}
            value={agent}
            onChange={onAgentChange}
            variant="list"
          />
        </div>

        <p className="wb-profile-scope-note">{t('profile.scopeNote')}</p>
      </SheetContent>
    </Sheet>
  )
}
