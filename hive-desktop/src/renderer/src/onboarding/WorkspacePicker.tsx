import { Button, Empty } from '@hive/design-system'
import { t } from '../i18n'

interface WorkspacePickerProps {
  /** Invoked when the user activates the CTA — should call `window.hive.chooseWorkspace()`. */
  onChooseWorkspace: () => void
}

/**
 * First-run gate (design.md §5.1, task T6): shown when `getWorkspace()`
 * resolves `null`, i.e. no workspace has been persisted yet. Composes the DS
 * `Empty` shell with a `Button` CTA that hands off to the native folder
 * picker in `App`; a cancelled pick just leaves this screen visible.
 */
export function WorkspacePicker({ onChooseWorkspace }: WorkspacePickerProps): React.JSX.Element {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24
      }}
    >
      <Empty
        title={t('onboarding.pickerTitle')}
        description={t('onboarding.pickerDescription')}
        action={<Button onClick={onChooseWorkspace}>{t('onboarding.chooseWorkspaceCta')}</Button>}
      />
    </div>
  )
}
