import type { ReactNode } from 'react'
import { roleActionLabel, t } from '../i18n'
import { actionIcon } from '../ui/roleVisuals'
import { HiveCellIcon } from '../ui/icons'
import type { RoleAction } from '../ui/ActionRail'

interface IntentGridProps {
  /** The current role's resolved actions (role-personalization RP-R4). */
  actions: RoleAction[]
  /** Launches an action as a workflow turn. */
  onLaunch: (action: RoleAction) => void
  /** The chat composer, rendered inside the hero: on an empty conversation the prompt IS the main affordance, so it sits center-stage instead of docked at the bottom. */
  composer?: ReactNode
}

/**
 * "What do you want to do today?" new-session hero (role-personalization RP-R4).
 * Renders the current role's actions — all launchable, no "planned/disabled"
 * row (that MVP split is gone for role actions). Workflow actions are compact
 * pills; the persona action ("Conversar com <especialista>") is grouped apart
 * as the warm, human entry point (`data-persona`), not just another chip.
 */
export function IntentGrid({ actions, onLaunch, composer }: IntentGridProps): React.JSX.Element {
  const workflows = actions.filter((action) => action.kind === 'workflow')
  const personas = actions.filter((action) => action.kind === 'persona')

  function renderPill(action: RoleAction): React.JSX.Element {
    const Icon = actionIcon(action.key)
    return (
      <article
        key={action.key}
        role="button"
        tabIndex={0}
        data-lead="true"
        data-persona={action.kind === 'persona' || undefined}
        className="wb-pill"
        onClick={() => onLaunch(action)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            onLaunch(action)
          }
        }}
      >
        <Icon size={14} />
        {roleActionLabel(action.key)}
      </article>
    )
  }

  return (
    <div className="wb-hero-wrap">
      <div className="wb-chat-col wb-hero">
        <span className="wb-hero-mark" aria-hidden="true">
          <HiveCellIcon size={20} />
        </span>
        <h1 className="wb-hero-title">{t('intentGrid.title')}</h1>
        <p className="wb-hero-sub">{t('intentGrid.description')}</p>

        {workflows.length > 0 && (
          <div className="wb-pills" role="list">
            {workflows.map(renderPill)}
          </div>
        )}

        {personas.length > 0 && (
          <div className="wb-pills wb-pills-persona">
            <span className="wb-pills-persona-label">{t('intentGrid.personaLabel')}</span>
            {personas.map(renderPill)}
          </div>
        )}

        {composer && <div className="wb-hero-composer">{composer}</div>}
      </div>
    </div>
  )
}
