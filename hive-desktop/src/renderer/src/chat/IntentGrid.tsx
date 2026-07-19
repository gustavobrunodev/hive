import type { ReactNode } from 'react'
import { relativeTimeLabel, shortcutLabel, t } from '../i18n'
import { shortcutIcon } from '../ui/roleVisuals'
import { ChatBubbleIcon, HiveCellIcon, SlidersIcon } from '../ui/icons'
import type { RoleAction } from '../ui/ActionRail'
import { sessionTitle, type ChatSessionMeta } from './sessionMeta'

interface IntentGridProps {
  /** The current role's resolved actions (role-personalization RP-R4). */
  actions: RoleAction[]
  /** Launches an action as a workflow turn. */
  onLaunch: (action: RoleAction) => void
  /** The chat composer, rendered inside the hero: on an empty conversation the prompt IS the main affordance, so it sits center-stage instead of docked at the bottom. */
  composer?: ReactNode
  /** session-history: the latest stored conversations, offered as a quiet "continue" list under the composer. */
  recents?: ChatSessionMeta[]
  /** session-history: restores a recent conversation into the pane. */
  onOpenRecent?: (id: string) => void
  /** background-turns: conversation ids whose reply is still being generated ("Em andamento" indicator). */
  runningIds?: readonly string[]
  /** Display name — greets the user by (first) name when set. */
  userName?: string | null
  /** shortcut-customization: opens the "Personalizar atalhos" picker. */
  onCustomize?: () => void
}

/** First name only — the greeting is a hello, not a form field echo. */
function firstNameOf(name: string | null): string | null {
  const first = name?.trim().split(/\s+/)[0]
  return first && first.length > 0 ? first : null
}

/**
 * "What do you want to do today?" new-session hero (role-personalization RP-R4).
 * Renders the current role's actions — all launchable, no "planned/disabled"
 * row (that MVP split is gone for role actions). Workflow actions are compact
 * pills; the persona action ("Conversar com <especialista>") is grouped apart
 * as the warm, human entry point (`data-persona`), not just another chip.
 *
 * session-history adds a "continue where you left off" list under the
 * composer — the same Claude-Desktop home pattern: start something new above,
 * pick an ongoing thread below.
 */
export function IntentGrid({
  actions,
  onLaunch,
  composer,
  recents = [],
  onOpenRecent,
  runningIds = [],
  userName = null,
  onCustomize
}: IntentGridProps): React.JSX.Element {
  const workflows = actions.filter((action) => action.kind === 'workflow')
  const personas = actions.filter((action) => action.kind === 'persona')
  const firstName = firstNameOf(userName)

  function renderPill(action: RoleAction): React.JSX.Element {
    const Icon = shortcutIcon(action)
    return (
      <article
        key={action.key}
        role="button"
        tabIndex={0}
        data-lead="true"
        data-persona={action.kind === 'persona' || undefined}
        className="wb-pill"
        title={`/${action.command.key}`}
        onClick={() => onLaunch(action)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            onLaunch(action)
          }
        }}
      >
        <Icon size={14} />
        {shortcutLabel(action.key, action.kind, action.label)}
      </article>
    )
  }

  // shortcut-customization: the quiet "edit this set" affordance at the tail
  // of the pill row — always present (even when everything was deselected,
  // it's the way back in).
  const customizePill = onCustomize && (
    <button
      type="button"
      className="wb-pill wb-pill-customize"
      title={t('shortcuts.customizeTitle')}
      aria-label={t('shortcuts.customizeTitle')}
      onClick={onCustomize}
    >
      <SlidersIcon size={14} />
      {t('shortcuts.customizeLabel')}
    </button>
  )

  return (
    <div className="wb-hero-wrap">
      <div className="wb-chat-col wb-hero">
        <span className="wb-hero-mark" aria-hidden="true">
          <HiveCellIcon size={20} />
        </span>
        <h1 className="wb-hero-title">
          {firstName ? t('intentGrid.titleNamed', firstName) : t('intentGrid.title')}
        </h1>
        <p className="wb-hero-sub">{t('intentGrid.description')}</p>

        {(workflows.length > 0 || customizePill) && (
          <div className="wb-pills" role="list" data-tour="shortcuts">
            {workflows.map(renderPill)}
            {customizePill}
          </div>
        )}

        {personas.length > 0 && (
          <div className="wb-pills wb-pills-persona">
            <span className="wb-pills-persona-label">{t('intentGrid.personaLabel')}</span>
            {personas.map(renderPill)}
          </div>
        )}

        {composer && <div className="wb-hero-composer">{composer}</div>}

        {recents.length > 0 && onOpenRecent && (
          <div className="wb-hero-recents">
            <span className="wb-hero-recents-label">{t('chatHistory.heroRecentsLabel')}</span>
            <ul className="wb-hero-recent-list">
              {recents.map((meta) => {
                const title = sessionTitle(meta)
                const running = runningIds.includes(meta.id)
                return (
                  <li key={meta.id}>
                    <button
                      type="button"
                      className="wb-hero-recent"
                      aria-label={t('chatHistory.openAria', title)}
                      onClick={() => onOpenRecent(meta.id)}
                    >
                      <ChatBubbleIcon size={14} className="wb-hero-recent-icon" />
                      <span className="wb-hero-recent-title">{title}</span>
                      {running ? (
                        <span className="wb-history-running">
                          <span className="wb-history-running-dot" aria-hidden="true" />
                          {t('chatHistory.runningLabel')}
                        </span>
                      ) : (
                        <span className="wb-hero-recent-time">
                          {relativeTimeLabel(meta.updatedAt)}
                        </span>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
