import { useCallback, useEffect, useMemo, useState } from 'react'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@hive/design-system'
import { roleMeta, shellName, t } from '../i18n'
import { ArrowLeftIcon } from '../ui/icons'
import { AgentPicker, type AgentMeta } from '../ui/AgentPicker'
import { ShellPicker, type ShellCatalogView } from '../ui/ShellPicker'
import type { ShortcutScope } from '../ui/ShortcutCustomizer'
import { useWhisperCatalog } from '../secondBrain/whisper/useWhisperCatalog'
import { useWhisperPreference } from '../secondBrain/whisper/useWhisperPreference'
import { AccountScope } from './AccountScope'
import { ProfileNav } from './ProfileNav'
import { ShortcutsScope } from './ShortcutsScope'
import { VoiceScope } from './VoiceScope'
import { preferenceSummary } from './voiceCopy'
import { scopeMeta, type ProfileScope } from './scopes'

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
  /** Which detail to open on, when something outside deep-links into the sheet. */
  initialScope?: ProfileScope | null
  /** Opens the "Personalizar atalhos" picker on the given set. */
  onOpenShortcuts?: (scope: ShortcutScope) => void
  onAgentsChange?: (ids: string[]) => void
  onDefaultAgentChange?: (agentId: string) => void
  onUserNameChange: (name: string) => void
  /** Replays the guided tour (closes the sheet first). */
  onReplayTour?: () => void
}

/**
 * Profile / settings surface (role-personalization RP-R6, agent-selection
 * AG-R3.2) — a right-side `Sheet` (settings keep the work context visible
 * behind them, better than a centre modal).
 *
 * **It is a drill-down, not a scroll.** Five sections stacked flat measured
 * 1771 px inside a 900 px panel, so the terminal picker and the tour lived
 * below the fold with nothing on screen announcing them. The sheet now opens on
 * an index that states the current setup — which agent, how many shortcuts,
 * which transcription model, which terminal — and each row opens exactly one
 * scope. Escape backs out of a detail before it closes the sheet, which is what
 * the visible back button already promises.
 *
 * Changes propagate through lifted state in `App` — no relaunch.
 */
export function ProfileSheet({
  open,
  onOpenChange,
  role,
  agents,
  defaultAgent,
  userName,
  shortcutCounts = { start: 0, during: 0 },
  initialScope = null,
  onOpenShortcuts,
  onAgentsChange = () => {},
  onDefaultAgentChange = () => {},
  onUserNameChange,
  onReplayTour
}: ProfileSheetProps): React.JSX.Element {
  const [scope, setScope] = useState<ProfileScope | null>(initialScope)
  // Detected agent metadata (availability + install hints) — re-probed each
  // time the sheet opens so a CLI the user just installed shows up.
  const [agentMetas, setAgentMetas] = useState<AgentMeta[]>([])
  const [rescanning, setRescanning] = useState(false)
  // agent-terminal: the shells on this machine + the persisted choice, read on
  // open for the same reason as the agents — a terminal installed since last
  // time has to be selectable without restarting the app.
  const [shellView, setShellView] = useState<ShellCatalogView | null>(null)
  const [shellScanning, setShellScanning] = useState(false)

  // voice-settings: the model choice is global, so it is read whenever the
  // sheet is open (the index row states it) rather than only inside its detail.
  const preference = useWhisperPreference(open)
  const catalog = useWhisperCatalog(open)

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

  // Re-opening the sheet lands on the index (or on whatever deep link asked
  // for), never on the detail the last visit happened to end in — a settings
  // panel that reopens two levels deep is disorienting, and the "back" that
  // would fix it is the same click the user just spent to get here.
  useEffect(() => {
    // Locally-defined function invoked immediately (the repo's GuidedInstall
    // `load()` pattern) — react-hooks/set-state-in-effect.
    function resetScope(): void {
      setScope(initialScope)
    }
    if (open) resetScope()
  }, [open, initialScope])

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

  // Keyed on the primitives, not on `shortcutCounts` — the host passes an
  // object literal, so a dependency on it is a new identity every render and
  // the memo never holds.
  const shortcutTotal = shortcutCounts.start + shortcutCounts.during
  const enabledCount = agents.length
  const resolvedPreference = preference.preference
  const summaries = useMemo(
    () => ({
      account: userName?.trim() || t('profile.summaryUnset'),
      agents: t('profile.agentsSummary', enabledCount),
      shortcuts: t('profile.shortcutsSummary', shortcutTotal),
      voice: preferenceSummary(resolvedPreference),
      shell: shellSummary(shellView)
    }),
    [userName, enabledCount, shortcutTotal, resolvedPreference, shellView]
  )

  const meta = scopeMeta(scope)
  const back = useCallback(() => setScope(null), [])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="wb-profile-sheet"
        data-view={scope ?? 'index'}
        // A drill-down owes a back gesture, and Escape is the one every desktop
        // user already has in their hands. Only the index closes the sheet.
        onEscapeKeyDown={(event) => {
          if (scope === null) return
          event.preventDefault()
          back()
        }}
      >
        {meta === null ? (
          <>
            <SheetTitle>{t('profile.title')}</SheetTitle>
            <SheetDescription>{t('profile.description')}</SheetDescription>
            <ProfileNav
              userName={userName}
              roleId={role ?? 'general'}
              roleName={roleMeta(role ?? 'general').name}
              summaries={summaries}
              onOpen={setScope}
              onReplayTour={onReplayTour}
            />
          </>
        ) : (
          <>
            <button
              type="button"
              className="wb-profile-back"
              aria-label={t('profile.backAria')}
              onClick={back}
            >
              <ArrowLeftIcon size={15} aria-hidden="true" />
              {t('profile.backTo')}
            </button>
            <SheetTitle>{meta.label}</SheetTitle>
            <SheetDescription>{meta.hint}</SheetDescription>

            <div className="wb-profile-detail" key={scope}>
              {scope === 'account' && (
                <AccountScope role={role} userName={userName} onUserNameChange={onUserNameChange} />
              )}
              {scope === 'agents' && (
                <div className="wb-profile-section">
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
              )}
              {scope === 'shortcuts' && (
                <ShortcutsScope counts={shortcutCounts} onOpenShortcuts={onOpenShortcuts} />
              )}
              {scope === 'voice' && <VoiceScope preference={preference} catalog={catalog} />}
              {scope === 'shell' && (
                <div className="wb-profile-section">
                  <ShellPicker
                    view={shellView}
                    onSelect={handleSelectShell}
                    onRefresh={handleRescanShells}
                    refreshing={shellScanning}
                    // file-clipboard: through the main process, never
                    // `navigator.clipboard` — this window's permission for it
                    // is denied.
                    onCopy={(text) => void window.hive.clipboard.writeText(text)}
                    onOpenUrl={(url) => void window.hive.openExternal(url)}
                  />
                </div>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

/**
 * The terminal row's summary.
 *
 * Says "Automático · Git Bash" rather than just "Automático", because the
 * automatic choice is the one a reader most needs spelled out — it is the only
 * value on the index that does not name itself.
 */
function shellSummary(view: ShellCatalogView | null): string | null {
  if (view === null) return null
  const resolved = view.shells.find((entry) => entry.id === view.resolvedId)
  if (resolved === undefined) return t('profile.summaryUnset')
  const name = shellName(resolved.id)
  return view.selectedId === null ? t('profile.autoSummary', name) : name
}
