import { useEffect, useState } from 'react'
import { Button } from '@hive/design-system'
import { roleActionLabel, roleMeta, t } from '../i18n'
import { ChoiceGrid, type ChoiceOption } from '../ui/ChoiceCard'
import { SELECTABLE_ROLE_IDS, roleIcon } from '../ui/roleVisuals'

/** Structural mirror of `main/roleCatalog.ts`'s `ResolvedRoleAction` (local copy). */
interface RoleActionPreview {
  key: string
  kind: 'workflow' | 'persona'
}

interface RoleSetupProps {
  /** Called with the chosen role id once the user confirms (persisted here). */
  onComplete: (roleId: string) => void
}

/**
 * Required first-run role picker (role-personalization RP-R2). The user cannot
 * reach the work UI without choosing — no default preselect, the CTA stays
 * disabled until a card is picked. Each role card teaches what selecting does:
 * icon, name, one-line focus, and a preview of the role's top workflows +
 * specialist. Built on the `.wb-gate` shell + the `ChoiceGrid` radiogroup.
 */
export function RoleSetup({ onComplete }: RoleSetupProps): React.JSX.Element {
  const [selected, setSelected] = useState<string | null>(null)
  const [previews, setPreviews] = useState<Record<string, RoleActionPreview[]>>({})

  // Fetch each role's resolved actions so the cards preview real workflow
  // labels (the "empty state that teaches" principle applied to choice) rather
  // than the renderer duplicating the catalog. One-time, onboarding only.
  useEffect(() => {
    let cancelled = false
    Promise.all(
      SELECTABLE_ROLE_IDS.map((roleId) =>
        window.hive.profile.roleActions(roleId).then((actions) => [roleId, actions] as const)
      )
    ).then((pairs) => {
      if (!cancelled) setPreviews(Object.fromEntries(pairs))
    })
    return () => {
      cancelled = true
    }
  }, [])

  const options: ChoiceOption[] = SELECTABLE_ROLE_IDS.map((roleId) => {
    const meta = roleMeta(roleId)
    const Icon = roleIcon(roleId)
    const actions = previews[roleId] ?? []
    const workflows = actions.filter((action) => action.kind === 'workflow').slice(0, 3)
    return {
      id: roleId,
      icon: <Icon size={22} />,
      title: meta.name,
      description: meta.description,
      extra:
        workflows.length > 0 ? (
          <span className="wb-role-preview">
            {workflows.map((action) => (
              <span key={action.key} className="wb-role-preview-chip">
                {roleActionLabel(action.key)}
              </span>
            ))}
          </span>
        ) : undefined
    }
  })

  function handleContinue(): void {
    if (selected) onComplete(selected)
  }

  return (
    <main className="wb-gate">
      <div className="wb-gate-card wb-setup-card">
        <h1 className="wb-gate-title">{t('roleSetup.title')}</h1>
        <p className="wb-gate-desc">{t('roleSetup.description')}</p>

        <ChoiceGrid
          ariaLabel={t('roleSetup.title')}
          options={options}
          value={selected}
          onChange={setSelected}
        />

        <div className="wb-setup-actions">
          <Button
            cut={false}
            className="wb-btn wb-btn-lg hds-btn-primary"
            disabled={!selected}
            onClick={handleContinue}
          >
            {t('roleSetup.continueCta')}
          </Button>
        </div>
      </div>
    </main>
  )
}
