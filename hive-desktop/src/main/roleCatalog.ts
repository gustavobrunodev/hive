import type { WorkflowCommand } from './agentAdapter'
import type { ShortcutScope, ShortcutSettings } from './configStore'
import type { WorkspaceSkill } from './workflowCatalog'

/**
 * `RoleCatalog` — the source of truth for role-personalization (M9, RP-R1/R3).
 * Maps each user role to an ordered set of launchable actions: BMAD *workflows*
 * plus one "talk to your specialist" *persona* action bound to the role's BMAD
 * agent. See `.specs/features/role-personalization/{spec,design,context}.md`.
 *
 * Skill names are the **verified live** ones observed in a real `bmad-method`
 * install's `.claude/skills/` (the `bmm` module — always installed/recommended
 * per the install catalog — ships every skill named here, including the
 * `bmad-agent-*`/`bmad-tea` personas and the `bmad-testarch-*` QA skills). Only
 * live, non-deprecated names are used (e.g. `bmad-prd`/`bmad-architecture`, not
 * the deprecated `bmad-create-prd`/`bmad-create-architecture` shims). Personas
 * and testarch skills are NOT in `_bmad/_config/bmad-help.csv` (that catalog
 * lists workflow skills only), so they resolve the same way B1/B2 verified:
 * Claude Code matches the natural-language prompt against each `SKILL.md`
 * `description` — no special CLI syntax (see claudeCliAdapter.ts). RP-C4/C5.
 */

export type RoleId = 'pm' | 'tech-lead' | 'ux' | 'qa' | 'dev' | 'general'

/** The closed set of user-selectable roles, in display order (excludes the
 *  internal `general` fallback, which only backs the pre-role default). */
export const SELECTABLE_ROLES: readonly RoleId[] = ['pm', 'tech-lead', 'ux', 'qa', 'dev']

/** Whether a raw persisted string is a valid selectable role. */
export function isSelectableRole(value: string | null | undefined): value is RoleId {
  return value != null && (SELECTABLE_ROLES as readonly string[]).includes(value)
}

/** One action a role can launch. `kind` distinguishes a BMAD workflow from a
 *  "converse with the specialist agent" persona action (styled distinctly). */
export interface RoleActionDef {
  /** Stable key — the renderer keys its i18n label + icon off this. */
  key: string
  /** The BMAD skill this action invokes. */
  skill: string
  kind: 'workflow' | 'persona'
  /** The literal prompt sent to the agent: the skill's slash command
   *  (`/bmad-<skill>`), exactly what the user would type in the composer.
   *  Claude Code resolves a leading-slash prompt as a skill invocation, and
   *  the chat renders it verbatim — the shortcut IS the slash command. */
  prompt: string
}

export interface RoleDef {
  id: RoleId
  /** The role's BMAD specialist agent skill (for the persona action). */
  personaSkill?: string
  /** Defaults for the `start` scope — the hero, before the first message. */
  actions: readonly RoleActionDef[]
  /**
   * Defaults for the `during` scope — the strip above the composer inside a
   * live conversation (shortcut-scopes). Deliberately near-empty: mid-thread,
   * a row of workflow launchers is noise the user did not ask for, so only a
   * role with a genuinely conversational move gets one (today: the PM's
   * party mode). Omitted = the strip starts clean and the user fills it.
   */
  conversation?: readonly RoleActionDef[]
}

/** A role action resolved for the renderer: everything it needs to render
 *  (`key`/`kind`) and to launch via the existing `agent.runWorkflow` path.
 *  `label` (shortcut-customization): the workspace catalog's display name,
 *  set only for custom-selected skills — the renderer prefers its own pt-BR
 *  map by `key` and uses this as the fallback (role-default actions keep
 *  labels fully renderer-side, as before). */
export interface ResolvedRoleAction {
  key: string
  kind: 'workflow' | 'persona'
  command: WorkflowCommand
  label?: string
  /** skill-studio: set (true) only on shortcuts backed by a user-created
   *  skill — the renderer gives them the studio's spark icon. */
  custom?: boolean
}

function workflow(key: string, skill: string): RoleActionDef {
  return { key, skill, kind: 'workflow', prompt: `/${skill}` }
}
function persona(key: string, skill: string): RoleActionDef {
  return { key, skill, kind: 'persona', prompt: `/${skill}` }
}

/**
 * The role → actions table (spec.md "Roles → Actions"). Every action launches
 * its skill via the slash command (`prompt` = `/<skill>`), so a shortcut click
 * and a typed `/bmad-*` command are one and the same path.
 */
