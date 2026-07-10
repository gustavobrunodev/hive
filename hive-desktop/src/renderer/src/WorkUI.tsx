import { Button, Resizable, ResizableHandle, ResizablePanel } from '@hive/design-system'
import { t } from './i18n'
import { Explorer } from './explorer/Explorer'
import { Chat } from './chat/Chat'

interface WorkUIProps {
  /** Absolute path to the provisioned, up-to-date workspace. */
  workspace: string
  theme: 'dark' | 'light'
  onToggleTheme: () => void
}

/**
 * The app's main work surface (task T19, design.md §4 layout — "File Tree |
 * Chat | File Viewer"): composes `Explorer` (T12 — tree + viewer, already a
 * self-contained two-pane unit) and `Chat` (T15/T18 — conversation + guided
 * intents) side by side via the DS `Resizable` group.
 *
 * **Deliberate layout simplification vs. design.md's literal 3-column
 * diagram**: `Explorer` already owns an internal tree/viewer split (it needs
 * the selected-file state to live in one place), so splitting it into two
 * independent top-level panes here would mean lifting that state up and
 * widening `Explorer`'s public API for no functional gain — every
 * requirement this task must satisfy (R5.1–R5.4 tree+viewer behavior, R6/R7
 * chat+intents) is met either way. Two resizable columns — `Explorer` (its
 * own tree+viewer) on the left, `Chat` on the right — reflects that
 * structure honestly instead of forcing a 3-way split around a
 * component that isn't shaped for it.
 */
export function WorkUI({ workspace, theme, onToggleTheme }: WorkUIProps): React.JSX.Element {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 16px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0
        }}
      >
        <strong>{t('app.title')}</strong>
        <Button onClick={onToggleTheme}>
          {t('theme.toggle', theme === 'dark' ? t('theme.dark') : t('theme.light'))}
        </Button>
      </header>
      <div style={{ flex: 1, minHeight: 0 }}>
        <Resizable orientation="horizontal" style={{ height: '100%' }}>
          <ResizablePanel id="explorer" defaultSize={40} minSize={20}>
            <Explorer workspace={workspace} />
          </ResizablePanel>
          <ResizableHandle aria-label={t('workUI.resizeHandleLabel')} />
          <ResizablePanel id="chat" defaultSize={60} minSize={30}>
            <Chat workspace={workspace} />
          </ResizablePanel>
        </Resizable>
      </div>
    </div>
  )
}
