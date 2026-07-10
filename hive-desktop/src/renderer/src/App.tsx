import { useCallback, useEffect, useState } from 'react'
import { Button, Panel, Spinner } from '@hive/design-system'
import { t } from './i18n'
import { WorkspacePicker } from './onboarding/WorkspacePicker'
import { GuidedInstall } from './onboarding/GuidedInstall'

type Theme = 'dark' | 'light'

const THEME_STORAGE_KEY = 'hive-desktop-theme'

/**
 * First-run gate state (design.md §5.1, tasks T6 + T9):
 *  - `checking`: initial `getWorkspace()` call is still in flight.
 *  - `picker`: no workspace persisted — show the workspace-pick screen.
 *  - `checkingProvisioned`: a workspace is known, checking `isProvisioned()`
 *    to decide between `installing` and `ready`.
 *  - `installing`: workspace known but not yet BMAD-provisioned — guided
 *    install screen (T9).
 *  - `ready`: workspace known and provisioned — the update gate (T10) and
 *    real work UI (T12/T15/T18/T19) replace this placeholder wholesale.
 */
type OnboardingState =
  | { status: 'checking' }
  | { status: 'picker' }
  | { status: 'checkingProvisioned'; workspacePath: string }
  | { status: 'installing'; workspacePath: string }
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
  // the guided install (T9) and the ready placeholder based on
  // isProvisioned(). T10 will insert an update gate before `ready` for the
  // already-provisioned branch — out of scope for this task.
  useEffect(() => {
    if (onboarding.status !== 'checkingProvisioned') return
    let cancelled = false
    const { workspacePath } = onboarding
    window.hive.isProvisioned().then((provisioned) => {
      if (cancelled) return
      setOnboarding(
        provisioned ? { status: 'ready', workspacePath } : { status: 'installing', workspacePath }
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

  const handleInstallComplete = useCallback((workspacePath: string) => {
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
