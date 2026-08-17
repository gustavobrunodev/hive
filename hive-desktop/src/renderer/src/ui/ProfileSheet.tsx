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
import { AgentPicker, type AgentMeta } from './AgentPicker'
import { ShellPicker, type ShellCatalogView } from './ShellPicker'
import { roleIcon } from './roleVisuals'
import type { ShortcutScope } from './ShortcutCustomizer'
import { ChatBubbleIcon, CheckIcon, CompassIcon, HiveCellIcon, SlidersIcon } from './icons'

interface ProfileSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The role chosen at first access — shown as context, never edited here. */
  role: string | null
  /** Enabled agent ids (multi-agent). */
  agents: string[]
  /** Default agent id (multi-agent) — new conversations start on it. */
  defaultAgent: string | null
  /** Display name (install form / here) — greets the user in the hero. */
  userName: string | null
  /** shortcut-scopes: how many shortcuts each set currently resolves to. */
  shortcutCounts?: Record<ShortcutScope, number>
  /** Opens the "Personalizar atalhos" picker on the given set. */
  onOpenShortcuts?: (scope: ShortcutScope) => void
  onAgentsChange?: (ids: string[]) => void
  onDefaultAgentChange?: (agentId: string) => void
  onUserNameChange: (name: string) => void
  /** Replays the guided tour (closes the sheet first). */
  onReplayTour?: () => void
}

/** Renders the role's icon element (a plain helper, not a per-render component alias — react-hooks/static-components). */
function roleIconEl(roleId: string): React.JSX.Element {
  const IconComponent = roleIcon(roleId)
  return <IconComponent size={18} />
}

/** One shortcut set's summary row — icon, set name, live count, all quiet. */
function ShortcutSetRow({
  icon,
  label,
  count
}: {
  icon: React.ReactNode
  label: string
  count: number
}): React.JSX.Element {
  return (
    <li className="wb-profile-shortcut-row">
      <span className="wb-profile-shortcut-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="wb-profile-shortcut-label">{label}</span>
      <span className="wb-profile-shortcut-count" data-empty={count === 0 || undefined}>
        {count === 0 ? t('profile.shortcutsEmpty') : t('profile.shortcutsCount', count)}
      </span>
    </li>
  )
}

/**
 * Profile / settings surface (role-personalization RP-R6, agent-selection
 * AG-R3.2) — a right-side `Sheet` (settings keep the work context visible
 * behind them, better than a center modal). Four sections: your **name** (how
 * the app and the agents address you — committed on blur/Enter, with a
 * transient "saved" check), your **role**, your **shortcuts** and your
 * **agent** (re-binds the chat session). Changes propagate through lifted
 * state in `App` — no relaunch.
 *
 * shortcut-scopes: the role is **read-only** here. It is chosen once, at first
 * access, and its only job afterwards is to seed the two shortcut sets —
 * re-picking it mid-flight would silently rewrite both, so the sheet shows
 * which role is active and sends anyone who wants different shortcuts to the
 * place that actually changes them.
 */
