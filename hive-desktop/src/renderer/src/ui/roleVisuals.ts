import {
  AutomationIcon,
  BeakerIcon,
  ClipboardIcon,
  FileTextIcon,
  IntentArchitectureIcon,
  IntentBrainstormIcon,
  IntentPrdIcon,
  IntentResearchIcon,
  IntentStoryIcon,
  LayersIcon,
  PersonaChatIcon,
  ReviewIcon,
  RoleDevIcon,
  RolePmIcon,
  RoleQaIcon,
  RoleTechLeadIcon,
  RoleUxIcon
} from './icons'

type IconComponent = (props: { size?: number }) => React.JSX.Element

/**
 * The user-selectable roles, in display order (renderer-side mirror of
 * `main/roleCatalog.ts`'s `SELECTABLE_ROLES` — the renderer tsconfig doesn't
 * include `src/main`, same local-mirror convention `chat/Chat.tsx` uses for
 * `AgentCapabilities`). Labels/descriptions come from `roleMeta()` (i18n).
 */
export const SELECTABLE_ROLE_IDS = ['pm', 'tech-lead', 'ux', 'qa', 'dev'] as const
export type SelectableRoleId = (typeof SELECTABLE_ROLE_IDS)[number]

/** Maps a `RoleId` to its picker/rail icon (role-personalization RP-R1.2). */
export function roleIcon(roleId: string): IconComponent {
  switch (roleId) {
    case 'pm':
      return RolePmIcon
    case 'tech-lead':
      return RoleTechLeadIcon
    case 'ux':
      return RoleUxIcon
    case 'qa':
      return RoleQaIcon
    case 'dev':
      return RoleDevIcon
    default:
      return RolePmIcon
  }
}

/**
 * Maps a role-action key (main/roleCatalog.ts) to its icon. Persona actions
 * (`persona-*`) share the conversation icon; unknown keys fall back to a
 * generic document icon.
 */
export function actionIcon(actionKey: string): IconComponent {
  if (actionKey.startsWith('persona-')) return PersonaChatIcon
  switch (actionKey) {
    case 'domain-research':
      return IntentResearchIcon
    case 'brainstorm':
      return IntentBrainstormIcon
    case 'prd':
      return IntentPrdIcon
    case 'product-brief':
      return ClipboardIcon
    case 'epics-stories':
      return LayersIcon
    case 'story':
      return IntentStoryIcon
    case 'architecture':
      return IntentArchitectureIcon
    case 'ux-spec':
      return RoleUxIcon
    case 'test-design':
      return BeakerIcon
    case 'test-automation':
      return AutomationIcon
    case 'dev-story':
      return RoleDevIcon
    case 'code-review':
      return ReviewIcon
    default:
      return FileTextIcon
  }
}
