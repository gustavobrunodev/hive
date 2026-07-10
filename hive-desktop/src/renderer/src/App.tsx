import { useCallback, useEffect, useState } from 'react'
import { Button, Panel, Spinner } from '@hive/design-system'
import { t } from './i18n'
import { WorkspacePicker } from './onboarding/WorkspacePicker'
import { GuidedInstall } from './onboarding/GuidedInstall'
import { UpdateGate } from './onboarding/UpdateGate'

type Theme = 'dark' | 'light'

const THEME_STORAGE_KEY = 'hive-desktop-theme'

/**
 * First-run + relaunch gate state (design.md §5.1–§5.2, tasks T6 + T9 + T10):
 *  - `checking`: initial `getWorkspace()` call is still in flight.
 *  - `picker`: no workspace persisted — show the workspace-pick screen.
 *  - `checkingProvisioned`: a workspace is known, checking `isProvisioned()`
 *    to decide between `installing` and `updating`.
 *  - `installing`: workspace known but not yet BMAD-provisioned — guided
 *    install screen (T9). Completing it goes straight to `ready` (a
 *    just-provisioned workspace doesn't need an update in the same launch).
 *  - `updating`: workspace already provisioned (a relaunch, R8.2) — auto-update
 *    gate (T10) runs before the work UI, per R4.1. Completing it (or the user
 *    choosing "continue anyway" after a failure, R4.2) goes to `ready`.
 *  - `ready`: the real work UI (T12/T15/T18/T19) replaces this placeholder
 *    wholesale.
 */
type OnboardingState =
  | { status: 'checking' }
  | { status: 'picker' }
  | { status: 'checkingProvisioned'; workspacePath: string }
  | { status: 'installing'; workspacePath: string }
  | { status: 'updating'; workspacePath: string }
  | { status: 'ready'; workspacePath: string }

function App(): React.JSX.Element {
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
    return stored === 'light' || stored === 'dark' ? stored : 'dark'
  })
  const [onboarding, setOnboarding] = useState<OnboardingState>({ status: 'checking' })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  }, [theme])

  useEffect(() => {
    let cancelled = false
    window.hive.getWorkspace().then((path) => {
      if (cancelled) return
      setOnboarding(
        path ? { status: 'checkingProvisioned', workspacePath: path } : { status: 'picker' }
      )
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Once a workspace is known (persisted, or just picked), decide between
  // the guided install (T9) and the auto-update gate (T10) based on
  // isProvisioned() (R2.3, R8.2: a returning user's remembered workspace
  // updates before the work UI; a fresh/unprovisioned one installs first).
  useEffect(() => {
    if (onboarding.status !== 'checkingProvisioned') return
    let cancelled = false
    const { workspacePath } = onboarding
    window.hive.isProvisioned().then((provisioned) => {
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
      // Cancelled pick resolves null — stay on the picker screen as-is.
      if (path) setOnboarding({ status: 'checkingProvisioned', workspacePath: path })
    })
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

  if (onboarding.status === 'checking' || onboarding.status === 'checkingProvisioned') {
    return (
      <main>
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
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
    <main>
      <Panel style={{ maxWidth: 480, margin: '48px auto', padding: 24, color: 'var(--ink)' }}>
        <h1>{t('app.title')}</h1>
        <p>{t('onboarding.workspaceReadyDescription', onboarding.workspacePath)}</p>
        <Button onClick={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}>
          {t('theme.toggle', theme === 'dark' ? t('theme.dark') : t('theme.light'))}
        </Button>
      </Panel>
    </main>
  )
}

export default App