export function ProfileSheet({
  open,
  onOpenChange,
  role,
  agents,
  defaultAgent,
  userName,
  shortcutCounts = { start: 0, during: 0 },
  onOpenShortcuts,
  onAgentsChange = () => {},
  onDefaultAgentChange = () => {},
  onUserNameChange,
  onReplayTour
}: ProfileSheetProps): React.JSX.Element {
  // Detected agent metadata (availability + install hints) — re-probed each
  // time the sheet opens so a CLI the user just installed shows up.
  const [agentMetas, setAgentMetas] = useState<AgentMeta[]>([])
  const [rescanning, setRescanning] = useState(false)
  // agent-terminal: the shells on this machine + the persisted choice, read on
  // open for the same reason as the agents — a terminal installed since last
  // time has to be selectable without restarting the app.
  const [shellView, setShellView] = useState<ShellCatalogView | null>(null)
  const [shellScanning, setShellScanning] = useState(false)
  // Local draft so typing doesn't spam persistence — committed on blur/Enter.
  const [nameDraft, setNameDraft] = useState(userName ?? '')
  const [nameSaved, setNameSaved] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    window.hive.profile.agents().then((list) => {
      if (!cancelled) setAgentMetas(list)
    })
    window.hive.shell.list().then((view) => {
      if (!cancelled) setShellView(view)
    })
    return () => {
      cancelled = true
    }
  }, [open])

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

  const activeRole = roleMeta(role ?? 'general')

  // multi-agent: toggling an agent in the sheet updates the enabled set; the
  // default stays coherent (handled in App's `onAgentsChange`).
  function handleToggleAgent(id: string, next: boolean): void {
    onAgentsChange(next ? [...agents, id] : agents.filter((x) => x !== id))
  }

  /** AO-R2: re-probe every agent without closing the sheet. */
  function handleRescanAgents(): void {
    setRescanning(true)
    window.hive.profile
      .agents(true)
      .then(setAgentMetas)
      .finally(() => setRescanning(false))
  }

  /**
   * AO-R3/AO-R6: an agent installed from the sheet enables itself. Installing
   * one here is the same act of consent it is during onboarding, and a card
   * that flipped to "available" while staying switched off would read as the
   * install having half-worked.
   */
  function handleAgentInstalled(agent: AgentMeta): void {
    setAgentMetas((current) => current.map((entry) => (entry.id === agent.id ? agent : entry)))
    if (!agents.includes(agent.id)) onAgentsChange([...agents, agent.id])
  }

  /** AT-R2: persisting a choice re-reads the view, so the caveats follow it. */
  function handleSelectShell(id: string | null): void {
    void window.hive.shell.select(id).then(() => window.hive.shell.list().then(setShellView))
  }

  /** AT-R1: re-detect without closing the sheet (mirrors the agents' re-scan). */
  function handleRescanShells(): void {
    setShellScanning(true)
    window.hive.shell
      .list(true)
      .then(setShellView)
      .finally(() => setShellScanning(false))
  }

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
          <p className="wb-profile-section-hint">{t('profile.roleLockedHint')}</p>
          {/* Read-only identity, not a control: no radiogroup, no hover
              affordance, nothing that invites a click that won't happen. */}
          <div className="wb-profile-role">
            <span className="wb-profile-role-icon" aria-hidden="true">
              {roleIconEl(role ?? 'general')}
            </span>
            <span className="wb-profile-role-text">
              <span className="wb-profile-role-name">{activeRole.name}</span>
              <span className="wb-profile-role-desc">{activeRole.description}</span>
            </span>
          </div>
        </div>

        <div className="wb-profile-section">
          <h3 className="wb-profile-section-label">{t('profile.shortcutsSectionLabel')}</h3>
          <p className="wb-profile-section-hint">{t('profile.shortcutsSectionHint')}</p>
          <ul className="wb-profile-shortcut-sets">
            <ShortcutSetRow
              icon={<HiveCellIcon size={14} />}
              label={t('profile.shortcutsStartLabel')}
              count={shortcutCounts.start}
            />
            <ShortcutSetRow
              icon={<ChatBubbleIcon size={14} />}
              label={t('profile.shortcutsDuringLabel')}
              count={shortcutCounts.during}
            />
          </ul>
          {onOpenShortcuts && (
            <button
              type="button"
              className="wb-profile-shortcut-cta"
              onClick={() => onOpenShortcuts('start')}
            >
              <SlidersIcon size={15} />
              {t('profile.shortcutsCta')}
            </button>
          )}
        </div>

        <div className="wb-profile-section">
          <h3 className="wb-profile-section-label">{t('profile.agentSectionLabel')}</h3>
          <p className="wb-profile-section-hint">{t('profile.agentSectionHint')}</p>
          <AgentPicker
            agents={agentMetas}
            enabled={agents}
            defaultAgent={defaultAgent}
            onToggle={handleToggleAgent}
            onSetDefault={onDefaultAgentChange}
            onInstall={(url) => void window.hive.openExternal(url)}
            startInstall={(id, onEvent) => window.hive.profile.installAgent(id, onEvent)}
            onInstalled={handleAgentInstalled}
            onRefresh={handleRescanAgents}
            refreshing={rescanning}
          />
          {agents.length === 0 && (
            <p className="wb-profile-agent-warning" role="alert">
              {t('profile.agentEmptyWarning')}
            </p>
          )}
        </div>

        <div className="wb-profile-section">
          <h3 className="wb-profile-section-label">{t('profile.shellSectionLabel')}</h3>
          <p className="wb-profile-section-hint">{t('profile.shellSectionHint')}</p>
          <ShellPicker
            view={shellView}
            onSelect={handleSelectShell}
            onRefresh={handleRescanShells}
            refreshing={shellScanning}
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
