import { useEffect, useState } from 'react'
import { Button, Panel } from '@hive/design-system'

type Theme = 'dark' | 'light'

const THEME_STORAGE_KEY = 'hive-desktop-theme'

function App(): React.JSX.Element {
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
    return stored === 'light' || stored === 'dark' ? stored : 'dark'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  }, [theme])

  return (
    <main>
      <Panel style={{ maxWidth: 480, margin: '48px auto', padding: 24, color: 'var(--ink)' }}>
        <h1>Hive Desktop</h1>
        <p>Design system wired — placeholder content, replaced in later tasks.</p>
        <Button onClick={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}>
          Toggle theme (current: {theme})
        </Button>
      </Panel>
    </main>
  )
}

export default App
