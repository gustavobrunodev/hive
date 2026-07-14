import { useCallback, useEffect, useState } from 'react'
import { Spinner } from '@hive/design-system'
import { t } from './i18n'
import { HiveLogo } from './ui/HiveLogo'
import { WorkspacePicker } from './onboarding/WorkspacePicker'
import { AgentSetup } from './onboarding/AgentSetup'
import { RoleSetup } from './onboarding/RoleSetup'
import { GuidedInstall } from './onboarding/GuidedInstall'
import { UpdateGate } from './onboarding/UpdateGate'
import { WorkUI } from './WorkUI'

type Theme = 'dark' | 'light'

const THEME_STORAGE_KEY = 'hive-desktop-theme'

/**
 * First-run + relaunch gate state (design.md §5.1–§5.2, tasks T6 + T9 + T10):
 *  - `checking`: initial `getWorkspace()` call is still in flight.
 *  - `picker`: no workspace persisted — show the workspace-pick screen.
 *  - `checkingProvisioned`: a workspace is known, checking `provisionState()`
 *    (disk-based, for this specific path) to decide between `installing` and
 *    `updating`.
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
  | { status: 'checkingProvisioned'; workspacePath: string }
  | { status: 'installing'; workspacePath: string }
  | { status: 'updating'; workspacePath: string }
  | { status: 'ready'; workspacePath: string }

/**
 * Routes a known workspace to the next onboarding step (role-personalization
 * RP-C6 / agent-selection AG-C3). The agent + role are **required, one-time,
 * global** steps: shown only when unset, so a returning user (or a workspace
 * switch, where both are already set) skips straight to the per-workspace
 * install/update gate. Order: agent → role → provisioning.
 */
function routeAfterWorkspace(
  workspacePath: string,
  agent: string | null,
  role: string | null
): OnboardingState {
  if (!agent) return { status: 'setupAgent', workspacePath }
  if (!role) return { status: 'setupRole', workspacePath }
  return { status: 'checkingProvisioned', workspacePath }
}

function App(): React.JSX.Element {
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
    return stored === 'light' || stored === 'dark' ? stored : 'dark'
  })
  const [onboarding, setOnboarding] = useState<OnboardingState>({ status: 'checking' })
  // Lifted, app-wide profile state (agent-selection + role-personalization).
  // Loaded once at startup and updated live by the setup steps + the profile
  // sheet; passed down to WorkUI so the action rail / intent grid / chat
  // session all react to a change without re-reading config.
  const [agent, setAgentState] = useState<string | null>(null)
  const [role, setRoleState] = useState<string | null>(null)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  }, [theme])

  useEffect(() => {
    let cancelled = false
    Promise.all([
      window.hive.getWorkspace(),
      window.hive.profile.getAgent(),
      window.hive.profile.getRole()
    ]).then(([path, loadedAgent, loadedRole]) => {
      if (cancelled) return
      setAgentState(loadedAgent)
      setRoleState(loadedRole)
      setOnboarding(
        path ? routeAfterWorkspace(path, loadedAgent, loadedRole) : { status: 'picker' }
      )
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Once a workspace is known (persisted, or just picked), decide between
  // the guided install (T9) and the auto-update gate (T10) based on a
  // disk-based provisionState() check for this specific workspacePath
  // (WS-R3.3: routing must depend on the selected path, not a global
  // config flag — R2.3, R8.2: a returning user's remembered workspace
  // updates before the work UI; a fresh/unprovisioned one installs first).
  useEffect(() => {
    if (onboarding.status !== 'checkingProvisioned') return
    let cancelled = false
    const { workspacePath } = onboarding
    window.hive.provisionState(workspacePath).then((provisioned) => {
      if (cancelled) return
      setOnboarding(
        provisioned
          ? { status: 'updating', workspacePath }
          : { status: 'installing', workspacePath }
      )
    })
    return () => {
      cancelled = true
    }
  }, [onboarding])

  const handleChooseWorkspace = useCallback(() => {
    window.hive.chooseWorkspace().then((path) => {
      // Cancelled pick resolves null — stay on the picker screen as-is. A
      // first-time user still needs the required agent + role steps before the
      // work UI; a returning one (agent+role already set) skips them.
      if (path) setOnboarding(routeAfterWorkspace(path, agent, role))
    })
  }, [agent, role])

  // Required agent step done (agent-selection AG-R3.1): persist the choice,
  // lift it into state, and continue routing (role step next if still unset).
  const handleAgentSetupComplete = useCallback(
    (workspacePath: string, agentId: string) => {
      void window.hive.profile.setAgent(agentId)
      setAgentState(agentId)
      setOnboarding(routeAfterWorkspace(workspacePath, agentId, role))
    },
    [role]
  )

  // Required role step done (role-personalization RP-R2): persist, lift, and
  // fall through to the per-workspace provisioning gate.
  const handleRoleSetupComplete = useCallback((workspacePath: string, roleId: string) => {
    void window.hive.profile.setRole(roleId)
    setRoleState(roleId)
    setOnboarding({ status: 'checkingProvisioned', workspacePath })
  }, [])

  // Live profile changes from the work UI's profile sheet (RP-R6.2 / AG-R3.2).
  // Persisted in main (setAgent also re-binds the agent adapter there); lifting
  // the value here re-renders the rail/intent grid and, for the agent, keys
  // Chat's session effect so it restarts against the new adapter.
  const handleAgentChange = useCallback((agentId: string) => {
    void window.hive.profile.setAgent(agentId)
    setAgentState(agentId)
  }, [])

  const handleRoleChange = useCallback((roleId: string) => {
    void window.hive.profile.setRole(roleId)
    setRoleState(roleId)
  }, [])

  // A just-completed install doesn't need an update in the same launch —
  // goes straight to ready. A completed (or "continue anyway"-dismissed)
  // update also goes to ready; both handlers converge on the same
  // transition, kept separate for readability at each call site.
  const handleInstallComplete = useCallback((workspacePath: string) => {
    setOnboarding({ status: 'ready', workspacePath })
  }, [])

  const handleUpdateComplete = useCallback((workspacePath: string) => {
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
  const handleSwitchWorkspace = useCallback((workspacePath: string) => {
    setOnboarding({ status: 'checkingProvisioned', workspacePath })
  }, [])

  if (onboarding.status === 'checking' || onboarding.status === 'checkingProvisioned') {
    return (
      <main className="wb-gate">
        <div className="wb-gate-inner">
          <HiveLogo mark="brain" className="wb-gate-logo" />
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
    return <AgentSetup onComplete={(agentId) => handleAgentSetupComplete(workspacePath, agentId)} />
  }

  if (onboarding.status === 'setupRole') {
    const { workspacePath } = onboarding
    return <RoleSetup onComplete={(roleId) => handleRoleSetupComplete(workspacePath, roleId)} />
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

  return (
    <WorkUI
      // WS-R4.4: keyed on the active workspace path so switching fully
      // unmounts/remounts the subtree (fresh file tree, fresh chat, no
      // leaked state from the previous workspace) instead of re-rendering
      // in place.
      key={onboarding.workspacePath}
      workspace={onboarding.workspacePath}
      theme={theme}
      onToggleTheme={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
      onCandidateWorkspace={handleSwitchWorkspace}
      // Lifted profile state (agent-selection + role-personalization): the
      // active role/agent + change handlers, so the action rail, intent grid
      // and chat session all react to a profile change made in the sheet.
      role={role}
      agent={agent}
      onRoleChange={handleRoleChange}
      onAgentChange={handleAgentChange}
    />
  )
}

export default App