export const ROLE_CATALOG: Record<RoleId, RoleDef> = {
  pm: {
    id: 'pm',
    personaSkill: 'bmad-agent-pm',
    actions: [
      workflow('domain-research', 'bmad-domain-research'),
      workflow('brainstorm', 'bmad-brainstorming'),
      workflow('prd', 'bmad-prd'),
      workflow('product-brief', 'bmad-product-brief'),
      workflow('epics-stories', 'bmad-create-epics-and-stories'),
      workflow('story', 'bmad-create-story'),
      persona('persona-pm', 'bmad-agent-pm')
    ],
    // The one default in-conversation shortcut in the catalog: a PM's move
    // mid-thread is to pull the rest of the squad into the discussion, which
    // is exactly what party mode does — it takes the conversation already on
    // screen and opens it to the other agents.
    conversation: [workflow('party-mode', 'bmad-party-mode')]
  },
  'tech-lead': {
    id: 'tech-lead',
    personaSkill: 'bmad-agent-architect',
    actions: [
      workflow('architecture', 'bmad-architecture'),
      workflow('epics-stories', 'bmad-create-epics-and-stories'),
      workflow('story', 'bmad-create-story'),
      persona('persona-architect', 'bmad-agent-architect')
    ]
  },
  ux: {
    id: 'ux',
    personaSkill: 'bmad-agent-ux-designer',
    actions: [workflow('ux-spec', 'bmad-ux'), persona('persona-ux', 'bmad-agent-ux-designer')]
  },
  qa: {
    id: 'qa',
    personaSkill: 'bmad-tea',
    actions: [
      workflow('test-design', 'bmad-testarch-test-design'),
      workflow('test-automation', 'bmad-testarch-automate'),
      persona('persona-qa', 'bmad-tea')
    ]
  },
  dev: {
    id: 'dev',
    personaSkill: 'bmad-agent-dev',
    actions: [
      workflow('dev-story', 'bmad-dev-story'),
      workflow('code-review', 'bmad-code-review'),
      persona('persona-dev', 'bmad-agent-dev')
    ]
  },
  // Internal fallback only (never user-selectable). Mirrors the pre-role
  // curated intents so nothing degrades before a role is ever chosen — but the
  // required first-run step (RP-R2) means a real user always lands on one of
  // the five above.
  general: {
    id: 'general',
    actions: [
      workflow('prd', 'bmad-prd'),
      workflow('domain-research', 'bmad-domain-research'),
      workflow('brainstorm', 'bmad-brainstorming'),
      workflow('architecture', 'bmad-architecture'),
      workflow('story', 'bmad-create-story')
    ]
  }
}

/** Normalizes any persisted/passed role string to a known `RoleId`, falling
 *  back to `general` for `null`/unknown values (never throws). */
export function normalizeRole(value: string | null | undefined): RoleId {
  return value != null && value in ROLE_CATALOG ? (value as RoleId) : 'general'
}

/**
 * Resolves a role's ordered defaults for one scope into the render+launch
 * shape the renderer consumes over IPC (RP-R3.2). Each action's `command`
 * feeds the existing `agent.runWorkflow` path unchanged. Defaults to the
 * `start` scope — the hero set every caller meant before scopes existed.
 */
export function resolveRoleActions(
  role: string | null | undefined,
  scope: ShortcutScope = 'start'
): ResolvedRoleAction[] {
  const def = ROLE_CATALOG[normalizeRole(role)]
  const actions = scope === 'during' ? (def.conversation ?? []) : def.actions
  return actions.map((action) => ({
    key: action.key,
    kind: action.kind,
    command: { key: action.skill, prompt: action.prompt }
  }))
}

/**
 * Resolves one scope's shortcut set (shortcut-customization): that scope's
 * custom selection when one exists, its role defaults otherwise. Custom keys
 * are validated against the workspace catalog — prefs are global but
 * workspaces differ, so a skill not installed here is silently skipped rather
 * than rendered as a dead shortcut. An *empty* catalog (no BMAD metadata at
 * all) means the prefs can't be validated → role defaults, same as `null`
 * prefs. An empty *result* from real prefs is respected: deselecting
 * everything is a legitimate "I want a clean surface" choice.
 */
export function resolveShortcuts(
  role: string | null | undefined,
  settings: ShortcutSettings | null,
  catalog: readonly WorkspaceSkill[],
  scope: ShortcutScope = 'start'
): ResolvedRoleAction[] {
  const prefs = settings?.[scope] ?? null
  if (!prefs || catalog.length === 0) return resolveRoleActions(role, scope)

  const byKey = new Map(catalog.map((skill) => [skill.key, skill]))
  const pick = (keys: string[], kind: 'workflow' | 'persona'): ResolvedRoleAction[] =>
    keys.flatMap((key) => {
      const skill = byKey.get(key)
      if (!skill) return []
      return [
        {
          key,
          kind,
          label: skill.label,
          // The shortcut IS the slash command, same contract as role actions.
          command: { key, prompt: `/${key}` },
          // Carried only when true, so role-default shapes stay unchanged.
          ...(skill.custom ? { custom: true } : {})
        }
      ]
    })

  return [...pick(prefs.skills, 'workflow'), ...pick(prefs.agents, 'persona')]
}

/** Both scopes resolved together — one IPC round trip for the two surfaces
 *  (hero + strip) that always render side by side. */
export type ResolvedShortcutSets = Record<ShortcutScope, ResolvedRoleAction[]>

/** Resolves every scope at once (see `resolveShortcuts` for the per-scope rules). */
export function resolveAllShortcuts(
  role: string | null | undefined,
  settings: ShortcutSettings | null,
  catalog: readonly WorkspaceSkill[]
): ResolvedShortcutSets {
  return {
    start: resolveShortcuts(role, settings, catalog, 'start'),
    during: resolveShortcuts(role, settings, catalog, 'during')
  }
}
