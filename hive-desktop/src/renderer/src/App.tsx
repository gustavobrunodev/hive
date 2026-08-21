import { useCallback, useEffect, useState } from 'react'
import { Spinner } from '@hive/design-system'
import { t } from './i18n'
import { HiveLogo } from './ui/HiveLogo'
import { WorkspacePicker } from './onboarding/WorkspacePicker'
import { AgentSetup } from './onboarding/AgentSetup'
import { RoleSetup } from './onboarding/RoleSetup'
import { GuidedInstall } from './onboarding/GuidedInstall'
import { WorkspaceKindChoice, type WorkspaceKind } from './onboarding/WorkspaceKindChoice'
import { UpdateGate } from './onboarding/UpdateGate'
import { SecondBrainGate } from './onboarding/SecondBrainGate'
import { THEME_STORAGE_KEY, readStoredTheme, type Theme } from './ui/theme'
import type { WorkspaceRoute } from './ui/useWorkspaces'
import { WorkUI } from './WorkUI'

/**
 * First-run + relaunch gate state (design.md §5.1–§5.2, tasks T6 + T9 + T10):
 *  - `checking`: initial `getWorkspace()` call is still in flight.
 *  - `picker`: no workspace persisted — show the workspace-pick screen.
 *  - `routing`: a workspace is known — main is asked what it owes this
 *    specific path (multi-workspace: `light`/`managed`, BMAD on disk or not),
 *    and the verdict picks the next screen.
 *  - `choosingKind`: a folder has been picked but nothing written yet — the
 *    one moment the app asks whether it may install BMAD there.
 *  - `installing`: workspace known but not yet BMAD-provisioned — guided
 *    install screen (T9). Completing it goes straight to `ready` (a
 *    just-provisioned workspace doesn't need an update in the same launch).
 *  - `updating`: workspace already provisioned (a relaunch, R8.2) — auto-update
 *    gate (T10) runs before the work UI, per R4.1. Completing it (or the user
 *    choosing "continue anyway" after a failure, R4.2) goes to `ready`.
 *  - `ready`: the real work UI (`WorkUI`, T19 — composing `Explorer` + `Chat`).
 */
type OnboardingState =
  | { status: 'checking' }
  | { status: 'picker' }
  | { status: 'setupAgent'; workspacePath: string }
  | { status: 'setupRole'; workspacePath: string }
  | { status: 'routing'; workspacePath: string }
  | {
      status: 'choosingKind'
      /** Picked but not yet committed — nothing is persisted until the user answers. */
      candidatePath: string
      /** Where "Cancelar" goes back to; `null` only if there was nowhere to go back to. */
      returnTo: string | null
    }
  | { status: 'installing'; workspacePath: string }
  | { status: 'updating'; workspacePath: string }
  | { status: 'provisioningSecondBrain'; workspacePath: string }
  | { status: 'ready'; workspacePath: string }

/**
 * Turns main's routing verdict into the screen that serves it
 * (multi-workspace). All the rules live in `workspaceService.routeFor` — this
 * is the projection, so install-vs-update-vs-ask can be unit-tested in the
 * main process without a window, and the renderer can never drift from it.
 *
 * `returnTo` is where a cancelled `choose` goes back to: the workspace that
 * was active when the user started adding one.
 */
function stateForRoute(
  path: string,
  route: WorkspaceRoute,
  returnTo: string | null
): OnboardingState {
  switch (route.step) {
    case 'install':
      return { status: 'installing', workspacePath: path }
    case 'update':
      return { status: 'updating', workspacePath: path }
    case 'ready':
      return { status: 'ready', workspacePath: path }
    case 'choose':
      return { status: 'choosingKind', candidatePath: path, returnTo }
    case 'missing':
      // The folder went away between sessions: back to the first-run picker
      // rather than a dead work UI pointed at nothing.
      return { status: 'picker' }
  }
}

