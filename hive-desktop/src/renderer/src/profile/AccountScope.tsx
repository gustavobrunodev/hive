import { useEffect, useState } from 'react'
import { Field, Input } from '@hive/design-system'
import { roleMeta, t } from '../i18n'
import { CheckIcon } from '../ui/icons'
import { roleIcon } from '../ui/roleVisuals'

interface AccountScopeProps {
  role: string | null
  userName: string | null
  onUserNameChange: (name: string) => void
}

/** Renders the role's icon element (a plain helper, not a per-render component alias — react-hooks/static-components). */
function roleIconEl(roleId: string): React.JSX.Element {
  const IconComponent = roleIcon(roleId)
  return <IconComponent size={18} />
}

/**
 * Conta — the two facts that are about the person rather than the machine.
 *
 * The **name** is committed on blur/Enter, with a transient "Salvo" check: a
 * write on every keystroke would spam persistence, and a field that saves
 * silently gives the user no way to know it did.
 *
 * The **role** is read-only here. It is chosen once, at first access, and its
 * only job afterwards is to seed the two shortcut sets — re-picking it
 * mid-flight would silently rewrite both. So the scope states which role is
 * active, and the sentence under it says where that was decided.
 */
export function AccountScope({
  role,
  userName,
  onUserNameChange
}: AccountScopeProps): React.JSX.Element {
  // Local draft so typing doesn't spam persistence — committed on blur/Enter.
  const [nameDraft, setNameDraft] = useState(userName ?? '')
  const [nameSaved, setNameSaved] = useState(false)

  // Re-sync the draft whenever the lifted value moves. Deliberately does NOT
  // clear `nameSaved`: committing a name lifts it through App and right back
  // into this prop, and clearing here would kill the "Salvo" feedback the
  // moment it appeared (its own 2 s timer clears it).
  useEffect(() => {
    // Locally-defined function invoked immediately (the repo's GuidedInstall
    // `load()` pattern) — react-hooks/set-state-in-effect.
    function syncDraft(): void {
      setNameDraft(userName ?? '')
    }
    syncDraft()
  }, [userName])

  useEffect(() => {
    if (!nameSaved) return
    const timer = window.setTimeout(() => setNameSaved(false), 2000)
    return () => window.clearTimeout(timer)
  }, [nameSaved])

  function commitName(): void {
    const trimmed = nameDraft.trim()
    if (trimmed === (userName ?? '')) return
    onUserNameChange(trimmed)
    setNameSaved(true)
  }

  const activeRole = roleMeta(role ?? 'general')

  return (
    <div className="wb-profile-section">
      <div className="wb-profile-name-row">
        <Field label={t('profile.nameFieldLabel')} description={t('profile.nameHint')}>
          <Input
            value={nameDraft}
            placeholder={t('profile.namePlaceholder')}
            onChange={(event) => setNameDraft(event.target.value)}
            onBlur={commitName}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                commitName()
              }
            }}
          />
        </Field>
        <span className="wb-profile-name-saved" data-visible={nameSaved || undefined} role="status">
          <CheckIcon size={12} />
          {t('profile.nameSavedLabel')}
        </span>
      </div>

      <div className="wb-profile-subsection">
        <h4 className="wb-profile-subtitle">{t('profile.roleSectionLabel')}</h4>
        {/* Read-only identity, not a control: no radiogroup, no hover
            affordance, nothing that invites a click that won't happen. */}
        <div className="wb-profile-role">
          <span className="wb-profile-role-icon" aria-hidden="true">
            {roleIconEl(role ?? 'general')}
          </span>
          <span className="wb-profile-role-text">
            <span className="wb-profile-role-name">{activeRole.name}</span>
            <span className="wb-profile-role-desc">{activeRole.description}</span>
          </span>
        </div>
        <p className="wb-profile-section-hint">{t('profile.roleLockedHint')}</p>
      </div>
    </div>
  )
}
