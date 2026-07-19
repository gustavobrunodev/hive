import { useEffect, useState } from 'react'
import {
  Field,
  Input,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle
} from '@hive/design-system'
import { roleMeta, t } from '../i18n'
import { ChoiceGrid, type ChoiceOption } from './ChoiceCard'
import { SELECTABLE_ROLE_IDS, roleIcon } from './roleVisuals'
import { BoltIcon, CheckIcon, CompassIcon, HiveCellIcon } from './icons'

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
  /** Display name (install form / here) — greets the user in the hero. */
  userName: string | null
  onRoleChange: (roleId: string) => void
  onAgentChange: (agentId: string) => void
  onUserNameChange: (name: string) => void
  /** Replays the guided tour (closes the sheet first). */
  onReplayTour?: () => void
}

/**
 * Profile / settings surface (role-personalization RP-R6, agent-selection
 * AG-R3.2) — a right-side `Sheet` (settings keep the work context visible
 * behind them, better than a center modal). Three sections: your **name**
 * (how the app and the agents address you — committed on blur/Enter, with a
 * transient "saved" check), your **role** (updates the rail + intent grid
 * live) and your **agent** (re-binds the chat session), the latter two
 * reusing the `ChoiceGrid` radiogroup in its `list` variant. Changes
 * propagate through lifted state in `App` — no relaunch.
 */
export function ProfileSheet({
  open,
  onOpenChange,
  role,
  agent,
  userName,
  onRoleChange,
  onAgentChange,
  onUserNameChange,
  onReplayTour
}: ProfileSheetProps): React.JSX.Element {
  const [agents, setAgents] = useState<AgentMeta[]>([])
  // Local draft so typing doesn't spam persistence — committed on blur/Enter.
  const [nameDraft, setNameDraft] = useState(userName ?? '')
  const [nameSaved, setNameSaved] = useState(false)

  useEffect(() => {
    let cancelled = false
    window.hive.profile.agents().then((list) => {
      if (!cancelled) setAgents(list)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Re-sync the draft whenever the sheet (re)opens or the lifted value moves.
  // Deliberately does NOT clear `nameSaved`: committing a name lifts it
  // through App and right back into this prop, and clearing here would kill
  // the "Salvo" feedback the moment it appeared (its own 2s timer clears it).
  useEffect(() => {
    // Locally-defined function invoked immediately (the repo's GuidedInstall
    // `load()` pattern) — react-hooks/set-state-in-effect.
    function syncDraft(): void {
      setNameDraft(userName ?? '')
    }
    syncDraft()
  }, [userName, open])

  useEffect(() => {
    if (!nameSaved) return
    const timer = window.setTimeout(() => setNameSaved(false), 2000)
    return () => window.clearTimeout(timer)
  }, [nameSaved])

  function commitName(): void {
    const trimmed = nameDraft.trim()
    if (trimmed === (userName ?? '')) return
    onUserNameChange(trimmed)
    setNameSaved(true)
  }

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
          <h3 className="wb-profile-section-label">{t('profile.nameSectionLabel')}</h3>
          <div className="wb-profile-name-row">
            <Field label={t('profile.nameFieldLabel')} description={t('profile.nameHint')}>
              <Input
                value={nameDraft}
                placeholder={t('profile.namePlaceholder')}
                onChange={(event) => setNameDraft(event.target.value)}
                onBlur={commitName}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    commitName()
                  }
                }}
              />
            </Field>
            <span
              className="wb-profile-name-saved"
              data-visible={nameSaved || undefined}
              role="status"
            >
              <CheckIcon size={12} />
              {t('profile.nameSavedLabel')}
            </span>
          </div>
        </div>

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

        {onReplayTour && (
          <button type="button" className="wb-profile-tour-btn" onClick={onReplayTour}>
            <CompassIcon size={15} />
            {t('profile.replayTourCta')}
          </button>
        )}

        <p className="wb-profile-scope-note">{t('profile.scopeNote')}</p>
      </SheetContent>
    </Sheet>
  )
}
