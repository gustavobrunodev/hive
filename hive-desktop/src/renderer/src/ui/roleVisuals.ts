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
  RoleUxIcon,
  SparkleIcon
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

/**
 * Workspace *skill* key → icon (shortcut-customization) — the skill-key
 * sibling of `actionIcon`'s map, sharing the same visual family so a custom
 * shortcut and its role-default twin look identical. A flat lookup table
 * (not a switch) keeps `skillIcon` itself trivial.
 */
const SKILL_ICONS: Record<string, IconComponent> = {
  'bmad-prd': IntentPrdIcon,
  'bmad-domain-research': IntentResearchIcon,
  'bmad-market-research': IntentResearchIcon,
  'bmad-technical-research': IntentResearchIcon,
  'bmad-brainstorming': IntentBrainstormIcon,
  'bmad-forge-idea': IntentBrainstormIcon,
  'bmad-architecture': IntentArchitectureIcon,
  'bmad-create-story': IntentStoryIcon,
  'bmad-spec': IntentStoryIcon,
  'bmad-product-brief': ClipboardIcon,
  'bmad-sprint-planning': ClipboardIcon,
  'bmad-sprint-status': ClipboardIcon,
  'bmad-create-epics-and-stories': LayersIcon,
  'bmad-shard-doc': LayersIcon,
  'bmad-ux': RoleUxIcon,
  'bmad-dev-story': RoleDevIcon,
  'bmad-quick-dev': RoleDevIcon,
  'bmad-dev-auto': RoleDevIcon,
  'bmad-code-review': ReviewIcon,
  'bmad-review-adversarial-general': ReviewIcon,
  'bmad-review-edge-case-hunter': ReviewIcon,
  'bmad-editorial-review-prose': ReviewIcon,
  'bmad-editorial-review-structure': ReviewIcon,
  'bmad-checkpoint-preview': ReviewIcon,
  'bmad-testarch-test-review': ReviewIcon,
  'bmad-testarch-automate': AutomationIcon,
  'bmad-testarch-ci': AutomationIcon,
  'bmad-qa-generate-e2e-tests': AutomationIcon
}

/** Icon for a workspace skill key; testarch/testing skills read as the beaker, anything unknown as a generic document. */
export function skillIcon(skillKey: string): IconComponent {
  const direct = SKILL_ICONS[skillKey]
  if (direct) return direct
  if (skillKey.startsWith('bmad-testarch-') || skillKey === 'bmad-teach-me-testing') {
    return BeakerIcon
  }
  return FileTextIcon
}

/**
 * Icon for a resolved shortcut action (role defaults AND custom selections):
 * persona shortcuts always read as a conversation; a user-created skill
 * (skill-studio's `custom` flag) reads as the studio's spark; other workflow
 * shortcuts try the role-action key first, then the skill key (custom
 * shortcuts carry the BMAD skill name as their key).
 */
export function shortcutIcon(action: {
  key: string
  kind: 'workflow' | 'persona'
  custom?: boolean
}): IconComponent {
  if (action.kind === 'persona') return PersonaChatIcon
  if (action.custom) return SparkleIcon
  const byAction = actionIcon(action.key)
  return byAction === FileTextIcon ? skillIcon(action.key) : byAction
}
