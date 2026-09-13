import type { ReactNode } from 'react'
import { Alert } from '@hive/design-system'
import { t } from '../i18n'
import { AlertTriangleIcon } from '../ui/icons'

/**
 * The banner under the composer when a turn dies: what stopped, and the one
 * thing that would start it again.
 *
 * ## Why it is a component and not three `<Alert>`s inline
 *
 * There are three readings of a dead turn — a credential lane that can be
 * repaired from here (Claude's account, the AWS session) and everything else,
 * which keeps the CLI's own words. They are the same object with different
 * copy, and writing them out three times is how the two repairable ones
 * drifted: both were passing their flex layout to `Alert`'s **root**, where the
 * only children are the icon slot and the body wrapper. The row's `gap` was
 * therefore spent between an absent icon and one box, while the sentence and
 * the button — the actual siblings, one level down inside
 * `.hds-alert-description` — sat with nothing between them at all and rendered
 * as `…a resposta parou.Conectar conta`.
 *
 * So the layout lives on `.wb-turnfix`'s description (see workbench.css) and
 * every caller goes through here.
 *
 * ## Why the CTA has a busy state
 *
 * Because the repair leaves the app. Signing in opens a browser, and the user
 * comes back to Hive with a code; a button that looks exactly as it did before
 * they left is the app saying nothing happened. While the sign-in is in flight
 * the control names what it is doing and stops taking clicks — a second
 * `claude auth login` racing the first is how a landed sign-in reports failure.
 */
export interface TurnErrorNoticeProps {
  /** The sentence — the app's reading of the failure, or the CLI's own words. */
  text: string
  /** Leading glyph. Defaults to the generic failure mark. */
  icon?: ReactNode
  /** The repair. Omitted when the failure has none from here. */
  action?: {
    label: string
    /** What the control says while the repair is in flight. */
    busyLabel?: string
    onClick: () => void
  } | null
  /** The repair is running right now — the control says so and refuses a second press. */
  busy?: boolean
}

export function TurnErrorNotice({
  text,
  icon,
  action,
  busy = false
}: TurnErrorNoticeProps): React.JSX.Element {
  return (
    <Alert
      variant="danger"
      role="alert"
      className="wb-composer-error wb-turnfix"
      icon={icon ?? <AlertTriangleIcon size={16} />}
    >
      <span className="wb-turnfix-text">{text}</span>
      {action && (
        <button
          type="button"
          className="wb-turnfix-cta"
          // `aria-disabled`, not `disabled`: a control that leaves the tab
          // order the moment it is pressed takes the focus with it, and the
          // keyboard user is dropped back at the top of the document in the
          // middle of the one flow that most needs them to stay put.
          aria-disabled={busy || undefined}
          onClick={() => {
            if (!busy) action.onClick()
          }}
        >
          {busy && <span className="wb-turnfix-spinner" aria-hidden="true" />}
          {busy ? (action.busyLabel ?? t('claude.connecting')) : action.label}
        </button>
      )}
    </Alert>
  )
}