/**
 * Routes a known workspace to the next onboarding step (multi-agent /
 * role-personalization). Enabling ≥1 agent + picking a role are **required,
 * one-time, global** steps: shown only when unset, so a returning user (or a
 * workspace switch, where both are already set) skips straight to the
 * per-workspace install/update gate. Order: agents → role → provisioning.
 */
function routeAfterWorkspace(
  workspacePath: string,
  enabledAgents: string[],
  role: string | null
): OnboardingState {
  if (enabledAgents.length === 0) return { status: 'setupAgent', workspacePath }
  if (!role) return { status: 'setupRole', workspacePath }
  return { status: 'routing', workspacePath }
}

function App(): React.JSX.Element {
  const [theme, setTheme] = useState<Theme>(readStoredTheme)
  const [onboarding, setOnboarding] = useState<OnboardingState>({ status: 'checking' })
  // Lifted, app-wide profile state (multi-agent + role-personalization).
  // `agents` is the enabled set (the composer switcher's pool); `defaultAgent`
  // is the agent a new conversation starts on. Loaded once at startup and
  // updated live by the setup steps + the profile sheet; passed down to WorkUI
  // so the action rail / intent grid / chat all react without re-reading config.
  const [agents, setAgentsState] = useState<string[]>([])
  const [defaultAgent, setDefaultAgentState] = useState<string | null>(null)
  const [role, setRoleState] = useState<string | null>(null)
  // Display name (set in the install form, editable in the profile sheet) —
  // lifted like agent/role so the hero greeting reacts to a profile edit.
  const [userName, setUserNameState] = useState<string | null>(null)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  }, [theme])

  useEffect(() => {
    let cancelled = false
    Promise.all([
      window.hive.getWorkspace(),
      window.hive.profile.getAgents(),
      window.hive.profile.getAgent(),
      window.hive.profile.getRole(),
      window.hive.profile.getUserName()
    ]).then(([path, loadedAgents, loadedDefault, loadedRole, loadedUserName]) => {
      if (cancelled) return
      const enabled = loadedAgents ?? []
      setAgentsState(enabled)
      setDefaultAgentState(loadedDefault)
      setRoleState(loadedRole)
      setUserNameState(loadedUserName)
      setOnboarding(path ? routeAfterWorkspace(path, enabled, loadedRole) : { status: 'picker' })
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Once a workspace is known (persisted, or just picked), ask main what it
  // owes this specific path and render the screen that serves the answer
  // (WS-R3.3: routing depends on the selected path, never on a global config
  // flag — R2.3, R8.2). Opening it here is also what refreshes its MRU rank,
  // so the switcher's order is a fact about the app, not a guess.
  useEffect(() => {
    if (onboarding.status !== 'routing') return
    let cancelled = false
    const { workspacePath } = onboarding
    window.hive.openWorkspace(workspacePath).then((result) => {
      if (cancelled) return
      // A workspace that can no longer be opened (folder deleted between
      // sessions) drops back to the picker rather than into a dead work UI.
      setOnboarding(
        result.ok ? stateForRoute(workspacePath, result.route, null) : { status: 'picker' }
      )
    })
    return () => {
      cancelled = true
    }
  }, [onboarding])

  const handleChooseWorkspace = useCallback(() => {
    window.hive.workspaces.pickFolder().then((path) => {
      // Cancelled pick resolves null — stay on the picker screen as-is. A
      // first-time user still needs the required agent + role steps before the
      // work UI; a returning one (agents+role already set) skips them.
      if (!path) return
      void window.hive.openWorkspace(path).then((result) => {
        if (result.ok) setOnboarding(routeAfterWorkspace(path, agents, role))
      })
    })
  }, [agents, role])

  // Required agent step done (multi-agent): persist the enabled set + default,
  // lift them, and continue routing (role step next if still unset).
  const handleAgentSetupComplete = useCallback(
    (workspacePath: string, agentIds: string[], defaultId: string) => {
      void window.hive.profile.setAgents(agentIds)
      void window.hive.profile.setAgent(defaultId)
      setAgentsState(agentIds)
      setDefaultAgentState(defaultId)
      setOnboarding(routeAfterWorkspace(workspacePath, agentIds, role))
    },
    [role]
  )

  // Required role step done (role-personalization RP-R2): persist, lift, and
  // fall through to the per-workspace provisioning gate.
  const handleRoleSetupComplete = useCallback((workspacePath: string, roleId: string) => {
    void window.hive.profile.setRole(roleId)
    setRoleState(roleId)
    setOnboarding({ status: 'routing', workspacePath })
  }, [])

  // Live profile changes from the work UI's profile sheet (multi-agent).
  // `handleAgentsChange` persists + lifts the enabled set, keeping the default
  // coherent (mirrors main's `setEnabledAgents`); `handleDefaultAgentChange`
  // sets which enabled agent new conversations start on.
  const handleAgentsChange = useCallback(
    (ids: string[]) => {
      void window.hive.profile.setAgents(ids)
      setAgentsState(ids)
      const nextDefault = ids.includes(defaultAgent ?? '') ? defaultAgent : (ids[0] ?? null)
      if (nextDefault !== defaultAgent) {
        if (nextDefault) void window.hive.profile.setAgent(nextDefault)
        setDefaultAgentState(nextDefault)
      }
    },
    [defaultAgent]
  )

  const handleDefaultAgentChange = useCallback((agentId: string) => {
    void window.hive.profile.setAgent(agentId)
    setDefaultAgentState(agentId)
  }, [])

  // Display-name edit from the profile sheet: persist (main normalizes —
  // trims, empty clears to null) and lift the normalized value.
  const handleUserNameChange = useCallback((name: string) => {
    const trimmed = name.trim()
    void window.hive.profile.setUserName(trimmed === '' ? null : trimmed)
    setUserNameState(trimmed === '' ? null : trimmed)
  }, [])

  // BMAD provisioning done — hand off to the second-brain step (SB-R1.4,
  // D-SB-7): BMAD first, then second-brain, in one continuous gate. Both the
  // install and update BMAD paths converge here rather than jumping straight
  // to `ready`.
  const handleInstallComplete = useCallback((workspacePath: string) => {
    // The install form may have just captured the user's name (persisted in
    // main when the install kicked off) — pick it up for the hero greeting.
    void window.hive.profile.getUserName().then(setUserNameState)
    setOnboarding({ status: 'provisioningSecondBrain', workspacePath })
  }, [])

  const handleUpdateComplete = useCallback((workspacePath: string) => {
    setOnboarding({ status: 'provisioningSecondBrain', workspacePath })
  }, [])

  // Second-brain provisioning done (or "continue anyway" after a failure,
  // SB-R1.3) — the last gate step, into the work UI.
  const handleSecondBrainComplete = useCallback((workspacePath: string) => {
    setOnboarding({ status: 'ready', workspacePath })
  }, [])

  // T5 (WS-R4.1, WS-R4.4): runtime switch entry, invoked via `WorkUI`'s
  // `onCandidateWorkspace` (T7) once the user picks "Abrir pasta…" or a
  // Recentes entry. Re-enters the SAME onboarding gate used for first-run/
  // relaunch — `checkingProvisioned` re-derives install-vs-update for this
  // NEW path via the existing disk-based provisionState() effect above.
  // Note: the unsaved-work guard + session teardown (WS-R5) is T8's job,
  // layered inside WorkUI before it calls onCandidateWorkspace — this
  // handler only performs the state re-entry.
  const handleSwitchWorkspace = useCallback((workspacePath: string, route: WorkspaceRoute) => {
    // `WorkUI` has already opened the workspace (that is what produced
    // `route`), so this is the projection step only — no second round trip.
    setOnboarding(stateForRoute(workspacePath, route, null))
  }, [])

  /**
   * multi-workspace: the user picked a folder that Hive has never seen and
   * that carries no BMAD, and there is already a primary workspace — so the
   * kind question is owed. Nothing has been persisted at this point; the
   * active workspace is still whatever it was, which is what `returnTo`
   * carries so "Cancelar" can put it back on screen.
   */
  const handleCandidateKind = useCallback((candidatePath: string, returnTo: string) => {
    setOnboarding({ status: 'choosingKind', candidatePath, returnTo })
  }, [])

  /** The kind answer — the first moment anything about this folder is written. */
  const handleKindChosen = useCallback((candidatePath: string, kind: WorkspaceKind) => {
    void window.hive.openWorkspace(candidatePath, kind).then((result) => {
      if (result.ok) setOnboarding(stateForRoute(candidatePath, result.route, null))
    })
  }, [])

  if (onboarding.status === 'checking' || onboarding.status === 'routing') {
    return (
      <main className="wb-gate">
        <div className="wb-gate-inner">
          <HiveLogo className="wb-gate-logo" />
          <Spinner label={t('onboarding.checkingWorkspace')} />
        </div>
      </main>
    )
  }

  if (onboarding.status === 'picker') {
    return (
      <main>
        <WorkspacePicker onChooseWorkspace={handleChooseWorkspace} />
      </main>
    )
  }

  if (onboarding.status === 'setupAgent') {
    const { workspacePath } = onboarding
    return (
      <AgentSetup
        onComplete={(agentIds, defaultId) =>
          handleAgentSetupComplete(workspacePath, agentIds, defaultId)
        }
      />
    )
  }

  if (onboarding.status === 'setupRole') {
    const { workspacePath } = onboarding
    return <RoleSetup onComplete={(roleId) => handleRoleSetupComplete(workspacePath, roleId)} />
  }

  if (onboarding.status === 'choosingKind') {
    const { candidatePath, returnTo } = onboarding
    return (
      <WorkspaceKindChoice
        path={candidatePath}
        onConfirm={(kind) => handleKindChosen(candidatePath, kind)}
        onCancel={() =>
          setOnboarding(
            returnTo ? { status: 'ready', workspacePath: returnTo } : { status: 'picker' }
          )
        }
      />
    )
  }

  if (onboarding.status === 'installing') {
    const { workspacePath } = onboarding
    return (
      <GuidedInstall
        workspace={workspacePath}
        onComplete={() => handleInstallComplete(workspacePath)}
      />
    )
  }

  if (onboarding.status === 'updating') {
    const { workspacePath } = onboarding
    return (
      <UpdateGate
        workspace={workspacePath}
        onComplete={() => handleUpdateComplete(workspacePath)}
      />
    )
  }

  if (onboarding.status === 'provisioningSecondBrain') {
    const { workspacePath } = onboarding
    return (
      <SecondBrainGate
        workspace={workspacePath}
        onComplete={() => handleSecondBrainComplete(workspacePath)}
      />
    )
  }

  return (
    <WorkUI
      // WS-R4.4: keyed on the active workspace path so switching fully
      // unmounts/remounts the subtree (fresh file tree, fresh chat, no
      // leaked state from the previous workspace) instead of re-rendering
      // in place.
      key={onboarding.workspacePath}
      workspace={onboarding.workspacePath}
      theme={theme}
      onSelectTheme={setTheme}
      onCandidateWorkspace={handleSwitchWorkspace}
      onCandidateKind={handleCandidateKind}
      // Lifted profile state (multi-agent + role-personalization): the role,
      // the enabled agent set + default, and change handlers, so the action
      // rail, intent grid and chat all react to a profile change made in the
      // sheet. `role` has no setter here on purpose (shortcut-scopes): it is
      // chosen once, in the first-run `setupRole` step above, and is read-only
      // everywhere else.
      role={role}
      agents={agents}
      defaultAgent={defaultAgent}
      userName={userName}
      onAgentsChange={handleAgentsChange}
      onDefaultAgentChange={handleDefaultAgentChange}
      onUserNameChange={handleUserNameChange}
    />
  )
}

export default App
