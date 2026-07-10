import { useCallback, useEffect, useState } from 'react'
import { Button, Panel, Spinner } from '@hive/design-system'
import { t } from './i18n'
import { WorkspacePicker } from './onboarding/WorkspacePicker'

type Theme = 'dark' | 'light'

const THEME_STORAGE_KEY = 'hive-desktop-theme'

/**
 * First-run gate state (design.md §5.1, task T6):
 *  - `checking`: initial `getWorkspace()` call is still in flight.
 *  - `picker`: no workspace persisted — show the workspace-pick screen.
 *  - `ready`: a workspace path is known (persisted, or just picked) — the
 *    guided-install screen (T9) replaces this placeholder wholesale.
 */
type OnboardingState =
  { status: 'checking' } | { status: 'picker' } | { status: 'ready'; workspacePath: string }

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
      setOnboarding(path ? { status: 'ready', workspacePath: path } : { status: 'picker' })
    })
    return () => {
      cancelled = true
    }
  }, [])

  const handleChooseWorkspace = useCallback(() => {
    window.hive.chooseWorkspace().then((path) => {
      // Cancelled pick resolves null — stay on the picker screen as-is.
      if (path) setOnboarding({ status: 'ready', workspacePath: path })
    })
  }, [])

  if (onboarding.status === 'checking') {
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
