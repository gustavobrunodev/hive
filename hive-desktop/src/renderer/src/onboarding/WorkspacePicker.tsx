import { Button } from '@hive/design-system'
import { t } from '../i18n'
import { HiveLogo } from '../ui/HiveLogo'

interface WorkspacePickerProps {
  /** Invoked when the user activates the CTA — should call `window.hive.chooseWorkspace()`. */
  onChooseWorkspace: () => void
}

/**
 * First-run gate (design.md §5.1, task T6): shown when `getWorkspace()`
 * resolves `null`, i.e. no workspace has been persisted yet. The app's
 * first impression — a welcome moment (logo, greeting, what a workspace
 * is) rather than a bare empty state — closing on the native folder picker
 * handed off via `App`; a cancelled pick just leaves this screen visible.
 */
export function WorkspacePicker({ onChooseWorkspace }: WorkspacePickerProps): React.JSX.Element {
  return (
    <div className="wb-gate">
      <div className="wb-gate-inner">
        <HiveLogo className="wb-gate-logo" />
        <h1 className="wb-gate-title">{t('onboarding.pickerTitle')}</h1>
        <p className="wb-gate-desc">{t('onboarding.pickerDescription')}</p>
        <Button cut={false} className="wb-btn-lg" onClick={onChooseWorkspace}>
          {t('onboarding.chooseWorkspaceCta')}
        </Button>
        <p className="wb-gate-note">{t('onboarding.pickerNote')}</p>
      </div>
    </div>
  )
}
